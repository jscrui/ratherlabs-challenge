const { expect } = require("chai");
const { ethers } = require("hardhat");
const { takeSnapshot, SnapshotRestorer } = require('@nomicfoundation/hardhat-network-helpers');


const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");
const IWETH = require("@uniswap/v2-periphery/build/WETH9.json");

/**
 * Some PoolInfo IDs from Sushiswap MasterchefV2 (from TheGraph)
 *
 * 0xC3f279090a47e80990Fe3a9c30d24Cb117EF91a8 ALCX + WETH -> 0
 * 0x05767d9ef41dc40689678ffca0608878fb3de906 CVX + WETH -> 1
 * 0x30045ad74f4475E82DcDC269952581ECb7CD2bAd SI + WETH -> 10
 * 0x15e86E6f65EF7EA1dbb72A5E51a07926fB1c82E3 AMP + WETH -> 11
 * 
 * More info at: 
 * https://thegraph.com/explorer/subgraphs/ACTiN4AwY5UiGk8W5WTkWw4HV93JcxnFL3HpQ1EipKpQ?view=Playground&chain=mainnet
 * 
 */

describe("SushiWallet, MasterChefV2 with _pid '1', CVX + WETH", function () {

    const _pid = 1;
    const lpTokenAddress = "0x05767d9EF41dC40689678fFca0608878fb3dE906";
    const isMasterChefV2 = true;

    let Owner;        
    let WETH;
    let CVX;
    let LPToken;
    let SushiRouter;
    let SushiWallet; 
    let MasterChefV2

    const sushiRouterAddress = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    const masterChefAddress = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"
    const masterChefV2Address = "0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d";    
    const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const SUSHIAddress = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";
    const CVXAddress = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";

    let snapShot;

    before(async function () {
                
        [Owner] = await ethers.getSigners();

        //Instantiate all necesary contracts
        WETH = await ethers.getContractAt(IWETH.abi, WETHAddress);
        CVX = await ethers.getContractAt("IERC20", CVXAddress); 
        LPToken = await ethers.getContractAt("IERC20", lpTokenAddress);   
        SushiToken = await ethers.getContractAt("IERC20", SUSHIAddress);
        SushiRouter = await ethers.getContractAt(IUniswapV2Router02.abi, sushiRouterAddress);
        MasterChefV2 = await ethers.getContractAt("IMiniChefV2", masterChefV2Address);        

        //Deploy SushiWallet
        const sushiWallet = await ethers.getContractFactory("SushiWallet");
        SushiWallet = await sushiWallet.deploy(sushiRouterAddress, masterChefAddress, masterChefV2Address);
        await SushiWallet.deployed();

        //Wrap ETH to WETH
        await WETH.deposit({ value: ethers.utils.parseEther("1") });
        
        //Swap ETH for CVX
        await SushiRouter.swapExactETHForTokens(
            0, // amountOutMin
            [WETHAddress, CVXAddress], // path
            Owner.address, // to
            Date.now() + 1000, // deadline
            { value: ethers.utils.parseEther("1") } // value
        ); 
        
        //Transfer WETH and CVX to SushiWallet Contract
        await WETH.transfer(SushiWallet.address, ethers.utils.parseEther("1"));        
        await CVX.transfer(SushiWallet.address, await CVX.balanceOf(Owner.address));    

    });
    
    it("AddLiquidity(), 1 WETH and ~1622.60 CVX", async function () {

        let balancePre = await CVX.balanceOf(SushiWallet.address);

        const tx = await SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            CVXAddress, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            await CVX.balanceOf(SushiWallet.address), //amountBDesired 
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            

        const receipt = await tx.wait();
        const event = receipt.events[receipt.events.length - 1];         
        
        expect(event.args[0] == lpTokenAddress).to.be.true &&
        expect(await CVX.balanceOf(SushiWallet.address)).to.be.lt(balancePre);

    });
    
    it("Check rewards, should've SUSHI rewards pending", async function () {

        await SushiRouter.swapExactETHForTokens(
            0, // amountOutMin
            [WETHAddress, CVXAddress], // path
            Owner.address, // to
            Date.now() + 1000, // deadline
            { value: ethers.utils.parseEther("10") } // value
        ); 
                
        snapShot = await takeSnapshot();
        
        const pendingSushi = await MasterChefV2.pendingSushi(_pid, SushiWallet.address);

        expect(pendingSushi).to.be.gt(0);

    });    
    
    it("RemoveLiquidity(), 1 WETH and ~1622.60 CVX", async function () {
        
        const userInfo = await MasterChefV2.userInfo(1, SushiWallet.address);        
        const providedLP = userInfo[0];

        await SushiWallet.removeLiquidity(
            lpTokenAddress, //lpToken
            providedLP, //Amount LP to remove
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );
    
        expect(await LPToken.balanceOf(SushiWallet.address)).to.be.eq(0);        
        
    });


    it("Balances of CVX, SUSHI and WETH should be > 0", async function () {
        
        expect(await CVX.balanceOf(SushiWallet.address)).to.be.gt(0) &&
        expect(await WETH.balanceOf(SushiWallet.address)).to.be.gt(0) &&
        expect(await SushiToken.balanceOf(SushiWallet.address)).to.be.gt(0);
        
    });
    
    
    it("Withdraw(), extract tokens from SushiWallet", async function () {
                
        const ownerCVXBalance = await CVX.balanceOf(Owner.address);
        const ownerWETHBalance = await WETH.balanceOf(Owner.address);
        const ownerSushiBalance = await SushiToken.balanceOf(Owner.address);

        const sushiWalletCVXBalance = await CVX.balanceOf(SushiWallet.address);
        const sushiWalletWETHBalance = await WETH.balanceOf(SushiWallet.address);
        const sushiWalletSushiBalance = await SushiToken.balanceOf(SushiWallet.address);
                
        await SushiWallet.withdraw(CVXAddress, sushiWalletCVXBalance);
        await SushiWallet.withdraw(WETHAddress, sushiWalletWETHBalance);
        await SushiWallet.withdraw(SUSHIAddress, sushiWalletSushiBalance);
        
        const newOwnerCVXBalance = await CVX.balanceOf(Owner.address);
        const newOwnerWETHBalance = await WETH.balanceOf(Owner.address);
        const newOwnerSushiBalance = await SushiToken.balanceOf(Owner.address);

        expect(newOwnerCVXBalance).to.be.gt(ownerCVXBalance) &&
        expect(newOwnerWETHBalance).to.be.gt(ownerWETHBalance) &&
        expect(newOwnerSushiBalance).to.be.gt(ownerSushiBalance);

    });
    
    it("EmergencyWithdraw(), extract LP tokens from Masterchef", async function () {

        await snapShot.restore();
        
        await SushiWallet.emergencyWithdraw(_pid, isMasterChefV2);

        expect(await LPToken.balanceOf(SushiWallet.address)).to.be.gt(0);

    });

    it("HarvestRewards(), extract SUSHI rewards from Masterchef", async function () {
        
        await snapShot.restore();
        
        await SushiWallet.harvestRewards(_pid);
    
        expect(await SushiToken.balanceOf(SushiWallet.address)).to.be.gt(0);
    });

});