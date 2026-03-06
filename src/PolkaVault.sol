// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStaking} from "./interfaces/IStaking.sol";
import {IBalances} from "./interfaces/IBalances.sol";
import {IAssets} from "./interfaces/IAssets.sol";
import {IXCM} from "./interfaces/IXCM.sol";
import {IYieldOptimizer} from "./interfaces/IYieldOptimizer.sol";
import {ScaleCodec} from "./libraries/ScaleCodec.sol";

/// @title PolkaVault — Native Liquid Staking Protocol for Polkadot Hub
/// @notice Deposit DOT → receive stDOT (liquid staking token).
///         stDOT appreciates against DOT as staking rewards compound.
///         Redeem stDOT and teleport DOT cross-chain to the Relay Chain via XCM.
/// @dev Uses Polkadot Hub precompiles exclusively:
///      Balances (0x0402), Staking (0x0804), Assets (0x0403+), XCM (0x0A0000)
///
///      Exchange rate mechanics:
///        rate = totalStaked / totalSupply (scaled by 1e18)
///        Starts at 1:1. Every compound() call increases rate for all holders.
///        Example: 1000 stDOT deposited at 1:1 → after compound(50 DOT) → worth 1050 DOT.
contract PolkaVault {

    // ============================================================
    //                    PRECOMPILE ADDRESSES
    // ============================================================

    address public constant BALANCES    = 0x0000000000000000000000000000000000000402;
    address public constant STAKING     = 0x0000000000000000000000000000000000000804;
    address public constant ASSETS_BASE = 0x0000000000000000000000000000000000000403;
    IXCM   public constant XCM          = IXCM(0x00000000000000000000000000000000000a0000);

    // ============================================================
    //                    stDOT ERC-20 STATE
    // ============================================================

    string  public constant name     = "Staked DOT";
    string  public constant symbol   = "stDOT";
    uint8   public constant decimals = 18;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // ============================================================
    //                    VAULT STATE
    // ============================================================

    /// @notice Total DOT currently bonded by this vault
    uint256 public totalStaked;

    /// @notice Total DOT currently in unbonding queue
    uint256 public totalUnbonding;

    /// @notice Number of unique addresses that have ever deposited
    uint256 public uniqueDepositors;

    /// @notice Tracks whether an address has deposited before (for uniqueDepositors count)
    mapping(address => bool) private _hasDeposited;

    /// @notice Current nominated validator set (set by owner via nominateValidators)
    bytes32[] private _nominators;

    /// @notice Whether the vault has made its initial bond call
    bool private _bonded;

    /// @notice Unbonding period — set to 28 days for mainnet, lower for testnet demo
    uint256 public unbondingPeriod = 28 days;

    /// @notice Keeper incentive in basis points sent to whoever calls compound() (0 = disabled)
    uint256 public keeperFeeBps;

    /// @notice Annualized yield in basis points computed from the most recent compound event
    uint256 public lastApyBps;

    /// @notice Timestamp of the most recent compound() call
    uint256 public lastCompoundTime;

    /// @notice Exchange rate recorded after the most recent compound() (baseline for next APY calc)
    uint256 public lastCompoundRate;

    /// @notice Address of the Rust PVM YieldOptimizer contract (cross-VM APY computation)
    address public yieldOptimizer;

    address public owner;

    uint256 private constant PRECISION = 1e18;

    // ============================================================
    //                    XCM CONSTANTS (XCM V5)
    // ============================================================

    uint8 private constant XCM_V5                = 5;
    uint8 private constant XCM_WITHDRAW_ASSET    = 0;
    uint8 private constant XCM_BUY_EXECUTION     = 19;
    uint8 private constant XCM_DEPOSIT_ASSET     = 13;
    uint8 private constant XCM_INITIATE_TELEPORT = 17;

    /// @notice DOT fee (plancks) attached to cross-chain sends for relay execution
    uint128 public xcmFeeAmount = 100_000_000; // 0.01 DOT

    uint64 public executeRefTime   = 50_000_000_000;
    uint64 public executeProofSize = 500_000;

    // ============================================================
    //                    WITHDRAWAL QUEUE
    // ============================================================

    struct WithdrawRequest {
        uint256 dot;
        uint256 claimableAt;
        bool    claimed;
    }

    mapping(address => WithdrawRequest[]) public withdrawRequests;

    // ============================================================
    //                    EVENTS
    // ============================================================

    // ERC-20 standard
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Vault
    event Deposited(address indexed user, uint256 dot, uint256 stDot, uint256 rate);
    event WithdrawRequested(
        address indexed user, uint256 stDot, uint256 dot, uint256 claimableAt
    );
    event WithdrawClaimed(address indexed user, uint256 dot);
    event Compounded(uint256 rewards, uint256 newRate, uint256 newTotalStaked);
    event KeeperRewarded(address indexed keeper, uint256 fee, uint256 compounded);
    event KeeperFeeUpdated(uint256 feeBps);
    event SentCrossChain(address indexed user, uint256 dot, bytes32 dest);
    event UnbondingPeriodUpdated(uint256 period);
    event XcmFeeUpdated(uint128 fee);
    event ValidatorsNominated(bytes32[] targets);

    // ============================================================
    //                    ERRORS
    // ============================================================

    error ZeroAmount();
    error InsufficientBalance();
    error AlreadyClaimed();
    error StillUnbonding(uint256 claimableAt);
    error NativeTransferFailed();
    error Unauthorized();
    error InvalidIndex();
    error InsufficientFeeAttached();

    // ============================================================
    //                    CONSTRUCTOR
    // ============================================================

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============================================================
    //                    EXCHANGE RATE
    // ============================================================

    /// @notice DOT value of 1 stDOT, scaled by 1e18 (1e18 = 1:1 parity)
    /// @dev Monotonically increases as compound() is called
    function exchangeRate() public view returns (uint256) {
        if (_totalSupply == 0) return PRECISION;
        return (totalStaked * PRECISION) / _totalSupply;
    }

    /// @notice stDOT shares minted for a given DOT deposit at the current rate
    function sharesForDot(uint256 dot) public view returns (uint256) {
        if (_totalSupply == 0 || totalStaked == 0) return dot;
        return (dot * _totalSupply) / totalStaked;
    }

    /// @notice DOT redeemable for a given stDOT amount at the current rate
    function dotForShares(uint256 shares) public view returns (uint256) {
        if (_totalSupply == 0) return shares;
        return (shares * totalStaked) / _totalSupply;
    }

    // ============================================================
    //                    STAKING PRECOMPILE HELPERS
    // ============================================================

    /// @dev Low-level wrappers that bypass Solidity 0.8's EXTCODESIZE check.
    ///      Polkadot Hub precompiles have 0 EVM code bytes but respond to calls.

    function _stakingBond(uint256 value, uint8 payee) internal {
        (bool ok,) = STAKING.call(abi.encodeWithSignature("bond(uint256,uint8)", value, payee));
        require(ok, "staking: bond failed");
    }

    function _stakingBondExtra(uint256 value) internal {
        (bool ok,) = STAKING.call(abi.encodeWithSignature("bondExtra(uint256)", value));
        require(ok, "staking: bondExtra failed");
    }

    function _stakingUnbond(uint256 value) internal {
        (bool ok,) = STAKING.call(abi.encodeWithSignature("unbond(uint256)", value));
        require(ok, "staking: unbond failed");
    }

    function _stakingNominate(bytes32[] calldata targets) internal {
        (bool ok,) = STAKING.call(abi.encodeWithSignature("nominate(bytes32[])", targets));
        require(ok, "staking: nominate failed");
    }

    function _stakingWithdrawUnbonded(uint32 numSlashingSpans) internal {
        (bool ok,) = STAKING.call(
            abi.encodeWithSignature("withdrawUnbonded(uint32)", numSlashingSpans)
        );
        require(ok, "staking: withdrawUnbonded failed");
    }

    // ============================================================
    //                    CORE: DEPOSIT
    // ============================================================

    /// @notice Deposit native DOT and receive stDOT at the current exchange rate
    /// @dev Bonds deposited DOT via Staking precompile.
    ///      First deposit calls bond(); all subsequent calls use bondExtra().
    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();

        uint256 shares = sharesForDot(msg.value);

        if (!_bonded) {
            _stakingBond(msg.value, 0); // payee=0 → Staked (rewards stay bonded)
            _bonded = true;
        } else {
            _stakingBondExtra(msg.value);
        }

        if (!_hasDeposited[msg.sender]) {
            _hasDeposited[msg.sender] = true;
            uniqueDepositors++;
        }

        totalStaked += msg.value;
        _mint(msg.sender, shares);

        emit Deposited(msg.sender, msg.value, shares, exchangeRate());
    }

    // ============================================================
    //                    CORE: WITHDRAW
    // ============================================================

    /// @notice Burn stDOT and begin the unbonding period for the equivalent DOT
    /// @param shares Amount of stDOT to redeem
    function requestWithdraw(uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (_balances[msg.sender] < shares) revert InsufficientBalance();

        uint256 dot = dotForShares(shares);

        _burn(msg.sender, shares);
        totalStaked    -= dot;
        totalUnbonding += dot;

        _stakingUnbond(dot);

        uint256 claimableAt = block.timestamp + unbondingPeriod;
        withdrawRequests[msg.sender].push(
            WithdrawRequest({dot: dot, claimableAt: claimableAt, claimed: false})
        );

        emit WithdrawRequested(msg.sender, shares, dot, claimableAt);
    }

    /// @notice Claim DOT after the unbonding period has elapsed
    /// @param index Index in the caller's withdrawRequests array
    function claimWithdrawal(uint256 index) external {
        WithdrawRequest[] storage reqs = withdrawRequests[msg.sender];
        if (index >= reqs.length) revert InvalidIndex();

        WithdrawRequest storage req = reqs[index];
        if (req.claimed) revert AlreadyClaimed();
        if (block.timestamp < req.claimableAt) revert StillUnbonding(req.claimableAt);

        req.claimed     = true;
        totalUnbonding -= req.dot;

        _stakingWithdrawUnbonded(0);

        (bool ok,) = msg.sender.call{value: req.dot}("");
        if (!ok) revert NativeTransferFailed();

        emit WithdrawClaimed(msg.sender, req.dot);
    }

    // ============================================================
    //                    CORE: COMPOUND
    // ============================================================

    /// @notice Compound staking rewards — increases the stDOT exchange rate for all holders
    /// @dev Caller provides reward amount as msg.value. Vault bonds it via bondExtra()
    ///      which increases totalStaked without minting new stDOT → rate goes up.
    ///
    ///      Permissionless: anyone can call. Keeper earns keeperFeeBps of compounded rewards.
    ///      On-chain APY is computed from exchange rate growth between consecutive calls.
    function compound() external payable {
        if (msg.value == 0) revert ZeroAmount();

        // Split: keeper incentive + rewards to bond
        uint256 fee     = (msg.value * keeperFeeBps) / 10_000;
        uint256 rewards = msg.value - fee;

        _stakingBondExtra(rewards);
        totalStaked += rewards;

        // Compute realized APY from rate growth since last compound
        uint256 newRate = exchangeRate();
        if (lastCompoundTime > 0 && lastCompoundRate > 0 && newRate > lastCompoundRate) {
            uint256 elapsed = block.timestamp - lastCompoundTime;
            if (elapsed > 0) {
                if (yieldOptimizer != address(0)) {
                    // Cross-VM call: Solidity (EVM) → Rust (PolkaVM) via pallet-revive
                    lastApyBps = IYieldOptimizer(yieldOptimizer).computeApy(
                        lastCompoundRate, newRate, elapsed
                    );
                } else {
                    // Fallback: compute in Solidity (used when PVM contract not yet set)
                    uint256 growth = ((newRate - lastCompoundRate) * PRECISION) / lastCompoundRate;
                    lastApyBps = (growth * 365 days * 10_000) / (elapsed * PRECISION);
                }
            }
        }
        lastCompoundRate = newRate;
        lastCompoundTime = block.timestamp;

        // Pay keeper reward
        if (fee > 0) {
            (bool ok,) = msg.sender.call{value: fee}("");
            if (!ok) revert NativeTransferFailed();
            emit KeeperRewarded(msg.sender, fee, rewards);
        }

        emit Compounded(rewards, newRate, totalStaked);
    }

    // ============================================================
    //                    XCM: CROSS-CHAIN SEND
    // ============================================================

    /// @notice Redeem stDOT and teleport the equivalent DOT to the Relay Chain
    /// @param shares      stDOT amount to redeem
    /// @param destAccount 32-byte destination account on the Relay Chain (SS58 public key)
    /// @dev Burns shares, unbonds DOT, then executes XCM V5 teleport:
    ///      Outer (Hub): WithdrawAsset + InitiateTeleport
    ///      Inner (Relay): BuyExecution + DepositAsset(destAccount)
    ///      Caller must attach at least xcmFeeAmount as msg.value for relay execution fees.
    function sendCrossChain(uint256 shares, bytes32 destAccount) external payable {
        if (shares == 0) revert ZeroAmount();
        if (_balances[msg.sender] < shares) revert InsufficientBalance();
        if (msg.value < xcmFeeAmount) revert InsufficientFeeAttached();

        uint256 dot = dotForShares(shares);

        _burn(msg.sender, shares);
        totalStaked -= dot;

        _stakingUnbond(dot);

        bytes memory xcmMsg = _buildTeleportMessage(uint128(dot), destAccount);
        XCM.execute(xcmMsg, IXCM.Weight(executeRefTime, executeProofSize));

        emit SentCrossChain(msg.sender, dot, destAccount);
    }

    // ============================================================
    //                    XCM MESSAGE BUILDER
    // ============================================================

    /// @dev Construct XCM V5 message: WithdrawAsset + InitiateTeleport to Relay Chain
    function _buildTeleportMessage(uint128 dot, bytes32 destAccount)
        internal
        view
        returns (bytes memory)
    {
        bytes memory innerXcm = abi.encodePacked(
            ScaleCodec.encodeCompactU32(2),
            _encodeBuyExecution(xcmFeeAmount),
            _encodeDepositAssetToAccount(destAccount)
        );

        return abi.encodePacked(
            XCM_V5,
            ScaleCodec.encodeCompactU32(2),
            _encodeWithdrawAsset(dot),
            _encodeInitiateTeleport(innerXcm)
        );
    }

    function _encodeWithdrawAsset(uint128 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_WITHDRAW_ASSET,
            ScaleCodec.encodeCompactU32(1),         // Vec<Asset> length = 1
            uint8(0x01),                            // parents = 1 → relay chain DOT
            uint8(0x00),                            // interior = Here
            uint8(0x00),                            // Fungibility::Fungible
            ScaleCodec.encodeCompactU128(amount)
        );
    }

    function _encodeBuyExecution(uint128 feeAmount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_BUY_EXECUTION,
            uint8(0x00),                            // parents = 0 → relay native (within relay)
            uint8(0x00),                            // interior = Here
            uint8(0x00),                            // Fungibility::Fungible
            ScaleCodec.encodeCompactU128(feeAmount),
            uint8(0x00)                             // WeightLimit::Unlimited
        );
    }

    function _encodeInitiateTeleport(bytes memory innerXcm) internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_INITIATE_TELEPORT,
            uint8(0x01),                            // AssetFilter::Wild
            uint8(0x00),                            // WildAsset::All
            uint8(0x01),                            // dest parents = 1 (relay chain)
            uint8(0x00),                            // dest interior = Here
            innerXcm
        );
    }

    function _encodeDepositAssetToAccount(bytes32 account) internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_DEPOSIT_ASSET,
            uint8(0x01),                            // AssetFilter::Wild
            uint8(0x00),                            // WildAsset::All
            uint8(0x00),                            // beneficiary parents = 0
            uint8(0x01),                            // 1 junction
            uint8(0x01),                            // Junction::AccountId32
            uint8(0x00),                            // network = None
            account                                 // 32-byte account id
        );
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Full vault snapshot — used by the frontend dashboard
    function getVaultStats() external view returns (
        uint256 rate,
        uint256 staked,
        uint256 unbonding,
        uint256 supply
    ) {
        return (exchangeRate(), totalStaked, totalUnbonding, _totalSupply);
    }

    /// @notice All withdrawal requests for a given user
    function getWithdrawRequests(address user)
        external
        view
        returns (WithdrawRequest[] memory)
    {
        return withdrawRequests[user];
    }

    /// @notice A user's stDOT balance and its current DOT value
    function getUserPosition(address user) external view returns (
        uint256 stDotBalance,
        uint256 dotValue
    ) {
        stDotBalance = _balances[user];
        dotValue     = dotForShares(stDotBalance);
    }

    /// @notice Preview the XCM message that would be sent for a cross-chain transfer
    /// @dev Allows users and judges to inspect the exact SCALE-encoded bytes before sending
    function previewXcmMessage(uint256 shares, bytes32 destAccount)
        external
        view
        returns (bytes memory)
    {
        uint256 dot = dotForShares(shares);
        return _buildTeleportMessage(uint128(dot), destAccount);
    }

    /// @notice Precompile address for a given native asset ID
    function assetAddress(uint256 assetId) external pure returns (address) {
        return address(uint160(uint160(ASSETS_BASE) + assetId));
    }

    // ============================================================
    //                    ADMIN
    // ============================================================

    /// @notice Nominate a set of validators for the vault's bonded stake
    /// @dev Must be called after the first deposit (once _bonded = true).
    ///      Without nomination, bonded PAS earns zero staking rewards on mainnet.
    ///      Validator account IDs are 32-byte SS58 public keys.
    function nominateValidators(bytes32[] calldata targets) external onlyOwner {
        require(targets.length > 0, "no targets");
        _stakingNominate(targets);
        delete _nominators;
        for (uint256 i = 0; i < targets.length; i++) {
            _nominators.push(targets[i]);
        }
        emit ValidatorsNominated(targets);
    }

    /// @notice Returns the current nominated validator set
    function getNominators() external view returns (bytes32[] memory) {
        return _nominators;
    }

    /// @notice Set keeper fee in basis points paid to whoever calls compound() (max 500 = 5%)
    function setKeeperFee(uint256 bps) external onlyOwner {
        require(bps <= 500, "fee exceeds max");
        keeperFeeBps = bps;
        emit KeeperFeeUpdated(bps);
    }

    /// @notice Set the Rust PVM YieldOptimizer contract address (cross-VM APY computation)
    /// @dev Once set, compound() delegates APY math to the Rust PolkaVM contract.
    ///      Set to address(0) to revert to Solidity-native computation.
    function setYieldOptimizer(address optimizer) external onlyOwner {
        yieldOptimizer = optimizer;
    }

    /// @notice Set unbonding period (use low value on testnet for demo)
    function setUnbondingPeriod(uint256 period) external onlyOwner {
        unbondingPeriod = period;
        emit UnbondingPeriodUpdated(period);
    }

    /// @notice Update the XCM fee amount in plancks
    function setXcmFee(uint128 fee) external onlyOwner {
        xcmFeeAmount = fee;
        emit XcmFeeUpdated(fee);
    }

    /// @notice Transfer contract ownership
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @notice Receive DOT — needed when withdrawUnbonded() returns funds to contract
    receive() external payable {}

    // ============================================================
    //                    ERC-20 IMPLEMENTATION
    // ============================================================

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function allowance(address owner_, address spender) external view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (_allowances[from][msg.sender] < value) revert InsufficientBalance();
        _allowances[from][msg.sender] -= value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0) || to == address(0)) revert ZeroAmount();
        if (_balances[from] < value) revert InsufficientBalance();
        _balances[from] -= value;
        _balances[to]   += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        _balances[to]  += value;
        _totalSupply   += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        if (_balances[from] < value) revert InsufficientBalance();
        _balances[from] -= value;
        _totalSupply    -= value;
        emit Transfer(from, address(0), value);
    }
}
