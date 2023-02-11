require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
},
  gasReporter: {
    enabled: true
},
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/D3PM3hdkUDmlaYQp7UJXw0nbpWO4ufCh",
        blockNumber: 16588388,        
      },
    },
  }
};