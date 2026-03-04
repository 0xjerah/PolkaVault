# PolkaVault — Native Liquid Staking on Polkadot Hub

> **Polkadot Hackathon 2025 — Track 2: PVM Smart Contracts**
> Categories: _Native Assets_ · _Accessing Native Functionality via Precompiles_

---

## What It Is

PolkaVault is a **native liquid staking protocol** built entirely on Polkadot Hub. Users deposit PAS (native token) and receive **stDOT** — a liquid ERC-20 receipt token that appreciates in value as staking rewards compound. stDOT can be transferred, held, or redeemed at any time. Accumulated rewards can be sent cross-chain to the Relay Chain via XCM V5.

**No oracle. No bridging. No off-chain relayer. Everything happens on-chain via Polkadot Hub precompiles.**

---

## How It Works

```
User deposits PAS
      │
      ▼
PolkaVault.deposit()
      │
      ├─► Staking precompile (0x0804) — bond(value, payee)
      │      PAS is bonded to the vault's stash account
      │
      └─► Mint stDOT to user at current exchange rate
             rate = totalStaked / totalSupply
```

### Exchange Rate Mechanics

The stDOT/PAS exchange rate starts at 1:1 and only ever increases:

```
Initial:   1 stDOT = 1.000000 PAS
After era: compound() called with staking rewards
           totalStaked += rewards (no new stDOT minted)
New rate:  1 stDOT = 1.054000 PAS  ← all holders benefit
```

### Withdrawal Flow

```
requestWithdraw(shares) → burns stDOT → unbond() via Staking precompile
                                              │
                                    28-day unbonding period
                                    (1 hour on testnet)
                                              │
claimWithdrawal(index) → withdrawUnbonded() → PAS sent to user
```

### XCM Cross-Chain Flow

```
sendCrossChain(shares, destAccount)
      │
      ├─► Burns stDOT + unbonds equivalent PAS
      │
      └─► XCM precompile (0x0A0000)
             XCM V5 message:
             ┌─ Hub (outer) ──────────────────────────────┐
             │  WithdrawAsset(PAS)                        │
             │  InitiateTeleport ─────────────────────────┤
             │    ┌─ Relay (inner) ──────────────────────┐│
             │    │  BuyExecution                        ││
             │    │  DepositAsset(destAccount)           ││
             │    └─────────────────────────────────────┘│
             └────────────────────────────────────────────┘
```

---

## Polkadot Hub Precompiles Used

| Precompile | Address | Purpose |
|---|---|---|
| Staking | `0x0000000000000000000000000000000000000804` | `bond()`, `bondExtra()`, `unbond()`, `withdrawUnbonded()` |
| XCM | `0x00000000000000000000000000000000000a0000` | `execute()` — XCM V5 InitiateTeleport |
| Balances | `0x0000000000000000000000000000000000000402` | Native PAS as ERC-20 |

> **Key insight discovered during development:** Polkadot Hub precompiles expose 0 bytes of EVM code (`eth_getCode` returns `0x`). Solidity 0.8 inserts an `EXTCODESIZE` check before every high-level interface call — if zero, it reverts immediately. The fix is to use low-level `.call(abi.encodeWithSignature(...))` which bypasses this check. Only the XCM precompile has an EVM code wrapper (10 bytes); the others are pure substrate precompiles.

---

## Smart Contract

**Address:** [`0x3e9eF811ddF3078559178C57d6cD97f45DbD6220`](https://blockscout-testnet.polkadot.io/address/0x3e9eF811ddF3078559178C57d6cD97f45DbD6220)
**Network:** Polkadot Hub Testnet (chain ID `420420417`)

### Key Functions

```solidity
// Deposit PAS, receive stDOT at current rate
function deposit() external payable

// Begin unbonding — burns stDOT, queues DOT for release
function requestWithdraw(uint256 shares) external

// Claim DOT after unbonding period
function claimWithdrawal(uint256 index) external

// Compound rewards — increases exchange rate for all holders
function compound() external payable

// Teleport PAS to Relay Chain via XCM V5
function sendCrossChain(uint256 shares, bytes32 destAccount) external payable

// Preview the exact XCM SCALE-encoded bytes
function previewXcmMessage(uint256 shares, bytes32 destAccount) external view returns (bytes memory)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart Contract | Solidity 0.8.28, Foundry |
| XCM Encoding | SCALE codec (Solidity), XCM V5 |
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Wallet | wagmi v2, RainbowKit, viem |
| Testing | Forge (27/27 tests passing) |

---

## Running Tests

```bash
forge test -vv
```

All 27 tests pass including:
- Exchange rate math (deposit, compound, multi-depositor scenarios)
- Full withdraw lifecycle (request → wait → claim)
- ERC-20 compliance (transfer, transferFrom, approval)
- XCM cross-chain message construction
- Admin controls (owner-only functions)

The Staking and XCM precompiles are mocked via `vm.etch` at their real addresses so tests run locally without a live chain.

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect a wallet configured for Polkadot Hub Testnet (chain `420420417`, RPC `https://services.polkadothub-rpc.com/testnet`).

---

## Project Structure

```
PolkaVault/
├── src/
│   ├── PolkaVault.sol          # Main contract
│   ├── interfaces/
│   │   ├── IStaking.sol        # Staking precompile interface
│   │   ├── IBalances.sol       # Balances precompile interface
│   │   ├── IAssets.sol         # Assets precompile interface
│   │   └── IXCM.sol            # XCM precompile interface
│   └── libraries/
│       └── ScaleCodec.sol      # SCALE encoding for XCM messages
├── test/
│   ├── PolkaVault.t.sol        # 27 Foundry tests
│   └── mocks/
│       ├── MockStaking.sol     # Staking precompile mock
│       └── MockXCM.sol         # XCM precompile mock
├── script/
│   └── Deploy.s.sol            # Deployment script
└── frontend/
    └── src/
        ├── app/page.tsx        # Full vault dashboard UI
        └── lib/
            ├── contracts.ts    # ABI + deployed address
            └── wagmi.ts        # Chain config
```

---

## Why Track 2

This project is specifically targeting **Track 2: PVM Smart Contracts** under the _Native Assets_ and _Precompiles_ sub-categories:

1. **Native Assets**: PAS (native chain token) is used directly — no wrapping, no synthetic tokens for the underlying asset. Users deposit raw PAS, the vault bonds it via substrate staking.

2. **Precompiles**: The vault calls the Staking precompile (`0x0804`) for every deposit, withdraw, and compound operation. The XCM precompile (`0x0A0000`) enables cross-chain teleportation with a hand-crafted SCALE-encoded XCM V5 message.

A plain EVM project (Track 1) would use standard ERC-20 tokens and OpenZeppelin contracts with no precompile interaction. PolkaVault is meaningless on any other EVM chain — it only works because Polkadot Hub exposes these substrate-native precompiles.

---

*Built for Polkadot Hackathon 2025*
