// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStaking - Polkadot Hub Staking Precompile Interface
/// @notice Interface for the Staking precompile on Polkadot Hub
/// @dev Precompile address: 0x0804
///      Allows nominating validators and managing staking positions
interface IStaking {
    /// @notice Nominate a set of validators
    /// @param targets Array of validator addresses to nominate
    function nominate(bytes32[] calldata targets) external;

    /// @notice Bond tokens for staking
    /// @param value Amount to bond (in plancks)
    /// @param payee Reward destination (0=Staked, 1=Stash, 2=Controller)
    function bond(uint256 value, uint8 payee) external;

    /// @notice Bond extra tokens on top of existing stake
    /// @param maxAdditional Amount of additional tokens to bond
    function bondExtra(uint256 maxAdditional) external;

    /// @notice Unbond tokens from staking (subject to unbonding period)
    /// @param value Amount to unbond
    function unbond(uint256 value) external;

    /// @notice Withdraw unbonded tokens after the unbonding period
    /// @param numSlashingSpans Number of slashing spans to check
    function withdrawUnbonded(uint32 numSlashingSpans) external;

    /// @notice Chill (stop nominating/validating)
    function chill() external;

    /// @notice Set the reward destination
    /// @param payee Reward destination enum
    function setPayee(uint8 payee) external;
}
