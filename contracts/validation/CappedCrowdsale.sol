//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.0;

import "../Crowdsale.sol";

/**
 * @title CappedCrowdsale
 * @dev Crowdsale with a limit for total contributions.
 */
abstract contract CappedCrowdsale is Crowdsale {
  uint256 private _cap;
  uint256 public beneficiaryMinCap;
  uint256 public beneficiaryHardCap;
  mapping(address => uint256) public contributions;

  /**
   * @dev Constructor, takes maximum amount of wei accepted in the crowdsale.
   * @param newCap Max amount of wei to be contributed
   */
  constructor(
    uint256 newCap,
    uint256 newBeneficiaryMinCap,
    uint256 newBeneficiaryHardCap
  ) {
    require(newCap > 0, "CC: cap is 0");
    _cap = newCap;
    beneficiaryMinCap = newBeneficiaryMinCap;
    beneficiaryHardCap = newBeneficiaryHardCap;
  }

  /**
   * @return the cap of the crowdsale.
   */
  function cap() public view returns (uint256) {
    return _cap;
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
    uint256 _existingContribution = contributions[beneficiary];
    uint256 _newContribution = _existingContribution + tokenAmount;
    require(_newContribution >= beneficiaryMinCap, "CC: beneficiary min cap not met");
    require(_newContribution <= beneficiaryHardCap, "CC: contributing above beneficiary max cap");
    contributions[beneficiary] = _newContribution;
    require(tokensRaised() + tokenAmount <= _cap, "CC: cap exceeded");
  }
}
