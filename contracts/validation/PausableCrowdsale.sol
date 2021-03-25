// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "../Crowdsale.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PausableCrowdsale
 * @dev Extension of Crowdsale contract where purchases can be paused and unpaused by the pauser role.
 */
abstract contract PausableCrowdsale is Crowdsale, Pausable {
  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met.
   * Use super to concatenate validations.
   * Adds the validation that the crowdsale must not be paused.
   * @param _beneficiary Address performing the token purchase
   * @param tokenAmount Amount of tokens bought
   */
  function _preValidatePurchase(address _beneficiary, uint256 tokenAmount) internal virtual override whenNotPaused {
    return super._preValidatePurchase(_beneficiary, tokenAmount);
  }

  /**
   * @notice Pauses the contract.
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpauses the contract.
   */
  function unpause() external onlyOwner {
    _unpause();
  }
}
