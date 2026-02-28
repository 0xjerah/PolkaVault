// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAssets - Polkadot Hub Assets Precompile Interface
/// @notice ERC-20 style interface for native Polkadot assets at 0x0403
/// @dev Each asset ID maps to its own precompile address via the Assets pallet
interface IAssets {
    /// @notice Get the balance of an account for this asset
    function balanceOf(address account) external view returns (uint256);

    /// @notice Get the total supply of this asset
    function totalSupply() external view returns (uint256);

    /// @notice Get the asset name
    function name() external view returns (string memory);

    /// @notice Get the asset symbol
    function symbol() external view returns (string memory);

    /// @notice Get the number of decimals
    function decimals() external view returns (uint8);

    /// @notice Transfer tokens to a recipient
    function transfer(address to, uint256 value) external returns (bool);

    /// @notice Approve a spender to spend tokens
    function approve(address spender, uint256 value) external returns (bool);

    /// @notice Get the allowance for a spender
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Transfer tokens from one account to another
    function transferFrom(address from, address to, uint256 value) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
