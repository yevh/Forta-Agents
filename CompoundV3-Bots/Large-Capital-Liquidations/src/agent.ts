import { ethers, Finding, getEthersProvider, Initialize, HandleBlock, BlockEvent } from "forta-agent";
import Bottleneck from "bottleneck";
import { MulticallContract, MulticallProvider, NetworkManager } from "forta-agent-tools";

import CONFIG from "./agent.config";
import { COMET_ABI } from "./constants";
import { AgentState, BorrowPosition, NetworkData } from "./utils";
import { createAbsorbFinding, createLiquidationRiskFinding } from "./finding";

function addPositionsToMonitoringList(
  state: AgentState,
  comet: string,
  monitoringListLength: number,
  positions: BorrowPosition[]
) {
  const monitoringList = state.monitoringLists[comet] || [];
  const monitoringListMap = Object.fromEntries(monitoringList.map((el, idx) => [el.borrower, idx]));

  positions.forEach((position) => {
    if (monitoringListMap[position.borrower] !== undefined) {
      monitoringList[monitoringListMap[position.borrower]] = position;
    } else {
      monitoringList.push(position);
    }
  });

  // ascending sorting because borrows are negative
  monitoringList.sort((a, b) => (a.principal.lt(b.principal) ? -1 : a.principal.eq(b.principal) ? 0 : 1));

  state.monitoringLists[comet] = monitoringList.slice(0, monitoringListLength);
}

function checkMonitoringListHealth(
  comet: string,
  monitoringListLength: number,
  threshold: ethers.BigNumber,
  baseBorrowIndex: ethers.BigNumber,
  baseIndexScale: ethers.BigNumber
) {
  const monitoringList = state.monitoringLists[comet];

  if (monitoringList.length < monitoringListLength) {
    return;
  }

  const minBalance = borrowLiquidity(monitoringList[monitoringList.length - 1], baseBorrowIndex, baseIndexScale);

  if (minBalance.gte(threshold)) {
    console.warn(
      `Monitoring list length ${monitoringListLength} is too short for the threshold ${threshold} for Comet ${comet}`
    );
  }
}

function borrowLiquidity(
  position: BorrowPosition,
  baseBorrowIndex: ethers.BigNumber,
  baseIndexScale: ethers.BigNumber
) {
  return position.principal.isNegative()
    ? position.principal.mul(-1).mul(baseBorrowIndex).div(baseIndexScale)
    : ethers.BigNumber.from(0);
}

export const provideInitializeTask = (
  state: AgentState,
  networkManager: NetworkManager<NetworkData>,
  multicallProvider: MulticallProvider,
  provider: ethers.providers.JsonRpcProvider
): (() => Promise<void>) => {
  const blockRange = 2_000;
  const iface = new ethers.utils.Interface(COMET_ABI);

  const scanState = networkManager.get("cometContracts").map((comet) => ({
    comet: new ethers.Contract(comet.address, iface, provider),
    multicallComet: new MulticallContract(comet.address, iface.fragments as ethers.utils.Fragment[]),
    blockCursor: comet.deploymentBlock,
    monitoringListLength: comet.monitoringListLength,
    threshold: ethers.BigNumber.from(comet.baseLargeThreshold),
  }));

  return async () => {
    await Promise.all(
      scanState.map(async ({ comet, multicallComet, blockCursor, threshold, monitoringListLength }) => {
        const bottleneck = new Bottleneck({
          minTime: 1_000,
        });

        const baseIndexScale = await comet.baseIndexScale();
        const { baseBorrowIndex } = await comet.totalsBasic();

        while (!state.lastHandledBlock || blockCursor < state.lastHandledBlock) {
          const withdrawLogs = await bottleneck.schedule(() =>
            comet.queryFilter("Withdraw", blockCursor, blockCursor + blockRange - 1)
          );

          const borrowers = Array.from(new Set(withdrawLogs.map((log) => log.args!.to)));
          const [success, userBasics] = (await multicallProvider.all(
            borrowers.map((borrower) => multicallComet.userBasic(borrower)),
            blockCursor + blockRange - 1,
            100
          )) as [boolean, { principal: ethers.BigNumber }[]];

          if (!success) throw new Error("Error while fetching user principals");

          addPositionsToMonitoringList(
            state,
            comet.address,
            monitoringListLength,
            borrowers.map((borrower, idx) => ({
              borrower,
              principal: userBasics[idx].principal,
              alertedAt: 0,
            }))
          );

          blockCursor += blockRange;
          console.log(
            `Scanned withdrawals on Comet ${comet.address} from block ${blockCursor} to ${blockCursor + blockRange - 1}`
          );
        }

        checkMonitoringListHealth(comet.address, monitoringListLength, threshold, baseBorrowIndex, baseIndexScale);
      })
    );

    console.log("Finished initialize task");
    state.initialized = true;
  };
};

export const provideInitialize = (
  state: AgentState,
  networkManager: NetworkManager<NetworkData>,
  multicallProvider: MulticallProvider,
  provider: ethers.providers.JsonRpcProvider
): Initialize => {
  return async () => {
    await networkManager.init(provider);
    await multicallProvider.init();

    const initializeTask = provideInitializeTask(state, networkManager, multicallProvider, provider);
    initializeTask();
  };
};

export const provideHandleBlock = (
  state: AgentState,
  networkManager: NetworkManager<NetworkData>,
  multicallProvider: MulticallProvider,
  provider: ethers.providers.JsonRpcProvider
): HandleBlock => {
  const iface = new ethers.utils.Interface(COMET_ABI);

  const cometContracts = networkManager.get("cometContracts").map((comet) => ({
    comet: new ethers.Contract(comet.address, iface, provider),
    multicallComet: new MulticallContract(comet.address, iface.fragments as ethers.utils.Fragment[]),
    threshold: ethers.BigNumber.from(comet.baseLargeThreshold),
    monitoringListLength: comet.monitoringListLength,
  }));

  return async (blockEvent: BlockEvent): Promise<Finding[]> => {
    if (!state.initialized) {
      state.lastHandledBlock = blockEvent.blockNumber;
      return [];
    }

    const chainId = networkManager.getNetwork();
    const logs = (
      await provider.getLogs({
        topics: [["Supply", "Withdraw", "AbsorbDebt"].map((el) => iface.getEventTopic(el))],
        blockHash: blockEvent.blockHash,
      })
    ).map((log) => ({ ...log, ...iface.parseLog(log) }));

    const findings: Finding[] = [];

    await Promise.all(
      cometContracts.map(async ({ comet, multicallComet, threshold, monitoringListLength }) => {
        const cometLogs = logs.filter((log) => log.address.toLowerCase() === comet.address.toLowerCase());
        const baseIndexScale = await comet.baseIndexScale();
        const { baseBorrowIndex } = await comet.totalsBasic();

        let changedPositions = new Set<string>();

        cometLogs.forEach((log) => {
          switch (log.name) {
            case "Supply":
              changedPositions.add(log.args.dst);
              break;
            case "Withdraw":
              changedPositions.add(log.args.src);
              break;
            case "AbsorbDebt":
              if ((log.args.basePaidOut as ethers.BigNumber).gte(threshold)) {
                findings.push(createAbsorbFinding(comet.address, log.args.borrower, log.args.basePaidOut, chainId));
              }
              changedPositions.add(log.args.borrower);
              break;
          }
        });

        const borrowers = Array.from(changedPositions);

        const [userBasicsSuccess, userBasics] = (await multicallProvider.all(
          Array.from(changedPositions).map((borrower) => multicallComet.userBasic(borrower)),
          blockEvent.block.number,
          100
        )) as [boolean, { principal: ethers.BigNumber }[]];

        if (!userBasicsSuccess) throw new Error("Error while fetching user principals");

        addPositionsToMonitoringList(
          state,
          comet.address,
          monitoringListLength,
          borrowers.map((borrower, idx) => ({
            borrower,
            principal: userBasics[idx].principal,
            alertedAt: 0,
          }))
        );

        const largePositions = state.monitoringLists[comet.address].filter((entry) =>
          borrowLiquidity(entry, baseBorrowIndex, baseIndexScale).gte(threshold)
        );

        let [borrowerStatusesSuccess, borrowerStatuses] = await multicallProvider.all(
          largePositions.map((entry) => multicallComet.isBorrowCollateralized(entry.borrower)),
          blockEvent.block.number,
          100
        );

        if (!borrowerStatusesSuccess) throw new Error("Error while trying to fetch borrow collateralization status");

        largePositions.forEach((entry, idx) => {
          const isBorrowCollateralized = borrowerStatuses[idx];
          if (
            !isBorrowCollateralized &&
            blockEvent.block.timestamp - entry.alertedAt > networkManager.get("alertInterval")
          ) {
            findings.push(
              createLiquidationRiskFinding(
                comet.address,
                entry.borrower,
                borrowLiquidity(entry, baseBorrowIndex, baseIndexScale),
                chainId
              )
            );
            entry.alertedAt = blockEvent.block.timestamp;
          }
        });

        checkMonitoringListHealth(comet.address, monitoringListLength, threshold, baseBorrowIndex, baseIndexScale);
      })
    );

    return findings;
  };
};

const networkManager = new NetworkManager(CONFIG);
const multicallProvider = new MulticallProvider(getEthersProvider());
const state: AgentState = {
  initialized: false,
  monitoringLists: {},
  lastHandledBlock: 0,
};

export default {
  initialize: provideInitialize(state, networkManager, multicallProvider, getEthersProvider()),
  handleBlock: provideHandleBlock(state, networkManager, multicallProvider, getEthersProvider()),
};