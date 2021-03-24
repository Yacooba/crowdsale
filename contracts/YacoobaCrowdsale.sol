//SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "./Crowdsale.sol";
import "./validation/PausableCrowdsale.sol";
import "./validation/CappedCrowdsale.sol";
import "./validation/TimedCrowdsale.sol";
import "./validation/WhitelistCrowdsale.sol";
import "./distribution/TokenLockCrowdsale.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title YacoobaCrowdsale
 * @dev Yacooba crowdsale accepts purchases within a time frame and from a list of
 * pre approved accounts, it is also possible to pause token purchases at any time.
 * The crowdsale is defined by a total cap of tokens to be sold, nevertheless each
 * account has a minimum and a maximum token cap that should be respected.
 * Tokens aren't directly sent to the beneficiary account after purchase, they will
 * be stored in a vault for a period of time.
 */
contract YacoobaCrowdsale is
  Crowdsale,
  PausableCrowdsale,
  TimedCrowdsale,
  TokenLockCrowdsale,
  CappedCrowdsale,
  WhitelistCrowdsale
{
  constructor(
    uint256 newRate,
    address payable newFundWallet,
    IERC20 newToken,
    uint256 newCap,
    uint256 newBeneficiaryMinCap,
    uint256 newBeneficiaryMaxCap,
    address newTokenWallet,
    uint256 newOpeningTime,
    uint256 newClosingTime,
    uint256 newAdditionalLockPeriod
  )
    Crowdsale(newRate, newFundWallet, newToken, newTokenWallet)
    PausableCrowdsale()
    CappedCrowdsale(newCap, newBeneficiaryMinCap, newBeneficiaryMaxCap)
    TimedCrowdsale(newOpeningTime, newClosingTime)
    TokenLockCrowdsale(newAdditionalLockPeriod)
    WhitelistCrowdsale()
  {
    // solhint-disable-previous-line no-empty-blocks
  }

  function _preValidatePurchase(address beneficiary, uint256 tokenAmount)
    internal
    override(PausableCrowdsale, CappedCrowdsale, Crowdsale, TimedCrowdsale, WhitelistCrowdsale)
  {
    super._preValidatePurchase(beneficiary, tokenAmount);
  }

  function _processPurchase(address beneficiary, uint256 tokenAmount) internal override(Crowdsale, TokenLockCrowdsale) {
    TokenLockCrowdsale._processPurchase(beneficiary, tokenAmount);
  }
}
