// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../Crowdsale.sol";

/**
 * @title TimedCrowdsale
 * @dev Crowdsale accepting contributions only within a time frame.
 */
abstract contract TimedCrowdsale is Crowdsale {
  uint256 private _openingTime;
  uint256 private _closingTime;

  /**
   * Event for crowdsale extending
   * @param newClosingTime new closing time
   * @param prevClosingTime old closing time
   */
  event TimedCrowdsaleExtended(uint256 prevClosingTime, uint256 newClosingTime);

  /**
   * @dev Reverts if not in crowdsale time range.
   */
  modifier onlyWhileOpen {
    require(isOpen(), "TC: not open");
    _;
  }

  /**
   * @dev Constructor, takes crowdsale opening and closing times.
   * @param newOpeningTime Crowdsale opening time
   * @param newClosingTime Crowdsale closing time
   */
  constructor(uint256 newOpeningTime, uint256 newClosingTime) {
    require(newOpeningTime >= block.timestamp, "TC: opening time is before current time");
    require(newClosingTime > newOpeningTime, "TC: opening time is not before closing time");

    _openingTime = newOpeningTime;
    _closingTime = newClosingTime;
  }

  /**
   * @return the crowdsale opening time.
   */
  function openingTime() public view returns (uint256) {
    return _openingTime;
  }

  /**
   * @return the crowdsale closing time.
   */
  function closingTime() public view returns (uint256) {
    return _closingTime;
  }

  /**
   * @return true if the crowdsale is open, false otherwise.
   */
  function isOpen() public view returns (bool) {
    // solhint-disable-next-line not-rely-on-time
    return block.timestamp >= _openingTime && block.timestamp <= _closingTime;
  }

  /**
   * @dev Checks whether the period in which the crowdsale is open has already elapsed.
   * @return Whether crowdsale period has elapsed
   */
  function hasClosed() public view returns (bool) {
    // solhint-disable-next-line not-rely-on-time
    return block.timestamp > _closingTime;
  }

  /**
   * @dev Extend parent behavior requiring to be within contributing period.
   * @param beneficiary Token purchaser
   * @param tokenAmount Amount of wei contributed
   */
  function _preValidatePurchase(address beneficiary, uint256 tokenAmount) internal virtual override onlyWhileOpen {
    super._preValidatePurchase(beneficiary, tokenAmount);
  }

  /**
   * @dev Extend crowdsale.
   * @param newClosingTime Crowdsale closing time
   */
  function _extendTime(uint256 newClosingTime) internal {
    require(!hasClosed(), "TC: already closed");
    // solhint-disable-next-line max-line-length
    require(newClosingTime > _closingTime, "TC: new closing time is before current closing time");

    emit TimedCrowdsaleExtended(_closingTime, newClosingTime);
    _closingTime = newClosingTime;
  }

  function extendTime(uint256 newClosingTime) public onlyOwner() {
    _extendTime(newClosingTime);
  }
}
