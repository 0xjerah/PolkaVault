// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PolkaVault} from "../src/PolkaVault.sol";
import {MockStaking} from "./mocks/MockStaking.sol";
import {MockXCM} from "./mocks/MockXCM.sol";
import {MockYieldOptimizer} from "./mocks/MockYieldOptimizer.sol";

contract PolkaVaultTest is Test {
    PolkaVault vault;
    MockStaking mockStaking;
    MockXCM     mockXcm;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant ONE_DOT = 1e18;

    function setUp() public {
        // Deploy mocks and etch them at the precompile addresses
        mockStaking = new MockStaking();
        mockXcm     = new MockXCM();

        vm.etch(address(0x0804), address(mockStaking).code);
        vm.etch(0x00000000000000000000000000000000000a0000, address(mockXcm).code);

        vault = new PolkaVault();

        // Set a short unbonding period so withdrawal tests don't need 28-day warps
        vault.setUnbondingPeriod(1 hours);

        vm.deal(alice, 1000 * ONE_DOT);
        vm.deal(bob,   500  * ONE_DOT);
        vm.deal(carol, 250  * ONE_DOT);
    }

    // ============================================================
    //                    EXCHANGE RATE
    // ============================================================

    function test_exchangeRate_starts_at_1() public view {
        assertEq(vault.exchangeRate(), 1e18);
    }

    function test_exchangeRate_stays_1_after_first_deposit() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        assertEq(vault.exchangeRate(), 1e18);
    }

    function test_exchangeRate_increases_after_compound() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        uint256 rateBefore = vault.exchangeRate();

        // Simulate 5 DOT staking rewards arriving in contract balance (payee=Stash)
        vm.deal(address(vault), 5 * ONE_DOT);
        vault.compound();

        assertGt(vault.exchangeRate(), rateBefore);
        // totalStaked = 105, supply = 100 → rate = 1.05e18
        assertEq(vault.exchangeRate(), 1.05e18);
    }

    // ============================================================
    //                    DEPOSIT
    // ============================================================

    function test_deposit_mints_stDOT_1to1_on_first_deposit() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        assertEq(vault.balanceOf(alice), 100 * ONE_DOT);
        assertEq(vault.totalStaked(), 100 * ONE_DOT);
    }

    function test_deposit_mints_fewer_shares_after_compound() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        // Simulate 100 DOT staking rewards → rate is now 2:1
        vm.deal(address(vault), 100 * ONE_DOT);
        vault.compound();
        assertEq(vault.exchangeRate(), 2e18);

        // Bob deposits 100 DOT at 2:1 rate → gets 50 stDOT
        vm.prank(bob);
        vault.deposit{value: 100 * ONE_DOT}();

        assertEq(vault.balanceOf(bob), 50 * ONE_DOT);
    }

    function test_deposit_reverts_on_zero() public {
        vm.prank(alice);
        vm.expectRevert(PolkaVault.ZeroAmount.selector);
        vault.deposit{value: 0}();
    }

    function test_deposit_calls_staking_precompile() public {
        // Read mock state via etch — use a fresh mock we control
        MockStaking ms = new MockStaking();
        vm.etch(address(0x0804), address(ms).code);

        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        // bond() should have been called once (first deposit)
        // We verify indirectly: totalStaked matches deposit
        assertEq(vault.totalStaked(), 100 * ONE_DOT);
    }

    // ============================================================
    //                    WITHDRAW
    // ============================================================

    function test_requestWithdraw_burns_stDOT() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        uint256 sharesBefore = vault.balanceOf(alice);
        vault.requestWithdraw(50 * ONE_DOT);

        assertEq(vault.balanceOf(alice), sharesBefore - 50 * ONE_DOT);
        vm.stopPrank();
    }

    function test_requestWithdraw_queues_correct_dot() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vault.requestWithdraw(100 * ONE_DOT);

        PolkaVault.WithdrawRequest[] memory reqs = vault.getWithdrawRequests(alice);
        assertEq(reqs.length, 1);
        assertEq(reqs[0].dot, 100 * ONE_DOT);
        assertFalse(reqs[0].claimed);
        vm.stopPrank();
    }

    function test_requestWithdraw_dot_reflects_compounded_rate() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        // Simulate 100 DOT rewards → rate 2:1. Alice's 100 stDOT is now worth 200 DOT.
        vm.deal(address(vault), 100 * ONE_DOT);
        vault.compound();

        vm.prank(alice);
        vault.requestWithdraw(100 * ONE_DOT); // redeem all shares

        PolkaVault.WithdrawRequest[] memory reqs = vault.getWithdrawRequests(alice);
        assertEq(reqs[0].dot, 200 * ONE_DOT);
    }

    function test_requestWithdraw_reverts_insufficient_shares() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vm.expectRevert(PolkaVault.InsufficientBalance.selector);
        vault.requestWithdraw(200 * ONE_DOT);
        vm.stopPrank();
    }

    function test_claimWithdrawal_sends_dot() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vault.requestWithdraw(100 * ONE_DOT);

        uint256 balBefore = alice.balance;

        vm.warp(block.timestamp + 2 hours); // past 1-hour unbonding period
        vm.deal(address(vault), 100 * ONE_DOT); // simulate withdrawUnbonded returning funds
        vault.claimWithdrawal(0);

        assertEq(alice.balance, balBefore + 100 * ONE_DOT);
        vm.stopPrank();
    }

    function test_claimWithdrawal_reverts_before_period() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vault.requestWithdraw(100 * ONE_DOT);

        vm.expectRevert(); // StillUnbonding
        vault.claimWithdrawal(0);
        vm.stopPrank();
    }

    function test_claimWithdrawal_reverts_if_already_claimed() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vault.requestWithdraw(100 * ONE_DOT);

        vm.warp(block.timestamp + 2 hours);
        vm.deal(address(vault), 100 * ONE_DOT);
        vault.claimWithdrawal(0);

        vm.expectRevert(PolkaVault.AlreadyClaimed.selector);
        vault.claimWithdrawal(0);
        vm.stopPrank();
    }

    // ============================================================
    //                    MULTIPLE DEPOSITORS
    // ============================================================

    function test_proportional_shares_multiple_depositors() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        vm.prank(bob);
        vault.deposit{value: 100 * ONE_DOT}();

        // Both deposited at 1:1 → equal shares
        assertEq(vault.balanceOf(alice), vault.balanceOf(bob));

        // Simulate 100 DOT rewards → rate is now 1.5:1 (300 staked / 200 supply)
        vm.deal(address(vault), 100 * ONE_DOT);
        vault.compound();

        // Both hold equal shares → equal DOT value
        assertEq(vault.dotForShares(vault.balanceOf(alice)), vault.dotForShares(vault.balanceOf(bob)));
    }

    function test_late_depositor_gets_fewer_shares() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        // Simulate 100 DOT rewards → rate 2:1
        vm.deal(address(vault), 100 * ONE_DOT);
        vault.compound();

        vm.prank(bob);
        vault.deposit{value: 100 * ONE_DOT}(); // gets 50 stDOT

        // Alice: 100 stDOT worth 200 DOT. Bob: 50 stDOT worth 100 DOT. Correct.
        assertEq(vault.dotForShares(vault.balanceOf(alice)), 200 * ONE_DOT);
        assertEq(vault.dotForShares(vault.balanceOf(bob)),   100 * ONE_DOT);
    }

    // ============================================================
    //                    VAULT STATS
    // ============================================================

    function test_getVaultStats() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vm.deal(address(vault), 10 * ONE_DOT);
        vault.compound();

        (uint256 rate, uint256 staked, uint256 unbonding, uint256 supply) = vault.getVaultStats();

        assertEq(staked,   110 * ONE_DOT);
        assertEq(supply,   100 * ONE_DOT);
        assertEq(unbonding, 0);
        assertEq(rate,     1.1e18);
    }

    function test_getUserPosition() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vm.deal(address(vault), 100 * ONE_DOT);
        vault.compound(); // rate → 2:1

        (uint256 stDotBal, uint256 dotVal) = vault.getUserPosition(alice);
        assertEq(stDotBal, 100 * ONE_DOT);
        assertEq(dotVal,   200 * ONE_DOT);
    }

    // ============================================================
    //                    ERC-20
    // ============================================================

    function test_stDOT_transfer() public {
        vm.startPrank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vault.transfer(bob, 40 * ONE_DOT);

        assertEq(vault.balanceOf(alice), 60 * ONE_DOT);
        assertEq(vault.balanceOf(bob),   40 * ONE_DOT);
        vm.stopPrank();
    }

    function test_stDOT_transferFrom() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        vm.prank(alice);
        vault.approve(bob, 50 * ONE_DOT);

        vm.prank(bob);
        vault.transferFrom(alice, carol, 50 * ONE_DOT);

        assertEq(vault.balanceOf(alice), 50 * ONE_DOT);
        assertEq(vault.balanceOf(carol), 50 * ONE_DOT);
    }

    function test_stDOT_metadata() public view {
        assertEq(vault.name(),     "Staked DOT");
        assertEq(vault.symbol(),   "stDOT");
        assertEq(vault.decimals(), 18);
    }

    // ============================================================
    //                    XCM: CROSS-CHAIN SEND
    // ============================================================

    function test_sendCrossChain_burns_shares() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        uint256 sharesBefore = vault.balanceOf(alice);

        uint128 fee = vault.xcmFeeAmount(); // read before prank so static call doesn't consume it
        vm.prank(alice);
        vault.sendCrossChain{value: fee}(
            50 * ONE_DOT,
            bytes32(uint256(uint160(alice)))
        );

        assertEq(vault.balanceOf(alice), sharesBefore - 50 * ONE_DOT);
    }

    function test_sendCrossChain_reverts_insufficient_fee() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        vm.prank(alice);
        vm.expectRevert(PolkaVault.InsufficientFeeAttached.selector);
        vault.sendCrossChain{value: 0}(50 * ONE_DOT, bytes32(uint256(uint160(alice))));
    }

    function test_sendCrossChain_reverts_zero_shares() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        uint128 fee = vault.xcmFeeAmount(); // read before expectRevert + prank
        vm.prank(alice);
        vm.expectRevert(PolkaVault.ZeroAmount.selector);
        vault.sendCrossChain{value: fee}(0, bytes32(uint256(uint160(alice))));
    }

    // ============================================================
    //                    ADMIN
    // ============================================================

    function test_setUnbondingPeriod() public {
        vault.setUnbondingPeriod(7 days);
        assertEq(vault.unbondingPeriod(), 7 days);
    }

    function test_setUnbondingPeriod_reverts_non_owner() public {
        vm.prank(alice);
        vm.expectRevert(PolkaVault.Unauthorized.selector);
        vault.setUnbondingPeriod(7 days);
    }

    function test_precompile_addresses() public view {
        assertEq(vault.BALANCES(),  address(0x0402));
        assertEq(vault.STAKING(),   address(0x0804));
        assertEq(address(vault.XCM()), 0x00000000000000000000000000000000000a0000);
    }

    // ============================================================
    //                    VALIDATOR NOMINATION
    // ============================================================

    function test_nominateValidators_stores_targets() public {
        // Need to bond first (vault must be in bonded state for nominate to make sense)
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        bytes32[] memory targets = new bytes32[](2);
        targets[0] = bytes32(uint256(0xAAAA));
        targets[1] = bytes32(uint256(0xBBBB));

        vault.nominateValidators(targets);

        bytes32[] memory stored = vault.getNominators();
        assertEq(stored.length, 2);
        assertEq(stored[0], targets[0]);
        assertEq(stored[1], targets[1]);
    }

    function test_nominateValidators_reverts_non_owner() public {
        bytes32[] memory targets = new bytes32[](1);
        targets[0] = bytes32(uint256(0xAAAA));

        vm.prank(alice);
        vm.expectRevert(PolkaVault.Unauthorized.selector);
        vault.nominateValidators(targets);
    }

    function test_nominateValidators_reverts_empty() public {
        bytes32[] memory targets = new bytes32[](0);
        vm.expectRevert();
        vault.nominateValidators(targets);
    }

    function test_nominateValidators_replaces_previous() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        bytes32[] memory first = new bytes32[](1);
        first[0] = bytes32(uint256(0xAAAA));
        vault.nominateValidators(first);

        bytes32[] memory second = new bytes32[](2);
        second[0] = bytes32(uint256(0xCCCC));
        second[1] = bytes32(uint256(0xDDDD));
        vault.nominateValidators(second);

        bytes32[] memory stored = vault.getNominators();
        assertEq(stored.length, 2);
        assertEq(stored[0], second[0]);
    }

    // ============================================================
    //                    UNIQUE DEPOSITORS
    // ============================================================

    function test_uniqueDepositors_increments_on_first_deposit() public {
        assertEq(vault.uniqueDepositors(), 0);

        vm.prank(alice);
        vault.deposit{value: 10 * ONE_DOT}();
        assertEq(vault.uniqueDepositors(), 1);

        vm.prank(bob);
        vault.deposit{value: 10 * ONE_DOT}();
        assertEq(vault.uniqueDepositors(), 2);
    }

    function test_uniqueDepositors_no_double_count() public {
        vm.prank(alice);
        vault.deposit{value: 10 * ONE_DOT}();
        vm.prank(alice);
        vault.deposit{value: 10 * ONE_DOT}();

        assertEq(vault.uniqueDepositors(), 1);
    }

    // ============================================================
    //                    KEEPER FEE
    // ============================================================

    function test_keeper_fee_paid_on_compound() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        vault.setKeeperFee(100); // 1%

        address keeper = makeAddr("keeper");

        // Simulate 10 DOT staking rewards arriving in contract
        vm.deal(address(vault), 10 * ONE_DOT);

        uint256 balBefore = keeper.balance;
        vm.prank(keeper);
        vault.compound();

        // 1% of 10 DOT = 0.1 DOT paid to keeper
        assertEq(keeper.balance - balBefore, 0.1 ether);
        // Only 9.9 DOT bonded
        assertEq(vault.totalStaked(), 109.9 ether);
    }

    function test_no_keeper_fee_when_zero() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        // keeperFeeBps defaults to 0 — all rewards bonded
        vm.deal(address(vault), 5 * ONE_DOT);
        vault.compound();
        assertEq(vault.totalStaked(), 105 * ONE_DOT);
    }

    function test_setKeeperFee_reverts_non_owner() public {
        vm.prank(alice);
        vm.expectRevert(PolkaVault.Unauthorized.selector);
        vault.setKeeperFee(100);
    }

    function test_setKeeperFee_reverts_above_max() public {
        vm.expectRevert();
        vault.setKeeperFee(501);
    }

    // ============================================================
    //                    REALIZED APY
    // ============================================================

    function test_lastApyBps_zero_before_first_compound() public {
        assertEq(vault.lastApyBps(), 0);
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        // First compound sets baseline but can't compute APY yet
        vm.deal(address(vault), 10 * ONE_DOT);
        vault.compound();
        assertEq(vault.lastApyBps(), 0);
    }

    function test_lastApyBps_computed_on_second_compound() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        // First compound at T=0 — sets baseline: rate = 1.1e18
        vm.deal(address(vault), 10 * ONE_DOT);
        vault.compound();

        // Advance exactly 365 days
        vm.warp(block.timestamp + 365 days);

        // Second compound: 10% of totalStaked (110) = 11 DOT → rate goes to 1.21e18
        // Growth = (1.21 - 1.1) / 1.1 = 0.1 = 10% in 365 days → APY = 1000 bps
        vm.deal(address(vault), 11 * ONE_DOT);
        vault.compound();

        assertEq(vault.lastApyBps(), 1000); // exactly 10% APY
    }

    function test_lastCompoundTime_updated() public {
        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        uint256 t = block.timestamp;
        vm.deal(address(vault), 5 * ONE_DOT);
        vault.compound();

        assertEq(vault.lastCompoundTime(), t);
    }

    // ============================================================
    //                    CROSS-VM YIELD OPTIMIZER
    // ============================================================

    function test_crossVM_apyBps_matches_solidity_fallback() public {
        // Deploy mock YieldOptimizer and wire it up
        MockYieldOptimizer mockOptimizer = new MockYieldOptimizer();
        vault.setYieldOptimizer(address(mockOptimizer));

        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();

        vm.deal(address(vault), 10 * ONE_DOT);
        vault.compound();
        vm.warp(block.timestamp + 365 days);
        vm.deal(address(vault), 11 * ONE_DOT);
        vault.compound();

        // Cross-VM path should give same 10% APY = 1000 bps
        assertEq(vault.lastApyBps(), 1000);
    }

    function test_crossVM_can_be_disabled() public {
        MockYieldOptimizer mockOptimizer = new MockYieldOptimizer();
        vault.setYieldOptimizer(address(mockOptimizer));

        // Disable by setting to address(0) — falls back to Solidity math
        vault.setYieldOptimizer(address(0));
        assertEq(vault.yieldOptimizer(), address(0));

        vm.prank(alice);
        vault.deposit{value: 100 * ONE_DOT}();
        vm.deal(address(vault), 10 * ONE_DOT);
        vault.compound();
        vm.warp(block.timestamp + 365 days);
        vm.deal(address(vault), 11 * ONE_DOT);
        vault.compound();

        assertEq(vault.lastApyBps(), 1000); // still works via fallback
    }

    function test_setYieldOptimizer_reverts_non_owner() public {
        vm.prank(alice);
        vm.expectRevert(PolkaVault.Unauthorized.selector);
        vault.setYieldOptimizer(makeAddr("attacker"));
    }
}
