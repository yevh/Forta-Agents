import { ethers } from "ethers";

export interface NetworkData {
  bridgeReceiver: string;
  blockChunk: number;
  pastBlocks: number;
}

export interface AgentConfig {
  mainnetRpcEndpoint: string;
  networkData: Record<number, NetworkData>;
}

export function encodePacked(signature: string, data: string): string {
  const signatureHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
  const calldata = ethers.utils.hexConcat([signatureHash.slice(0, 10), ethers.utils.hexlify(data)]);
  return calldata;
}
