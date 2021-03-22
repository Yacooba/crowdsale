//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Crowdsale
 * @dev Crowdsale is a base contract for managing a token crowdsale,
 * allowing beneficiaries to purchase tokens with ether. This contract implements
 * such functionality in its most fundamental form and can be extended to provide additional
 * functionality and/or custom behavior.
 * The external interface represents the basic interface for purchasing tokens, and conforms
 * the base architecture for crowdsales. It is *not* intended to be modified / overridden.
 * The internal interface conforms the extensible and modifiable surface of crowdsales. Override
 * the methods to add functionality. Consider using 'super' where appropriate to concatenate
 * behavior.
 */
contract Crowdsale is Context, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;

  // The token being sold
  IERC20 private _token;

  // Address where funds (Ether) will be forwarded to
  address payable private _fundWallet;

  // How many token units a buyer gets per wei.
  // The rate is the conversion between wei and the smallest and indivisible token unit.
  // So, if you are using a rate of 1 with a ERC20Detailed token with 3 decimals called YAC
  // 1 wei will give you 1 unit, or 0.001 YAC.
  uint256 private _rate;

  // Amount of wei raised
  uint256 private _tokensRaised;

  // Address of the wallet containing YAC tokens to be bought
  address private _tokenWallet;

  /**
   * Event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchasedasdasdasd
   */
  event TokensPurchased(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

  /**
   * @dev The rate is the conversion between wei and the smallest and indivisible
   * token unit. So, if you are using a rate of 1 with a ERC20Detailed token
   * with 3 decimals called YAC, 1 wei will give you 1 unit, or 0.001 YAC.
   * @param newRate Number of token units a buyer gets per wei
   * @param newFundWallet Address where collected funds (Ether) will be forwarded to
   * @param newToken Address of the token being sold (YAC)
   * @param newTokenWallet Address of the wallet containing YAC tokens to be bought
   */
  constructor(
    uint256 newRate,
    address payable newFundWallet,
    IERC20 newToken,
    address newTokenWallet
  ) {
    require(newRate != 0, "CS: rate is 0");
    require(newFundWallet != address(0), "CS: fund wallet is the zero address");
    require(address(newToken) != address(0), "CS: token is the zero address");
    require(newTokenWallet != address(0), "CS: token wallet is the zero address");

    _tokenWallet = newTokenWallet;
    _rate = newRate;
    _fundWallet = newFundWallet;
    _token = newToken;
  }

  /**
   * @dev fallback function ***DO NOT OVERRIDE***
   * Note that other contracts will transfer funds with a base gas stipend
   * of 2300, which is not enough to call buyTokens. Consider calling
   * buyTokens directly when purchasing tokens from a contract.
   */
  receive() external payable {
    buyTokens(_msgSender());
  }

  /**
   * @return the token being sold.
   */
  function token() public view returns (IERC20) {
    return _token;
  }

  /**
   * @return the address of the wallet that will hold the tokens.
   */
  function tokenWallet() public view returns (address) {
    return _tokenWallet;
  }

  /**
   * @return the address where funds are collected.
   */
  function fundWallet() public view returns (address payable) {
    return _fundWallet;
  }

  /**
   * @return the number of token units a buyer gets per wei.
   */
  function rate() public view returns (uint256) {
    return _rate;
  }

  function setRate(uint256 newRate) public onlyOwner {
    require(newRate != 0, "CS: rate is 0");
    _rate = newRate;
  }

  /**
   * @return the amount of wei raised.
   */
  function tokensRaised() public view returns (uint256) {
    return _tokensRaised;
  }

  /**
   * @return Amount of tokens left in the allowance
   */
  function remainingTokens() public view returns (uint256) {
    return Math.min(token().balanceOf(_tokenWallet), token().allowance(_tokenWallet, address(this)));
  }

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * This function has a non-reentrancy guard, so it shouldn't be called by
   * another `nonReentrant` function.
   * @param beneficiary Recipient of the token purchase
   */
  function buyTokens(address beneficiary) public payable virtual nonReentrant {
    uint256 weiAmount = msg.value;

    // calculate token amount to be transferred
    uint256 tokens = _getTokenAmount(weiAmount);

    _preValidatePurchase(beneficiary, tokens);

    // update state
    _tokensRaised = _tokensRaised + tokens;

    _processPurchase(beneficiary, tokens);
    emit TokensPurchased(_msgSender(), beneficiary, weiAmount, tokens);

    _forwardFunds();
  }

  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met.
   * Use `super` in contracts that inherit from Crowdsale to extend their validations.
   * Example from CappedCrowdsale.sol's _preValidatePurchase method:
   *     super._preValidatePurchase(beneficiary, tokenAmount);
   *     require(tokensRaised() + tokenAmount <= cap);
   * @param beneficiary Address performing the token purchase
   * @param tokenAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(address beneficiary, uint256 tokenAmount) internal virtual {
    require(beneficiary != address(0), "CS: beneficiary is the zero address");
    require(tokenAmount != 0, "CS: tokenAmount is 0");
    this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
  }

  /**
   * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends
   * its tokens.
   * @param beneficiary Address performing the token purchase
   * @param tokenAmount Number of tokens to be emitted
   */
  function _deliverTokens(address beneficiary, uint256 tokenAmount) internal {
    token().safeTransferFrom(_tokenWallet, beneficiary, tokenAmount);
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Doesn't necessarily emit/send
   * tokens.
   * @param beneficiary Address receiving the tokens
   * @param tokenAmount Number of tokens to be purchased
   */
  function _processPurchase(address beneficiary, uint256 tokenAmount) internal virtual {
    // solhint-disable-previous-line no-empty-blocks
  }

  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @param weiAmount Value in wei to be converted into tokens
   * @return Number of tokens that can be purchased with the specified _weiAmount
   */
  function _getTokenAmount(uint256 weiAmount) internal view returns (uint256) {
    return weiAmount * _rate;
  }

  /**
   * @dev Determines how ETH is stored/forwarded on purchases.
   */
  function _forwardFunds() internal {
    _fundWallet.transfer(msg.value);
  }
}
