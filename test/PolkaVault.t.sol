// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PolkaVault} from "../src/PolkaVault.sol";

contract PolkaVaultTest is Test {
    PolkaVault vault;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vault = new PolkaVault();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 50 ether);
    }

    function test_createPortfolio() public {
        vm.prank(alice);
        vault.createPortfolio("Alice's Portfolio");

        (address owner, uint256 createdAt,, string memory label) =
            vault.portfolios(alice);
        assertEq(owner, alice);
        assertGt(createdAt, 0);
        assertEq(label, "Alice's Portfolio");
    }

    function test_cannotCreateDuplicatePortfolio() public {
        vm.startPrank(alice);
        vault.createPortfolio("First");
        vm.expectRevert("Portfolio already exists");
        vault.createPortfolio("Second");
        vm.stopPrank();
    }

    function test_trackAsset() public {
        vm.startPrank(alice);
        vault.createPortfolio("Test");
        vault.trackAsset(1984); // USDT on Polkadot
        vault.trackAsset(1337); // USDC on Polkadot

        uint256[] memory tracked = vault.getTrackedAssets(alice);
        assertEq(tracked.length, 2);
        assertEq(tracked[0], 1984);
        assertEq(tracked[1], 1337);
        vm.stopPrank();
    }

    function test_cannotTrackDuplicateAsset() public {
        vm.startPrank(alice);
        vault.createPortfolio("Test");
        vault.trackAsset(1984);
        vm.expectRevert("Asset already tracked");
        vault.trackAsset(1984);
        vm.stopPrank();
    }

    function test_untrackAsset() public {
        vm.startPrank(alice);
        vault.createPortfolio("Test");
        vault.trackAsset(1984);
        vault.trackAsset(1337);
        vault.untrackAsset(1984);

        uint256[] memory tracked = vault.getTrackedAssets(alice);
        assertEq(tracked.length, 1);
        assertEq(tracked[0], 1337);
        vm.stopPrank();
    }

    function test_requiresPortfolioForOperations() public {
        vm.startPrank(alice);
        vm.expectRevert("No portfolio - create one first");
        vault.trackAsset(1984);
        vm.stopPrank();
    }

    function test_precompileAddresses() public view {
        assertEq(vault.BALANCES_PRECOMPILE(), address(0x0402));
        assertEq(vault.STAKING_PRECOMPILE(), address(0x0804));
        assertEq(vault.XCM_PRECOMPILE(), address(0x0816));
        assertEq(vault.ASSETS_BASE(), address(0x0403));
    }
}
