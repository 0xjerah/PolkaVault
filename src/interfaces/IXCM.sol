// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IXCM - Polkadot Hub XCM Precompile Interface
/// @notice Located at 0x00000000000000000000000000000000000A0000
/// @dev Enables cross-chain interactions from Solidity contracts.
///      Uses Weight as a struct parameter (not flat u64).
///      Reference: https://docs.polkadot.com/smart-contracts/precompiles/xcm/
interface IXCM {
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    /// @notice Execute an XCM message locally using the caller's origin
    /// @param message The SCALE-encoded VersionedXcm message bytes
    /// @param weight Weight limit for execution
    function execute(bytes calldata message, Weight calldata weight) external;

    /// @notice Send an XCM message to a destination chain
    /// @param dest SCALE-encoded VersionedLocation of the destination
    /// @param message The SCALE-encoded XCM message bytes
    function send(bytes calldata dest, bytes calldata message) external;

    /// @notice Estimate the weight of an XCM message
    /// @param message The SCALE-encoded XCM message bytes
    /// @return weight The estimated execution weight
    function weighMessage(bytes calldata message) external view returns (Weight memory weight);
}
