// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

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

  /**
   * @dev Grants `role` to all `accounts`.
   *
   * If some `account` had not been already granted `role`, emits a {RoleGranted}
   * event.
   *
   * Requirements:
   *
   * - the caller must have ``role``'s admin role.
   */
  function grantRoles(bytes32 role, address[] memory accounts) external {
    for (uint256 i = 0; i < accounts.length; i++) {
      grantRole(role, accounts[i]);
    }
  }
}
