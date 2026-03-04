// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Mock XCM precompile deployed at 0x0A0000 in tests
contract MockXCM {
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    bytes public lastMessage;
    bytes public lastDest;
    uint256 public executeCalls;
    uint256 public sendCalls;

    function execute(bytes calldata message, Weight calldata /* weight */ ) external {
        lastMessage = message;
        executeCalls++;
    }

    function send(bytes calldata dest, bytes calldata message) external {
        lastDest    = dest;
        lastMessage = message;
        sendCalls++;
    }

    function weighMessage(bytes calldata /* message */ )
        external
        pure
        returns (Weight memory)
    {
        return Weight({refTime: 1_000_000, proofSize: 10_000});
    }
}
