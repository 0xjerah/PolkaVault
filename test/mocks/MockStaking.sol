// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Mock Staking precompile deployed at 0x0804 in tests
/// @dev Tracks calls and state for assertion in tests
contract MockStaking {
    uint256 public bonded;
    uint256 public totalUnbonding;
    uint256 public bondCalls;
    uint256 public bondExtraCalls;
    uint256 public unbondCalls;
    uint256 public withdrawUnbondedCalls;

    function bond(uint256 value, uint8 /* payee */ ) external {
        bonded += value;
        bondCalls++;
    }

    function bondExtra(uint256 maxAdditional) external {
        bonded += maxAdditional;
        bondExtraCalls++;
    }

    function unbond(uint256 value) external {
        if (bonded >= value) bonded -= value;
        totalUnbonding += value;
        unbondCalls++;
    }

    function withdrawUnbonded(uint32 /* numSlashingSpans */ ) external returns (bool) {
        totalUnbonding = 0;
        withdrawUnbondedCalls++;
        return true;
    }

    function nominate(bytes32[] calldata /* targets */ ) external {}

    function chill() external {}

    function setPayee(uint8 /* payee */ ) external {}
}
