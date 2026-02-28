// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IBalances - Polkadot Hub Balances Precompile Interface
/// @notice Interface for native DOT balance operations
/// @dev Precompile address: 0x0402 (ERC-20 style interface for native token)
interface IBalances {
    /// @notice Get the native DOT balance of an account
    function balanceOf(address account) external view returns (uint256);

    /// @notice Get the total supply of native DOT
    function totalSupply() external view returns (uint256);

    /// @notice Transfer native DOT to a recipient
    function transfer(address to, uint256 value) external returns (bool);

    /// @notice Approve a spender for native DOT
    function approve(address spender, uint256 value) external returns (bool);

    /// @notice Get allowance for native DOT
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Transfer native DOT from one account to another
    function transferFrom(address from, address to, uint256 value) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
