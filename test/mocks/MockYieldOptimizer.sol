// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Mock that mirrors the Rust PVM YieldOptimizer's APY computation.
///      Used in Foundry tests to verify the cross-VM call path works.
contract MockYieldOptimizer {
    function computeApy(
        uint256 prevRate,
        uint256 newRate,
        uint256 elapsed
    ) external pure returns (uint256 apyBps) {
        if (elapsed == 0 || prevRate == 0 || newRate <= prevRate) return 0;
        // apyBps = (newRate - prevRate) * 10_000 * 365 days / (prevRate * elapsed)
        uint256 numerator   = (newRate - prevRate) * 10_000 * 365 days;
        uint256 denominator = prevRate * elapsed;
        return numerator / denominator;
    }
}
