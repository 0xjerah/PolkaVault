// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAssets} from "./interfaces/IAssets.sol";
import {IStaking} from "./interfaces/IStaking.sol";
import {IBalances} from "./interfaces/IBalances.sol";

/// @title PolkaVault - Native Asset Portfolio Manager for Polkadot Hub
/// @notice Manages a user's native asset portfolio: DOT staking, asset tracking,
///         and cross-chain transfers — all through Polkadot Hub precompiles
/// @dev Uses Balances (0x0402), Assets (0x0403+), Staking (0x0804), XCM (0x0816)
contract PolkaVault {
    // ============================================================
    //                    PRECOMPILE ADDRESSES
    // ============================================================

    /// @notice Native DOT balance precompile (ERC-20 interface)
    address public constant BALANCES_PRECOMPILE = 0x0000000000000000000000000000000000000402;

    /// @notice Staking precompile
    address public constant STAKING_PRECOMPILE = 0x0000000000000000000000000000000000000804;

    /// @notice XCM precompile
    address public constant XCM_PRECOMPILE = 0x0000000000000000000000000000000000000816;

    /// @notice Base address for Assets precompile (asset_id offset)
    /// @dev Asset at ID N is at address 0x0403...0000 + N
    address public constant ASSETS_BASE = 0x0000000000000000000000000000000000000403;

    // ============================================================
    //                    STATE
    // ============================================================

    struct Portfolio {
        address owner;
        uint256 createdAt;
        uint256[] trackedAssetIds;
        bool stakingEnabled;
        string label;
    }

    /// @notice User portfolios
    mapping(address => Portfolio) public portfolios;

    /// @notice Tracked asset IDs per user (for enumeration)
    mapping(address => mapping(uint256 => bool)) public isAssetTracked;

    /// @notice Staking log per user
    struct StakeRecord {
        uint256 amount;
        uint256 timestamp;
        bool active;
    }
    mapping(address => StakeRecord[]) public stakeHistory;

    /// @notice Transfer log per user
    struct TransferRecord {
        address token;
        address to;
        uint256 amount;
        uint256 timestamp;
    }
    mapping(address => TransferRecord[]) public transferHistory;

    // ============================================================
    //                    EVENTS
    // ============================================================

    event PortfolioCreated(address indexed owner, string label);
    event AssetTracked(address indexed owner, uint256 assetId);
    event AssetUntracked(address indexed owner, uint256 assetId);
    event StakingInitiated(address indexed owner, uint256 amount);
    event StakeIncreased(address indexed owner, uint256 additionalAmount);
    event UnbondingInitiated(address indexed owner, uint256 amount);
    event TransferExecuted(
        address indexed owner, address indexed token, address indexed to, uint256 amount
    );
    event NativeTransfer(address indexed owner, address indexed to, uint256 amount);

    // ============================================================
    //                    MODIFIERS
    // ============================================================

    modifier hasPortfolio() {
        require(portfolios[msg.sender].owner != address(0), "No portfolio - create one first");
        _;
    }

    // ============================================================
    //                    PORTFOLIO MANAGEMENT
    // ============================================================

    /// @notice Create a portfolio for the caller
    /// @param label Human-readable label for the portfolio
    function createPortfolio(string calldata label) external {
        require(
            portfolios[msg.sender].owner == address(0), "Portfolio already exists"
        );

        portfolios[msg.sender] = Portfolio({
            owner: msg.sender,
            createdAt: block.timestamp,
            trackedAssetIds: new uint256[](0),
            stakingEnabled: false,
            label: label
        });

        emit PortfolioCreated(msg.sender, label);
    }

    /// @notice Track a native asset in your portfolio
    /// @param assetId The asset ID on Polkadot Hub (e.g., USDT, USDC)
    function trackAsset(uint256 assetId) external hasPortfolio {
        require(!isAssetTracked[msg.sender][assetId], "Asset already tracked");

        isAssetTracked[msg.sender][assetId] = true;
        portfolios[msg.sender].trackedAssetIds.push(assetId);

        emit AssetTracked(msg.sender, assetId);
    }

    /// @notice Stop tracking an asset
    /// @param assetId The asset ID to untrack
    function untrackAsset(uint256 assetId) external hasPortfolio {
        require(isAssetTracked[msg.sender][assetId], "Asset not tracked");

        isAssetTracked[msg.sender][assetId] = false;

        // Remove from array
        uint256[] storage ids = portfolios[msg.sender].trackedAssetIds;
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == assetId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }

        emit AssetUntracked(msg.sender, assetId);
    }

    // ============================================================
    //                    PORTFOLIO VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the full portfolio overview for a user
    /// @return label Portfolio label
    /// @return assetIds Array of tracked asset IDs
    /// @return balances Corresponding balances for each asset
    /// @return dotBalance Native DOT balance
    /// @return stakingActive Whether staking is enabled
    function getPortfolioOverview(address user)
        external
        view
        returns (
            string memory label,
            uint256[] memory assetIds,
            uint256[] memory balances,
            uint256 dotBalance,
            bool stakingActive
        )
    {
        Portfolio storage p = portfolios[user];
        require(p.owner != address(0), "No portfolio");

        label = p.label;
        assetIds = p.trackedAssetIds;
        balances = new uint256[](assetIds.length);
        stakingActive = p.stakingEnabled;

        // Fetch DOT balance via Balances precompile
        try IBalances(BALANCES_PRECOMPILE).balanceOf(user) returns (uint256 bal) {
            dotBalance = bal;
        } catch {
            dotBalance = user.balance;
        }

        // Fetch each tracked asset balance
        for (uint256 i = 0; i < assetIds.length; i++) {
            address assetAddr = _assetAddress(assetIds[i]);
            try IAssets(assetAddr).balanceOf(user) returns (uint256 bal) {
                balances[i] = bal;
            } catch {
                balances[i] = 0;
            }
        }
    }

    /// @notice Get asset metadata (name, symbol, decimals)
    function getAssetInfo(uint256 assetId)
        external
        view
        returns (string memory assetName, string memory assetSymbol, uint8 assetDecimals)
    {
        address assetAddr = _assetAddress(assetId);
        try IAssets(assetAddr).name() returns (string memory n) {
            assetName = n;
        } catch {
            assetName = "";
        }
        try IAssets(assetAddr).symbol() returns (string memory s) {
            assetSymbol = s;
        } catch {
            assetSymbol = "";
        }
        try IAssets(assetAddr).decimals() returns (uint8 d) {
            assetDecimals = d;
        } catch {
            assetDecimals = 0;
        }
    }

    /// @notice Get user's stake history count
    function getStakeHistoryCount(address user) external view returns (uint256) {
        return stakeHistory[user].length;
    }

    /// @notice Get user's transfer history count
    function getTransferHistoryCount(address user) external view returns (uint256) {
        return transferHistory[user].length;
    }

    /// @notice Get tracked asset IDs for a user
    function getTrackedAssets(address user) external view returns (uint256[] memory) {
        return portfolios[user].trackedAssetIds;
    }

    // ============================================================
    //                    STAKING OPERATIONS
    // ============================================================

    /// @notice Bond DOT for staking via the Staking precompile
    /// @param amount Amount of DOT to bond (in plancks)
    function stakeDOT(uint256 amount) external hasPortfolio {
        require(amount > 0, "Amount must be > 0");

        // Call Staking precompile: bond(amount, payee=0 means Staked)
        IStaking(STAKING_PRECOMPILE).bond(amount, 0);

        portfolios[msg.sender].stakingEnabled = true;
        stakeHistory[msg.sender].push(
            StakeRecord({amount: amount, timestamp: block.timestamp, active: true})
        );

        emit StakingInitiated(msg.sender, amount);
    }

    /// @notice Bond additional DOT to existing stake
    /// @param amount Additional amount to bond
    function stakeMoreDOT(uint256 amount) external hasPortfolio {
        require(amount > 0, "Amount must be > 0");
        require(portfolios[msg.sender].stakingEnabled, "No active stake");

        IStaking(STAKING_PRECOMPILE).bondExtra(amount);

        stakeHistory[msg.sender].push(
            StakeRecord({amount: amount, timestamp: block.timestamp, active: true})
        );

        emit StakeIncreased(msg.sender, amount);
    }

    /// @notice Unbond DOT from staking (begins unbonding period)
    /// @param amount Amount to unbond
    function unstakeDOT(uint256 amount) external hasPortfolio {
        require(amount > 0, "Amount must be > 0");

        IStaking(STAKING_PRECOMPILE).unbond(amount);

        stakeHistory[msg.sender].push(
            StakeRecord({amount: amount, timestamp: block.timestamp, active: false})
        );

        emit UnbondingInitiated(msg.sender, amount);
    }

    /// @notice Nominate validators for your staked DOT
    /// @param validators Array of validator public keys (32 bytes each)
    function nominateValidators(bytes32[] calldata validators) external hasPortfolio {
        require(portfolios[msg.sender].stakingEnabled, "No active stake");
        require(validators.length > 0 && validators.length <= 16, "1-16 validators required");

        IStaking(STAKING_PRECOMPILE).nominate(validators);
    }

    // ============================================================
    //                    ASSET TRANSFERS
    // ============================================================

    /// @notice Transfer a native asset to another address
    /// @param assetId The asset ID to transfer
    /// @param to Recipient address
    /// @param amount Amount to transfer
    function transferAsset(uint256 assetId, address to, uint256 amount) external hasPortfolio {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        address assetAddr = _assetAddress(assetId);
        bool success = IAssets(assetAddr).transfer(to, amount);
        require(success, "Asset transfer failed");

        transferHistory[msg.sender].push(
            TransferRecord({
                token: assetAddr,
                to: to,
                amount: amount,
                timestamp: block.timestamp
            })
        );

        emit TransferExecuted(msg.sender, assetAddr, to, amount);
    }

    /// @notice Transfer native DOT to another address
    /// @param to Recipient address
    /// @param amount Amount of DOT to transfer (in plancks)
    function transferDOT(address to, uint256 amount) external hasPortfolio {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        bool success = IBalances(BALANCES_PRECOMPILE).transfer(to, amount);
        require(success, "DOT transfer failed");

        transferHistory[msg.sender].push(
            TransferRecord({
                token: BALANCES_PRECOMPILE,
                to: to,
                amount: amount,
                timestamp: block.timestamp
            })
        );

        emit NativeTransfer(msg.sender, to, amount);
    }

    // ============================================================
    //                    INTERNAL
    // ============================================================

    /// @dev Compute the precompile address for a given asset ID
    function _assetAddress(uint256 assetId) internal pure returns (address) {
        return address(uint160(uint160(ASSETS_BASE) + assetId));
    }
}
