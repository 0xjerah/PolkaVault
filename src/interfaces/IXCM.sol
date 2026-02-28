// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IXCM - Polkadot Hub XCM Precompile Interface
/// @notice Interface for sending XCM messages cross-chain
/// @dev Precompile address: 0x0816
interface IXCM {
    /// @notice Execute a pre-encoded XCM message locally
    /// @param message SCALE-encoded XCM VersionedXcm message
    /// @param maxWeight Maximum weight (ref_time, proof_size) for execution
    function execute(bytes calldata message, uint64 maxWeight) external;
}
