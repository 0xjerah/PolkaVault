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
  ExternalLink,
  ArrowDown,
  Sparkles,
  Box,
  Globe,
  Activity,
} from "lucide-react";
import { POLKAVAULT_ADDRESS, POLKAVAULT_ABI } from "@/lib/contracts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(wei: bigint, dp = 4): string {
  const s = formatEther(wei);
  const [int, dec = ""] = s.split(".");
  return `${int}.${dec.padEnd(dp, "0").slice(0, dp)}`;
}
function fmtRate(r: bigint) { return (Number(r) / 1e18).toFixed(6); }
function parseAmt(val: string): bigint {
  if (!val) return 0n;
  const n = Number(val);
  if (!isFinite(n) || n <= 0) return 0n;
  try {
    return parseEther(n.toFixed(18).replace(/\.?0+$/, "") || "0");
  } catch { return 0n; }
}

function fmtApy(bps: bigint | undefined): string | null {
  if (bps === undefined || bps === 0n) return null;
  return `${(Number(bps) / 100).toFixed(2)}%`;
}
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

function Sparkline({ data, color = "#E6007A" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 0.000001;
  const W = 100, H = 36;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / span) * (H - 4) - 2}`)
    .join(" ");
  return (
    <svg width={W} height={H} className="opacity-90">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* area fill */}
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill="url(#sparkGrad)"
      />
      <circle cx={W} cy={H - ((data[data.length - 1] - min) / span) * (H - 4) - 2}
        r="2.5" fill={color} />
    </svg>
  );
}

// ─── Scroll-aware section hook ────────────────────────────────────────────────

function useActiveSection() {
  const [active, setActive] = useState("hero");
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);
  return active;
}

// ─── Background ───────────────────────────────────────────────────────────────

function Background() {
  return (
    <>
      <div className="dot-grid fixed inset-0 -z-20 opacity-30 pointer-events-none" />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-64 -left-64 w-[800px] h-[800px] rounded-full bg-pink-600/[0.08] blur-[180px] animate-blob" />
        <div className="absolute -top-32 -right-64 w-[600px] h-[600px] rounded-full bg-purple-600/[0.06] blur-[140px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/[0.05] blur-[140px] animate-blob animation-delay-4000" />
      </div>
    </>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { id: "hero", label: "Home" },
  { id: "dashboard", label: "Dashboard" },
  { id: "how-it-works", label: "Flow" },
  { id: "cross-vm", label: "Cross-VM" },
  { id: "precompiles", label: "Precompiles" },
];

function Nav() {
  const activeSection = useActiveSection();
  const [scrolled, setScrolled] = useState(false);

  const { data: rate } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "exchangeRate",
    query: { refetchInterval: 10_000 },
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={clsx(
      "sticky top-0 z-50 transition-all duration-200",
      scrolled
        ? "border-b border-[var(--border)] bg-[rgba(8,8,9,0.94)] backdrop-blur-xl"
        : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-5 h-[52px] flex items-center gap-6">
        {/* Logo */}
        <a href="#hero" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pink)] to-pink-900 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-black tracking-tight text-[17px]">PolkaVault</span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200",
                activeSection === link.id
                  ? "bg-[var(--pink)]/10 text-[var(--pink)]"
                  : "text-[var(--muted)] hover:text-gray-300 hover:bg-white/[0.03]"
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex-1" />

        {/* Live rate pill */}
        <div className="hidden sm:flex items-center gap-2 border border-[var(--border)] rounded-lg bg-[var(--surface2)] px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] shadow-[0_0_6px_var(--green)] animate-pulse" />
          <span className="text-[10px] text-[var(--muted)]">
            <span className="text-[var(--pink)] font-semibold">stDOT</span>{" "}
            <span className="font-mono">{rate !== undefined ? fmtRate(rate as bigint) : "…"}</span>
          </span>
        </div>

        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--pink)]/10 text-[var(--pink)] border border-[var(--pink)]/20 font-mono font-bold uppercase tracking-wider">
          Testnet
        </span>

        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
      </div>
    </nav>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ children, color = "pink" }: { children: React.ReactNode; color?: "pink" | "cyan" | "green" | "amber" | "muted" | "fuchsia" }) {
  const colorMap = {
    pink:    "bg-[rgba(230,0,122,0.12)] text-[#E6007A] border-[rgba(230,0,122,0.3)]",
    cyan:    "bg-[rgba(0,212,255,0.1)] text-[#00D4FF] border-[rgba(0,212,255,0.3)]",
    green:   "bg-[rgba(0,255,136,0.1)] text-[#00FF88] border-[rgba(0,255,136,0.3)]",
    amber:   "bg-[rgba(255,184,0,0.1)] text-[#FFB800] border-[rgba(255,184,0,0.3)]",
    muted:   "bg-[rgba(82,82,106,0.15)] text-[#52526A] border-[rgba(82,82,106,0.3)]",
    fuchsia: "bg-[rgba(217,70,239,0.12)] text-fuchsia-400 border-[rgba(217,70,239,0.3)]",
  };
  return (
    <span className={clsx(
      "font-mono text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-widest whitespace-nowrap",
      colorMap[color]
    )}>
      {children}
    </span>
  );
}

// ─── Chip (feature pill) ──────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[11px] text-[var(--muted)] select-none hover:border-[var(--pink)]/30 hover:text-gray-300 transition-all duration-200">
      <span className="w-1 h-1 rounded-full bg-[var(--pink)] shrink-0" />
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children, glow }: { children: React.ReactNode; glow?: boolean }) {
  return (
    <div className={clsx(
      "bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden transition-all duration-300 hover:border-[var(--border2)]",
      glow && "vault-glow"
    )}>
      {children}
    </div>
  );
}

function CardHeader({ label, right, accent }: { label: string; right?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border)] bg-[var(--surface2)]">
      <span className="flex items-center gap-2">
        {accent && <span className="w-1.5 h-1.5 rounded-full bg-[var(--pink)]" />}
        <span className="font-mono text-[10px] text-[var(--muted)] tracking-[0.12em] uppercase">
          {label}
        </span>
      </span>
      {right}
    </div>
  );
}

// ─── Vault stats ──────────────────────────────────────────────────────────────

function VaultStats() {
  const { data: stats } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "getVaultStats",
    query: { refetchInterval: 10_000 },
  });
  const { data: depositors } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "uniqueDepositors",
    query: { refetchInterval: 15_000 },
  });
  const { data: apyBps } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "lastApyBps",
    query: { refetchInterval: 30_000 },
  });

  const [rate, staked] = (stats as [bigint, bigint, bigint, bigint]) ?? [0n, 0n, 0n, 0n];
  const rateHistory = useRateHistory(rate);
  const realApy = fmtApy(apyBps as bigint | undefined);

  const items = [
    { label: "Exchange Rate", value: fmtRate(rate), accent: true },
    { label: "Total Value Locked", value: fmt(staked) + " PAS", accent: false },
    { label: "Depositors", value: depositors !== undefined ? depositors.toString() : "—", accent: false },
    { label: "Realized APY", value: realApy ?? "~12–15%", accent: false },
  ];

  return (
    <div className="mt-10 w-full max-w-3xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(({ label, value, accent }) => (
          <div key={label} className={clsx(
            "bg-[var(--surface)] border rounded-xl p-4 transition-all duration-300",
            accent ? "border-[var(--pink)]/20 hover:border-[var(--pink)]/40" : "border-[var(--border)] hover:border-[var(--border2)]"
          )}>
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.1em] uppercase mb-2">
              {label}
            </div>
            <div className={clsx("font-mono text-lg font-medium", accent ? "text-[var(--pink)]" : "text-[var(--text)]")}>
              {value}
            </div>
            {accent && rateHistory.length > 1 && (
              <div className="mt-2">
                <Sparkline data={rateHistory} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section id="hero" className="relative pt-16 pb-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Protocol status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[var(--border2)] mb-8 animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
          <span className="font-mono text-[10px] text-[var(--muted)] tracking-[0.1em] uppercase">Live on Polkadot Hub</span>
        </div>

        {/* Main heading */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] mb-6 animate-fade-in-up">
          Native Liquid<br />
          Staking on{" "}
          <span className="text-[var(--pink)]">Polkadot Hub</span>
        </h1>

        <p className="text-[var(--muted)] text-base md:text-lg mb-8 max-w-lg mx-auto leading-relaxed animate-fade-in-up font-light">
          Deposit PAS, receive <span className="text-[var(--pink)] font-bold">stDOT</span>.
          The protocol bonds your stake via native precompiles, auto-compounds rewards, and teleports cross-chain via XCM&nbsp;V5.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 animate-fade-in-up">
          <Chip>No Oracle</Chip>
          <Chip>No Bridging</Chip>
          <Chip>No Off-chain Relayer</Chip>
          <Chip>XCM V5 Teleport</Chip>
          <Chip>Solidity + Rust PVM</Chip>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-6 animate-fade-in-up">
          <a href="#dashboard"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-[var(--pink)] text-white font-mono text-[12px] font-medium uppercase tracking-wider hover:opacity-90 transition-opacity">
            Open App <ArrowDown className="w-3.5 h-3.5" />
          </a>
          <a href="https://blockscout-testnet.polkadot.io/address/0x64D3EfbAde442779c68972D5079861Bcf16722E6"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-transparent border border-[var(--border)] text-[var(--muted)] font-mono text-[12px] font-medium uppercase tracking-wider hover:text-[var(--text)] transition-colors">
            View on Explorer
          </a>
        </div>

        <VaultStats />

        {/* Scroll indicator */}
        <div className="mt-12 flex justify-center animate-float">
          <a href="#dashboard" className="flex flex-col items-center gap-1.5 text-[var(--muted)] hover:text-gray-400 transition-colors">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em]">Explore</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
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
    <button onClick={doCopy} className="p-1 rounded text-[var(--muted)] hover:text-gray-400 transition-colors" title="Copy">
      {copied ? <Check className="w-3 h-3 text-[var(--green)]" /> : <Copy className="w-3 h-3" />}
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
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="font-mono text-[10px] text-[var(--muted)] tracking-[0.08em] uppercase">Amount</span>
        {maxBal !== undefined && maxBal > 0n && (
          <button
            onClick={() => onChange(formatEther(maxBal))}
            className="font-mono text-[10px] text-[var(--pink)] cursor-pointer bg-transparent border-none hover:opacity-80"
          >
            MAX {fmt(maxBal)}
          </button>
        )}
      </div>
      <div className="flex items-center bg-[var(--surface2)] border border-[var(--border)] rounded overflow-hidden">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 px-3 py-2.5 bg-transparent font-mono text-sm text-[var(--text)] border-none min-w-0"
        />
        <span className="px-3 font-mono text-[11px] text-[var(--muted)] border-l border-[var(--border)] bg-[var(--bg)] self-stretch flex items-center">
          {token}
        </span>
      </div>
      {preview && <p className="text-xs text-[var(--muted)] mt-1.5 font-mono text-[11px]">{preview}</p>}
    </div>
  );
}

// ─── TX button ────────────────────────────────────────────────────────────────

function TxButton({ onClick, disabled, isPending, isSuccess, variant = "primary", label }: {
  onClick: () => void; disabled: boolean; isPending: boolean;
  isSuccess: boolean; variant?: "primary" | "outline"; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={clsx(
        "w-full py-2.5 rounded font-mono text-[12px] font-medium uppercase tracking-wider transition-all duration-150 cursor-pointer",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "primary"
          ? "bg-[var(--pink)] text-white border border-[var(--pink)]"
          : "bg-transparent text-[var(--pink)] border border-[rgba(230,0,122,0.4)]"
      )}
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
        </span>
      ) : isSuccess ? (
        <span className="flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
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
    args: Number(amount) > 0 ? [parseAmt(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });
  const { data: rate } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "exchangeRate",
  });

  if (isSuccess) { onSuccess(); reset(); }

  return (
    <Card>
      <CardHeader label="Deposit PAS" right={<Badge color="cyan">Earn Yield</Badge>} />
      <div className="p-4 flex flex-col gap-3.5">
        <TokenInput value={amount} onChange={setAmount} token="PAS" maxBal={nativeBal} />

        {/* Preview */}
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-3 grid grid-cols-2 gap-2">
          <div>
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">You receive</div>
            <div className="font-mono text-[13px] text-[var(--cyan)]">
              {sharesOut !== undefined && Number(amount) > 0 ? fmt(sharesOut as bigint) : "—"} stDOT
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">Rate</div>
            <div className="font-mono text-[13px] text-[var(--text)]">
              1 stDOT = {rate !== undefined ? fmtRate(rate as bigint) : "…"} PAS
            </div>
          </div>
        </div>

        <TxButton
          onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
            functionName: "deposit", value: parseAmt(amount) })}
          disabled={!amount || Number(amount) <= 0} isPending={isPending || isConfirming}
          isSuccess={isSuccess} label="Deposit" />
      </div>
    </Card>
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
    args: Number(amount) > 0 ? [parseAmt(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  if (isSuccess) { onSuccess(); refetchReqs(); reset(); }

  type WReq = { dot: bigint; claimableAt: bigint; claimed: boolean };
  const pendingReqs = ((withdrawReqs as WReq[]) ?? []).filter((r) => !r.claimed);

  return (
    <Card>
      <CardHeader label="Withdraw" right={<Badge color="green">stDOT → PAS</Badge>} />
      <div className="p-4 flex flex-col gap-3.5">
        <TokenInput value={amount} onChange={setAmount} token="stDOT" maxBal={stDotBal} />

        {/* Preview */}
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-3">
          <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">You receive</div>
          <div className="font-mono text-[13px] text-[var(--green)]">
            {dotOut !== undefined && Number(amount) > 0 ? fmt(dotOut as bigint) : "—"} PAS
          </div>
        </div>

        <TxButton
          onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
            functionName: "requestWithdraw", args: [parseAmt(amount)] })}
          disabled={!amount || Number(amount) <= 0} isPending={isPending || isConfirming}
          isSuccess={isSuccess} variant="outline" label="Withdraw" />

        {pendingReqs.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-[var(--border)]">
            <p className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase">Pending Claims</p>
            {pendingReqs.map((req, i) => <PendingClaim key={i} req={req} index={i} onClaimed={refetchReqs} />)}
          </div>
        )}
      </div>
    </Card>
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
    <div className="flex items-center justify-between py-2 px-3 rounded bg-[var(--bg)] border border-[var(--border)]">
      <div>
        <p className="font-mono text-sm font-medium">{fmt(req.dot)} PAS</p>
        <p className={clsx("font-mono text-[10px] flex items-center gap-1 mt-0.5", ready ? "text-[var(--green)]" : "text-[var(--muted)]")}>
          <Clock className="w-3 h-3" />{timeUntil(req.claimableAt)}
        </p>
      </div>
      {ready && (
        <button onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
          functionName: "claimWithdrawal", args: [BigInt(index)] })}
          disabled={isPending}
          className="px-2.5 py-1 rounded bg-[rgba(0,255,136,0.1)] text-[var(--green)] text-[10px] font-mono font-medium uppercase tracking-wider border border-[rgba(0,255,136,0.3)] hover:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer">
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
    args: Number(amount) > 0 ? [parseAmt(amount)] : undefined,
    query: { enabled: Number(amount) > 0 },
  });

  function toBytes32(s: string): `0x${string}` {
    const clean = s.startsWith("0x") ? s.slice(2) : s;
    return `0x${clean.padStart(64, "0").slice(0, 64)}` as `0x${string}`;
  }

  const destBytes32 = dest.length >= 2 ? toBytes32(dest) : undefined;
  const { data: xcmBytes } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "previewXcmMessage",
    args: Number(amount) > 0 && destBytes32 ? [parseAmt(amount), destBytes32] : undefined,
    query: { enabled: Number(amount) > 0 && !!destBytes32 && showPreview },
  });

  if (isSuccess) { onSuccess(); reset(); }

  const fee = xcmFee ? BigInt(xcmFee as bigint) : 0n;
  const bytesHex = xcmBytes as `0x${string}` | undefined;
  const byteCount = bytesHex ? Math.floor((bytesHex.length - 2) / 2) : 0;

  return (
    <Card>
      <CardHeader label="Cross-Chain Teleport" right={<Badge color="cyan">XCM V5</Badge>} />
      <div className="p-4 flex flex-col gap-3.5">
        <TokenInput value={amount} onChange={setAmount} token="stDOT" maxBal={stDotBal}
          preview={dotOut !== undefined && Number(amount) > 0
            ? <>&asymp; <span className="text-[var(--cyan)]">{fmt(dotOut as bigint)} PAS</span> arrives on Relay Chain</>
            : undefined} />

        <div>
          <div className="font-mono text-[10px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1.5">Destination</div>
          <input type="text" value={dest} onChange={(e) => setDest(e.target.value)}
            placeholder="0x… or 64 hex chars"
            className="w-full px-3 py-2.5 rounded bg-[var(--surface2)] border border-[var(--border)] font-mono text-xs text-[var(--text)] placeholder-gray-700" />
          {fee > 0n && (
            <p className="font-mono text-[10px] text-[var(--muted)] mt-1">XCM fee: {fmt(fee, 8)} PAS auto-attached</p>
          )}
        </div>

        <TxButton
          onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
            functionName: "sendCrossChain",
            args: [parseAmt(amount), toBytes32(dest)], value: fee })}
          disabled={!amount || Number(amount) <= 0 || !dest}
          isPending={isPending || isConfirming} isSuccess={isSuccess}
          label="Send Cross-Chain" />

        {/* XCM bytes preview */}
        <div className="rounded bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setShowPreview((p) => !p)}
            className="w-full flex items-center justify-between px-3 py-2 font-mono text-[10px] text-[var(--muted)] hover:text-gray-300 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-[var(--cyan)]" />
              <span className="text-[var(--cyan)]">Preview SCALE bytes</span>
            </span>
            <span>{showPreview ? "▲" : "▼"}</span>
          </button>
          {showPreview && (
            <div className="border-t border-[var(--border)] px-3 pb-3 pt-2">
              {!bytesHex ? (
                <p className="font-mono text-[10px] text-[var(--muted)] italic">Fill amount + destination to preview</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[9px] text-[var(--cyan)]">{byteCount} bytes · XCM V5 InitiateTeleport</span>
                    <CopyButton text={bytesHex} />
                  </div>
                  <code className="font-mono text-[10px] text-[var(--green)]/70 break-all leading-relaxed block">{bytesHex}</code>
                </>
              )}
            </div>
          )}
        </div>

        {/* XCM flow */}
        <div className="rounded bg-[var(--surface2)] border border-[var(--border)] p-3">
          <div className="font-mono text-[9px] text-[var(--cyan)] tracking-wider uppercase mb-2">Message Flow</div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--muted)] flex-wrap">
            <span className="px-2 py-0.5 bg-[rgba(0,212,255,0.1)] rounded text-[var(--cyan)]">Hub</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>WithdrawAsset</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>InitiateTeleport</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span className="px-2 py-0.5 bg-[rgba(168,85,247,0.1)] rounded text-purple-400">Relay</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>BuyExecution</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>DepositAsset</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Compound ─────────────────────────────────────────────────────────────────

function CompoundPanel({ onSuccess }: { onSuccess: () => void }) {
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });
  const { data: rate } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "exchangeRate",
    query: { refetchInterval: 5_000 },
  });
  const { data: keeperFeeBps } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "keeperFeeBps",
  });
  const { data: apyBps } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "lastApyBps",
    query: { refetchInterval: 30_000 },
  });
  const { data: yieldOptAddr } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "yieldOptimizer",
  });
  if (isSuccess) { onSuccess(); reset(); }
  const pvmActive = yieldOptAddr && yieldOptAddr !== "0x0000000000000000000000000000000000000000";

  const feeBps = keeperFeeBps as bigint | undefined;
  const realApy = fmtApy(apyBps as bigint | undefined);

  return (
    <Card>
      <CardHeader label="Compound Rewards" right={
        <div className="flex items-center gap-2">
          {pvmActive && <Badge color="fuchsia">PVM</Badge>}
          <Badge color="amber">Keeper Fee</Badge>
        </div>
      } />
      <div className="p-4 flex flex-col gap-3.5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-[1px] border border-[var(--border)] rounded overflow-hidden">
          <div className="bg-[var(--surface2)] p-3">
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.1em] uppercase mb-1.5">Exchange Rate</div>
            <div className="font-mono text-xl font-medium text-[var(--pink)]">
              {rate !== undefined ? fmtRate(rate as bigint) : "—"}
            </div>
            <div className="font-mono text-[9px] text-[var(--muted)] mt-1">PAS / stDOT</div>
          </div>
          <div className="bg-[var(--surface2)] p-3">
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.1em] uppercase mb-1.5">Realized APY</div>
            <div className="font-mono text-xl font-medium text-[var(--green)]">
              {realApy ?? "—"}
            </div>
            <div className="font-mono text-[9px] text-[var(--muted)] mt-1">
              {pvmActive ? "via Rust PolkaVM" : "awaiting compound"}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded bg-[var(--surface2)] border border-[var(--border)] px-3 py-2.5">
          <p className="font-mono text-[11px] text-[var(--text)] font-medium mb-1">
            Auto-Harvest from Staking Rewards
          </p>
          <p className="font-mono text-[9px] text-[var(--muted)] leading-relaxed">
            Staking rewards accrue to the vault automatically (payee=Stash). Calling compound()
            bonds all accrued rewards via bondExtra(), increasing the exchange rate for every
            stDOT holder. No manual input needed.
          </p>
        </div>

        {/* Keeper fee */}
        {feeBps !== undefined && feeBps > 0n && (
          <div className="rounded bg-[rgba(0,255,136,0.04)] border border-[rgba(0,255,136,0.15)] px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] text-[var(--green)] font-medium">
                Earn {Number(feeBps) / 100}% keeper reward
              </p>
              <p className="font-mono text-[9px] text-[var(--muted)] mt-0.5">
                Paid instantly to your wallet from accrued rewards
              </p>
            </div>
          </div>
        )}

        <TxButton
          onClick={() => writeContract({ address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
            functionName: "compound" })}
          disabled={false} isPending={isPending || isConfirming}
          isSuccess={isSuccess}
          label="Compound Rewards" />
      </div>
    </Card>
  );
}

// ─── Validator Admin ──────────────────────────────────────────────────────────

const PASEO_VALIDATORS = [
  "0xe4b1fbe4f25d751d4b239615a2ebee64fe75f9a45fad6ce083a0f1383897a428",
  "0xba5ecc6673cf03dd80a61008afb799b7f6bf74fab64795a0062bf2aa94df067b",
];

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
    <div className="max-w-[1100px] mx-auto px-5 mb-3">
      <Card>
        <CardHeader label="Nominate Validators" right={<Badge color="amber">Owner Only</Badge>} />
        <div className="p-4 flex flex-col gap-3.5">
          {nominators.length > 0 && (
            <div className="rounded bg-[var(--bg)] border border-[var(--border)] p-3 space-y-1.5">
              <p className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-2">
                Currently Nominating ({nominators.length})
              </p>
              {nominators.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <code className="font-mono text-[10px] text-purple-300/70 break-all">{n}</code>
                  <CopyButton text={n} />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="font-mono text-[10px] text-[var(--muted)] tracking-[0.08em] uppercase">
              Validator Public Keys (bytes32)
            </p>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text" value={row} onChange={(e) => updateRow(i, e.target.value)}
                  placeholder={`0x${"0".repeat(64)}`}
                  className="flex-1 px-3 py-2 rounded bg-[var(--surface2)] border border-[var(--border)] font-mono text-xs text-[var(--text)] placeholder-gray-700"
                />
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)}
                    className="p-1.5 rounded text-[var(--muted)] hover:text-red-400 transition-colors cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button onClick={addRow}
                className="flex items-center gap-1 font-mono text-[10px] text-[var(--muted)] hover:text-purple-400 transition-colors px-1 py-1 cursor-pointer">
                <Plus className="w-3 h-3" /> Add validator
              </button>
              <button onClick={() => setRows([...PASEO_VALIDATORS])}
                className="flex items-center gap-1 font-mono text-[10px] text-amber-500/70 hover:text-amber-400 transition-colors px-1 py-1 cursor-pointer">
                Prefill Paseo Validators
              </button>
            </div>
          </div>

          <button
            onClick={() => writeContract({
              address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI,
              functionName: "nominateValidators", args: [validRows.map(toBytes32)],
            })}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded font-mono text-[12px] font-medium uppercase tracking-wider bg-purple-600 text-white border border-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {isPending || isConfirming ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</span>
            ) : isSuccess ? (
              <span className="flex items-center justify-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Nominated!</span>
            ) : (
              `Nominate ${validRows.length > 0 ? validRows.length : ""} Validator${validRows.length !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Position Summary ─────────────────────────────────────────────────────────

function PositionSummary({ stDotBal, dotVal, earnedPas, earnedPct, nativeBal }: {
  stDotBal: bigint; dotVal: bigint; earnedPas: bigint; earnedPct: string | null; nativeBal: bigint;
}) {
  const { data: rate } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "exchangeRate",
  });

  const fields = [
    { label: "stDOT Balance", value: fmt(stDotBal, 6), suffix: "stDOT", color: "text-[var(--text)]" },
    { label: "PAS Value", value: fmt(dotVal), suffix: "PAS", color: "text-[var(--text)]" },
    { label: "PAS Earned", value: earnedPas > 0n ? `+${fmt(earnedPas, 6)}` : "0.0000", suffix: earnedPct ? `+${earnedPct}%` : "PAS", color: earnedPas > 0n ? "text-[var(--green)]" : "text-[var(--muted)]" },
    { label: "Current Rate", value: rate !== undefined ? fmtRate(rate as bigint) : "…", suffix: "PAS/stDOT", color: "text-[var(--pink)]" },
  ];

  return (
    <Card>
      <CardHeader label="Your Position" right={
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse shadow-[0_0_6px_var(--green)]" />
      } />
      <div className="p-4 grid grid-cols-2 gap-2.5">
        {fields.map(({ label, value, suffix, color }) => (
          <div key={label} className="bg-[var(--bg)] rounded p-3">
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">{label}</div>
            <div className={clsx("font-mono text-[15px] font-medium", color)}>{value}</div>
            <div className="font-mono text-[10px] text-[var(--muted)] mt-0.5">{suffix}</div>
          </div>
        ))}
      </div>
      {nativeBal > 0n && (
        <div className="px-4 pb-3">
          <div className="font-mono text-[10px] text-[var(--muted)]">
            Wallet: {fmt(nativeBal)} PAS available
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type Tab = "crosschain" | "compound";

function Dashboard() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("crosschain");

  const { data: position, refetch: refetchPosition } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "getUserPosition",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });
  const [stDotBal, dotVal] = (position as [bigint, bigint]) ?? [0n, 0n];
  const { data: nativeBal } = useBalance({ address });
  const earnedPas = stDotBal > 0n && dotVal > stDotBal ? dotVal - stDotBal : 0n;
  const earnedPct = stDotBal > 0n && earnedPas > 0n
    ? ((Number(earnedPas) / Number(stDotBal)) * 100).toFixed(3)
    : null;

  if (!isConnected) {
    return (
      <section id="dashboard" className="py-16 px-4">
        <div className="max-w-sm mx-auto">
          <Card>
            <div className="p-10 text-center">
              <div className="w-14 h-14 rounded bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center mx-auto mb-5">
                <Shield className="w-7 h-7 text-[var(--pink)]" />
              </div>
              <h3 className="text-lg font-black mb-2">Connect Your Wallet</h3>
              <p className="font-mono text-[11px] text-[var(--muted)] mb-6 leading-relaxed">
                Connect to Polkadot Hub Testnet to deposit PAS, earn staking yield, and send cross-chain.
              </p>
              <div className="flex justify-center"><ConnectButton /></div>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="dashboard" className="py-10 px-4">
      <div className="max-w-[1100px] mx-auto space-y-3">
        {/* Section header */}
        <div className="mb-6">
          <div className="font-mono text-[10px] text-[var(--pink)] tracking-[0.12em] uppercase mb-1">Dashboard</div>
          <h2 className="text-2xl font-black">Manage Your Position</h2>
        </div>

        {/* Deposit + Withdraw side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DepositPanel onSuccess={refetchPosition} nativeBal={nativeBal?.value ?? 0n} />
          <WithdrawPanel onSuccess={refetchPosition} address={address!} stDotBal={stDotBal} />
        </div>

        {/* Position summary */}
        <PositionSummary
          stDotBal={stDotBal} dotVal={dotVal}
          earnedPas={earnedPas} earnedPct={earnedPct}
          nativeBal={nativeBal?.value ?? 0n}
        />

        {/* Cross-chain + Compound tabs */}
        <div className="flex gap-0.5 border border-[var(--border)] rounded overflow-hidden bg-[var(--surface2)]">
          {([
            { id: "crosschain" as Tab, label: "Cross-Chain", icon: ArrowRightLeft },
            { id: "compound" as Tab, label: "Compound", icon: Zap },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 font-mono text-[11px] tracking-wider uppercase transition-all duration-150 cursor-pointer",
                tab === id
                  ? "bg-[rgba(230,0,122,0.1)] text-[var(--pink)] border-b-2 border-[var(--pink)]"
                  : "text-[var(--muted)] hover:text-gray-300 border-b-2 border-transparent"
              )}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {tab === "crosschain" && <CrossChainPanel onSuccess={refetchPosition} stDotBal={stDotBal} />}
        {tab === "compound"   && <CompoundPanel   onSuccess={refetchPosition} />}
      </div>
    </section>
  );
}

// ─── Exchange Rate Hero Card ──────────────────────────────────────────────────

function RateHeroCard() {
  const { data: stats } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "getVaultStats",
    query: { refetchInterval: 10_000 },
  });
  const [rate, staked, , supply] = (stats as [bigint, bigint, bigint, bigint]) ?? [0n, 0n, 0n, 0n];
  const rateHistory = useRateHistory(rate);

  const gainPct = rate > 1000000000000000000n
    ? Number(((rate - 1000000000000000000n) * 10000n) / 1000000000000000000n) / 100
    : 0;

  return (
    <Card glow>
      <div className="mesh-gradient absolute inset-0 pointer-events-none" />
      <div className="p-7 text-center relative z-10">
        <div className="font-mono text-[10px] text-[var(--muted)] tracking-[0.15em] uppercase mb-4">
          stDOT / PAS Exchange Rate
        </div>
        <div className="text-5xl font-black text-[var(--pink)] leading-none" style={{ textShadow: "0 0 40px rgba(230,0,122,0.4)" }}>
          {fmtRate(rate)}
        </div>
        <div className="font-mono text-[11px] text-[var(--muted)] mt-3">
          1 stDOT redeems for {fmtRate(rate)} PAS · Rate is monotonically non-decreasing
        </div>
        {rateHistory.length > 1 && (
          <div className="flex justify-center mt-4">
            <Sparkline data={rateHistory} />
          </div>
        )}
        <div className="flex gap-6 justify-center mt-5">
          {[
            { label: "All-time gain", value: `+${gainPct.toFixed(2)}%`, color: "text-[var(--green)]" },
            { label: "Total PAS", value: fmt(staked) + " PAS", color: "text-[var(--text)]" },
            { label: "Total stDOT", value: fmt(supply) + " stDOT", color: "text-[var(--cyan)]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">{label}</div>
              <div className={clsx("font-mono text-[14px] font-medium", color)}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { n: "01", title: "Deposit PAS", desc: "Send native PAS to the vault. Bonded via Staking precompile (0x0804). Receive stDOT at the current exchange rate.", accent: true },
    { n: "02", title: "Earn Yield", desc: "Rewards accumulate each era. compound() re-bonds them — the stDOT/PAS exchange rate grows for all holders.", accent: false },
    { n: "03", title: "stDOT is Liquid", desc: "Transfer stDOT like any ERC-20. No lock-up. Redeem PAS anytime after the unbonding period.", accent: false },
    { n: "04", title: "Go Cross-Chain", desc: "Teleport PAS to the Relay Chain via XCM V5 InitiateTeleport. Executed by the XCM precompile. Fully on-chain.", accent: false },
  ];

  return (
    <section id="how-it-works" className="py-16 px-4">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-10">
          <div className="font-mono text-[10px] text-[var(--pink)] tracking-[0.12em] uppercase mb-1">Flow</div>
          <h2 className="text-3xl font-black mb-2">How It Works</h2>
          <p className="font-mono text-[11px] text-[var(--muted)] max-w-md">
            Four steps from deposit to cross-chain. No oracle, no bridging, no off-chain relayer.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => (
            <div key={s.n} className={clsx(
              "bg-[var(--surface)] border rounded-xl p-6 group transition-all duration-300 hover:border-[var(--pink)]/20",
              s.accent ? "border-[var(--pink)]/15" : "border-[var(--border)]"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.1em] uppercase">Step {s.n}</div>
                <div className={clsx(
                  "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all",
                  s.accent ? "bg-[var(--pink)]/10 text-[var(--pink)]" : "bg-[var(--surface2)] text-[var(--muted)]"
                )}>
                  {s.n}
                </div>
              </div>
              <p className="font-black text-sm mb-2 group-hover:text-[var(--pink)] transition-colors">{s.title}</p>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Cross-VM Architecture ────────────────────────────────────────────────────

function CrossVMSection() {
  const { data: yieldOptAddr } = useReadContract({
    address: POLKAVAULT_ADDRESS, abi: POLKAVAULT_ABI, functionName: "yieldOptimizer",
  });
  const pvmActive = yieldOptAddr && yieldOptAddr !== "0x0000000000000000000000000000000000000000";

  const steps = [
    { label: "Solidity", desc: "compound() called", color: "var(--amber)" },
    { label: "pallet-revive", desc: "Routes cross-VM", color: "var(--cyan)" },
    { label: "Rust PVM", desc: "computeApy()", color: "#d946ef" },
    { label: "Result", desc: "APY on-chain", color: "var(--green)" },
  ];

  return (
    <section id="cross-vm" className="py-16 px-4">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-10">
          <div className="font-mono text-[10px] text-fuchsia-400 tracking-[0.12em] uppercase mb-1">Track 2 · PVM Smart Contracts</div>
          <h2 className="text-3xl font-black mb-2">Cross-VM Architecture</h2>
          <p className="font-mono text-[11px] text-[var(--muted)] max-w-xl leading-relaxed">
            PolkaVault delegates APY computation to a <span className="text-fuchsia-400 font-bold">Rust PolkaVM contract</span> via
            pallet-revive&apos;s transparent VM routing. Solidity calls Rust natively on-chain.
          </p>
        </div>

        {/* Rate hero card */}
        <div className="mb-6 max-w-2xl mx-auto relative">
          <RateHeroCard />
        </div>

        {/* Flow diagram */}
        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center min-w-[130px] transition-all duration-300 hover:border-[var(--border2)] hover:scale-[1.02]">
                <div className="w-9 h-9 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: `${s.color}12` }}>
                  <Activity className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="font-mono text-[11px] font-medium" style={{ color: s.color }}>{s.label}</div>
                <div className="font-mono text-[9px] text-[var(--muted)] mt-0.5">{s.desc}</div>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden sm:block">
                  <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Status + tech */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader label="PVM Status" right={
              pvmActive ? <Badge color="green">Active</Badge> : <Badge color="muted">Inactive</Badge>
            } />
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className={clsx(
                  "w-2 h-2 rounded-full",
                  pvmActive ? "bg-[var(--green)] shadow-[0_0_8px_var(--green)] animate-pulse" : "bg-[var(--muted)]"
                )} />
                <span className={clsx("font-mono text-sm font-medium", pvmActive ? "text-[var(--green)]" : "text-[var(--muted)]")}>
                  {pvmActive ? "Rust PVM Active" : "PVM Not Connected"}
                </span>
              </div>
              <p className="font-mono text-[10px] text-[var(--muted)]">
                {pvmActive
                  ? `YieldOptimizer at ${(yieldOptAddr as string).slice(0, 10)}...${(yieldOptAddr as string).slice(-6)}`
                  : "Solidity fallback mode"
                }
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader label="Tech Stack" right={<Badge color="cyan">Cross-VM</Badge>} />
            <div className="p-4 space-y-2.5">
              {[
                { icon: Box, label: "EVM", value: "Solidity 0.8.28", color: "var(--amber)" },
                { icon: Cpu, label: "PVM", value: "Rust + RISC-V (2,089 bytes)", color: "#d946ef" },
                { icon: ArrowRightLeft, label: "Bridge", value: "pallet-revive cross-VM", color: "var(--cyan)" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="font-mono text-[10px] text-[var(--muted)] w-10">{label}</span>
                  <span className="font-mono text-[11px] text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ─── Precompile section ───────────────────────────────────────────────────────

function PrecompileInfo() {
  const items = [
    {
      name: "Staking", short: "0x0804",
      full: "0x0000000000000000000000000000000000000804",
      fns: ["bond()", "bondExtra()", "unbond()", "withdrawUnbonded()", "nominate()"],
      note: "0 bytes EVM code · low-level .call() bypass",
      color: "green" as const,
    },
    {
      name: "XCM", short: "0x0A0000",
      full: "0x00000000000000000000000000000000000a0000",
      fns: ["execute()"],
      note: "10 bytes EVM code · high-level interface OK",
      color: "cyan" as const,
    },
    {
      name: "Balances", short: "0x0402",
      full: "0x0000000000000000000000000000000000000402",
      fns: ["Native PAS as ERC-20"],
      note: "0 bytes EVM code · low-level .call() bypass",
      color: "pink" as const,
    },
  ];

  return (
    <section id="precompiles" className="py-16 px-4">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-10">
          <div className="font-mono text-[10px] text-[var(--pink)] tracking-[0.12em] uppercase mb-1">Track 2 · Precompiles</div>
          <h2 className="text-3xl font-black mb-2">Polkadot Hub Precompiles</h2>
          <p className="font-mono text-[11px] text-[var(--muted)] max-w-xl leading-relaxed">
            Solidity 0.8 inserts an <code className="text-[var(--pink)] bg-[var(--pink)]/10 px-1 rounded text-[10px]">EXTCODESIZE</code> check
            before every interface call. Hub precompiles expose 0 bytes of EVM code — PolkaVault uses
            low-level <code className="text-[var(--pink)] bg-[var(--pink)]/10 px-1 rounded text-[10px]">.call()</code> to bypass this.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {items.map((p) => (
            <Card key={p.name}>
              <CardHeader label={p.name} right={
                <span className="font-mono text-[10px] text-[var(--muted)]">{p.short}</span>
              } />
              <div className="p-4">
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.fns.map((fn) => (
                    <span key={fn} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)]">
                      {fn}
                    </span>
                  ))}
                </div>
                <div className="flex items-start gap-1.5 mb-3">
                  <Cpu className="w-3 h-3 text-[var(--muted)] mt-0.5 shrink-0" />
                  <p className="font-mono text-[10px] text-[var(--muted)] leading-relaxed">{p.note}</p>
                </div>
                <code className="font-mono text-[9px] text-gray-700 block break-all">{p.full}</code>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[var(--border)]">
      {/* Contract addresses */}
      <div className="max-w-[1100px] mx-auto px-5 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-3">
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">PolkaVault (EVM)</div>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[10px] text-[var(--text)] break-all">0x64D3EfbAde442779c68972D5079861Bcf16722E6</code>
              <CopyButton text="0x64D3EfbAde442779c68972D5079861Bcf16722E6" />
            </div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-3">
            <div className="font-mono text-[9px] text-[var(--muted)] tracking-[0.08em] uppercase mb-1">YieldOptimizer (Rust PVM)</div>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[10px] text-[var(--text)] break-all">0x7d849b045d89a489df71c2e69968eb020a233974</code>
              <CopyButton text="0x7d849b045d89a489df71c2e69968eb020a233974" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--border)] bg-[var(--surface2)] px-5 py-3">
        <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--muted)]">
            PolkaVault · Polkadot Hub · pallet-revive
          </span>
          <div className="flex gap-5">
            <a href="https://blockscout-testnet.polkadot.io/address/0x64D3EfbAde442779c68972D5079861Bcf16722E6"
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--text)] transition-colors flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Explorer
            </a>
            <a href="https://blockscout-testnet.polkadot.io/address/0x7d849b045d89a489df71c2e69968eb020a233974"
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--text)] transition-colors flex items-center gap-1">
              <Cpu className="w-3 h-3" /> PVM
            </a>
          </div>
        </div>
      </div>
    </footer>
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
        <CrossVMSection />
        <PrecompileInfo />
        <Footer />
      </main>
    </>
  );
}
