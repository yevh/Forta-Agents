import { Network } from "forta-agent";
import { AgentConfig } from "./utils";

const CONFIG: AgentConfig = {
  [Network.MAINNET]: {
    // Minimum interval between two uncollateralized borrow alerts for the
    // same borrower
    alertInterval: 60 * 60,
    // Comet contracts to be monitored and some extra data
    cometContracts: [
      {
        // Address of the Comet contract
        address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
        // Deployment block of the contract (used for historical borrow fetching)
        deploymentBlock: 15331586,
        // Lower threshold that defines whether a position is 'large',
        // denominated in the same scale as in the contract
        baseLargeThreshold: "1000000000000000000",
        // Length of the largest borrow positions that is constantly checked
        // for uncollateralized borrows.
        // Ideally this limit must include all borrows currently greater or
        // equal than the threshold, otherwise positions that should be
        // monitored will likely be lost. If at any time the smallest position
        // is greater or equal than the threshold, a warning log will be
        // emitted.
        // It must also be considered that this should be a viable amount
        // considering memory limits and the network block rate.
        monitoringListLength: 1000,
      },
      {
        address: "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
        deploymentBlock: 16400710,
        baseLargeThreshold: "1000000000000000000",
        monitoringListLength: 1000,
      },
    ],
  },

  [Network.POLYGON]: {
    alertInterval: 60 * 60,
    cometContracts: [
      {
        address: "0xF25212E676D1F7F89Cd72fFEe66158f541246445",
        deploymentBlock: 39412367,
        baseLargeThreshold: "1000000000000000000",
        monitoringListLength: 1000,
      },
    ],
  },
};

export default CONFIG;