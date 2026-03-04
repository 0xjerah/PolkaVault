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
import { useState, useEffect } from "react";
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
  Eye,
  Copy,
  Check,
  Vote,
  Plus,
  Trash2,
} from "lucide-react";
import { POLKAVAULT_ADDRESS, POLKAVAULT_ABI } from "@/lib/contracts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(wei: bigint, dp = 4): string {
  const s = formatEther(wei);
  const [int, dec = ""] = s.split(".");
  return `${int}.${dec.padEnd(dp, "0").slice(0, dp)}`;
}
function fmtRate(r: bigint) { return (Number(r) / 1e18).toFixed(6); }
function timeUntil(ts: bigint): string {
  const diff = Number(ts) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ready to claim";
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60);
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

// ─── Rate history (sparkline) ─────────────────────────────────────────────────

function useRateHistory(rate: bigint): number[] {
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || rate === 0n) return;
    const key = "pv-rate-history";
    try {
      const stored = localStorage.getItem(key);
      const arr: number[] = stored ? JSON.parse(stored) : [];
      const r = Number(rate) / 1e18;
      const last = arr[arr.length - 1];
      if (!last || Math.abs(last - r) > 1e-10) {
        const updated = [...arr, r].slice(-40);
        localStorage.setItem(key, JSON.stringify(updated));
        setHistory(updated);
      } else {
        setHistory(arr);
      }
    } catch { /* */ }
  }, [rate]);
  return history;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 0.000001;
  const W = 56, H = 24;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / span) * (H - 4) - 2}`)
    .join(" ");
  return (
    <svg width={W} height={H} className="ml-1 opacity-90">
      <polyline points={pts} fill="none" stroke="#f472b6" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(W)} cy={H - ((data[data.length - 1] - min) / span) * (H - 4) - 2}
        r="2" fill="#f472b6" />
    </svg>
  );
}

// ─── Background ───────────────────────────────────────────────────────────────

function Background() {
  return (
    <>
      {/* Polkadot dot grid */}
      <div className="dot-grid fixed inset-0 -z-20 opacity-40 pointer-events-none" />
      {/* Gradient orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-64 -left-64 w-[700px] h-[700px] rounded-full bg-pink-600/[0.12] blur-[140px] animate-blob" />
        <div className="absolute -top-32 -right-64 w-[600px] h-[600px] rounded-full bg-purple-600/[0.10] blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/[0.08] blur-[120px] animate-blob animation-delay-4000" />
      </div>
    </>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-pink-500/10 bg-[#030712]/85 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-pink-800 flex items-center justify-center shadow-lg shadow-pink-500/40">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-black tracking-tight text-lg">PolkaVault</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 font-bold">
            Testnet
          </span>
        </div>
        <ConnectButton showBalance chainStatus="icon" accountStatus="avatar" />
      </div>
    </nav>
  );
}

// ─── Feature badge ─────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12121e] border border-white/[0.08] text-xs text-gray-400 font-medium select-none">
      <span className="w-1 h-1 rounded-full bg-pink-500 shrink-0" />
      {children}
    </span>
  );
}

// ─── Vault stats ──────────────────────────────────────────────────────────────

function VaultStats() {
  const { data: stats } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "getVaultStats",
    query: { refetchInterval: 10_000 },
  });
  const { data: depositors } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "uniqueDepositors",
    query: { refetchInterval: 15_000 },
  });

  const [rate, staked, , supply] = (stats as [bigint, bigint, bigint, bigint]) ?? [0n, 0n, 0n, 0n];
  const rateHistory = useRateHistory(rate);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 max-w-3xl mx-auto w-full">
      {/* Exchange Rate — with sparkline */}
      <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] p-4 text-center shadow-lg hover:border-pink-500/20 transition-all">
        <TrendingUp className="w-4 h-4 mx-auto mb-2 text-pink-400" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Exchange Rate</p>
        <div className="flex items-center justify-center">
          <p className="font-black text-base leading-none text-pink-300">{fmtRate(rate)}</p>
          <Sparkline data={rateHistory} />
        </div>
        <p className="text-[10px] text-gray-600 mt-1">PAS / stDOT</p>
      </div>

      {/* Total Staked */}
      <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] p-4 text-center shadow-lg hover:border-emerald-500/20 transition-all">
        <Lock className="w-4 h-4 mx-auto mb-2 text-emerald-400" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Staked</p>
        <p className="font-black text-base leading-none text-emerald-300">{fmt(staked)}</p>
        <p className="text-[10px] text-gray-600 mt-1">PAS bonded</p>
      </div>

      {/* Depositors */}
      <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] p-4 text-center shadow-lg hover:border-purple-500/20 transition-all">
        <Layers className="w-4 h-4 mx-auto mb-2 text-purple-400" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Depositors</p>
        <p className="font-black text-base leading-none text-purple-300">
          {depositors !== undefined ? depositors.toString() : "—"}
        </p>
        <p className="text-[10px] text-gray-600 mt-1">unique wallets</p>
      </div>

      {/* Est. APY */}
      <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] p-4 text-center shadow-lg hover:border-yellow-500/20 transition-all">
        <Zap className="w-4 h-4 mx-auto mb-2 text-yellow-400" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Est. APY</p>
        <p className="font-black text-base leading-none text-yellow-300">~12–15%</p>
        <p className="text-[10px] text-gray-600 mt-1">native yield</p>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-16 pb-14 px-4 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-400 text-xs font-bold mb-7">
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
        The first fully on-chain liquid staking protocol on Polkadot Hub
      </div>

      <h1 className="text-5xl md:text-[4.5rem] font-black tracking-tight leading-[1.05] mb-5">
        <span className="bg-gradient-to-br from-white via-pink-100 to-[#E6007A] bg-clip-text text-transparent">
          Native Liquid<br />Staking on<br />Polkadot Hub
        </span>
      </h1>

      <p className="text-gray-400 text-lg mb-5 max-w-sm mx-auto">
        Deposit PAS → receive{" "}
        <span className="text-pink-400 font-black">stDOT</span>.{" "}
        Earn yield. Send cross-chain via XCM&nbsp;V5.
      </p>

      {/* Unique feature chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        <Chip>No Oracle</Chip>
        <Chip>No Bridging</Chip>
        <Chip>No Off-chain Relayer</Chip>
        <Chip>XCM V5 InitiateTeleport</Chip>
        <Chip>Substrate Staking via Precompile</Chip>
      </div>

      {/* APY highlight */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm mt-2">
        <TrendingUp className="w-4 h-4" />
        ~12–15% APY · Polkadot native staking yield
      </div>

      <VaultStats />
    </section>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={doCopy}
      className="p-1 rounded-md text-gray-600 hover:text-gray-400 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Token input ──────────────────────────────────────────────────────────────

function TokenInput({
  value, onChange, token, maxBal, preview,
}: {
  value: string; onChange: (v: string) => void; token: string;
  maxBal?: bigint; preview?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#0a0a14] border border-white/[0.10] focus-within:border-pink-500/40 transition-colors">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 bg-transparent text-white text-xl font-black outline-none placeholder-gray-700 min-w-0"
        />
        {maxBal !== undefined && maxBal > 0n && (
          <button
            onClick={() => onChange(formatEther(maxBal))}
            className="shrink-0 text-[10px] px-2 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors font-black"
          >
            MAX
          </button>
        )}
        <span className="shrink-0 text-gray-400 font-bold text-sm bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/[0.08]">
          {token}
        </span>
      </div>
      {preview && <p className="text-xs text-gray-500 px-1 mt-1">{preview}</p>}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, accentClass }: { children: React.ReactNode; accentClass?: string }) {
  return (
    <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] overflow-hidden shadow-xl shadow-black/40">
      {accentClass && <div className={`h-[2px] w-full ${accentClass}`} />}
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function PanelHeader({ icon: Icon, iconClass, title, sub }: {
  icon: React.ElementType; iconClass: string; title: string; sub: string;
}) {
  return (
    <div>
      <h3 className="font-black text-sm flex items-center gap-2 mb-0.5">
        <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {title}
      </h3>
      <p className="text-xs text-gray-600 pl-9">{sub}</p>
    </div>
  );
}

// ─── TX button ────────────────────────────────────────────────────────────────

function TxButton({ onClick, disabled, isPending, isSuccess, gradientClass, label }: {
  onClick: () => void; disabled: boolean; isPending: boolean;
  isSuccess: boolean; gradientClass: string; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={clsx(
        "w-full py-4 rounded-xl text-sm font-black transition-all shadow-lg",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
        gradientClass
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
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "sharesForDot",
    args: Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); reset(); }

  return (
    <Panel accentClass="bg-gradient-to-r from-pink-600 to-pink-500">
      <PanelHeader icon={ArrowDownToLine} iconClass="bg-pink-500/15 text-pink-400"
        title="Deposit PAS — Receive stDOT"
        sub="Bonded via Staking precompile (0x0804) · stDOT rate auto-compounds" />
      <TokenInput value={amount} onChange={setAmount} token="PAS" maxBal={nativeBal}
        preview={sharesOut !== undefined && Number(amount) > 0
          ? <>You receive ≈ <span className="text-pink-400 font-bold">{fmt(sharesOut as bigint)} stDOT</span></>
          : undefined} />
      <TxButton
        onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
          functionName: "deposit", value: parseEther(amount || "0") })}
        disabled={!amount || Number(amount) <= 0} isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        gradientClass="bg-gradient-to-r from-pink-600 to-pink-500 text-white shadow-pink-500/25 hover:shadow-pink-500/40 hover:from-pink-500 hover:to-pink-400"
        label="Deposit PAS" />
    </Panel>
  );
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

function WithdrawPanel({ onSuccess, address, stDotBal }: {
  onSuccess: () => void; address: `0x${string}`; stDotBal: bigint;
}) {
  const [amount, setAmount] = useState("");
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: withdrawReqs, refetch: refetchReqs } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "getWithdrawRequests",
    args: [address], query: { refetchInterval: 15_000 },
  });
  const { data: dotOut } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "dotForShares",
    args: Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); refetchReqs(); reset(); }

  type WReq = { dot: bigint; claimableAt: bigint; claimed: boolean };
  const pendingReqs = ((withdrawReqs as WReq[]) ?? []).filter((r) => !r.claimed);

  return (
    <Panel accentClass="bg-gradient-to-r from-amber-600 to-amber-500">
      <PanelHeader icon={ArrowUpFromLine} iconClass="bg-amber-500/15 text-amber-400"
        title="Withdraw — Redeem stDOT for PAS"
        sub="28-day unbonding (1h on testnet) · Burn stDOT → claim PAS" />
      <TokenInput value={amount} onChange={setAmount} token="stDOT" maxBal={stDotBal}
        preview={dotOut !== undefined && Number(amount) > 0
          ? <>You receive ≈ <span className="text-amber-400 font-bold">{fmt(dotOut as bigint)} PAS</span> after unbonding</>
          : undefined} />
      <TxButton
        onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
          functionName: "requestWithdraw", args: [parseEther(amount || "0")] })}
        disabled={!amount || Number(amount) <= 0} isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        gradientClass="bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-amber-500/25 hover:shadow-amber-500/40"
        label="Request Withdrawal" />
      {pendingReqs.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/[0.06]">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pending Claims</p>
          {pendingReqs.map((req, i) => <PendingClaim key={i} req={req} index={i} onClaimed={refetchReqs} />)}
        </div>
      )}
    </Panel>
  );
}

function PendingClaim({ req, index, onClaimed }: {
  req: { dot: bigint; claimableAt: bigint; claimed: boolean }; index: number; onClaimed: () => void;
}) {
  const ready = Date.now() / 1000 >= Number(req.claimableAt);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onClaimed();
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <div>
        <p className="text-sm font-bold">{fmt(req.dot)} PAS</p>
        <p className={clsx("text-xs flex items-center gap-1 mt-0.5", ready ? "text-emerald-400" : "text-gray-500")}>
          <Clock className="w-3 h-3" />{timeUntil(req.claimableAt)}
        </p>
      </div>
      {ready && (
        <button onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
          functionName: "claimWithdrawal", args: [BigInt(index)] })}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-black hover:bg-emerald-500/25 transition-colors disabled:opacity-50 border border-emerald-500/20">
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
  const [showPreview, setShowPreview] = useState(false);
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: xcmFee } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "xcmFeeAmount",
  });

  const { data: dotOut } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "dotForShares",
    args: Number(amount) > 0 ? [parseEther(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  function toBytes32(s: string): `0x${string}` {
    const clean = s.startsWith("0x") ? s.slice(2) : s;
    return `0x${clean.padStart(64, "0").slice(0, 64)}` as `0x${string}`;
  }

  const destBytes32 = dest.length >= 2 ? toBytes32(dest) : undefined;

  // Live SCALE-encoded XCM bytes preview — this is unique to PolkaVault
  const { data: xcmBytes } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "previewXcmMessage",
    args: Number(amount) > 0 && destBytes32 ? [parseEther(amount), destBytes32] : undefined,
    query: { enabled: Number(amount) > 0 && !!destBytes32 && showPreview },
  });

  if (isSuccess) { onSuccess(); reset(); }

  const fee = xcmFee ? BigInt(xcmFee as bigint) : 0n;
  const bytesHex = xcmBytes as `0x${string}` | undefined;
  const byteCount = bytesHex ? Math.floor((bytesHex.length - 2) / 2) : 0;

  return (
    <Panel accentClass="bg-gradient-to-r from-blue-600 to-indigo-500">
      <PanelHeader icon={ArrowRightLeft} iconClass="bg-blue-500/15 text-blue-400"
        title="Send Cross-Chain via XCM"
        sub="XCM V5 InitiateTeleport · Relay Chain · powered by XCM precompile (0x0A0000)" />
      <TokenInput value={amount} onChange={setAmount} token="stDOT" maxBal={stDotBal}
        preview={dotOut !== undefined && Number(amount) > 0
          ? <>≈ <span className="text-blue-400 font-bold">{fmt(dotOut as bigint)} PAS</span> arrives on Relay Chain</>
          : undefined} />
      <div className="space-y-1.5">
        <input type="text" value={dest} onChange={(e) => setDest(e.target.value)}
          placeholder="Destination account (0x… or 64 hex chars)"
          className="w-full px-4 py-3 rounded-xl bg-[#0a0a14] border border-white/[0.10] text-sm text-white placeholder-gray-700 outline-none focus:border-blue-500/40 transition-colors font-mono" />
        {fee > 0n && (
          <p className="text-[11px] text-gray-600 px-1">XCM fee: {fmt(fee, 8)} PAS attached automatically</p>
        )}
      </div>

      <TxButton
        onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
          functionName: "sendCrossChain",
          args: [parseEther(amount || "0"), toBytes32(dest)], value: fee })}
        disabled={!amount || Number(amount) <= 0 || !dest}
        isPending={isPending || isConfirming} isSuccess={isSuccess}
        gradientClass="bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40"
        label="Send Cross-Chain" />

      {/* XCM live bytes preview — unique feature */}
      <div className="rounded-xl bg-[#080812] border border-blue-500/15 overflow-hidden">
        <button
          onClick={() => setShowPreview((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-bold">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400">Preview raw XCM SCALE bytes</span>
            <span className="text-[10px] text-gray-600 font-normal ml-1">
              (live on-chain encoding — inspect before sending)
            </span>
          </span>
          <span className="text-gray-600">{showPreview ? "▲" : "▼"}</span>
        </button>
        {showPreview && (
          <div className="border-t border-blue-500/10 px-3 pb-3 pt-2">
            {!bytesHex ? (
              <p className="text-[11px] text-gray-600 italic">
                Fill amount + destination above to see the live SCALE-encoded XCM V5 message
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-blue-400 font-bold">
                    {byteCount} bytes · XCM V5 InitiateTeleport
                  </span>
                  <CopyButton text={bytesHex} />
                </div>
                <code className="text-[10px] text-emerald-400/70 font-mono break-all leading-relaxed block">
                  {bytesHex}
                </code>
                <p className="text-[10px] text-gray-700 mt-2">
                  SCALE-encoded on-chain · No off-chain tools · No relayer
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* XCM flow diagram */}
      <div className="rounded-xl bg-blue-950/20 border border-blue-500/10 p-3">
        <p className="text-[10px] text-blue-400 font-bold mb-2">XCM V5 Message Flow</p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap">
          <span className="px-2 py-1 bg-blue-500/10 rounded-lg text-blue-400 font-bold">Hub</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span>WithdrawAsset</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span>InitiateTeleport</span>
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          <span className="px-2 py-1 bg-purple-500/10 rounded-lg text-purple-400 font-bold">Relay</span>
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
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "exchangeRate",
    query: { refetchInterval: 5_000 },
  });
  if (isSuccess) { onSuccess(); reset(); }

  return (
    <Panel accentClass="bg-gradient-to-r from-yellow-500 to-orange-400">
      <PanelHeader icon={Zap} iconClass="bg-yellow-500/15 text-yellow-400"
        title="Compound Staking Rewards"
        sub="Permissionless · bondExtra() · Exchange rate grows for every stDOT holder" />
      <div className="rounded-xl bg-[#0e0c06] border border-yellow-500/15 p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Current Exchange Rate</p>
          <p className="font-black text-3xl font-mono text-yellow-400 leading-none">
            {rate !== undefined ? fmtRate(rate as bigint) : "—"}
          </p>
          <p className="text-[11px] text-gray-500 mt-1.5">PAS per stDOT · grows after each compound()</p>
        </div>
        <div className="flex items-end gap-0.5 h-10">
          {[20, 35, 30, 50, 45, 65, 60, 80].map((h, i) => (
            <div key={i} className="w-1.5 rounded-sm bg-gradient-to-t from-yellow-600/60 to-yellow-400/30"
              style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <TokenInput value={amount} onChange={setAmount} token="PAS" />
      <TxButton
        onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
          functionName: "compound", value: parseEther(amount || "0") })}
        disabled={!amount || Number(amount) <= 0} isPending={isPending || isConfirming}
        isSuccess={isSuccess}
        gradientClass="bg-gradient-to-r from-yellow-500 to-orange-400 text-black shadow-yellow-500/25 hover:shadow-yellow-500/40"
        label="Compound Rewards" />
    </Panel>
  );
}

// ─── Validator Admin ──────────────────────────────────────────────────────────

function ValidatorAdmin() {
  const { address } = useAccount();
  const [rows, setRows] = useState<string[]>([""]);
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: owner } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "owner",
  });
  const { data: currentNominators, refetch: refetchNominators } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "getNominators",
    query: { refetchInterval: 30_000 },
  });

  if (!address || !owner || address.toLowerCase() !== (owner as string).toLowerCase()) return null;

  if (isSuccess) { refetchNominators(); reset(); }

  const nominators = (currentNominators as `0x${string}`[]) ?? [];

  function toBytes32(s: string): `0x${string}` {
    const clean = s.startsWith("0x") ? s.slice(2) : s;
    return `0x${clean.padStart(64, "0").slice(0, 64)}` as `0x${string}`;
  }

  const validRows = rows.filter((r) => r.trim().length >= 2);
  const canSubmit = validRows.length > 0 && !isPending && !isConfirming;

  function addRow() { setRows((r) => [...r, ""]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, v: string) {
    setRows((r) => { const n = [...r]; n[i] = v; return n; });
  }

  return (
    <div className="max-w-xl mx-auto px-4 mb-6">
      <div className="rounded-2xl bg-[#0d0d18] border border-violet-500/25 overflow-hidden shadow-xl shadow-black/40">
        <div className="h-[2px] bg-gradient-to-r from-violet-600 to-purple-500" />
        <div className="p-5 space-y-4">
          <div>
            <h3 className="font-black text-sm flex items-center gap-2 mb-0.5">
              <span className="w-7 h-7 rounded-xl flex items-center justify-center bg-violet-500/15 text-violet-400">
                <Vote className="w-3.5 h-3.5" />
              </span>
              Nominate Validators
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold ml-1">
                Owner Only
              </span>
            </h3>
            <p className="text-xs text-gray-600 pl-9">
              Staking precompile nominate() · Required for bonded PAS to earn rewards
            </p>
          </div>

          {/* Current nominators */}
          {nominators.length > 0 && (
            <div className="rounded-xl bg-[#0a0a14] border border-white/[0.07] p-3 space-y-1.5">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                Currently Nominating ({nominators.length})
              </p>
              {nominators.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  <code className="text-[10px] text-violet-300/70 font-mono break-all">{n}</code>
                  <CopyButton text={n} />
                </div>
              ))}
            </div>
          )}

          {/* Input rows */}
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              Validator Public Keys (bytes32 / 0x hex)
            </p>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row}
                  onChange={(e) => updateRow(i, e.target.value)}
                  placeholder={`0x${"0".repeat(64)}`}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a0a14] border border-white/[0.10] text-xs text-white placeholder-gray-700 outline-none focus:border-violet-500/40 transition-colors font-mono"
                />
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)}
                    className="p-2 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-violet-400 transition-colors px-1 py-1">
              <Plus className="w-3.5 h-3.5" />
              Add validator
            </button>
          </div>

          <button
            onClick={() => writeContract({
              address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
              functionName: "nominateValidators",
              args: [validRows.map(toBytes32)],
            })}
            disabled={!canSubmit}
            className={clsx(
              "w-full py-4 rounded-xl text-sm font-black transition-all shadow-lg",
              "bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-violet-500/25 hover:shadow-violet-500/40",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            )}
          >
            {isPending || isConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Confirming...
              </span>
            ) : isSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Validators Nominated!
              </span>
            ) : (
              `Nominate ${validRows.length > 0 ? validRows.length : ""} Validator${validRows.length !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type Tab = "deposit" | "withdraw" | "crosschain" | "compound";

function Dashboard() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("deposit");

  const { data: position, refetch: refetchPosition } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "getUserPosition",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });
  const [stDotBal, dotVal] = (position as [bigint, bigint]) ?? [0n, 0n];
  const { data: nativeBal } = useBalance({ address });
  // Earned yield ≈ current PAS value minus initial deposit (assumes entry near rate 1.0)
  const earnedPas = stDotBal > 0n && dotVal > stDotBal ? dotVal - stDotBal : 0n;
  const earnedPct = stDotBal > 0n && earnedPas > 0n
    ? ((Number(earnedPas) / Number(stDotBal)) * 100).toFixed(3)
    : null;

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto px-4 mb-14">
        <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] p-12 text-center shadow-xl shadow-black/40">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-pink-500/10">
            <Shield className="w-8 h-8 text-pink-400" />
          </div>
          <h3 className="text-lg font-black mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500 text-sm mb-7 leading-relaxed max-w-xs mx-auto">
            Connect to Polkadot Hub Testnet to deposit PAS, earn ~12–15% staking yield, and send cross-chain.
          </p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 space-y-4 mb-14">
      {/* Position card */}
      <div className="rounded-2xl bg-[#0d0d18] border border-white/[0.08] overflow-hidden shadow-xl shadow-black/40">
        <div className="h-[2px] bg-gradient-to-r from-pink-600 via-purple-500 to-indigo-500" />
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Your Position</p>
            <p className="text-3xl font-black">
              {fmt(stDotBal)}{" "}<span className="text-pink-400">stDOT</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">≈ {fmt(dotVal)} PAS</p>
            {earnedPct && (
              <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs font-bold">
                <TrendingUp className="w-3 h-3" />
                +{fmt(earnedPas)} PAS earned (+{earnedPct}%)
              </div>
            )}
          </div>
          <div className="text-right space-y-1.5">
            <div className="flex items-center gap-1.5 justify-end text-emerald-400 text-sm font-black">
              <TrendingUp className="w-3.5 h-3.5" />~12–15% APY
            </div>
            <p className="text-xs text-gray-600">Exchange rate grows each era</p>
            {nativeBal && (
              <p className="text-[11px] font-mono text-gray-600">{fmt(nativeBal.value)} PAS available</p>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl bg-[#0a0a14] border border-white/[0.07] p-1 gap-1">
        {([
          { id: "deposit",    label: "Deposit",     icon: ArrowDownToLine },
          { id: "withdraw",   label: "Withdraw",    icon: ArrowUpFromLine },
          { id: "crosschain", label: "Cross-Chain", icon: ArrowRightLeft  },
          { id: "compound",   label: "Compound",    icon: Zap             },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all",
              tab === id ? "bg-white/[0.08] text-white shadow-sm" : "text-gray-600 hover:text-gray-400"
            )}>
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
    { n: "01", color: "pink"    as const, title: "Deposit PAS",    desc: "Send native PAS to the vault. Bonded via Staking precompile (0x0804). Receive stDOT at the current exchange rate." },
    { n: "02", color: "emerald" as const, title: "Earn Yield",     desc: "Rewards accumulate each era. compound() re-bonds them — the stDOT/PAS exchange rate grows for all holders automatically." },
    { n: "03", color: "blue"    as const, title: "stDOT is Liquid", desc: "Transfer stDOT like any ERC-20. No lock-up. Redeem PAS anytime after the unbonding period via claimWithdrawal()." },
    { n: "04", color: "purple"  as const, title: "Send Cross-Chain", desc: "Redeem stDOT and teleport PAS to the Relay Chain via XCM V5 InitiateTeleport, executed by the XCM precompile (0x0A0000). Fully on-chain." },
  ];
  const cfg = {
    pink:    { num: "text-pink-600/20",    border: "border-pink-500/10",    hover: "hover:border-pink-500/30    hover:shadow-pink-500/5"    },
    emerald: { num: "text-emerald-600/20", border: "border-emerald-500/10", hover: "hover:border-emerald-500/30 hover:shadow-emerald-500/5" },
    blue:    { num: "text-blue-600/20",    border: "border-blue-500/10",    hover: "hover:border-blue-500/30    hover:shadow-blue-500/5"    },
    purple:  { num: "text-purple-600/20",  border: "border-purple-500/10",  hover: "hover:border-purple-500/30  hover:shadow-purple-500/5"  },
  };
  return (
    <section className="max-w-5xl mx-auto px-4 py-16 border-t border-white/[0.05]">
      <div className="text-center mb-10">
        <p className="text-xs text-pink-400 font-black tracking-widest uppercase mb-2">Flow</p>
        <h2 className="text-3xl font-black">How it works</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => {
          const c = cfg[s.color];
          return (
            <div key={s.n} className={clsx("rounded-2xl bg-[#0d0d18] border p-6 transition-all shadow-lg", c.border, c.hover)}>
              <p className={clsx("text-7xl font-black mb-4 select-none leading-none", c.num)}>{s.n}</p>
              <p className="font-black text-sm mb-2">{s.title}</p>
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
      name: "Staking",  short: "0x0804",
      full: "0x0000000000000000000000000000000000000804",
      desc: "bond() · bondExtra() · unbond() · withdrawUnbonded()",
      note: "0 bytes EVM code · EXTCODESIZE check bypassed via low-level .call()",
      color: "emerald" as const,
    },
    {
      name: "XCM",  short: "0x0A0000",
      full: "0x00000000000000000000000000000000000a0000",
      desc: "execute() · XCM V5 InitiateTeleport to Relay Chain",
      note: "10 bytes EVM code · high-level interface calls work",
      color: "blue" as const,
    },
    {
      name: "Balances",  short: "0x0402",
      full: "0x0000000000000000000000000000000000000402",
      desc: "Native PAS as ERC-20 · balance queries",
      note: "0 bytes EVM code · EXTCODESIZE check bypassed via low-level .call()",
      color: "pink" as const,
    },
  ];
  const cfg = {
    emerald: { border: "border-emerald-500/15 hover:border-emerald-500/30", badge: "bg-emerald-500/10 text-emerald-400" },
    blue:    { border: "border-blue-500/15    hover:border-blue-500/30",    badge: "bg-blue-500/10    text-blue-400"    },
    pink:    { border: "border-pink-500/15    hover:border-pink-500/30",    badge: "bg-pink-500/10    text-pink-400"    },
  };
  return (
    <section className="max-w-5xl mx-auto px-4 pb-16 border-t border-white/[0.05] pt-16">
      <div className="text-center mb-8">
        <p className="text-xs text-pink-400 font-black tracking-widest uppercase mb-2">Track 2 · Precompiles</p>
        <h2 className="text-3xl font-black mb-3">Polkadot Hub Precompiles</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
          Solidity 0.8 inserts an{" "}
          <code className="text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded text-xs font-bold">EXTCODESIZE</code>{" "}
          check before every interface call. Hub precompiles expose 0 bytes of EVM code — PolkaVault uses
          low-level{" "}
          <code className="text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded text-xs font-bold">.call()</code>{" "}
          to bypass this. Only works on Polkadot Hub.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((p) => {
          const c = cfg[p.color];
          return (
            <div key={p.name} className={clsx("rounded-2xl bg-[#0d0d18] border p-5 transition-all shadow-lg", c.border)}>
              <div className="flex items-center justify-between mb-4">
                <span className={clsx("text-xs font-black px-2.5 py-1 rounded-xl", c.badge)}>{p.name}</span>
                <code className="text-[10px] text-gray-600 font-mono">{p.short}</code>
              </div>
              <p className="text-sm text-gray-300 font-bold mb-3">{p.desc}</p>
              <div className="flex items-start gap-1.5">
                <Cpu className="w-3 h-3 text-gray-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-600 leading-relaxed">{p.note}</p>
              </div>
              <code className="text-[9px] text-gray-700 font-mono mt-3 block break-all">{p.full}</code>
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
      <Background />
      <main className="min-h-screen">
        <Nav />
        <Hero />
        <ValidatorAdmin />
        <Dashboard />
        <HowItWorks />
        <PrecompileInfo />
        <footer className="border-t border-white/[0.05] py-8 text-center">
          <p className="text-xs text-gray-700">
            PolkaVault · Native Liquid Staking on Polkadot Hub ·{" "}
            <a href="https://blockscout-testnet.polkadot.io/address/0x19faeccEe3eefE31736956EF2bc9B7436beC5BD2"
              target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">
              0x19fae…BD2
            </a>
          </p>
          <p className="text-[11px] text-gray-800 mt-1">Chain ID 420420417 · Polkadot Hub Testnet</p>
        </footer>
      </main>
    </>
  );
}
