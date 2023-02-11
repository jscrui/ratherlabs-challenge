const { expect } = require("chai");
const { ethers } = require("hardhat");
const { takeSnapshot, SnapshotRestorer } = require('@nomicfoundation/hardhat-network-helpers');


const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");
const IWETH = require("@uniswap/v2-periphery/build/WETH9.json");

describe("SushiWallet, Error Handling -> Should Revert", function () {

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

    let snapShot;

    before(async function () {
                
        [Owner, NotOwner] = await ethers.getSigners();

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
        
        //Transfer WETH and USDC to SushiWallet Contract
        await WETH.transfer(SushiWallet.address, ethers.utils.parseEther("1"));        
        await USDC.transfer(SushiWallet.address, await USDC.balanceOf(Owner.address));    

    });
    
    it("AddLiquidity(), from NotOwner.", async function () {

        const tx = SushiWallet.connect(NotOwner).addLiquidity(
            WETHAddress, //tokenA
            USDCAddress, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            await USDC.balanceOf(SushiWallet.address), //amountBDesired 
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            
            
        await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");        

    });

    it("AddLiquidity(), Token A == address(0).", async function () {

        const tx = SushiWallet.addLiquidity(
            ethers.constants.AddressZero, //tokenA
            USDCAddress, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            await USDC.balanceOf(SushiWallet.address), //amountBDesired 
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            
            
        await expect(tx).to.be.revertedWith("SushiWallet: INVALID_TOKEN_A_ADDRESS");

    });

    it("AddLiquidity(), Token B == address(0).", async function () {

        const tx = SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            ethers.constants.AddressZero, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            await USDC.balanceOf(SushiWallet.address), //amountBDesired
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );
    });
    
    it("AddLiquidity(), amountADesired == 0.", async function () {

        const tx = SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            USDCAddress, //tokenB
            0, //amountADesired
            await USDC.balanceOf(SushiWallet.address), //amountBDesired
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );

        await expect(tx).to.be.revertedWith("SushiWallet: INVALID_AMOUNT_A");
    });

    it("AddLiquidity(), amountBDesired == 0.", async function () {
            
            const tx = SushiWallet.addLiquidity(
                WETHAddress, //tokenA
                USDCAddress, //tokenB
                ethers.utils.parseEther("1"), //amountADesired
                0, //amountBDesired
                0, //amountAMin
                0, //amountBMin
                _pid, //_pid
                isMasterChefV2, //Masterchef V2?
            );
    
            await expect(tx).to.be.revertedWith("SushiWallet: INVALID_AMOUNT_B");
    });

    it("AddLiquidity(), amountAMin > amountA.", async function () {

        const tx = SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            USDCAddress, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            await USDC.balanceOf(SushiWallet.address), //amountBDesired
            ethers.utils.parseEther("2"), //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );

        await expect(tx).to.be.revertedWith("SushiWallet: INVALID_MIN_AMOUNT_A");
    });

    it("AddLiquidity(), amountBMin > amountB.", async function () {

            let usdcBalance = await USDC.balanceOf(SushiWallet.address);            
            
            const tx = SushiWallet.addLiquidity(
                WETHAddress, //tokenA
                USDCAddress, //tokenB
                ethers.utils.parseEther("1"), //amountADesired
                usdcBalance, //amountBDesired
                0, //amountAMin
                usdcBalance.add(1), //amountBMin
                _pid, //_pid
                isMasterChefV2, //Masterchef V2?
            );            
    
            await expect(tx).to.be.revertedWith("SushiWallet: INVALID_MIN_AMOUNT_B");
    });

    it("AddLiquidity(), amountA > SushiWallet balance.", async function () {
        
        const tx = SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            USDCAddress, //tokenB
            ethers.utils.parseEther("2"), //amountADesired
            USDC.balanceOf(SushiWallet.address), //amountBDesired
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            

        await expect(tx).to.be.revertedWith("SushiWallet: INSUFFICIENT_BALANCE_TOKEN_A");
    });

    it("AddLiquidity(), amountB > SushiWallet balance.", async function () {
        let usdcBalance = await USDC.balanceOf(SushiWallet.address);

        const tx = SushiWallet.addLiquidity(
            WETHAddress, //tokenA
            USDCAddress, //tokenB
            ethers.utils.parseEther("1"), //amountADesired
            usdcBalance.add(1), //amountBDesired
            0, //amountAMin
            0, //amountBMin
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            

        await expect(tx).to.be.revertedWith("SushiWallet: INSUFFICIENT_BALANCE_TOKEN_B");
    });

    it("RemoveLiquidity(), from NotOwner.", async function () {

        const tx = SushiWallet.connect(NotOwner).removeLiquidity(
            LPToken.address, //lpToken
            1, //amount
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            
            
        await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");        

    });

    it("RemoveLiquidity(), lpToken == address(0).", async function () {

        const tx = SushiWallet.removeLiquidity(
            ethers.constants.AddressZero, //lpToken
            1, //amount
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );        
        
        await expect(tx).to.be.revertedWith("SushiWallet: INVALID_LP_TOKEN_ADDRESS");
    });
    
    it("RemoveLiquidity(), lpToken amount == 0.", async function () {
        
        const tx = SushiWallet.removeLiquidity(
            LPToken.address, //lpToken
            0, //amount
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );
        
        await expect(tx).to.be.revertedWith("SushiWallet: INVALID_AMOUNT");
    });

    it("EmergencyWithdraw(), from NotOwner.", async function () {
            
        const tx = SushiWallet.connect(NotOwner).emergencyWithdraw(
            _pid, //_pid
            isMasterChefV2, //Masterchef V2?
        );            
                
        await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");        
    
    });

    it("HarvestRewards(), from NotOwner.", async function () {
            
        const tx = SushiWallet.connect(NotOwner).harvestRewards(
            _pid, //_pid                
        );            
        
        await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");    
    });

    it("Withdraw(), from NotOwner.", async function () {
                
        const tx = SushiWallet.connect(NotOwner).withdraw(
            USDC.address, //tokenAddress
            1, //amount
        );            
                    
        await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");        
        
    });

    it("Withdraw(), tokenAddress == address(0).", async function () {

        const tx = SushiWallet.withdraw(
            ethers.constants.AddressZero, //tokenAddress
            1, //amount
        );

        await expect(tx).to.be.revertedWith("SushiWallet: INVALID_TOKEN_ADDRESS");

    });

    it("Withdraw(), amount == 0.", async function () {
            
            const tx = SushiWallet.withdraw(
                USDC.address, //tokenAddress
                0, //amount
            );
    
            await expect(tx).to.be.revertedWith("SushiWallet: INVALID_AMOUNT");
    
    });

    it("Withdraw(), amount > SushiWallet balance.", async function () {
            
            const usdcBalance = await USDC.balanceOf(SushiWallet.address);            

            const tx = SushiWallet.withdraw(
                USDC.address, //tokenAddress
                usdcBalance.add(1), //amount
            );
        
            await expect(tx).to.be.revertedWith("SushiWallet: INSUFFICIENT_BALANCE");
    });


});