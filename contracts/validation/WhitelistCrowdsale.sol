//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../Crowdsale.sol";

/**
 * @title WhitelistCrowdsale
 * @dev Crowdsale in which only whitelisted beneficiaries can contribute.
 */
abstract contract WhitelistCrowdsale is Crowdsale, AccessControl {
  // Create a new role identifier for the beneficiary
  bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");

  constructor() {
    // Grant the contract deployer the default admin role: it will be able
    // to grant and revoke any roles
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  /**
   * @dev Extend parent behavior requiring beneficiary to be whitelisted. Note that no
   * restriction is imposed on the account sending the transaction.
   * @param _beneficiary Token beneficiary
   * @param tokenAmount Amount of tokens bought
   */
  function _preValidatePurchase(address _beneficiary, uint256 tokenAmount) internal virtual override {
    require(hasRole(BENEFICIARY_ROLE, _beneficiary), "WC: beneficiary doesn't have the correct role");
    super._preValidatePurchase(_beneficiary, tokenAmount);
  }
}
