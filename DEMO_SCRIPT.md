# PolkaVault — Demo Script

**Target length:** 4-5 minutes
**Format:** Screen recording with voiceover (or text overlay)

---

## Scene 1: Hook (0:00 – 0:20)

**Show:** PolkaVault landing page hero section

**Say:**
> "What if you could stake DOT, earn yield, and move assets cross-chain — all from a single smart contract on Polkadot Hub? No oracles. No bridges. No off-chain relayers. Meet PolkaVault — native liquid staking powered by precompiles and cross-VM Rust contracts."

---

## Scene 2: The Problem (0:20 – 0:40)

**Show:** Brief slide or text overlay

**Say:**
> "Today, liquid staking on Polkadot requires external protocols with oracles, bridges, and centralized relayers. PolkaVault eliminates all of that by building directly on Polkadot Hub's native precompiles — the Staking precompile for bonding, the XCM precompile for cross-chain, and a Rust PolkaVM contract for APY computation. Everything happens on-chain."

---

## Scene 3: Connect Wallet (0:40 – 1:00)

**Action:** Click "Connect Wallet" on the navbar → select MetaMask → connect to Polkadot Hub Testnet (chain 420420417)

**Show:** Wallet connects, navbar updates with connected address, live exchange rate pill appears

**Say:**
> "Let's connect a wallet. We're on Polkadot Hub Testnet — chain ID 420420417. Notice the live exchange rate in the navbar — that's reading directly from the deployed smart contract."

---

## Scene 4: Vault Stats (1:00 – 1:20)

**Action:** Scroll to the stats strip and Rate Hero Card

**Show:** TVL, exchange rate, stDOT supply, depositor count. Rate Hero Card with animated glow.

**Say:**
> "Here's the vault at a glance. Total Value Locked, current exchange rate, total stDOT supply, and unique depositor count — all pulled live from on-chain. The exchange rate starts at 1:1 and only increases as rewards compound."

---

## Scene 5: Deposit (1:20 – 2:00)

**Action:**
1. Scroll to the Deposit panel
2. Enter an amount (e.g., 5 PAS)
3. See the preview: "You'll receive X stDOT"
4. Click "Deposit"
5. Confirm in MetaMask
6. Wait for tx confirmation
7. Show updated Position Summary (stDOT balance, PAS value)

**Show:** Transaction hash, Blockscout link, updated balances

**Say:**
> "Let's deposit 5 PAS. The contract calls the Staking precompile at address 0x0804 to bond our PAS directly to the vault's stash. We receive stDOT — a liquid ERC-20 receipt token at the current exchange rate. Notice — no wrapping, no bridging. Raw native PAS goes straight into substrate staking."

**Bonus — show on Blockscout:**
> "Here's the transaction on Blockscout. You can see the deposit event with the exact shares minted."

---

## Scene 6: Compound + Cross-VM (2:00 – 3:00) ← KEY DEMO MOMENT

**Action:**
1. Scroll to the Compound panel
2. Show the current exchange rate and APY
3. Point out: "No amount input — the contract reads accrued rewards automatically"
4. Click "Compound Rewards"
5. Confirm in MetaMask
6. Show exchange rate increase + APY update

**Show:** Cross-VM flow diagram lights up: Solidity → pallet-revive → Rust PVM → Result

**Say:**
> "This is the core innovation. Notice there's no amount to enter — the vault uses payee=Stash, so staking rewards accrue directly to the contract's balance. When compound is called, the contract does three things:
> First, it reads address(this).balance — the accrued staking rewards sitting in the contract.
> Second, it takes 0.5% as a keeper fee and bonds the rest via bondExtra on the Staking precompile. This increases the exchange rate for ALL stDOT holders — no action required on their part.
> Third — and this is the Track 2 cross-VM demo — it calls our Rust YieldOptimizer contract deployed on PolkaVM. The Solidity EVM contract calls a Rust RISC-V contract through pallet-revive's transparent VM routing. The Rust contract computes the annualized APY from exchange rate growth and returns it on-chain.
> This is real cross-VM interoperability — not a mock, not a simulation. Two different virtual machines, one seamless call."

**Show on Blockscout:** The compound transaction, pointing out the cross-contract call to the YieldOptimizer address `0x7d849...`

---

## Scene 7: Withdraw (3:00 – 3:30)

**Action:**
1. Go to Withdraw panel
2. Enter stDOT amount
3. Click "Request Withdraw"
4. Show the pending withdrawal with unbonding timer (1 hour on testnet)
5. (If pre-prepared) Click "Claim" on an already-matured withdrawal

**Say:**
> "Withdrawals use the Staking precompile's unbond function. There's a 28-day unbonding period on mainnet — 1 hour on testnet. Once matured, claim your PAS. The contract burns your stDOT and sends PAS back at the current exchange rate — which has grown since you deposited."

---

## Scene 8: XCM Cross-Chain (3:30 – 4:00)

**Action:**
1. Go to the XCM / Cross-Chain panel
2. Enter shares + a Relay Chain destination account
3. Click "Send Cross-Chain"
4. Show the XCM message preview (SCALE-encoded bytes)

**Say:**
> "PolkaVault can also teleport PAS to the Relay Chain via XCM V5. The contract hand-crafts a SCALE-encoded XCM message with WithdrawAsset, InitiateTeleport, BuyExecution, and DepositAsset — all in Solidity. This goes through the XCM precompile at 0x0A0000. No bridge. No relayer. Native Polkadot cross-chain messaging."

---

## Scene 9: Architecture Recap (4:00 – 4:20)

**Show:** The Cross-VM flow diagram section + Precompile Info section

**Say:**
> "To recap — PolkaVault uses three Polkadot Hub precompiles: Staking for bonding, XCM for cross-chain, and Balances for native PAS access. APY computation runs on a Rust contract compiled to RISC-V on PolkaVM. This is Track 2 in action — native assets, precompiles, and cross-VM, all working together in a real deployed protocol."

---

## Scene 10: Tests + Close (4:20 – 4:40)

**Show:** Terminal running `forge test -vv` → 43/43 passing

**Say:**
> "43 out of 43 tests passing. Exchange rate math, full withdraw lifecycle, ERC-20 compliance, XCM message construction, keeper fees, APY computation, and cross-VM integration — all tested with mocked precompiles at their real addresses.
> PolkaVault. Native liquid staking. Built on Polkadot Hub. Thank you."

---

## Pre-Demo Preparation Checklist

- [ ] Wallet connected to Polkadot Hub Testnet with PAS balance
- [ ] Fresh browser tab with `localhost:3000` loaded
- [ ] Blockscout tab open at the contract address
- [ ] Terminal ready with `forge test -vv` command
- [ ] One pre-matured withdrawal ready to claim (optional — submit requestWithdraw 1+ hour before recording)
- [ ] Screen recording software set to 1080p or higher
- [ ] Clear browser cache to show fresh load experience
