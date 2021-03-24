//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.3;

import "./Crowdsale.sol";
import "./validation/PausableCrowdsale.sol";
import "./validation/CappedCrowdsale.sol";
import "./validation/TimedCrowdsale.sol";
import "./validation/WhitelistCrowdsale.sol";
import "./distribution/TokenLockCrowdsale.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
    uint256 newBeneficiaryHardCap,
    address newTokenWallet,
    uint256 newOpeningTime,
    uint256 newClosingTime,
    uint256 newAdditionalLockPeriod
  )
    Crowdsale(newRate, newFundWallet, newToken, newTokenWallet)
    PausableCrowdsale()
    CappedCrowdsale(newCap, newBeneficiaryMinCap, newBeneficiaryHardCap)
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
