//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
  constructor() ERC20("SampleToken", "ST") {
    _mint(msg.sender, 1000000000000000000000000000000);
  }

  function mint(address _to, uint256 _amount) public {
    _mint(_to, _amount);
  }
}
