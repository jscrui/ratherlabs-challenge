//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.1;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./@sushiswap/contracts/interfaces/IMasterChef.sol";
import "./@sushiswap/contracts/interfaces/IMiniChefV2.sol";

contract SushiWallet is Ownable {

    IUniswapV2Router02 public router;
    IMasterChef public masterchef;   
    IMiniChefV2 public masterchefV2;     
            
    event Withdraw(address indexed token, uint256 indexed amount);
    event LiquidityAdded(address indexed lpToken, uint256 indexed amountA, uint256 indexed amountB);
    event LiquidityRemoved(address indexed lpToken, uint256 indexed amountA, uint256 indexed amountB);
    event harvestedRewards(address indexed tokenEarned);
    
    event NewRouter(address indexed router);
    event NewMasterchef(address indexed masterchef);
    event NewMasterchefV2(address indexed masterchefV2);
    
    constructor(address _router, address _masterchef, address _masterchefV2){
        router = IUniswapV2Router02(_router);
        masterchef = IMasterChef(_masterchef);
        masterchefV2 = IMiniChefV2(_masterchefV2);             
    }
    
    /**
     * @dev When you call this function you are providing liquidity and then deposit the LP token in the Masterchef.
     *      This function does not emit any event, as the Router is already emitting events for the liquidity added.
     * 
     * @param tokenA Address of the token A
     * @param tokenB Address of the token B
     * @param amountA Amount of token A
     * @param amountB Amount of token B
     * @param slippage The diff between the expected and the realized deposited amount in percentage, only from 0 to 100 where 0 means no slippage and 100 means no limit.
     * @param _pid If you know the pid of the pool you can pass it, otherwise it will be calculated.
     *             Note: if you pass 0 because you want the _pid 0 it will be calculated anyways but that behaviour should be improved.
     * @param isMasterchefV2 true if the pool is in masterchefV2, false if it is in masterchef.
     */
    function addLiquidity(address tokenA, address tokenB, uint amountA, uint amountB, uint slippage, uint _pid, bool isMasterchefV2) onlyOwner public {                
        require(tokenA != tokenB, 'Error: TOKEN A == TOKEN B');
        require(IERC20(tokenA).balanceOf(address(this)) >= amountA, 'Insufficient balance: TOKEN A');
        require(IERC20(tokenB).balanceOf(address(this)) >= amountB, 'Insufficient balance: TOKEN B');
        require(slippage >= 0 && slippage <= 100, 'Slippage: OUT_OF_LIMITS');

        /** STEP ONE  -> Approve tokens */     
        IERC20(tokenA).approve(address(router), amountA);                   
        IERC20(tokenB).approve(address(router), amountB);        

        /** STEP TWO -> Calculate slippage  */
        uint amountAmin = amountA - (amountA * slippage / 100);
        uint amountBmin = amountB - (amountB * slippage / 100);

        /** STEP THREE -> Add Liquidity */                
        IUniswapV2Router02(router).addLiquidity(tokenA, tokenB, amountA, amountB, amountAmin, amountBmin, address(this), block.timestamp);                        

        /** STEP FOUR -> Get the LP token address */
        address _lpToken = IUniswapV2Factory(router.factory()).getPair(tokenA, tokenB);        

        /** STEP FIVE -> Get PID for LP token 
         * This is a temporary solution that should be improved, because 
         * if you want to use the PID 0 then the function will not 
         * distinguish between the PID 0 and the pid not passed.
         * and it will calculate the PID for the LP token wasting gas.
         * TODO: IMPROVE THIS LOGIC!! */
        if (_pid == 0) {
            _pid = getPID(_lpToken);
        }
        
        /** STEP SEVEN -> Check if must add to Masterchef or MasterchefV2, then approve and stake LP tokens */
        if (isMasterchefV2) {            
            IERC20(_lpToken).approve(address(masterchefV2), IERC20(_lpToken).balanceOf(address(this)));
            masterchefV2.deposit(_pid, IERC20(_lpToken).balanceOf(address(this)), address(this));   
        }else {            
            IERC20(_lpToken).approve(address(masterchef), IERC20(_lpToken).balanceOf(address(this)));
            masterchef.deposit(_pid, IERC20(_lpToken).balanceOf(address(this)));
        }        

        emit LiquidityAdded(_lpToken, amountA, amountB);

    }

    /**
     * @dev Remove the liquidity from a LP token. 
     * @param _lpToken the address of the LP token to remove.
     * @param _amount the amount of LP token to remove.
     * @param isMasterchefV2 true if the LP token is in MasterchefV2, false if is in Masterchef.
     */
    function removeLiquidity(address _lpToken, uint256 _amount, uint256 _pid, bool isMasterchefV2) onlyOwner public {                
        
        /** STEP ONE -> Get PID for LP token 
         * This is a temporary solution that should be improved, because 
         * if you want to use the PID 0 then the function will not 
         * distinguish between the PID 0 and the pid not passed.
         * and it will calculate the PID for the LP token wasting gas.
         * TODO: IMPROVE THIS LOGIC!! */
        if (_pid == 0) {
            _pid = getPID(_lpToken);
        }

        /** STEP TWO -> Check if must Withdraw from Masterchef or MasterchefV2 */
        if (isMasterchefV2) {            
            masterchefV2.withdrawAndHarvest(_pid, _amount, address(this));
        }else {
            masterchef.withdraw(_pid, _amount);
        }

        /** STEP FOUR -> Approve LP Token */
        IERC20(_lpToken).approve(address(router), _amount);

        /** STEP FIVE -> Remove Liquidity */
        router.removeLiquidity(IUniswapV2Pair(_lpToken).token0(), IUniswapV2Pair(_lpToken).token1(), _amount, 0, 0, address(this), block.timestamp);

        emit LiquidityRemoved(_lpToken, _amount, _amount);
    }
    
    /**
     * @dev Withdraw LP token without taking care about the rewards earned. 
     * @param _lpToken the address of the LP token to withdraw
     * @param isMasterchefV2 true if the LP token is in MasterchefV2, false if is in Masterchef
     */
    function emergencyWithdraw(address _lpToken, bool isMasterchefV2) onlyOwner public {        
        /** STEP ONE -> Get PID  */
        uint256 _pid = getPID(_lpToken);

        /** STEP TWO -> Check if must Withdraw from Masterchef or MasterchefV2 */
        if (isMasterchefV2) {            
            masterchefV2.emergencyWithdraw(_pid, address(this));
        }else {
            masterchef.emergencyWithdraw(_pid, address(this));
        }
    }

    /**
     * @dev Allows the owner to harvest tokens earned from staking in the Masterchef
     * @param _lpToken the address of the LP token to harvest
     * @param isMasterchefV2 true if the LP token is in MasterchefV2, false if is in Masterchef
     */
    function harvestRewards(address _lpToken, bool isMasterchefV2) onlyOwner public {        
        
        /** STEP ONE -> Get PID  */
        uint256 _pid = getPID(_lpToken);
        
        if (isMasterchefV2 == true) {
            masterchefV2.harvest(_pid, address(this));   
        }else {
            masterchef.deposit(_pid, 0);
        }

        emit harvestedRewards(_lpToken);

    }

    /**
     * @dev Withdraws the specified amount of the specified token from the contract
     * @param _token the address of the token to withdraw
     * @param _amount the amount of the token to withdraw expressed in wei
     */
    function withdraw(address _token, uint256 _amount ) onlyOwner public {        
        require(_amount <= IERC20(_token).balanceOf(address(this)), "Insufficient balance: CONTRACT");
        IERC20(_token).transfer(msg.sender, _amount);

        emit Withdraw(_token, _amount);
    }    

    /**
     * @dev Sets the router address
     * @param _newRouter the address of the new router     
     */   
    function setRouter(address _newRouter) onlyOwner public {  
        require(_newRouter != address(0), "INVALID ADDRESS");      
        router = IUniswapV2Router02(_newRouter);
        emit NewRouter(_newRouter);
    }

    /**
     * @dev Sets the Masterchef address
     * @param _newMasterchef the address of the new Masterchef
     */
    function setMasterchef(address _newMasterchef) onlyOwner public {        
        require(_newMasterchef != address(0), "INVALID ADDRESS");  
        masterchef = IMasterChef(_newMasterchef);
        emit NewMasterchef(_newMasterchef);
    }

    /**
     * @dev Sets the MasterchefV2 address
     * @param _newMasterchefV2 the address of the new MasterchefV2
     */
    function setMasterchefV2(address _newMasterchefV2) onlyOwner public {        
        require(_newMasterchefV2 != address(0), "INVALID ADDRESS");  
        masterchefV2 = IMiniChefV2(_newMasterchefV2);
        emit NewMasterchefV2(_newMasterchefV2);
    }    

    /**
     * @dev This fuction retrieves the PID of the LP token in Masterchef, 
     * the PID is used when calling different functions of the Masterchef contracts.
     * 
     * WARNING: This function is not efficient as it will loop through all the pools in Masterchef until find the right PID. 
     * 
     * TODO: MUST improve this function to make it more efficient, for example:
     * 1) Save the PID and the LP Token address in a mapping and then just retrieve it. 
     * 
     * @param _token the address of the token to check
     */
    function getPID(address _token) public view returns (uint256 _pid) {
        require(_token != address(0), "INVALID ADDRESS");  
        
        for(uint i = 0; i < masterchef.poolLength(); i++) {
            if(masterchef.poolInfo(i).lpToken == IERC20(_token)) {
                return i;
            }
        }

        revert("Error: Pool not found in Masterchef.");

    }

}
