# PolkaVault — Demo Video Script

**Total length:** ~4 minutes (aim for 3:30–4:30)
**Format:** Screen-recorded clips stitched together, with text overlays (no voiceover needed)
**Resolution:** 1080p minimum
**Music:** Lo-fi or ambient electronic (optional, low volume)

---

## Pre-Recording Checklist

Do these **before** you hit record:

- [ ] Wallet connected to Polkadot Hub Testnet (chain 420420417) with 20+ PAS
- [ ] PolkaVault app running at `localhost:3000`, fresh page load
- [ ] Blockscout tab open: `https://blockscout-testnet.polkadot.io/address/0x64D3EfbAde442779c68972D5079861Bcf16722E6`
- [ ] Nominate validators already done (so staking is active)
- [ ] One withdrawal already requested 1+ hour ago (so you can show "Claim" live)
- [ ] Terminal ready with `forge test` command typed
- [ ] Clear browser cache for clean load
- [ ] Hide bookmarks bar, close other tabs

---

## CLIP 1 — The Hook (10–15 sec)

**What to record:** Nothing — this is a title card you'll add in editing.

**Text overlay:**
```
PolkaVault
Native Liquid Staking on Polkadot Hub

Stake PAS. Get stDOT. Earn yield. Go cross-chain.

No bridges. No oracles. No off-chain bots.
Built entirely on Polkadot Hub precompiles + PVM.
```

**Tip:** Use a dark background with the PolkaVault logo or a slow zoom on the hero section.

---

## CLIP 2 — The Problem We Solve (10–15 sec)

**What to record:** Text card or simple slide (edit in post).

**Text overlay:**
```
The Problem:

Liquid staking on Polkadot today needs
external oracles, bridges, and relayers.

PolkaVault does it natively —
using only what Polkadot Hub gives you.
```

---

## CLIP 3 — Connect Wallet (15–20 sec)

**What to record:**
1. Show the landing page (hero + stats strip)
2. Click "Connect Wallet" in navbar
3. Select MetaMask → approve connection
4. Show the navbar update: address appears, network shows "Polkadot Hub Testnet"

**Text overlay:**
```
Connecting to Polkadot Hub Testnet
Chain ID: 420420417 | Currency: PAS
```

**After connecting, briefly hover over the stats strip** (TVL, Exchange Rate, stDOT Supply, Depositors).

---

## CLIP 4 — Deposit PAS → Get stDOT (30–40 sec)

**This is the money clip. Go slow, let it breathe.**

**What to record:**
1. Click the **Deposit** tab
2. Show your PAS balance in the input area
3. Type `5` (or click a preset like 25%)
4. Point out the preview: _"You'll receive X stDOT at rate Y"_
5. Click **"Deposit 5 PAS"**
6. MetaMask popup → confirm
7. Wait for confirmation (loading spinner → checkmark)
8. Show updated **Position Summary**: stDOT balance, PAS value, earnings

**Text overlays (timed):**
```
→ Depositing 5 PAS into PolkaVault

→ Under the hood:
  contract calls Staking precompile (0x0804)
  bond(value, payee=Stash)
  PAS goes directly into substrate staking

→ stDOT minted at current exchange rate
  Liquid. Transferable. ERC-20.

→ Position updated ✓
```

**Bonus:** After the tx confirms, open the Blockscout tab and show the transaction — point out the Deposited event log.

---

## CLIP 5 — Nominate Validators (15–20 sec)

**What to record:**
1. Scroll down to the **"Nominate Validators"** panel (Owner Only)
2. Click **"Prefill Paseo Validators"** — both fields auto-fill
3. Click **"Nominate 2 Validators"**
4. Confirm in MetaMask
5. Show the "Currently Nominating (2)" section appear

**Text overlay:**
```
→ Nominating Paseo relay chain validators
  PAS is now backing real validators
  Staking rewards will accrue to the vault
```

**Note:** If you already nominated before recording, just show the "Currently Nominating" section instead. The point is to show it exists.

---

## CLIP 6 — Compound Rewards + Cross-VM (40–50 sec)

**This is the KEY clip. The judges care about this.**

**What to record:**
1. Click the **Compound** tab
2. Point out: _no amount input_ — the vault reads accrued rewards automatically
3. Show the "Auto-Harvest from Staking Rewards" info box
4. Click **"Compound Rewards"**
5. Confirm in MetaMask
6. Watch: exchange rate increases, APY updates
7. Scroll to the **Cross-VM Architecture** diagram section

**Text overlays (timed):**
```
→ compound() reads address(this).balance
  Staking rewards accrued via payee=Stash

→ 0.5% keeper fee paid to caller
  Remaining rewards bonded via bondExtra()
  Exchange rate increases for ALL stDOT holders

→ CROSS-VM CALL:
  Solidity (EVM) → pallet-revive → Rust (PolkaVM)
  YieldOptimizer computes APY from rate growth
  u128 arithmetic | 2,089-byte RISC-V binary

→ Two virtual machines. One seamless call.
  Deployed on Polkadot Hub Testnet.
```

**Then show the Cross-VM diagram on the page** — pause on it for 3-4 seconds so judges can read the flow:
`Solidity Vault → pallet-revive → Rust YieldOptimizer → APY result`

**Bonus:** Show the compound tx on Blockscout — point out the internal call to `0x7d849b045d89a489df71c2e69968eb020a233974` (the Rust contract).

---

## CLIP 7 — Withdraw (20–25 sec)

**What to record:**
1. Click the **Withdraw** tab
2. Enter an stDOT amount
3. Click **"Request Withdraw"** → confirm in MetaMask
4. Show the pending withdrawal with unbonding countdown
5. **If you have a pre-matured withdrawal:** Click **"Claim"** and show PAS returned

**Text overlay:**
```
→ Withdraw burns stDOT, calls unbond() on Staking precompile
  28-day unbonding on mainnet | 1 hour on testnet

→ After unbonding: claim your PAS
  You receive MORE PAS than you deposited
  (exchange rate grew from compounding)
```

---

## CLIP 8 — XCM Cross-Chain (20–25 sec)

**What to record:**
1. Click the **Cross-Chain** tab
2. Enter stDOT amount + a relay chain destination address
3. Show the SCALE-encoded XCM message preview
4. Click **"Send Cross-Chain"** (or just show the UI if you don't want to spend tokens)

**Text overlay:**
```
→ XCM V5 teleport to Relay Chain
  SCALE-encoded in Solidity:
  WithdrawAsset → InitiateTeleport → BuyExecution → DepositAsset

→ XCM precompile at 0x0A0000
  No bridge. No relayer. Native Polkadot messaging.
```

---

## CLIP 9 — Architecture & Precompiles (15–20 sec)

**What to record:** Slowly scroll through:
1. **"How It Works"** section (4-step flow)
2. **Precompile Info** section (Staking, XCM, Balances addresses)
3. Pause briefly on each so judges can read

**Text overlay:**
```
→ Three precompiles. One Rust PVM contract.
  Everything on-chain. Everything verifiable.
```

---

## CLIP 10 — Tests (15–20 sec)

**What to record:**
1. Switch to terminal
2. Run `forge test -vv`
3. Show all 43 tests passing (green output)

**Text overlay:**
```
→ 43/43 tests passing
  Exchange rate math ✓
  Full withdraw lifecycle ✓
  XCM message construction ✓
  Cross-VM APY computation ✓
  Keeper fees ✓
  ERC-20 compliance ✓
```

---

## CLIP 11 — Close (10 sec)

**What to record:** Title card (add in editing).

**Text overlay:**
```
PolkaVault
Native Liquid Staking on Polkadot Hub

Track 2: PVM Smart Contracts
Polkadot OpenGuild Hackathon 2026

github.com/[your-repo]
```

---

## Editing Tips

| Tip | Why |
|---|---|
| Cut dead time (MetaMask loading, tx confirming) | Keep it snappy — speed up 2-4x during waits |
| Use zoom/crop on key UI elements | Judges watch on small screens — make text readable |
| Clip 6 (Compound + Cross-VM) gets the most time | This is your differentiator. Let it breathe. |
| Add a subtle transition between clips | Simple fade or cut — nothing flashy |
| Consistent text overlay position | Bottom-left or bottom-center, semi-transparent background |
| Show Blockscout after Deposit and Compound | Proves it's real, not a mock |

## Recording Order (optimize your time)

1. **First:** Request a withdrawal (so it matures while you record other clips)
2. **Record Clips 3-6** in order (Connect → Deposit → Nominate → Compound)
3. **Record Clip 7** (Claim the matured withdrawal)
4. **Record Clip 8** (XCM)
5. **Record Clip 9** (scroll architecture sections)
6. **Record Clip 10** (terminal tests)
7. **Add Clips 1, 2, 11 in editing** (title cards)
