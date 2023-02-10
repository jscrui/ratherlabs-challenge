require("@nomicfoundation/hardhat-chai-matchers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/D3PM3hdkUDmlaYQp7UJXw0nbpWO4ufCh",
        blockNumber: 16588388,
        gas: 12000000,
        gasPrice: 100000000000 
      },
    },
  }
};