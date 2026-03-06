// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IYieldOptimizer - Interface for the Rust PVM YieldOptimizer contract
/// @notice Deployed as a native PolkaVM (RISC-V) contract, callable cross-VM
///         from Solidity via pallet-revive's transparent VM routing.
/// @dev The Rust contract computes annualized APY from exchange rate growth.
///      Cross-VM call: Solidity (EVM) → pallet-revive → PolkaVM (RISC-V)
interface IYieldOptimizer {
    /// @notice Compute annualized APY in basis points from exchange rate growth
    /// @param prevRate  Exchange rate at the previous compound (scaled by 1e18)
    /// @param newRate   Exchange rate after the current compound (scaled by 1e18)
    /// @param elapsed   Seconds between the two compounds
    /// @return apyBps   Annualized yield in basis points (e.g., 1000 = 10%)
    function computeApy(
        uint256 prevRate,
        uint256 newRate,
        uint256 elapsed
    ) external view returns (uint256 apyBps);
}
