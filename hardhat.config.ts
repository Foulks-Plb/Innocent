import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      // forking: {
      //   url: "https://eth-mainnet.g.alchemy.com/v2/jlkyqc70l2lraiPggraHYwHjxCpUntpw",
      //   blockNumber: 19863521
      // }
    }
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },   
    },
  },
};

export default config;
