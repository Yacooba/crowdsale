//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.0;

import "../validation/TimedCrowdsale.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenLockCrowdsale
 * @dev Crowdsale that locks tokens from withdrawal until it ends the crowdsale
 * and the additional lock period
 */
abstract contract TokenLockCrowdsale is TimedCrowdsale {
  uint256 private _additionalLockPeriod;

  mapping(address => uint256) private _balances;
  __unstable__TokenVault private _vault;

  constructor(uint256 newAdditionalLockPeriod) {
    require(newAdditionalLockPeriod != 0, "TLC: additional lock period is 0");
    _vault = new __unstable__TokenVault();
    _additionalLockPeriod = newAdditionalLockPeriod;
  }

  /**
   * @dev Withdraw tokens only after crowdsale ends.
   * @param beneficiary Whose tokens will be withdrawn.
   */
  function withdrawTokens(address beneficiary) public {
    require(hasClosed(), "TLC: crowdsale not closed");
    require(isUnlocked(), "TLC: tokens are still locked");
    uint256 amount = _balances[beneficiary];
    require(amount > 0, "TLC: beneficiary is not due any tokens");

    _balances[beneficiary] = 0;
    _vault.transfer(token(), beneficiary, amount);
  }

  /**
   * @return the balance of an account.
   */
  function balanceOf(address account) public view returns (uint256) {
    return _balances[account];
  }

  /**
   * @return the locking time of all tokens.
   */
  function lockingTime() public view returns (uint256) {
    return closingTime() + _additionalLockPeriod;
  }

  /**
   * @return true if all tokens are unlocked, false otherwise.
   */
  function isUnlocked() public view returns (bool) {
    return block.timestamp > lockingTime();
  }

  /**
   * @dev Overrides parent by storing due balances, and delivering tokens to the vault instead of the end user. This
   * ensures that the tokens will be available by the time they are withdrawn (which may not be the case if
   * `_deliverTokens` was called later).
   * @param beneficiary Token purchaser
   * @param tokenAmount Amount of tokens purchased
   */
  function _processPurchase(address beneficiary, uint256 tokenAmount) internal virtual override {
    _balances[beneficiary] = _balances[beneficiary] + tokenAmount;
    _deliverTokens(address(_vault), tokenAmount);
  }
}

/**
 * @title __unstable__TokenVault
 * @dev Similar to an Escrow for tokens, this contract allows its primary account to spend its tokens as it sees fit.
 * This contract is an internal helper for PostDeliveryCrowdsale, and should not be used outside of this context.
 */
// solhint-disable-next-line contract-name-camelcase
contract __unstable__TokenVault is Ownable {
  function transfer(
    IERC20 token,
    address to,
    uint256 amount
  ) public onlyOwner {
    token.transfer(to, amount);
  }
}
