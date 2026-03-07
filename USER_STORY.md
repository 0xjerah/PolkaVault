# PolkaVault — User Story

## The Vision

Staking on Polkadot should be simple. You deposit DOT. You earn yield. You stay liquid. You don't need to trust a bridge, an oracle, or an off-chain keeper to make it work.

That's PolkaVault.

---

## The Problem

Liquid staking on Polkadot today is fractured. Existing solutions rely on external infrastructure — oracles to report staking rewards, bridges to wrap tokens across chains, off-chain bots to trigger rebalancing. Each layer adds trust assumptions, attack surface, and points of failure.

Meanwhile, Polkadot Hub has everything a liquid staking protocol needs built directly into the chain: a **Staking precompile** to bond and unbond natively, an **XCM precompile** to move assets cross-chain without bridges, and **pallet-revive** to run both EVM and PolkaVM contracts side by side. The infrastructure exists. Nobody was using it.

---

## The User Journey

### Alice wants to stake her PAS

Alice has 100 PAS sitting in her wallet. She wants to earn staking yield, but she doesn't want to lock her capital for 28 days and she doesn't want to run a validator.

**She opens PolkaVault.**

The dashboard shows the current exchange rate: **1 stDOT = 1.000000 PAS**. She deposits 100 PAS. Under the hood, the contract calls the Staking precompile at `0x0804` — her PAS is bonded directly to the vault's stash, exactly like a native substrate staker. She receives **100 stDOT** — a liquid ERC-20 token she can hold, transfer, or use in DeFi.

She's now earning staking yield. She didn't nominate validators. She didn't lock anything. She has a liquid token.

### Rewards compound automatically

A few eras pass. Because the vault bonds with `payee=Stash`, staking rewards flow directly into the contract's free balance — no oracle, no off-chain bot needed to detect them. **Bob**, a keeper, sees an opportunity — PolkaVault pays a **0.5% keeper fee** to whoever calls `compound()`. Bob calls it — no PAS to send, just a simple transaction.

Three things happen in a single transaction:

1. **Auto-harvest** — the contract reads `address(this).balance` to find all accrued staking rewards, then bonds them via `bondExtra()` on the Staking precompile
2. **Cross-VM APY computation** — the contract calls a **Rust contract on PolkaVM** to compute the annualized APY from exchange rate growth. Solidity calling Rust, on-chain, through pallet-revive's transparent VM routing.
3. **Keeper fee** — Bob receives 0.5% of the compounded rewards for his service, paid instantly from the accrued balance

The exchange rate updates: **1 stDOT = 1.054000 PAS**. Alice's 100 stDOT is now worth 105.4 PAS. She didn't do anything.

### Alice moves PAS cross-chain

Alice wants to send 20 PAS worth of stDOT to the Relay Chain. She enters her Relay Chain account in the XCM panel and clicks "Send Cross-Chain."

The contract burns her stDOT, unbonds the PAS, and constructs a **SCALE-encoded XCM V5 message** — WithdrawAsset, InitiateTeleport, BuyExecution, DepositAsset — entirely in Solidity. It calls the XCM precompile at `0x0A0000`. No bridge. No relayer. Native Polkadot cross-chain messaging.

Her PAS arrives on the Relay Chain.

### Alice withdraws the rest

Months later, Alice wants to exit. She requests a withdrawal of her remaining stDOT. The contract burns her tokens and unbonds the PAS via the Staking precompile. After the unbonding period (28 days on mainnet, 1 hour on testnet), she claims her PAS — now worth more than she deposited, because the exchange rate has been compounding the entire time.

---

## Why This Matters

### It's native

PolkaVault doesn't wrap tokens. It doesn't bridge assets. It calls Polkadot Hub's Staking precompile directly. PAS goes into substrate staking — the same mechanism validators use. This isn't a synthetic yield product; it's real staking with a liquid wrapper.

### It's trustless

No oracle reports the exchange rate — it's computed on-chain from `totalStaked / totalSupply`. No off-chain bot is required to feed rewards — staking rewards accrue to the contract automatically (`payee=Stash`), and anyone can call `compound()` to bond them and earn a keeper fee. No admin can steal funds — the vault is a smart contract with transparent logic.

### It's cross-VM

This is what makes PolkaVault a Track 2 project, not Track 1. The APY computation runs on a **Rust contract compiled to RISC-V and deployed on PolkaVM**. When `compound()` is called, the Solidity EVM contract calls the Rust PolkaVM contract through pallet-revive. Two virtual machines, one seamless call. This isn't a demo — it's a deployed, working contract on Polkadot Hub Testnet.

### It's real

- **Deployed** on Polkadot Hub Testnet at [`0x64D3EfbAde442779c68972D5079861Bcf16722E6`](https://blockscout-testnet.polkadot.io/address/0x64D3EfbAde442779c68972D5079861Bcf16722E6)
- **Rust PVM contract** deployed at [`0x7d849b045d89a489df71c2e69968eb020a233974`](https://blockscout-testnet.polkadot.io/address/0x7d849b045d89a489df71c2e69968eb020a233974)
- **43/43 tests passing** covering exchange rate math, withdrawals, ERC-20 compliance, XCM construction, keeper fees, APY computation, and cross-VM integration
- **Full frontend** with live on-chain data, wallet connection, and transaction execution

---

## The Technical Edge

| Capability | How PolkaVault Does It |
|---|---|
| Staking | Direct calls to Staking precompile (`0x0804`) — `bond()`, `bondExtra()`, `unbond()`, `withdrawUnbonded()`, `nominate()` |
| Yield | Rewards accrue to contract (`payee=Stash`); `compound()` bonds them — no oracle, no external feed |
| Keeper incentive | 0.5% fee paid to `compound()` caller — no `msg.value`, fully permissionless |
| APY computation | Cross-VM call to Rust YieldOptimizer on PolkaVM — real RISC-V contract |
| Cross-chain | XCM V5 `InitiateTeleport` via XCM precompile (`0x0A0000`) — SCALE-encoded in Solidity |
| Precompile compatibility | Low-level `.call()` to bypass Solidity 0.8's `EXTCODESIZE` check on zero-code precompiles |

---

## Built Solo. Built Real.

PolkaVault was built by a solo developer over 5 days:

- **Day 1:** Smart contract architecture — liquid staking vault + stDOT ERC-20 + precompile integration
- **Day 2:** Full frontend dashboard — Next.js 16, React 19, wagmi v2, Tailwind v4
- **Day 3:** Deployed to Polkadot Hub Testnet — discovered and fixed the Staking precompile EXTCODESIZE bug, first successful deposit
- **Day 4:** Keeper fees, on-chain APY tracking, Rust PVM YieldOptimizer contract, cross-VM integration, 43/43 tests
- **Day 5:** Deployed Rust PVM contract, wired cross-VM, polished UI/UX, demo prep

Every line of code written during the hackathon. Every feature deployed and verified on-chain.

---

*PolkaVault — Deposit. Earn. Stay Liquid.*
