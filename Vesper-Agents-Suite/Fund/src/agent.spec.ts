import { Finding, HandleTransaction } from "forta-agent";
import agent from "./agent";
import { defaultList } from "./utils";
import Mock from "./mock";

describe("high gas agent", () => {
  let handleTransaction: HandleTransaction;

  beforeAll(() => {});

  it("A new transaction gets received. The condition for tokenfunds gives false", async () => {
    const txEvent = {
      addresses: { "0xBA680a906d8f624a5F11fba54D3C672f09F26e47": true },
    };

    let mockWeb3 = {
      eth: {
        Contract: Mock.build_Mock(1000, 150, 800, 10),
      },
    } as any;

    handleTransaction = agent.provideHandleFunction(
      mockWeb3 as any,
      defaultList
    );

    const findings = await handleTransaction(txEvent as any);
    expect(findings).toStrictEqual([]);
  });

  it(" The condition for tokenfunds gives true", async () => {
    const txEvent = {
      addresses: { "0xBA680a906d8f624a5F11fba54D3C672f09F26e47": true },
    };

    let mockWeb3 = {
      eth: {
        Contract: Mock.build_Mock(100, 1000, 0.5, 8),
      },
    } as any;

    handleTransaction = agent.provideHandleFunction(
      mockWeb3 as any,
      defaultList.slice(0, 1)
    );

    const findings = await handleTransaction(txEvent as any);
    expect(findings).toStrictEqual([
      Finding.fromObject({
        name: "Fund Ratio",
        alertId: "NethForta-Vesper-3",
        description: "There is idle fund in the pool",
        severity: 4,
        type: 2,
      }),
    ]);
  });

  it(" The condition for tokenfunds gives true", async () => {
    const txEvent = {
      addresses: { "0xBA680a906d8f624a5F11fba54D3C672f09F26e47": true },
    };

    let mockWeb3 = {
      eth: {
        Contract: Mock.build_Mock(100, 1000, 0.5, 8),
      },
    } as any;

    handleTransaction = agent.provideHandleFunction(
      mockWeb3 as any,
      defaultList.slice(0, 2)
    );

    const findings = await handleTransaction(txEvent as any);
    console.log(findings);
    expect(findings).toStrictEqual([
      Finding.fromObject({
        name: "Fund Ratio",
        alertId: "NethForta-Vesper-3",
        description: "There is idle fund in the pool",
        severity: 4,
        type: 2,
      }),
      Finding.fromObject({
        name: "Fund Ratio",
        alertId: "NethForta-Vesper-3",
        description: "There is idle fund in the pool",
        severity: 4,
        type: 2,
      }),
    ]);
  });
});
