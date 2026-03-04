"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
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
  Layers,
  Lock,
  Cpu,
} from "lucide-react";
import { POLKAVAULT_ADDRESS, POLKAVAULT_ABI } from "@/lib/contracts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(wei: bigint, dp = 4): string {
  const s = formatEther(wei);
  const [int, dec = ""] = s.split(".");
  return `${int}.${dec.padEnd(dp, "0").slice(0, dp)}`;
}

function fmtRate(rateBig: bigint): string {
  return (Number(rateBig) / 1e18).toFixed(6);
}

function timeUntil(ts: bigint): string {
  const diff = Number(ts) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ready to claim";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

// ─── Background orbs ──────────────────────────────────────────────────────────

function BgOrbs() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute -top-64 -left-64 w-[700px] h-[700px] rounded-full bg-pink-600/[0.07] blur-[140px] animate-blob" />
      <div className="absolute -top-32 -right-64 w-[600px] h-[600px] rounded-full bg-purple-600/[0.07] blur-[120px] animate-blob animation-delay-2000" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/[0.05] blur-[120px] animate-blob animation-delay-4000" />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030712]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">PolkaVault</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 font-semibold">
            Testnet
          </span>
        </div>
        <ConnectButton showBalance chainStatus="icon" accountStatus="avatar" />
      </div>
    </nav>
  );
}

// ─── Live vault stats ─────────────────────────────────────────────────────────

function VaultStats() {
  const { data: stats } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "getVaultStats",
    query: { refetchInterval: 10_000 },
  });
  const [rate, staked, , supply] = (stats as [bigint, bigint, bigint, bigint]) ?? [0n, 0n, 0n, 0n];

  const cards = [
    { icon: TrendingUp, label: "Exchange Rate", value: `${fmtRate(rate)}`,  sub: "PAS per stDOT", color: "pink"    },
    { icon: Lock,       label: "Total Staked",  value: fmt(staked),          sub: "PAS bonded",    color: "emerald" },
    { icon: Layers,     label: "stDOT Supply",  value: fmt(supply),          sub: "tokens issued", color: "blue"    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-3 mt-10 max-w-2xl mx-auto w-full">
      {cards.map(({ icon: Icon, label, value, sub, color }) => (
        <div
          key={label}
          className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 text-center backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
        >
          <Icon className={clsx("w-4 h-4 mx-auto mb-2", {
            "text-pink-400":    color === "pink",
            "text-emerald-400": color === "emerald",
            "text-blue-400":    color === "blue",
          })} />
          <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
          <p className={clsx("font-black text-sm", {
            "text-pink-300":    color === "pink",
            "text-emerald-300": color === "emerald",
            "text-blue-300":    color === "blue",
          })}>
            {value}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-16 pb-12 px-4 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse inline-block" />
        Polkadot Hackathon 2025 · Track 2: PVM Smart Contracts
      </div>
      <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.08] mb-5 bg-gradient-to-br from-white via-pink-100 to-pink-500 bg-clip-text text-transparent">
        Native Liquid<br />Staking on<br />Polkadot Hub
      </h1>
      <p className="text-gray-400 text-lg mb-2 max-w-sm mx-auto">
        Deposit PAS → receive{" "}
        <span className="text-pink-400 font-semibold">stDOT</span>.
        Earn yield. Send cross-chain.
      </p>
      <p className="text-gray-600 text-sm tracking-wide">
        No oracle · No bridging · No off-chain relayer
      </p>
      <VaultStats />
    </section>
  );
}

// ─── Token input ──────────────────────────────────────────────────────────────

function TokenInput({
  value,
  onChange,
  token,
  maxBal,
  preview,
}: {
  value: string;
  onChange: (v: string) => void;
  token: string;
  maxBal?: bigint;
  preview?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.10] focus-within:border-white/[0.20] transition-colors">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 bg-transparent text-white text-xl font-semibold outline-none placeholder-gray-700 min-w-0"
        />
        {maxBal !== undefined && maxBal > 0n && (
          <button
            onClick={() => onChange(formatEther(maxBal))}
            className="shrink-0 text-[10px] px-2 py-1 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors font-bold"
          >
            MAX
          </button>
        )}
        <span className="shrink-0 text-gray-400 font-semibold text-sm">{token}</span>
      </div>
      {preview && <p className="text-xs text-gray-500 px-1">{preview}</p>}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
      {accent && <div className={`h-[2px] w-full ${accent}`} />}
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  iconColor,
  title,
  sub,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  sub: string;
}) {
  return (
    <div>
      <h3 className="font-bold text-sm flex items-center gap-2 mb-0.5">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {title}
      </h3>
      <p className="text-xs text-gray-600 pl-8">{sub}</p>
    </div>
  );
}

// ─── TX button ────────────────────────────────────────────────────────────────

function TxButton({
  onClick, disabled, isPending, isSuccess, gradient, label,
}: {
  onClick: () => void;
  disabled: boolean;
  isPending: boolean;
  isSuccess: boolean;
  gradient: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={clsx(
        "w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
        gradient
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

// ─── Deposit ──────────────────────────────────────────────────────────────────

function DepositPanel({ onSuccess, nativeBal }: { onSuccess: () => void; nativeBal: bigint }) {
  const [amount, setAmount] = useState("");
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: sharesOut } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "sharesForDot",
    args: Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); reset(); }

  return (
    <Panel accent="bg-gradient-to-r from-pink-600 to-pink-500">
      <PanelHeader
        icon={ArrowDownToLine}
        iconColor="bg-pink-500/15 text-pink-400"
        title="Deposit PAS — Receive stDOT"
        sub="Bonded via Staking precompile (0x0804)"
      />
      <TokenInput
        value={amount}
        onChange={setAmount}
        token="PAS"
        maxBal={nativeBal}
        preview={sharesOut !== undefined && Number(amount) > 0
          ? <>You receive ≈ <span className="text-pink-400 font-semibold">{fmt(sharesOut as bigint)} stDOT</span></>
          : undefined
        }
      />
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
        gradient="bg-gradient-to-r from-pink-600 to-pink-500 text-white shadow-pink-500/20 hover:shadow-pink-500/30 hover:from-pink-500 hover:to-pink-400"
        label="Deposit PAS"
      />
    </Panel>
  );
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

function WithdrawPanel({
  onSuccess, address, stDotBal,
}: { onSuccess: () => void; address: `0x${string}`; stDotBal: bigint }) {
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
    args: Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); refetchReqs(); reset(); }

  type WReq = { dot: bigint; claimableAt: bigint; claimed: boolean };
  const pendingReqs = ((withdrawReqs as WReq[]) ?? []).filter((r) => !r.claimed);

  return (
    <Panel accent="bg-gradient-to-r from-amber-600 to-amber-500">
      <PanelHeader
        icon={ArrowUpFromLine}
        iconColor="bg-amber-500/15 text-amber-400"
        title="Withdraw — Redeem stDOT for PAS"
        sub="28-day unbonding period (1h on testnet)"
      />
      <TokenInput
        value={amount}
        onChange={setAmount}
        token="stDOT"
        maxBal={stDotBal}
        preview={dotOut !== undefined && Number(amount) > 0
          ? <>You receive ≈ <span className="text-amber-400 font-semibold">{fmt(dotOut as bigint)} PAS</span> after unbonding</>
          : undefined
        }
      />
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
        gradient="bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-amber-500/20 hover:shadow-amber-500/30 hover:from-amber-500 hover:to-amber-400"
        label="Request Withdrawal"
      />
      {pendingReqs.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/[0.06]">
          <p className="text-xs text-gray-500 font-semibold">Pending Claims</p>
          {pendingReqs.map((req, i) => (
            <PendingClaim key={i} req={req} index={i} onClaimed={refetchReqs} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function PendingClaim({
  req, index, onClaimed,
}: { req: { dot: bigint; claimableAt: bigint; claimed: boolean }; index: number; onClaimed: () => void }) {
  const ready = Date.now() / 1000 >= Number(req.claimableAt);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onClaimed();

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <div>
        <p className="text-sm font-semibold">{fmt(req.dot)} PAS</p>
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
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-50 border border-emerald-500/20"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
        </button>
      )}
    </div>
  );
}

// ─── Cross-chain ──────────────────────────────────────────────────────────────

function CrossChainPanel({ onSuccess, stDotBal }: { onSuccess: () => void; stDotBal: bigint }) {
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
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
    args: Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); reset(); }

  function toBytes32(s: string): `0x${string}` {
    const clean = s.startsWith("0x") ? s.slice(2) : s;
    return `0x${clean.padStart(64, "0").slice(0, 64)}` as `0x${string}`;
  }

  const fee = xcmFee ? BigInt(xcmFee as bigint) : 0n;

  return (
    <Panel accent="bg-gradient-to-r from-blue-600 to-indigo-500">
      <PanelHeader
        icon={ArrowRightLeft}
        iconColor="bg-blue-500/15 text-blue-400"
        title="Send Cross-Chain via XCM"
        sub="XCM V5 InitiateTeleport → Relay Chain (0x0A0000)"
      />
      <TokenInput
        value={amount}
        onChange={setAmount}
        token="stDOT"
        maxBal={stDotBal}
        preview={dotOut !== undefined && Number(amount) > 0
          ? <>≈ <span className="text-blue-400 font-semibold">{fmt(dotOut as bigint)} PAS</span> arrives on Relay Chain</>
          : undefined
        }
      />
      <div className="space-y-1.5">
        <input
          type="text"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Destination account (0x… or 64 hex chars)"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.10] text-sm text-white placeholder-gray-700 outline-none focus:border-white/[0.20] transition-colors font-mono"
        />
        {fee > 0n && (
          <p className="text-[11px] text-gray-600 px-1">
            XCM fee: {fmt(fee, 8)} PAS attached automatically
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
        gradient="bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30 hover:from-blue-500 hover:to-indigo-400"
        label="Send Cross-Chain"
      />
      <div className="rounded-xl bg-blue-950/30 border border-blue-500/10 p-3">
        <p className="text-[11px] text-blue-400 font-bold mb-2">XCM V5 Message Flow</p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap">
          <span className="px-1.5 py-0.5 bg-blue-500/10 rounded text-blue-400 font-medium">Hub</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span>WithdrawAsset</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span>InitiateTeleport</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span className="px-1.5 py-0.5 bg-purple-500/10 rounded text-purple-400 font-medium">Relay</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span>BuyExecution</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span>DepositAsset</span>
        </div>
      </div>
    </Panel>
  );
}

// ─── Compound ─────────────────────────────────────────────────────────────────

function CompoundPanel({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
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
    <Panel accent="bg-gradient-to-r from-yellow-500 to-orange-400">
      <PanelHeader
        icon={Zap}
        iconColor="bg-yellow-500/15 text-yellow-400"
        title="Compound Staking Rewards"
        sub="Permissionless · bondExtra() · Rate grows for all holders"
      />
      <div className="rounded-xl bg-yellow-950/20 border border-yellow-500/10 p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Current Exchange Rate</p>
          <p className="font-black text-2xl font-mono text-yellow-400 leading-none">
            {rate !== undefined ? fmtRate(rate as bigint) : "—"}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">PAS per stDOT</p>
        </div>
        <div className="flex items-end gap-0.5">
          {[30, 50, 40, 60, 55, 75, 70].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-sm bg-yellow-500/30"
              style={{ height: `${h}%`, maxHeight: 36 * h / 100 }}
            />
          ))}
        </div>
      </div>
      <TokenInput value={amount} onChange={setAmount} token="PAS" />
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
        gradient="bg-gradient-to-r from-yellow-500 to-orange-400 text-black shadow-yellow-500/20 hover:shadow-yellow-500/30 hover:from-yellow-400 hover:to-orange-300"
        label="Compound Rewards"
      />
    </Panel>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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
  const { data: nativeBal } = useBalance({ address });

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto px-4 mb-14">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/20 flex items-center justify-center mx-auto mb-5">
            <Shield className="w-8 h-8 text-pink-400" />
          </div>
          <h3 className="text-lg font-black mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500 text-sm mb-7 leading-relaxed max-w-xs mx-auto">
            Connect to Polkadot Hub Testnet to deposit PAS, earn staking yield, and send cross-chain.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 space-y-4 mb-14">
      {/* Position card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-pink-600 via-purple-500 to-indigo-500" />
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-500 font-medium mb-0.5 uppercase tracking-wider">Your Position</p>
            <p className="text-3xl font-black">
              {fmt(stDotBal)}{" "}
              <span className="text-pink-400">stDOT</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">≈ {fmt(dotVal)} PAS</p>
          </div>
          <div className="text-right space-y-1.5">
            <div className="flex items-center gap-1.5 justify-end text-emerald-400 text-sm font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              Auto-compounding
            </div>
            <p className="text-xs text-gray-600">Exchange rate grows each era</p>
            {nativeBal && (
              <p className="text-[11px] text-gray-600 font-mono">
                {fmt(nativeBal.value)} PAS available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.07] p-1 gap-1">
        {([
          { id: "deposit",    label: "Deposit",     icon: ArrowDownToLine },
          { id: "withdraw",   label: "Withdraw",    icon: ArrowUpFromLine },
          { id: "crosschain", label: "Cross-Chain", icon: ArrowRightLeft  },
          { id: "compound",   label: "Compound",    icon: Zap             },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all",
              tab === id
                ? "bg-white/10 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-400"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "deposit"    && <DepositPanel    onSuccess={refetchPosition} nativeBal={nativeBal?.value ?? 0n} />}
      {tab === "withdraw"   && <WithdrawPanel   onSuccess={refetchPosition} address={address!} stDotBal={stDotBal} />}
      {tab === "crosschain" && <CrossChainPanel onSuccess={refetchPosition} stDotBal={stDotBal} />}
      {tab === "compound"   && <CompoundPanel   onSuccess={refetchPosition} />}
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01", color: "pink" as const,
      title: "Deposit PAS",
      desc: "Send native PAS to the vault. Bonded via Staking precompile (0x0804). Receive stDOT at the current exchange rate.",
    },
    {
      n: "02", color: "emerald" as const,
      title: "Earn Yield",
      desc: "Staking rewards accumulate each era. compound() re-bonds them — the stDOT/PAS exchange rate grows for all holders.",
    },
    {
      n: "03", color: "blue" as const,
      title: "stDOT is Liquid",
      desc: "Transfer stDOT like any ERC-20. No lock-up on your tokens. Redeem PAS anytime after the unbonding period.",
    },
    {
      n: "04", color: "purple" as const,
      title: "Send Cross-Chain",
      desc: "Teleport PAS to the Relay Chain via XCM V5 InitiateTeleport, powered by the XCM precompile (0x0A0000).",
    },
  ];

  const cfg = {
    pink:    { num: "text-pink-600/25",    border: "border-pink-500/10",    hover: "hover:border-pink-500/25"    },
    emerald: { num: "text-emerald-600/25", border: "border-emerald-500/10", hover: "hover:border-emerald-500/25" },
    blue:    { num: "text-blue-600/25",    border: "border-blue-500/10",    hover: "hover:border-blue-500/25"    },
    purple:  { num: "text-purple-600/25",  border: "border-purple-500/10",  hover: "hover:border-purple-500/25"  },
  };

  return (
    <section className="max-w-5xl mx-auto px-4 py-16 border-t border-white/[0.05]">
      <div className="text-center mb-10">
        <p className="text-xs text-pink-400 font-bold tracking-widest uppercase mb-2">Flow</p>
        <h2 className="text-2xl font-black">How it works</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => {
          const c = cfg[s.color];
          return (
            <div
              key={s.n}
              className={clsx(
                "rounded-2xl border bg-white/[0.03] p-6 transition-colors",
                c.border, c.hover
              )}
            >
              <p className={clsx("text-6xl font-black mb-4 select-none leading-none", c.num)}>{s.n}</p>
              <p className="font-bold text-sm mb-2">{s.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Precompile section ───────────────────────────────────────────────────────

function PrecompileInfo() {
  const items = [
    {
      name: "Staking",
      short: "0x0804",
      full: "0x0000...0804",
      desc: "bond() · bondExtra() · unbond() · withdrawUnbonded()",
      note: "0 bytes EVM code — low-level .call() required",
      color: "emerald" as const,
    },
    {
      name: "XCM",
      short: "0x0A0000",
      full: "0x0000...0A0000",
      desc: "execute() — XCM V5 InitiateTeleport to Relay Chain",
      note: "10 bytes EVM code — interface calls work",
      color: "blue" as const,
    },
    {
      name: "Balances",
      short: "0x0402",
      full: "0x0000...0402",
      desc: "Native PAS as ERC-20 — balance queries",
      note: "0 bytes EVM code — low-level .call() required",
      color: "pink" as const,
    },
  ];

  const cfg = {
    emerald: {
      border: "border-emerald-500/15 hover:border-emerald-500/30",
      badge: "bg-emerald-500/10 text-emerald-400",
    },
    blue: {
      border: "border-blue-500/15 hover:border-blue-500/30",
      badge: "bg-blue-500/10 text-blue-400",
    },
    pink: {
      border: "border-pink-500/15 hover:border-pink-500/30",
      badge: "bg-pink-500/10 text-pink-400",
    },
  };

  return (
    <section className="max-w-5xl mx-auto px-4 pb-16 border-t border-white/[0.05] pt-16">
      <div className="text-center mb-8">
        <p className="text-xs text-pink-400 font-bold tracking-widest uppercase mb-2">Track 2 · Precompiles</p>
        <h2 className="text-2xl font-black mb-3">Polkadot Hub Precompiles</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
          Solidity 0.8 inserts an{" "}
          <code className="text-pink-400 bg-pink-500/10 px-1 rounded text-xs">EXTCODESIZE</code>{" "}
          check before every interface call. Precompiles expose 0 bytes of EVM code — so the check reverts.
          PolkaVault uses low-level{" "}
          <code className="text-pink-400 bg-pink-500/10 px-1 rounded text-xs">.call()</code>{" "}
          to bypass this.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((p) => {
          const c = cfg[p.color];
          return (
            <div
              key={p.name}
              className={clsx("rounded-2xl border bg-white/[0.03] p-5 transition-colors", c.border)}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={clsx("text-xs font-bold px-2.5 py-1 rounded-lg", c.badge)}>
                  {p.name}
                </span>
                <code className="text-[10px] text-gray-600 font-mono">{p.short}</code>
              </div>
              <p className="text-sm text-gray-300 font-medium mb-1.5">{p.desc}</p>
              <div className="flex items-start gap-1.5 mt-3">
                <Cpu className="w-3 h-3 text-gray-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-600 leading-relaxed">{p.note}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <BgOrbs />
      <main className="min-h-screen">
        <Nav />
        <Hero />
        <Dashboard />
        <HowItWorks />
        <PrecompileInfo />
        <footer className="border-t border-white/[0.05] py-8 text-center">
          <p className="text-xs text-gray-700">
            PolkaVault · Polkadot Hackathon 2025 · Track 2: PVM Smart Contracts ·{" "}
            <a
              href="https://blockscout-testnet.polkadot.io/address/0x3e9eF811ddF3078559178C57d6cD97f45DbD6220"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-500 transition-colors"
            >
              0x3e9eF…6220
            </a>
          </p>
          <p className="text-[11px] text-gray-800 mt-1">Chain ID 420420417 · Polkadot Hub Testnet</p>
        </footer>
      </main>
    </>
  );
}
