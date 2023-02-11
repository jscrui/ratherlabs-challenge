const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SushiWallet, Setters", function () {

    const sushiRouterAddress = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    const masterChefAddress = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"
    const masterChefV2Address = "0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d";        

    before(async function () {        
                
        [Owner, newRouter, newMasterchef, newMasterchefV2] = await ethers.getSigners();
        
        //Deploy SushiWallet
        const sushiWallet = await ethers.getContractFactory("SushiWallet");
        SushiWallet = await sushiWallet.deploy(sushiRouterAddress, masterChefAddress, masterChefV2Address);
        await SushiWallet.deployed();
        
    });
    
    it("Can set new Router via setRouter()", async function () {
        SushiWallet.setRouter(newRouter.address);        
        expect(await SushiWallet.router()).to.equal(newRouter.address);
    });

    it("Can set new MasterChef via setMasterChef()", async function () {        
        SushiWallet.setMasterchef(newMasterchef.address);
        expect(await SushiWallet.masterchef()).to.equal(newMasterchef.address);
    });         

    it("Can set new MasterChefV2 via setMasterChefV2()", async function () {
        SushiWallet.setMasterchefV2(newMasterchefV2.address);
        expect(await SushiWallet.masterchefV2()).to.equal(newMasterchefV2.address);
    });

    it("Reject if 0x0 address is passed via setRouter()", async function () {
        expect(SushiWallet.setRouter(ethers.constants.AddressZero)).to.be.revertedWith("SushiWallet: INVALID_ROUTER_ADDRESS");
    });

    it("Reject if 0x0 address is passed via setMasterChef()", async function () {
        expect(SushiWallet.setMasterchef(ethers.constants.AddressZero)).to.be.revertedWith("SushiWallet: INVALID_MASTERCHEF_ADDRESS");
    }); 

    it("Reject if 0x0 address is passed via setMasterChefV2()", async function () {
        expect(SushiWallet.setMasterchefV2(ethers.constants.AddressZero)).to.be.revertedWith("SushiWallet: INVALID_MASTERCHEFV2_ADDRESS");
    });

});