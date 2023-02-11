# ratherlabs-challenge
 This repository contains the solution to the Solidity coding challenge for Ratherlabs. The code implements a smart contract that satisfies the requirements specified in the challenge description. The contract has been tested and deployed on the Ethereum network to ensure its functionality. Feel free to review the code and leave comments or suggestions for improvement.

##  Installation 
Please follow these steps to set up the project:

1) Clone the repository to your local machine.
2) Run `npm i` to install the necessary dependencies.
3) Create a `.env` file in the root folder and add the following line: `ALCHEMY_PRIVATE_KEY="Your-alchemy-private-key"`.   
    If you don't have an Alchemy private key, you can obtain one from https://dashboard.alchemy.com/.

    It's important to note that if you plan to deploy this contract on **mainnet**, you should also include your private key in the .env file with the following line: `PRIVATE_KEY="your_private_key"`.

4) Open a terminal on the root folder and run `npx hardhat test`, if everything is correct, you will see all the hardaht unit testing passed.
5) Finally, on the same terminal you can run `npx hardhat run scripts/deploy.js` to deploy SushiWallet to Ethereum Mainnet.  

## Testing
To ensure accurate and efficient testing, I ran the tests against a fork of the Ethereum blockchain at a specific **block (16588388)**. By interacting with a copy of the blockchain with a controlled state, I was able to test against specific smart contracts and balances. Using this approach also provided the benefit of being able to reset the blockchain state after each test, ensuring a clean and reliable environment for subsequent testing.

Performing tests without forking requires relying on external contracts and balances, which may be in a different state or have unexpected behavior, making tests less reliable.

## Audit
I performed an audit using **Slither** to check for any potential errors and bugs in the code. Based on the report, everything appears to be in order. You can find the audit report located in the `/audits` folder.


## Features
This smart contract offers the following features:

* Single transaction execution for providing liquidity and depositing LP tokens from SushiSwap's MasterChef or MasterChefV2.
* Withdrawal of funds, emergency withdrawals, and harvesting of rewards.
* The owner has the authority to change the addresses of the router, MasterChef, and MasterChefV2.

## Tooling

* Hardhat
* Slither
* Tenderly

## Addresses

    Sushi Router = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"   
    MasterChef = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"   
    MasterChefV2 = "0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d"      
    WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"   
    SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"   
    USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"   

## Conclusion

Thank you for checking out my solution to this challenge! 

I did my best to keep the code as simple and straightforward as possible, but I acknowledge that there is still room for improvement.

If you have any questions or feedback, please feel free to reach out to me.




