"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState } from "react";
import clsx from "clsx";
import {
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Zap,
  Shield,
  Loader2,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { POLKAVAULT_ADDRESS, POLKAVAULT_ABI } from "@/lib/contracts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(wei: bigint, dp = 4): string {
  const s = formatEther(wei);
  const [int, dec = ""] = s.split(".");
  return `${int}.${dec.padEnd(dp, "0").slice(0, dp)}`;
}

function fmtRate(rateBig: bigint): string {
  const r = Number(rateBig) / 1e18;
  return r.toFixed(6);
}

function timeUntil(ts: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(ts) - now;
  if (diff <= 0) return "Ready to claim";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

// ─── Global vault stats strip ─────────────────────────────────────────────────

function VaultStatsStrip() {
  const { data: stats } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "getVaultStats",
    query: { refetchInterval: 10_000 },
  });

  const [rate, staked, , supply] = (stats as [bigint, bigint, bigint, bigint]) ?? [0n, 0n, 0n, 0n];

  return (
    <div className="border-b border-white/5 bg-white/[0.02]">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-10 text-sm flex-wrap">
        <Stat label="Exchange Rate"     value={`1 stDOT = ${fmtRate(rate)} PAS`}    accent="pink"    />
        <Stat label="Total Value Locked" value={`${fmt(staked)} PAS`}               accent="emerald" />
        <Stat label="stDOT Supply"       value={`${fmt(supply)} stDOT`}             accent="blue"    />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={clsx("font-semibold text-sm", {
        "text-pink-400":    accent === "pink",
        "text-emerald-400": accent === "emerald",
        "text-blue-400":    accent === "blue",
      })}>
        {value}
      </span>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="text-center py-14 px-4">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium mb-5">
        <Shield className="w-3 h-3" />
        Polkadot Hub Precompiles — Track 2
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-pink-200 to-pink-500 bg-clip-text text-transparent">
        PolkaVault
      </h1>
      <p className="text-gray-400 max-w-xl mx-auto text-base mb-1">
        Native Liquid Staking on Polkadot Hub
      </p>
      <p className="text-gray-600 max-w-lg mx-auto text-sm">
        Deposit PAS → receive{" "}
        <span className="text-pink-400 font-medium">stDOT</span>.
        Earn staking yield. Send cross-chain via XCM. All on-chain.
      </p>
    </section>
  );
}

// ─── User dashboard ───────────────────────────────────────────────────────────

type Tab = "deposit" | "withdraw" | "crosschain" | "compound";

function Dashboard() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("deposit");

  const { data: position, refetch: refetchPosition } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "getUserPosition",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });

  const [stDotBal, dotVal] = (position as [bigint, bigint]) ?? [0n, 0n];

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 mb-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <Shield className="w-10 h-10 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-5 text-sm">Connect your wallet to start staking</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-5 mb-8">
      {/* Position card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Your stDOT balance</p>
          <p className="text-2xl font-bold">
            {fmt(stDotBal)}{" "}
            <span className="text-pink-400">stDOT</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">≈ {fmt(dotVal)} PAS</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-0.5">Yield accrual</p>
          <p className="text-sm text-emerald-400 font-medium flex items-center gap-1 justify-end">
            <TrendingUp className="w-3.5 h-3.5" />
            Exchange rate grows each era
          </p>
          <p className="text-xs text-gray-600 mt-0.5">No lock-up on stDOT — transfer anytime</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl bg-white/5 p-0.5 gap-0.5">
        {(
          [
            { id: "deposit",    label: "Deposit",     icon: ArrowDownToLine },
            { id: "withdraw",   label: "Withdraw",    icon: ArrowUpFromLine },
            { id: "crosschain", label: "Cross-Chain", icon: ArrowRightLeft  },
            { id: "compound",   label: "Compound",    icon: Zap             },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
              tab === id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "deposit"    && <DepositPanel    onSuccess={refetchPosition} />}
      {tab === "withdraw"   && <WithdrawPanel   onSuccess={refetchPosition} address={address!} />}
      {tab === "crosschain" && <CrossChainPanel onSuccess={refetchPosition} />}
      {tab === "compound"   && <CompoundPanel   onSuccess={refetchPosition} />}
    </div>
  );
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

function DepositPanel({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: sharesOut } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "sharesForDot",
    args: amount && !isNaN(Number(amount)) && Number(amount) > 0
      ? [parseEther(amount)]
      : undefined,
    query: { enabled: !!amount && Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); reset(); }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <ArrowDownToLine className="w-4 h-4 text-pink-400" />
        Deposit PAS — Receive stDOT
      </h3>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-600"
          />
          <span className="text-gray-400 text-sm font-medium">DOT</span>
        </div>
        {sharesOut !== undefined && Number(amount) > 0 && (
          <p className="text-xs text-gray-500 px-1">
            You receive ≈{" "}
            <span className="text-pink-400 font-medium">{fmt(sharesOut as bigint)} stDOT</span>
          </p>
        )}
      </div>

      <TxButton
        onClick={() => writeContract({
          address: POLKAVAULT_ADDRESS,
          abi: POLKAVAULT_ABI,
          functionName: "deposit",
          value: parseEther(amount || "0"),
        })}
        disabled={!amount || Number(amount) <= 0}
        isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        color="pink"
        label="Deposit PAS"
      />
      <p className="text-[11px] text-gray-600 text-center">
        PAS is bonded via the Staking precompile (0x0804)
      </p>
    </div>
  );
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

function WithdrawPanel({ onSuccess, address }: { onSuccess: () => void; address: `0x${string}` }) {
  const [amount, setAmount] = useState("");
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: withdrawReqs, refetch: refetchReqs } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "getWithdrawRequests",
    args: [address],
    query: { refetchInterval: 15_000 },
  });

  const { data: dotOut } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "dotForShares",
    args: amount && Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: !!amount && Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); refetchReqs(); reset(); }

  type WReq = { dot: bigint; claimableAt: bigint; claimed: boolean };
  const pendingReqs = ((withdrawReqs as WReq[]) ?? []).filter((r) => !r.claimed);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <ArrowUpFromLine className="w-4 h-4 text-amber-400" />
        Withdraw — Redeem stDOT for PAS
      </h3>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-600"
          />
          <span className="text-gray-400 text-sm font-medium">stDOT</span>
        </div>
        {dotOut !== undefined && Number(amount) > 0 && (
          <p className="text-xs text-gray-500 px-1">
            You receive ≈{" "}
            <span className="text-amber-400 font-medium">{fmt(dotOut as bigint)} PAS</span>{" "}
            after unbonding
          </p>
        )}
      </div>

      <TxButton
        onClick={() => writeContract({
          address: POLKAVAULT_ADDRESS,
          abi: POLKAVAULT_ABI,
          functionName: "requestWithdraw",
          args: [parseEther(amount || "0")],
        })}
        disabled={!amount || Number(amount) <= 0}
        isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        color="amber"
        label="Request Withdrawal"
      />

      {pendingReqs.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <p className="text-xs text-gray-500">Pending Claims</p>
          {pendingReqs.map((req, i) => (
            <PendingClaim key={i} req={req} index={i} onClaimed={refetchReqs} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingClaim({
  req,
  index,
  onClaimed,
}: {
  req: { dot: bigint; claimableAt: bigint; claimed: boolean };
  index: number;
  onClaimed: () => void;
}) {
  const ready = Date.now() / 1000 >= Number(req.claimableAt);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onClaimed();

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
      <div>
        <p className="text-sm font-medium">{fmt(req.dot)} PAS</p>
        <p className={clsx("text-xs flex items-center gap-1 mt-0.5", ready ? "text-emerald-400" : "text-gray-500")}>
          <Clock className="w-3 h-3" />
          {timeUntil(req.claimableAt)}
        </p>
      </div>
      {ready && (
        <button
          onClick={() => writeContract({
            address: POLKAVAULT_ADDRESS,
            abi: POLKAVAULT_ABI,
            functionName: "claimWithdrawal",
            args: [BigInt(index)],
          })}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
        </button>
      )}
    </div>
  );
}

// ─── Cross-chain send ─────────────────────────────────────────────────────────

function CrossChainPanel({ onSuccess }: { onSuccess: () => void; stDotBal?: bigint }) {
  const [amount, setAmount] = useState("");
  const [dest, setDest]     = useState("");
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: xcmFee } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "xcmFeeAmount",
  });

  const { data: dotOut } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "dotForShares",
    args: amount && Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: !!amount && Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); reset(); }

  function toBytes32(s: string): `0x${string}` {
    const clean = s.startsWith("0x") ? s.slice(2) : s;
    return `0x${clean.padStart(64, "0").slice(0, 64)}` as `0x${string}`;
  }

  const fee = xcmFee ? BigInt(xcmFee as bigint) : 0n;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-0.5">
          <ArrowRightLeft className="w-4 h-4 text-blue-400" />
          Send Cross-Chain via XCM
        </h3>
        <p className="text-xs text-gray-500">
          Redeem stDOT and teleport PAS to the Relay Chain — XCM V5 InitiateTeleport
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-600"
          />
          <span className="text-gray-400 text-sm font-medium">stDOT</span>
        </div>
        <input
          type="text"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Destination account (0x... or 64 hex chars)"
          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50"
        />
        {dotOut !== undefined && Number(amount) > 0 && (
          <p className="text-xs text-gray-500 px-1">
            ≈ <span className="text-blue-400 font-medium">{fmt(dotOut as bigint)} PAS</span> arrives on Relay Chain
          </p>
        )}
        {fee > 0n && (
          <p className="text-[11px] text-gray-600 px-1">
            XCM fee: {fmt(fee, 8)} PAS (attached to tx)
          </p>
        )}
      </div>

      <TxButton
        onClick={() => writeContract({
          address: POLKAVAULT_ADDRESS,
          abi: POLKAVAULT_ABI,
          functionName: "sendCrossChain",
          args: [parseEther(amount || "0"), toBytes32(dest)],
          value: fee,
        })}
        disabled={!amount || Number(amount) <= 0 || !dest}
        isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        color="blue"
        label="Send Cross-Chain"
      />

      {/* XCM flow diagram */}
      <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3 text-[11px] text-gray-500 space-y-1.5">
        <p className="text-blue-400 font-medium mb-1">XCM V5 Message Structure</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="px-1.5 py-0.5 bg-blue-500/10 rounded text-blue-400">Hub (outer)</span>
          <ChevronRight className="w-3 h-3" />
          <span>WithdrawAsset(DOT)</span>
          <ChevronRight className="w-3 h-3" />
          <span>InitiateTeleport →</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap pl-3">
          <span className="px-1.5 py-0.5 bg-purple-500/10 rounded text-purple-400">Relay (inner)</span>
          <ChevronRight className="w-3 h-3" />
          <span>BuyExecution</span>
          <ChevronRight className="w-3 h-3" />
          <span>DepositAsset(dest)</span>
        </div>
      </div>
    </div>
  );
}

// ─── Compound ─────────────────────────────────────────────────────────────────

function CompoundPanel({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState("5");
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: rate } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "exchangeRate",
    query: { refetchInterval: 5_000 },
  });

  if (isSuccess) { onSuccess(); reset(); }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-0.5">
          <Zap className="w-4 h-4 text-yellow-400" />
          Compound Staking Rewards
        </h3>
        <p className="text-xs text-gray-500">
          Bonds rewards via bondExtra() — increases the exchange rate for all stDOT holders
        </p>
      </div>

      <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/10 p-3">
        <p className="text-xs text-gray-500 mb-0.5">Current exchange rate</p>
        <p className="font-mono text-yellow-400 font-semibold text-lg">
          1 stDOT = {rate !== undefined ? fmtRate(rate as bigint) : "..."} PAS
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-600"
        />
        <span className="text-gray-400 text-sm font-medium">DOT (rewards)</span>
      </div>

      <TxButton
        onClick={() => writeContract({
          address: POLKAVAULT_ADDRESS,
          abi: POLKAVAULT_ABI,
          functionName: "compound",
          value: parseEther(amount || "0"),
        })}
        disabled={!amount || Number(amount) <= 0}
        isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        color="yellow"
        label="Compound Rewards"
      />
      <p className="text-[11px] text-gray-600 text-center">
        Permissionless — anyone can trigger. In production, called by a keeper bot each era.
      </p>
    </div>
  );
}

// ─── Shared TX button ─────────────────────────────────────────────────────────

function TxButton({
  onClick, disabled, isPending, isSuccess, color, label,
}: {
  onClick: () => void;
  disabled: boolean;
  isPending: boolean;
  isSuccess: boolean;
  color: "pink" | "amber" | "blue" | "yellow" | "emerald";
  label: string;
}) {
  const colors = {
    pink:    "bg-pink-600    hover:bg-pink-500    text-white",
    amber:   "bg-amber-600   hover:bg-amber-500   text-white",
    blue:    "bg-blue-600    hover:bg-blue-500    text-white",
    yellow:  "bg-yellow-500  hover:bg-yellow-400  text-black",
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={clsx(
        "w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40",
        colors[color]
      )}
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Confirming...
        </span>
      ) : isSuccess ? (
        <span className="flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Done!
        </span>
      ) : label}
    </button>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01", color: "pink",
      title: "Deposit PAS",
      desc: "Send native PAS to the vault. It bonds via the Staking precompile (0x0804). You receive stDOT at the current exchange rate.",
    },
    {
      n: "02", color: "emerald",
      title: "Earn Yield",
      desc: "Staking rewards accumulate each era. compound() re-bonds them — the stDOT/DOT exchange rate increases for all holders.",
    },
    {
      n: "03", color: "blue",
      title: "stDOT is Liquid",
      desc: "Transfer stDOT like any ERC-20. No lock-up. When ready, request withdrawal and claim PAS after the unbonding period.",
    },
    {
      n: "04", color: "purple",
      title: "Send Cross-Chain",
      desc: "Redeem stDOT and teleport PAS to the Relay Chain via XCM V5 InitiateTeleport — powered by the XCM precompile (0x0A0000).",
    },
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 py-12">
      <h2 className="text-base font-semibold text-center mb-6 text-gray-300">How it works</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className={clsx("text-2xl font-black mb-3", {
              "text-pink-500/40":    s.color === "pink",
              "text-emerald-500/40": s.color === "emerald",
              "text-blue-500/40":    s.color === "blue",
              "text-purple-500/40":  s.color === "purple",
            })}>
              {s.n}
            </p>
            <p className="font-semibold text-sm mb-1">{s.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Precompile info ──────────────────────────────────────────────────────────

function PrecompileInfo() {
  const precompiles = [
    { name: "Balances", addr: "0x0402",   desc: "Native PAS as ERC-20",       color: "text-pink-400"    },
    { name: "Assets",   addr: "0x0403+",  desc: "USDT, USDC & native assets", color: "text-blue-400"    },
    { name: "Staking",  addr: "0x0804",   desc: "Bond, unbond, nominate",     color: "text-emerald-400" },
    { name: "XCM",      addr: "0x0A0000", desc: "Cross-chain teleport (V5)",  color: "text-purple-400"  },
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 pb-12">
      <h2 className="text-base font-semibold text-center mb-6 text-gray-300">
        Powered by Polkadot Hub Precompiles
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {precompiles.map((p) => (
          <div key={p.name} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className={clsx("text-sm font-semibold mb-1", p.color)}>{p.name}</p>
            <code className="text-[10px] text-gray-600 block mb-1.5">{p.addr}</code>
            <p className="text-[11px] text-gray-500">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="min-h-screen">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-gray-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-pink-500" />
          <span className="font-bold">PolkaVault</span>
          <span className="text-[10px] px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-full font-medium border border-pink-500/20">
            Testnet
          </span>
        </div>
        <ConnectButton showBalance chainStatus="icon" accountStatus="avatar" />
      </nav>

      <VaultStatsStrip />
      <Hero />
      <Dashboard />
      <HowItWorks />
      <PrecompileInfo />

      <footer className="text-center py-6 text-xs text-gray-700 border-t border-white/5">
        PolkaVault — Polkadot Hackathon 2025 — Track 2: PVM Smart Contracts
      </footer>
    </main>
  );
}
