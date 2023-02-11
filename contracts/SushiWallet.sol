//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.1;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./@sushiswap/contracts/interfaces/IMasterChef.sol";
import "./@sushiswap/contracts/interfaces/IMiniChefV2.sol";

/**
 * @title SushiWallet
 * @notice This smart contract allows the owner to execute a single transaction to provide liquidity and deposit of the LP token received in either SushiSwap's MasterChef or MasterChefV2.
 *         It also allows for the withdrawal of funds from the contracts, as well as emergency withdrawals and harvesting of rewards.
 *         The owner can also change the router, masterchef and masterchefV2 addresses.
 *         
 *         Owner should also check the code and use it only under their own responsibility.
 *  
 *          Hot to use:
 * 
 *          1. Deploy the contract.
 *          2. Set the router, masterchef and masterchefV2 addresses.
 *          3. Transfer the tokens you want to provide liquidity to the contract.
 *          4. Call the addLiquidity() function.
 *          
 *          Then you can call:
 * 
 *          removeLiquidty() To remove liquidity and withdraw the LP token from the Masterchef.
 *          harvestRewards() To harvest the rewards from the Masterchef. (Only for MasterchefV2)
 *          emergencyWithdraw() To withdraw the LP token without taking care about the rewards.
 *          withdraw() To withdraw any token from the contract to the owner address.
 * 
 *          And also you can:
 *          
 *          setRouter() To change the router address.
 *          setMasterchef() To change the masterchef address.
 *          setMasterchefV2() To change the masterchefV2 address.
 *
 * 
 * @dev    This contract emits events that can be reduced to reduce the gas cost,
 *         as the Router and Masterchef are already emitting events for the interactions.
 *         This is done to make it easier to track the interactions with the contract.
 */

contract SushiWallet is Ownable {

    using SafeERC20 for IERC20;

    IUniswapV2Router02 public router;
    IMasterChef public masterchef;   
    IMiniChefV2 public masterchefV2;     
            
    event Withdraw(address indexed token, uint256 indexed amount, address indexed to);
    event LiquidityAdded(address indexed lpToken, uint256 indexed lpTokenAmount);
    event LiquidityRemoved(address indexed lpToken, uint256 indexed amount);
    event EmergencyWithdraw(uint256 indexed poolId, bool isMasterchefV2);
    event HarvestedRewards(uint256 indexed poolId);
    event NewRouter(address indexed router);
    event NewMasterchef(address indexed masterchef);
    event NewMasterchefV2(address indexed masterchefV2); 
    
    constructor(address _router, address _masterchef, address _masterchefV2) {
        router = IUniswapV2Router02(address(_router));
        masterchef = IMasterChef(address(_masterchef));
        masterchefV2 = IMiniChefV2(address(_masterchefV2));
    }
    
    /**
     * @dev When you call this function you are providing liquidity and then deposit the LP token in the Masterchef.
     *      NOTE: The event emited in this function can be avoided, as the Router and Masterchef are already emitting events for this interactions.
     * 
     * @param tokenA Address of the token A
     * @param tokenB Address of the token B
     * @param amountA Amount of token A
     * @param amountB Amount of token B
     * @param minAmountA Minimum amount of token A to add liquidity
     * @param minAmountB Minimum amount of token B to add liquidity
     * @param _poolId If you know the pid of the pool you can pass it, otherwise it will be calculated.
     *             Note: if you pass 0 because you want the _poolId 0 it will be calculated anyways but that behaviour should be improved.
     * @param isMasterchefV2 true if the pool is in masterchefV2, false if it is in masterchef.
     */
    function addLiquidity(address tokenA, address tokenB, uint amountA, uint amountB, uint minAmountA, uint256 minAmountB, uint _poolId, bool isMasterchefV2) onlyOwner public {                
        require(tokenA != tokenB, "SushiWallet: TOKEN_A_EQUALS_TOKEN_B");        
        require(tokenA != address(0), "SushiWallet: INVALID_TOKEN_A_ADDRESS");
        require(tokenB != address(0), "SushiWallet: INVALID_TOKEN_B_ADDRESS");
        require(amountA > 0, "SushiWallet: INVALID_AMOUNT_A");
        require(amountB > 0, "SushiWallet: INVALID_AMOUNT_B");
        require(minAmountA >= 0 && minAmountA <= amountA, "SushiWallet: INVALID_MIN_AMOUNT_A");
        require(minAmountB >= 0 && minAmountB <= amountB, "SushiWallet: INVALID_MIN_AMOUNT_B");
        require(IERC20(tokenA).balanceOf(address(this)) >= amountA, 'SushiWallet: INSUFFICIENT_BALANCE_TOKEN_A');
        require(IERC20(tokenB).balanceOf(address(this)) >= amountB, 'SushiWallet: INSUFFICIENT_BALANCE_TOKEN_B');            

        /** STEP ONE -> Approve tokens */
        IERC20(tokenA).safeApprove(address(router), amountA);                   
        IERC20(tokenB).safeApprove(address(router), amountB);        

        /** STEP THREE -> Add Liquidity */
        IUniswapV2Router02(router).addLiquidity(tokenA, tokenB, amountA, amountB, minAmountA, minAmountB, address(this), block.timestamp);                        

        /** STEP FOUR -> Get the LP token address */
        address _lpToken = IUniswapV2Factory(router.factory()).getPair(tokenA, tokenB);               
        
        /** STEP FIVE -> Calculate LPToken balance and approve */
        uint256 thisBalance = IERC20(_lpToken).balanceOf(address(this));
        
        /** STEP SIX -> Deposit in Masterchef or MasterchefV2 */
        if (isMasterchefV2) {            
            IERC20(_lpToken).safeApprove(address(masterchefV2), thisBalance);
            masterchefV2.deposit(_poolId, thisBalance, address(this));   
        }else {            
            IERC20(_lpToken).safeApprove(address(masterchef),   thisBalance);
            masterchef.deposit(_poolId, thisBalance);
        }        

        emit LiquidityAdded(_lpToken, thisBalance);

    }

    /**
     * @dev Remove the liquidity from a LP token. 
     *      NOTE: The event emited in this function can be avoided, as the Router and Masterchef are already emitting events for this interactions.
     * 
     * @param _lpToken the address of the LP token to remove.
     * @param _amount the amount of LP token to remove.
     * @param _poolId the pool id of the pool where the LP token is deposited.  
     * @param isMasterchefV2 true if the LP token is in MasterchefV2, false if is in Masterchef.
     */
    function removeLiquidity(address _lpToken, uint256 _amount, uint256 _poolId, bool isMasterchefV2) onlyOwner public {       
        require(_amount > 0, "SushiWallet: INVALID_AMOUNT");
        require(_lpToken != address(0), "SushiWallet: INVALID_LP_TOKEN_ADDRESS");

        /** STEP ONE -> Approve LP Token */
        IERC20(_lpToken).safeApprove(address(router), _amount);         
        
        /** STEP TWO -> Withdraw from Masterchef or MasterchefV2 */
        if (isMasterchefV2) {            
            masterchefV2.withdrawAndHarvest(_poolId, _amount, address(this));
        }else {
            masterchef.withdraw(_poolId, _amount);
        }

        /** STEP THREE -> Remove Liquidity from Router */        
        router.removeLiquidity(IUniswapV2Pair(_lpToken).token0(), IUniswapV2Pair(_lpToken).token1(), _amount, 0, 0, address(this), block.timestamp);
    
        emit LiquidityRemoved(_lpToken, _amount);
    }
    
    /**
     * @dev Withdraw LP token without taking care about the rewards earned.
     *      NOTE: The event emited in this function can be avoided, as the Router and Masterchef are already emitting events for this interactions.
     * 
     * @param _poolId the pid of the pool to withdraw
     * @param isMasterchefV2 true if the LP token is in MasterchefV2, false if is in Masterchef
     */
    function emergencyWithdraw(uint256 _poolId, bool isMasterchefV2) onlyOwner public {                

        /** STEP ONE -> Withdraw from Masterchef or MasterchefV2 */
        if (isMasterchefV2) {            
            masterchefV2.emergencyWithdraw(_poolId, address(this));
        }else {
            masterchef.emergencyWithdraw(_poolId);
        }

        emit EmergencyWithdraw(_poolId, isMasterchefV2);
    }

    
    /** ONLY FOR MASTERCHEFV2 POOLS
     * @dev Allows the owner to harvest the tokens earned from MasterchefV2 without withdraw the LP Tokens.
     *      NOTE: The event emited in this function can be avoided, as the Router and Masterchef are already emitting events for this interactions.
     *      
     * @param _poolId the pid of the pool to harvest.
     */
    function harvestRewards(uint256 _poolId) onlyOwner public {                                
        masterchefV2.harvest(_poolId, address(this));   

        emit HarvestedRewards(_poolId);
    }

    /**
     * @dev Withdraw an specified amount of tokens from SushiWallet.
     * @param _token the address of the token to withdraw.
     * @param _amount the amount of the token to withdraw expressed in wei.
     */
    function withdraw(address _token, uint256 _amount ) onlyOwner public {                
        require(_token != address(0), "SushiWallet: INVALID_TOKEN_ADDRESS");
        require(_amount > 0, "SushiWallet: INVALID_AMOUNT");        
        require(_amount <= IERC20(_token).balanceOf(address(this)), "SushiWallet: INSUFFICIENT_BALANCE");
        
        IERC20(_token).safeTransfer(msg.sender, _amount);

        emit Withdraw(_token, _amount, msg.sender);
    }    

    /**
     * @dev Set a new Router address
     * @param _newRouter the address of the new Router contract.
     */   
    function setRouter(address _newRouter) onlyOwner public {  
        require(_newRouter != address(0), "SushiWallet: INVALID_ROUTER_ADDRESS");      
        router = IUniswapV2Router02(_newRouter);

        emit NewRouter(_newRouter);
    }

    /**
     * @dev Set a the Masterchef address
     * @param _newMasterchef the address of the new Masterchef contract.
     */
    function setMasterchef(address _newMasterchef) onlyOwner public {        
        require(_newMasterchef != address(0), "SushiWallet: INVALID_MASTERCHEF_ADDRESS");  
        masterchef = IMasterChef(_newMasterchef);

        emit NewMasterchef(_newMasterchef);
    }

    /**
     * @dev Set a new MasterchefV2 address
     * @param _newMasterchefV2 the address of the new MasterchefV2 contract.
     */
    function setMasterchefV2(address _newMasterchefV2) onlyOwner public {        
        require(_newMasterchefV2 != address(0), "SushiWallet: INVALID_MASTERCHEFV2_ADDRESS");  
        masterchefV2 = IMiniChefV2(_newMasterchefV2);

        emit NewMasterchefV2(_newMasterchefV2);
    }    
}
