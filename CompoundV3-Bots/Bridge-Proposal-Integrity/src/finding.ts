import { getAddress } from "ethers/lib/utils";
import {
  Finding,
  FindingSeverity,
  FindingType,
  LogDescription,
} from "forta-agent";

export function ProposalCreatedFinding(
  log: LogDescription,
  network: string,
  txHash: string
): Finding {
  return Finding.from({
    name: "Proposal created on BridgeReceiver contract",
    description:
      "A ProposalCreated event was emitted on BridgeReceiver contract, the corresponding creation message was found",
    alertId: "COMP2-5-1",
    protocol: "Compound",
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      network,
      bridgeReceiver: getAddress(log.address),
      id: log.args.id.toString(),
      fxChild: getAddress(log.args.rootMessageSender),
      txHash,
    },
  });
}

export function SuspiciousProposalCreatedFinding(
  log: LogDescription,
  network: string
): Finding {
  return Finding.from({
    name: "A suspicious proposal was created on BridgeReceiver contract",
    description:
      "A ProposalCreated event was emitted on BridgeReceiver contract, no corresponding creation message was found",

    alertId: "COMP2-5-2",
    protocol: "Compound",
    type: FindingType.Suspicious,
    severity: FindingSeverity.High,
    metadata: {
      network,
      bridgeReceiver: getAddress(log.address),
      id: log.args.id.toString(),
      fxChild: getAddress(log.args.rootMessageSender),
    },
  });
}
