import { HandleTransaction, TransactionEvent, keccak256 } from "forta-agent";
import { TestTransactionEvent } from "forta-agent-tools/lib/test";
import {
  getFindingInstance,
  getEventMetadataFromAbi,
  HUBPOOL_MONITORED_EVENTS,
  SPOKEPOOL_MONITORED_EVENTS,
  ARB_SPOKEPOOL_MONITORED_EVENTS,
  POLYGON_SPOKEPOOL_MONITORED_EVENTS,
  OP_SPOKEPOOL_MONITORED_EVENTS,
} from "./utils";
import { provideHandleTransaction } from "./agent";
import { createAddress, NetworkManager } from "forta-agent-tools";
import { NetworkDataInterface } from "./network";

const RANDOM_ADDRESSES = [createAddress("0x12"), createAddress("0x54")];
const TRANSFER_EVENT_ABI = "event Transfer(address,uint)";
const TEST_HUBPOOL_ADDR: string = createAddress("0x23");
const TEST_SPOKEPOOL_ADDR: string = createAddress("0x46");
const EMPTY_ADDRESS = createAddress("0x00");
const MOCK_NM_DATA: Record<number, NetworkDataInterface> = {
  0: {
    spokePoolAddr: TEST_SPOKEPOOL_ADDR,
    hubPoolAddr: TEST_HUBPOOL_ADDR,
    monitoredSpokePoolEvents: SPOKEPOOL_MONITORED_EVENTS,
  },
};
const MOCK_MAINNET_SPOKEPOOL_NM_DATA: Record<number, NetworkDataInterface> = {
  0: { spokePoolAddr: TEST_SPOKEPOOL_ADDR, monitoredSpokePoolEvents: SPOKEPOOL_MONITORED_EVENTS },
};
const MOCK_ARBITRUM_NM_DATA: Record<number, NetworkDataInterface> = {
  0: { spokePoolAddr: TEST_SPOKEPOOL_ADDR, monitoredSpokePoolEvents: ARB_SPOKEPOOL_MONITORED_EVENTS },
};
const MOCK_OPTIMISM_NM_DATA: Record<number, NetworkDataInterface> = {
  0: { spokePoolAddr: TEST_SPOKEPOOL_ADDR, monitoredSpokePoolEvents: OP_SPOKEPOOL_MONITORED_EVENTS },
};
const MOCK_POLYGON_NM_DATA: Record<number, NetworkDataInterface> = {
  0: { spokePoolAddr: TEST_SPOKEPOOL_ADDR, monitoredSpokePoolEvents: POLYGON_SPOKEPOOL_MONITORED_EVENTS },
};

describe("Detection of single HubPool configuration change events on L1", () => {
  const networkManagerTest = new NetworkManager(MOCK_NM_DATA, 0);

  const handleTransaction: HandleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("returns empty findings if there is no relevant event", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent();
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("doesn't return a finding if a relevant event is emitted from a non-HubPool address", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[0], RANDOM_ADDRESSES[0], ["123"]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("doesn't return a finding if an irrelevant event is made from the HubPool address", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(TRANSFER_EVENT_ABI, TEST_HUBPOOL_ADDR, [RANDOM_ADDRESSES[0], "123"]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event LivenessSet", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[0], TEST_HUBPOOL_ADDR, ["123"]);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[0], ["123"]);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event ProtocolFeeCaptureSet", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], "123"];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[1], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[1], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event Paused", async () => {
    const passedParams = [true];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[2], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[2], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event BondSet", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], "123"];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[3], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[3], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event IdentifierSet", async () => {
    const passedParams = [keccak256("hello world")];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[4], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[4], [passedParams[0].toString()]);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event CrossChainContractsSet", async () => {
    const passedParams = ["123", RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[5], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[5], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event L1TokenEnabledForLiquidityProvision", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[6], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[6], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event L2TokenDisabledForLiquidityProvision", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[6], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[6], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event SetPoolRebalanceRoute", async () => {
    const passedParams = ["123", RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[8], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[8], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from HubPool : Event SetEnableDepositRoute", async () => {
    const passedParams = ["123", "456", RANDOM_ADDRESSES[1], true];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[9], TEST_HUBPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[9], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(true, thisFindingMetadata)]);
  });
});

describe("Detection of multiple HubPool configuration change events on L1", () => {
  const networkManagerTest = new NetworkManager(MOCK_NM_DATA, 0);

  const handleTransaction: HandleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("returns N findings for N HubPool related events (N>=1)", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];

    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[7], TEST_HUBPOOL_ADDR, passedParams)
      .addEventLog(HUBPOOL_MONITORED_EVENTS[0], TEST_HUBPOOL_ADDR, ["123"]);

    const thisFindingMetadataEvent1 = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[7], passedParams);
    const thisFindingMetadataEvent2 = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[0], ["123"]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([
      getFindingInstance(true, thisFindingMetadataEvent1),
      getFindingInstance(true, thisFindingMetadataEvent2),
    ]);
  });

  it("returns N findings for N SpokePool related events (N>=1)", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[0], TEST_SPOKEPOOL_ADDR, [RANDOM_ADDRESSES[0]])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[3], TEST_SPOKEPOOL_ADDR, ["123"])
      .addEventLog(TRANSFER_EVENT_ABI, TEST_SPOKEPOOL_ADDR, [RANDOM_ADDRESSES[0], "123"]);

    const thisFindingMetadataEvent1 = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[0], [RANDOM_ADDRESSES[0]]);
    const thisFindingMetadataEvent2 = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[3], ["123"]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([
      getFindingInstance(false, thisFindingMetadataEvent1),
      getFindingInstance(false, thisFindingMetadataEvent2),
    ]);
  });

  it("returns findings when both HubPool and SpokePool configurations change in one transaction", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[0], TEST_SPOKEPOOL_ADDR, [RANDOM_ADDRESSES[0]])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[7], TEST_HUBPOOL_ADDR, [RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]])
      .addEventLog(HUBPOOL_MONITORED_EVENTS[0], TEST_HUBPOOL_ADDR, ["123"]);

    const thisFindingMetadataEvent1 = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[7], [
      RANDOM_ADDRESSES[0],
      RANDOM_ADDRESSES[1],
    ]);
    const thisFindingMetadataEvent2 = getEventMetadataFromAbi(HUBPOOL_MONITORED_EVENTS[0], ["123"]);
    const thisFindingMetadataEvent3 = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[0], [RANDOM_ADDRESSES[0]]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([
      getFindingInstance(true, thisFindingMetadataEvent1),
      getFindingInstance(true, thisFindingMetadataEvent2),
      getFindingInstance(false, thisFindingMetadataEvent3),
    ]);
  });
});

describe("(Non)Detection of HubPool events on L2", () => {
  const networkManagerTest = new NetworkManager(MOCK_MAINNET_SPOKEPOOL_NM_DATA, 0);

  const handleTransaction: HandleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("doesn't return any findings for HubPool relevant events on L2's", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(EMPTY_ADDRESS)
      .addEventLog(HUBPOOL_MONITORED_EVENTS[0], EMPTY_ADDRESS, ["123"]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("returns findings only related to SpokePools on L2's", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(EMPTY_ADDRESS)
      .addEventLog(HUBPOOL_MONITORED_EVENTS[0], EMPTY_ADDRESS, ["123"]) // no finding shall be generated for this event
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[0], TEST_SPOKEPOOL_ADDR, [RANDOM_ADDRESSES[0]]);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[0], [RANDOM_ADDRESSES[0]]);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });
});

describe("Base SpokePool configuration changes detection bot", () => {
  const networkManagerTest = new NetworkManager(MOCK_MAINNET_SPOKEPOOL_NM_DATA, 0);

  const handleTransaction: HandleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("returns empty findings if there is no relevant event", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent();
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("doesn't return a finding if a relevant event is emitted from a non-SpokePool address", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[0], RANDOM_ADDRESSES[0], [RANDOM_ADDRESSES[1]]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("doesn't return a finding if an irrelevant event is made from the SpokePool address", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(TRANSFER_EVENT_ABI, TEST_SPOKEPOOL_ADDR, [RANDOM_ADDRESSES[0], "123"]);

    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it("returns a finding for emitted monitored event from SpokePool : Event SetXDomainAdmin", async () => {
    const passedParams = [RANDOM_ADDRESSES[0]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[0], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[0], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from SpokePool : Event SetHubPool", async () => {
    const passedParams = [RANDOM_ADDRESSES[0]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[1], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[1], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from SpokePool : Event EnabledDepositRoute", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], "123", true];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[2], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[2], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from SpokePool : Event EnabledDepositRoute", async () => {
    const passedParams = ["123"];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(SPOKEPOOL_MONITORED_EVENTS[3], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(SPOKEPOOL_MONITORED_EVENTS[3], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });
});

describe("Arbitrum SpokePool configuration changes detection bot", () => {
  let networkManagerTest = new NetworkManager(MOCK_ARBITRUM_NM_DATA, 0);
  let handleTransaction: HandleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("returns a finding for emitted monitored event from Arbitrum SpokePool : Event SetL2GatewayRouter", async () => {
    const passedParams = [RANDOM_ADDRESSES[0]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(ARB_SPOKEPOOL_MONITORED_EVENTS[4], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(ARB_SPOKEPOOL_MONITORED_EVENTS[4], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from Arbitrum SpokePool : Event WhitelistedTokens", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(ARB_SPOKEPOOL_MONITORED_EVENTS[5], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(ARB_SPOKEPOOL_MONITORED_EVENTS[5], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });
});

describe("Optimism SpokePool configuration changes detection bot", () => {
  let networkManagerTest = new NetworkManager(MOCK_OPTIMISM_NM_DATA, 0);
  let handleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("returns a finding for emitted monitored event from Arbitrum SpokePool : Event SetL1Gas", async () => {
    const passedParams = ["9"];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(OP_SPOKEPOOL_MONITORED_EVENTS[4], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(OP_SPOKEPOOL_MONITORED_EVENTS[4], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from Arbitrum SpokePool : Event WhitelistedTokens", async () => {
    const passedParams = [RANDOM_ADDRESSES[0], RANDOM_ADDRESSES[1]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(OP_SPOKEPOOL_MONITORED_EVENTS[5], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(OP_SPOKEPOOL_MONITORED_EVENTS[5], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });
});

describe("Polygon SpokePool configuration changes detection bot", () => {
  let networkManagerTest = new NetworkManager(MOCK_POLYGON_NM_DATA, 0);
  let handleTransaction = provideHandleTransaction(HUBPOOL_MONITORED_EVENTS, networkManagerTest);

  it("returns a finding for emitted monitored event from Polygon SpokePool : Event SetFxChild", async () => {
    const passedParams = [RANDOM_ADDRESSES[0]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(POLYGON_SPOKEPOOL_MONITORED_EVENTS[4], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(POLYGON_SPOKEPOOL_MONITORED_EVENTS[4], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });

  it("returns a finding for emitted monitored event from Polygon SpokePool : Event SetPolygonTokenBridger", async () => {
    const passedParams = [RANDOM_ADDRESSES[0]];
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .setFrom(RANDOM_ADDRESSES[1])
      .addEventLog(POLYGON_SPOKEPOOL_MONITORED_EVENTS[5], TEST_SPOKEPOOL_ADDR, passedParams);

    const findings = await handleTransaction(txEvent);
    const thisFindingMetadata = getEventMetadataFromAbi(POLYGON_SPOKEPOOL_MONITORED_EVENTS[5], passedParams);
    expect(findings).toStrictEqual([getFindingInstance(false, thisFindingMetadata)]);
  });
});
