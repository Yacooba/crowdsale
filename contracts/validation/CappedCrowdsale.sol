// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "../Crowdsale.sol";

/**
 * @title CappedCrowdsale
 * @dev Crowdsale with a limit for total contributions.
 */
abstract contract CappedCrowdsale is Crowdsale {
  uint256 private _cap;
  uint256 private _beneficiaryMinCap;
  uint256 private _beneficiaryMaxCap;
  mapping(address => uint256) private _contributions;

  /**
   * @dev Constructor, takes maximum amount of wei accepted in the crowdsale.
   * @param newCap Max amount of wei to be contributed
   * @param newBeneficiaryMinCap Minimum amount of tokens a beneficiary can purchase
   * @param newBeneficiaryMaxCap Maximum amount of tokens a beneficiary can purchase
   */
  constructor(
    uint256 newCap,
    uint256 newBeneficiaryMinCap,
    uint256 newBeneficiaryMaxCap
  ) {
    require(newCap > 0, "CC: cap is 0");
    _cap = newCap;
    _beneficiaryMinCap = newBeneficiaryMinCap;
    _beneficiaryMaxCap = newBeneficiaryMaxCap;
  }

  /**
   * @return the cap of the crowdsale.
   */
  function cap() public view returns (uint256) {
    return _cap;
  }

  /**
   * @return the minimum beneficiary cap to purchase tokens.
   */
  function beneficiaryMinCap() public view returns (uint256) {
    return _beneficiaryMinCap;
  }

  /**
   * @return the maximum beneficiary cap to purchase tokens.
   */
  function beneficiaryMaxCap() public view returns (uint256) {
    return _beneficiaryMaxCap;
  }

  /**
   * @dev Checks whether the cap has been reached.
   * @return Whether the cap was reached
   */
  function capReached() public view returns (bool) {
    return tokensRaised() >= _cap;
  }

  /**
   * @dev Extend parent behavior requiring purchase to respect the funding cap.
   * @param beneficiary Token purchaser
   * @param tokenAmount Amount of wei contributed
   */
  function _preValidatePurchase(address beneficiary, uint256 tokenAmount) internal virtual override {
    super._preValidatePurchase(beneficiary, tokenAmount);
    uint256 _existingContribution = _contributions[beneficiary];
    uint256 _newContribution = _existingContribution + tokenAmount;
    require(_newContribution >= _beneficiaryMinCap, "CC: beneficiary min cap not met");
    require(_newContribution <= _beneficiaryMaxCap, "CC: contributing above beneficiary max cap");
    _contributions[beneficiary] = _newContribution;
    require(tokensRaised() + tokenAmount <= _cap, "CC: cap exceeded");
  }
}
