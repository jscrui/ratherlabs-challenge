// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

const sushiRouter = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const masterChef = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd";
const masterChefV2 = "0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d";

async function main() {

  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);

    //Deploy SushiWallet
    const sushiWallet = await ethers.getContractFactory("SushiWallet");
    SushiWallet = await sushiWallet.deploy(sushiRouter, masterChef, masterChefV2);
    await SushiWallet.deployed();

    console.log("SushiWallet deployed to:", SushiWallet.address);

    //Show deployment gas cost
    const tx = await deployer.getTransactionReceipt(SushiWallet.deployTransaction.hash);
    console.log("Gas used:", tx.gasUsed.toString());
    
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
