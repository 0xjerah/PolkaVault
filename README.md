# PolkaVault — Native Liquid Staking on Polkadot Hub

> **Polkadot OpenGuild Hackathon 2026 — Track 2: PVM Smart Contracts**
> Categories: _Native Assets_ · _Accessing Native Functionality via Precompiles_ · _Cross-VM (EVM + PolkaVM)_

<!-- ![PolkaVault Dashboard](./assets/screenshot.png) -->

### TL;DR

Deposit PAS(DOT) → get stDOT → earn staking yield automatically → compound rewards via cross-VM Rust contract → send PAS cross-chain via XCM V5. All on-chain. No oracles. No bridges. **[Live on Polkadot Hub Testnet.](https://blockscout-testnet.polkadot.io/address/0x64D3EfbAde442779c68972D5079861Bcf16722E6)**

<!-- **[Demo Video →](https://youtu.be/TODO)** -->

---

## What It Is

PolkaVault is a **native liquid staking protocol** built entirely on Polkadot Hub. Users deposit PAS (native token) and receive **stDOT** — a liquid ERC-20 receipt token that appreciates in value as staking rewards compound. stDOT can be transferred, held, or redeemed at any time. Accumulated rewards can be sent cross-chain to the Relay Chain via XCM V5.

**No oracle. No bridging. No off-chain relayer. Everything happens on-chain via Polkadot Hub precompiles and cross-VM calls.**

### Key Features

- **Liquid Staking** — deposit PAS, receive stDOT, earn yield passively
- **Auto-Harvest Compounding** — staking rewards accrue to contract (payee=Stash); `compound()` bonds them, increasing exchange rate for all holders
- **Keeper Incentives** — 0.5% fee paid to whoever calls `compound()` — no `msg.value` needed, fully permissionless
- **Cross-Chain Teleport** — send PAS to Relay Chain via XCM V5 `InitiateTeleport`
- **On-Chain APY** — realized yield computed from exchange rate growth between compounds
- **Cross-VM Architecture** — APY computation delegated to a **Rust PolkaVM contract** via pallet-revive
- **Validator Nomination** — owner can nominate validators for the vault's bonded stake

---

## Deployed Contracts

| Contract | Address | VM | Size |
|---|---|---|---|
| **PolkaVault** (liquid staking vault + stDOT) | [`0x64D3EfbAde442779c68972D5079861Bcf16722E6`](https://blockscout-testnet.polkadot.io/address/0x64D3EfbAde442779c68972D5079861Bcf16722E6) | EVM (Solidity) | — |
| **YieldOptimizer** (APY computation) | [`0x7d849b045d89a489df71c2e69968eb020a233974`](https://blockscout-testnet.polkadot.io/address/0x7d849b045d89a489df71c2e69968eb020a233974) | PolkaVM (Rust) | 2,089 bytes |

**Network:** Polkadot Hub Testnet · Chain ID `420420417` · RPC `https://services.polkadothub-rpc.com/testnet`

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              Polkadot Hub Testnet            │
                    │                                             │
  User ──deposit()──┤  PolkaVault.sol (EVM)                       │
                    │  ├── Staking Precompile (0x0804)            │
                    │  │     bond() · bondExtra() · unbond()      │
                    │  ├── XCM Precompile (0x0A0000)              │
                    │  │     execute() · XCM V5 InitiateTeleport  │
                    │  └── compound() ─── cross-VM call ──────────┤
                    │         │                                   │
                    │         ▼          pallet-revive             │
                    │  YieldOptimizer.rs (PolkaVM / RISC-V)       │
                    │     computeApy(prevRate, newRate, elapsed)   │
                    │     → returns apyBps (basis points)         │
                    └─────────────────────────────────────────────┘
```

### Cross-VM Flow (EVM ↔ PolkaVM)

When `compound()` is called, PolkaVault delegates APY computation to a **Rust contract running on PolkaVM**:

```
Solidity (EVM)                    pallet-revive                   Rust (RISC-V)
─────────────                    ──────────────                   ─────────────
compound()
  │ IYieldOptimizer(addr)
  │   .computeApy(prev, new, t)  ──► routes call ──►             call()
  │                                   across VMs                    │ parse ABI calldata
  │                                                                 │ u128 arithmetic
  │                                                                 │ apyBps = delta * 10000
  │                               ◄── returns result ◄──           │   * 365d / (prev * t)
  lastApyBps = result                                              return_value(output)
```

This demonstrates **real cross-VM interoperability** — Solidity calling Rust natively on-chain via pallet-revive's transparent VM routing. The Rust contract is compiled to RISC-V and runs on PolkaVM, not the EVM.

---

## How It Works

### Deposit

```
User deposits PAS
      │
      ▼
PolkaVault.deposit()
      │
      ├─► Staking precompile (0x0804) — bond(value, payee=Stash)
      │      PAS is bonded; rewards flow to contract balance
      │
      └─► Mint stDOT to user at current exchange rate
             rate = totalStaked / totalSupply
```

### Exchange Rate Mechanics

The stDOT/PAS exchange rate starts at 1:1 and only ever increases:

```
Initial:   1 stDOT = 1.000000 PAS
After era: staking rewards accrue to contract (payee=Stash)
           compound() bonds them → totalStaked increases (no new stDOT minted)
New rate:  1 stDOT = 1.054000 PAS  ← all holders benefit automatically
```

### Compound (Auto-Harvest + Keeper Fee + Cross-VM APY)

```
Staking rewards accrue to contract balance (payee=Stash)
      │
Anyone calls compound()       ← permissionless, no msg.value needed
      │
      ├─► Reads address(this).balance as accrued rewards
      │
      ├─► Split: 0.5% keeper fee + 99.5% rewards
      │
      ├─► bondExtra(rewards) via Staking precompile
      │      totalStaked increases → exchange rate grows
      │
      ├─► Cross-VM call to Rust YieldOptimizer ──► computeApy()
      │      lastApyBps = annualized APY in basis points
      │
      └─► Pay keeper fee instantly to caller's wallet
             emit KeeperRewarded(keeper, fee, rewards)
```

### Withdrawal

```
requestWithdraw(shares) → burns stDOT → unbond() via Staking precompile
                                              │
                                    28-day unbonding period
                                    (1 hour on testnet)
                                              │
claimWithdrawal(index) → withdrawUnbonded() → PAS sent to user
```

### XCM Cross-Chain Teleport

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
| Staking | `0x0000000000000000000000000000000000000804` | `bond()`, `bondExtra()`, `unbond()`, `withdrawUnbonded()`, `nominate()` |
| XCM | `0x00000000000000000000000000000000000a0000` | `execute()` — XCM V5 InitiateTeleport to Relay Chain |
| Balances | `0x0000000000000000000000000000000000000402` | Native PAS as ERC-20 |

> **Key insight:** Polkadot Hub precompiles expose 0 bytes of EVM code (`eth_getCode` returns `0x`). Solidity 0.8 inserts an `EXTCODESIZE` check before every high-level interface call — if zero, it reverts. PolkaVault uses low-level `.call(abi.encodeWithSignature(...))` to bypass this. Only the XCM precompile has an EVM code wrapper (10 bytes); the others are pure substrate precompiles.

---

## Smart Contract API

### Write Functions

```solidity
// Deposit PAS, receive stDOT at current rate
function deposit() external payable

// Begin unbonding — burns stDOT, queues PAS for release
function requestWithdraw(uint256 shares) external

// Claim PAS after unbonding period
function claimWithdrawal(uint256 index) external

// Compound accrued staking rewards — increases exchange rate for all holders
// Reads rewards from contract balance (payee=Stash). Keeper earns 0.5% fee.
// APY computed via cross-VM Rust contract. No msg.value needed.
function compound() external

// Teleport PAS to Relay Chain via XCM V5
function sendCrossChain(uint256 shares, bytes32 destAccount) external payable

// Admin: nominate validators for the vault's bonded stake
function nominateValidators(bytes32[] calldata targets) external onlyOwner

// Admin: set Rust PVM YieldOptimizer address (cross-VM)
function setYieldOptimizer(address optimizer) external onlyOwner
```

### View Functions

```solidity
function exchangeRate() → uint256     // PAS per stDOT (scaled 1e18)
function sharesForDot(uint256 dot)    // stDOT you'd get for a deposit
function dotForShares(uint256 shares) // PAS redeemable for stDOT amount
function getVaultStats()              // rate, staked, unbonding, supply
function getUserPosition(address)     // stDOT balance + PAS value
function getWithdrawRequests(address) // all pending/claimed withdrawals
function lastApyBps()                 // realized APY in basis points
function yieldOptimizer()             // Rust PVM contract address
function previewXcmMessage(...)       // inspect SCALE-encoded XCM bytes
```

---

## Rust PVM Contract (YieldOptimizer)

The YieldOptimizer is a **native PolkaVM contract** written in Rust, compiled to RISC-V, and deployed on Polkadot Hub. It computes annualized APY from exchange rate growth.

### Source

```rust
// rust-contract/src/yield_optimizer.rs
#![no_std]
#![no_main]

// ABI: computeApy(uint256 prevRate, uint256 newRate, uint256 elapsed) → uint256 apyBps
// Formula: apyBps = (newRate - prevRate) * 10_000 * 365_days / (prevRate * elapsed)
// Uses u128 arithmetic — sufficient for exchange rates up to ~3.4e38
```

### Build

```bash
cd rust-contract

# Requires: rustup with nightly-2024-11-19, polkatool
cargo +nightly-2024-11-19 build --release
polkatool link --strip \
  target/riscv64emac-unknown-none-polkavm/release/yield-optimizer \
  -o yield-optimizer.polkavm
```

### Dependencies

| Crate | Version | Source |
|---|---|---|
| `polkavm-derive` | 0.25.0 | crates.io |
| `pallet-revive-uapi` | 0.1.0 | polkadot-sdk git @ `187cddd` |

### Deploy

```bash
# Deploy the .polkavm binary as a standard contract creation tx
BYTECODE="0x$(xxd -p yield-optimizer.polkavm | tr -d '\n')"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY --create "$BYTECODE"

# Wire it into PolkaVault
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
  $POLKAVAULT_ADDRESS "setYieldOptimizer(address)" $YIELD_OPTIMIZER_ADDRESS
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart Contract (EVM) | Solidity 0.8.28, Foundry |
| Smart Contract (PVM) | Rust, `pallet-revive-uapi`, PolkaVM (RISC-V) |
| XCM Encoding | SCALE codec (Solidity), XCM V5 |
| Cross-VM | pallet-revive transparent VM routing |
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Wallet | wagmi v2, RainbowKit, viem |
| Testing | Forge (43/43 tests passing) |

---

## Running Tests

```bash
forge test -vv
```

All 43 tests pass including:
- Exchange rate math (deposit, compound, multi-depositor scenarios)
- Full withdraw lifecycle (request → wait → claim)
- ERC-20 compliance (transfer, transferFrom, approval)
- XCM cross-chain message construction
- Keeper fee (paid on compound, access control, max cap)
- On-chain APY computation (exact 10% after 365 days verified)
- **Cross-VM YieldOptimizer** (mock verifies Solidity ↔ Rust path matches)
- Admin controls (owner-only functions, validator nomination)

Precompiles are mocked via `vm.etch` at their real addresses so tests run locally without a live chain.

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect a wallet configured for Polkadot Hub Testnet (chain `420420417`, RPC `https://services.polkadothub-rpc.com/testnet`).

### Frontend Features

- **Live Rate Pill** — real-time exchange rate in the navbar, pulled from on-chain data
- **Vault Stats Strip** — TVL, exchange rate, stDOT supply, depositor count
- **Rate Hero Card** — large exchange rate display with animated glow + all-time gain stats
- **Side-by-Side Deposit/Withdraw** — both panels visible simultaneously for faster UX
- **Position Summary** — stDOT balance, PAS value, PAS earned, current rate at a glance
- **Compound Panel** — exchange rate, realized APY, keeper fee earnings, PVM badge
- **XCM Cross-Chain** — send PAS to Relay Chain with destination account input
- **Cross-VM Flow Diagram** — interactive visual: Solidity → pallet-revive → Rust PVM → Result
- **Precompile Info** — technical breakdown of each precompile with function badges
- **Scrolling Ticker** — feature marquee with gradient fade edges

---

## Project Structure

```
PolkaVault/
├── src/
│   ├── PolkaVault.sol              # Main contract (vault + stDOT ERC-20)
│   ├── interfaces/
│   │   ├── IStaking.sol            # Staking precompile interface
│   │   ├── IBalances.sol           # Balances precompile interface
│   │   ├── IAssets.sol             # Assets precompile interface
│   │   ├── IXCM.sol                # XCM precompile interface
│   │   └── IYieldOptimizer.sol     # Cross-VM interface for Rust contract
│   └── libraries/
│       └── ScaleCodec.sol          # SCALE encoding for XCM messages
├── rust-contract/
│   ├── src/
│   │   └── yield_optimizer.rs      # Rust PVM contract (APY computation)
│   ├── Cargo.toml                  # Dependencies (polkavm-derive, pallet-revive-uapi)
│   ├── rust-toolchain.toml         # nightly-2024-11-19
│   ├── .cargo/config.toml          # RISC-V target config
│   ├── riscv64emac-unknown-none-polkavm.json  # Custom target spec
│   └── build.sh                    # Build + link script
├── test/
│   ├── PolkaVault.t.sol            # 43 Foundry tests
│   └── mocks/
│       ├── MockStaking.sol         # Staking precompile mock
│       ├── MockXCM.sol             # XCM precompile mock
│       └── MockYieldOptimizer.sol  # Cross-VM mock
├── script/
│   └── Deploy.s.sol                # Deployment script
└── frontend/
    └── src/
        ├── app/page.tsx            # Full vault dashboard UI
        └── lib/
            ├── contracts.ts        # ABI + deployed addresses
            └── wagmi.ts            # Chain config (Polkadot Hub Testnet)
```

---

## Why Track 2: PVM Smart Contracts

This project targets **Track 2** across three sub-categories:

### 1. Native Assets
PAS (native chain token) is used directly — no wrapping, no synthetic tokens for the underlying asset. Users deposit raw PAS, the vault bonds it via substrate staking.

### 2. Precompiles
The vault calls the Staking precompile (`0x0804`) for every deposit, withdraw, and compound operation. The XCM precompile (`0x0A0000`) enables cross-chain teleportation with a hand-crafted SCALE-encoded XCM V5 message. The Balances precompile (`0x0402`) provides ERC-20 access to native PAS.

### 3. Cross-VM (EVM + PolkaVM)
PolkaVault demonstrates **real cross-VM interoperability** on Polkadot Hub:
- The main vault is a Solidity contract running on the EVM
- APY computation is delegated to a Rust contract running on PolkaVM (RISC-V)
- `compound()` calls the Rust contract via `IYieldOptimizer.computeApy()` — pallet-revive transparently routes the call between VMs
- This is not a toy example — it's a production-relevant pattern where compute-heavy logic runs natively on PolkaVM while the user-facing contract remains in Solidity

A plain EVM project (Track 1) would use standard ERC-20 tokens and OpenZeppelin contracts with no precompile or cross-VM interaction. PolkaVault is meaningless on any other EVM chain — it only works because Polkadot Hub exposes substrate-native precompiles and pallet-revive's cross-VM routing.

---

## Team

Solo builder — contract development, Rust PVM contract, frontend, testing, deployment.

---

*Built for Polkadot Hackathon 2025*
