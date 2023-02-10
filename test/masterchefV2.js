const { expect } = require("chai");
const { ethers } = require("hardhat");

const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");
const IWETH = require("@uniswap/v2-periphery/build/WETH9.json");

/**
 * Some PoolInfo IDs from Sushiswap Masterchef (from TheGraph)
 *
 * 0x06da0fd433c1a5d7a4faa01111c044910a184553 USDT + WETH -> 0
 * 0x397FF1542f962076d0BFE58eA045FfA2d347ACa0 USDC + WETH -> 1
 * 0x795065dcc9f64b5614c407a6efdc400da6221fb0 SUSHI + WETH -> 12
 * 0x088ee5007c98a9677165d78dd2109ae4a3d04d0c YFI + WETH -> 11
 * 
 * More info at: 
 * https://thegraph.com/hosted-service/subgraph/sushiswap/sushiswap
 * 
 */

describe("SushiWallet, MasterChefV2 with _pid '1', USDC + WETH", function () {

    const _pid = 1;
    const lpTokenAddress = "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0";
    const isMasterChefV2 = false;

    let Owner;        
    let WETH;
    let USDC;
    let LPToken;
    let SushiRouter;
    let SushiWallet; 
    let MasterChefV1;    

    const sushiRouterAddress = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    const masterChefAddress = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"
    const masterChefV2Address = "0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d";    
    const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const SUSHIAddress = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";
    const USDCAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

    before(async function () {
                
        [Owner] = await ethers.getSigners();

        //Instantiate all necesary contracts
        WETH = await ethers.getContractAt(IWETH.abi, WETHAddress);
        USDC = await ethers.getContractAt("IERC20", USDCAddress); 
        LPToken = await ethers.getContractAt("IERC20", lpTokenAddress);   
        SushiToken = await ethers.getContractAt("IERC20", SUSHIAddress);
        SushiRouter = await ethers.getContractAt(IUniswapV2Router02.abi, sushiRouterAddress);
        MasterChefV1 = await ethers.getContractAt("IMasterChef", masterChefAddress);        

        //Deploy SushiWallet
        const sushiWallet = await ethers.getContractFactory("SushiWallet");
        SushiWallet = await sushiWallet.deploy(sushiRouterAddress, masterChefAddress, masterChefV2Address);
        await SushiWallet.deployed();

        //Wrap ETH to WETH
        await WETH.deposit({ value: ethers.utils.parseEther("1") });
        
        //Swap ETH for USDC
        await SushiRouter.swapExactETHForTokens(
            0, // amountOutMin
            [WETHAddress, USDCAddress], // path
            Owner.address, // to
            Date.now() + 1000, // deadline
            { value: ethers.utils.parseEther("1") } // value
        ); 
        
        //Transfer WETH and USDC to SushiWallet
        await WETH.transfer(SushiWallet.address, ethers.utils.parseEther("1"));        
        await USDC.transfer(SushiWallet.address, await USDC.balanceOf(Owner.address));    

    });
    
    it("Add liquidity, 1 WETH and ~1622.60 USDC", async function () {

        const tx = await SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            USDCAddress, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            await USDC.balanceOf(SushiWallet.address), //amountBDesired 
            1, //slippage
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            

        const receipt = await tx.wait();
        const event = receipt.events[receipt.events.length - 1];  

        const effGasPrice = receipt.effectiveGasPrice;
        const txGasUsed = receipt.gasUsed;
        const gasUsedETH = effGasPrice * txGasUsed;
        
        console.log("Tx cost: " + ethers.utils.formatEther(gasUsedETH.toString()));
        
        expect(event.args[0] == lpTokenAddress).to.be.true &&
        expect(await USDC.balanceOf(SushiWallet.address)).to.be.eq(0);        

    });

    it("Check rewards, should've SUSHI rewards pending", async function () {

        await SushiRouter.swapExactETHForTokens(
            0, // amountOutMin
            [WETHAddress, USDCAddress], // path
            Owner.address, // to
            Date.now() + 1000, // deadline
            { value: ethers.utils.parseEther("10") } // value
        ); 
        
        let Masterchef = await ethers.getContractAt("IMasterChef", masterChefAddress);
        
        const pendingSushi = await Masterchef.pendingSushi(_pid, SushiWallet.address);

        expect(pendingSushi).to.be.gt(0);

    });

    it("Remove liquidity, 1 WETH and ~1622.60 USDC", async function () {
        
        const userInfo = await MasterChefV1.userInfo(1, SushiWallet.address);        
        const providedLP = userInfo[0];

        const tx = await SushiWallet.removeLiquidity(
            lpTokenAddress, //lpToken
            providedLP, //Amount LP to remove
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );
    
        expect(await LPToken.balanceOf(SushiWallet.address)).to.be.eq(0);        
        
    });

    it("Balances of USDC, SUSHI and WETH should be > 0", async function () {
        
        expect(await USDC.balanceOf(SushiWallet.address)).to.be.gt(0) &&
        expect(await WETH.balanceOf(SushiWallet.address)).to.be.gt(0) &&
        expect(await SushiToken.balanceOf(SushiWallet.address)).to.be.gt(0);
        
    });
   
});