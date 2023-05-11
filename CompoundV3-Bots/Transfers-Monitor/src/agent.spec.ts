import {
  FindingType,
  FindingSeverity,
  Finding,
  HandleTransaction,
  TransactionEvent,
} from "forta-agent";
import { SUPPLY_ABI, TRANSFER_ABI, BUY_COLLATERAL_ABI } from "./constants";
import { provideHandleTransaction } from "./agent";
import { TestTransactionEvent } from "forta-agent-tools/lib/test";
import { Interface } from "ethers/lib/utils";
import { createAddress } from "forta-agent-tools";

function mockCreateTransferFinding(
  comet: string,
  sender: string,
  amount: number | string
): Finding {
  return Finding.from({
    name: "Base token transfer on Comet contract",
    description:
      "A base token transfer was done to a Comet contract, without a matching Supply, BuyCollateral action",
    alertId: "COMP2-3",
    protocol: "Compound",
    type: FindingType.Info,
    severity: FindingSeverity.Medium,
    metadata: {
      cometContract: comet,
      sender,
      transferAmount: amount.toString(),
    },
  });
}

const mockGetFn = (id: string) => {
  if (id == "cometAddresses") return TEST_ADDRESSES;
  else return BASE_TOKENS;
};

const TEST_ADDRESSES = [
  createAddress("0x11"),
  createAddress("0x12"),
  createAddress("0x13"),
  createAddress("0x14"),
];
const BASE_TOKENS = [
  createAddress("0x21"),
  createAddress("0x22"),
  createAddress("0x23"),
  createAddress("0x24"),
];
const TEST_USERS = [
  createAddress("0x31"),
  createAddress("0x32"),
  createAddress("0x33"),
  createAddress("0x34"),
];

// const mockProvider: MockEthersProvider = new MockEthersProvider();
const TRANSFER_IFACE = new Interface([TRANSFER_ABI]);
const COMET_IFACE = new Interface([SUPPLY_ABI, BUY_COLLATERAL_ABI]);

const mockNetworkManager = {
  cometAddresses: TEST_ADDRESSES,
  networkMap: {},
  setNetwork: jest.fn(),
  get: mockGetFn as any,
};

describe("COMP2 - Transfers Monitor Bot Tests suite", () => {
  let handleTransaction: HandleTransaction;

  beforeEach(async () => {
    handleTransaction = provideHandleTransaction(mockNetworkManager as any);
  });

  it("returns empty findings when no event is emitted", async () => {
    const txEvent = new TestTransactionEvent().setBlock(1);

    expect(await handleTransaction(txEvent)).toStrictEqual([]);
  });

  it("returns empty findings if Transfer happens in a non-baseToken contract", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        createAddress("0xffe"),
        [TEST_USERS[0], TEST_ADDRESSES[0], 200]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([]);
  });

  it("returns empty findings if Transfer happens in a baseToken of a different comet contract", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[1],
        [TEST_USERS[0], TEST_ADDRESSES[0], 200]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([]);
  });

  it("returns empty findings if Transfer target is not a comet contract", async () => {
    const txEvent: TransactionEvent =
      new TestTransactionEvent().addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[0],
        [TEST_USERS[0], createAddress("0xffa"), 200]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([]);
  });

  it("returns empty findings if Transfer event was emitted with matching Supply event", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 500]
      )
      .addEventLog(
        COMET_IFACE.getEvent("Supply"),
        TEST_ADDRESSES[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 500]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([]);
  });

  it("returns empty findings if Transfer event was emitted with matching BuyCollateral event", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 500]
      )
      .addEventLog(
        COMET_IFACE.getEvent("BuyCollateral"),
        TEST_ADDRESSES[0],
        [TEST_USERS[0], BASE_TOKENS[1], 500, 0]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([]);
  });

  it("returns a finding if Transfer event was emitted with no Supply BuyCollateral events", async () => {
    const txEvent: TransactionEvent =
      new TestTransactionEvent().addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 500]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([
      mockCreateTransferFinding(TEST_ADDRESSES[0], TEST_USERS[0], 500),
    ]);
  });

  it("returns a finding if Transfer event was emitted with matching Supply event but different amount", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 500]
      )
      .addEventLog(
        COMET_IFACE.getEvent("Supply"),
        TEST_ADDRESSES[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 200]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([
      mockCreateTransferFinding(TEST_ADDRESSES[0], TEST_USERS[0], 500),
    ]);
  });

  it("returns a finding if Transfer event was emitted with matching BuyCollateral event but different amount", async () => {
    const txEvent: TransactionEvent = new TestTransactionEvent()
      .addEventLog(
        TRANSFER_IFACE.getEvent("Transfer"),
        BASE_TOKENS[0],
        [TEST_USERS[0], TEST_ADDRESSES[0], 500]
      )
      .addEventLog(
        COMET_IFACE.getEvent("BuyCollateral"),
        TEST_ADDRESSES[0],
        [TEST_USERS[0], BASE_TOKENS[1], 200, 0]
      );

    expect(await handleTransaction(txEvent)).toStrictEqual([
      mockCreateTransferFinding(TEST_ADDRESSES[0], TEST_USERS[0], 500),
    ]);
  });

  it("returns one finding when multiple transfers happen but one does not have a Supply/BuyCollateral matching event", async () => {
    for (let i = 0; i < TEST_ADDRESSES.length; i++) {
      const txEvent: TransactionEvent = new TestTransactionEvent()
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[0], TEST_ADDRESSES[i], 500]
        )
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[1], TEST_ADDRESSES[i], 600]
        )
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[2], TEST_ADDRESSES[i], 700]
        )
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[3], TEST_ADDRESSES[i], 800]
        )
        .addEventLog(
          COMET_IFACE.getEvent("Supply"),
          TEST_ADDRESSES[i],
          [TEST_USERS[0], TEST_ADDRESSES[i], 500]
        )
        .addEventLog(
          COMET_IFACE.getEvent("Supply"),
          TEST_ADDRESSES[i],
          [TEST_USERS[1], TEST_ADDRESSES[i], 600]
        )
        .addEventLog(
          COMET_IFACE.getEvent("BuyCollateral"),
          TEST_ADDRESSES[i],
          [TEST_USERS[2], BASE_TOKENS[0], 700, 0]
        );

      expect(await handleTransaction(txEvent)).toStrictEqual([
        mockCreateTransferFinding(TEST_ADDRESSES[i], TEST_USERS[3], 800),
      ]);
    }
  });

  it("returns multiple findings for different Transfer events", async () => {
    for (let i = 0; i < TEST_ADDRESSES.length; i++) {
      const txEvent: TransactionEvent = new TestTransactionEvent()
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[0], TEST_ADDRESSES[i], 500]
        )
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[0], TEST_ADDRESSES[i], 500]
        )
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[2], TEST_ADDRESSES[i], 700]
        )
        .addEventLog(
          TRANSFER_IFACE.getEvent("Transfer"),
          BASE_TOKENS[i],
          [TEST_USERS[3], TEST_ADDRESSES[i], 800]
        )
        .addEventLog(
          COMET_IFACE.getEvent("Supply"),
          TEST_ADDRESSES[i],
          [TEST_USERS[0], TEST_ADDRESSES[i], 500]
        );

      expect(await handleTransaction(txEvent)).toStrictEqual([
        mockCreateTransferFinding(TEST_ADDRESSES[i], TEST_USERS[0], 500),
        mockCreateTransferFinding(TEST_ADDRESSES[i], TEST_USERS[2], 700),
        mockCreateTransferFinding(TEST_ADDRESSES[i], TEST_USERS[3], 800),
      ]);
    }
  });
});
