"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useState } from "react";
import clsx from "clsx";
import {
  Wallet,
  PiggyBank,
  ArrowRightLeft,
  Plus,
  TrendingUp,
  Shield,
  Coins,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { POLKAVAULT_ADDRESS, POLKAVAULT_ABI, KNOWN_ASSETS } from "@/lib/contracts";

// ============================================================
//                    HERO SECTION
// ============================================================

function HeroSection() {
  return (
    <section className="text-center py-16 px-4">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium mb-6">
        <Shield className="w-3.5 h-3.5" />
        Built on Polkadot Hub Precompiles
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-pink-200 to-pink-500 bg-clip-text text-transparent">
        PolkaVault
      </h1>
      <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-2">
        Native Asset Portfolio Manager for Polkadot Hub
      </p>
      <p className="text-sm text-gray-500 max-w-xl mx-auto">
        Track DOT &amp; native assets, stake directly, and manage transfers —
        all powered by on-chain precompiles (Balances, Assets, Staking, XCM).
      </p>
    </section>
  );
}

// ============================================================
//                    PORTFOLIO OVERVIEW
// ============================================================

function PortfolioOverview() {
  const { address, isConnected } = useAccount();

  const { data: portfolio, isLoading, refetch } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "portfolios",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const hasPortfolio = portfolio && portfolio[0] !== "0x0000000000000000000000000000000000000000";

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 text-sm mb-6">
            Connect to Polkadot Hub Testnet to manage your portfolio
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <Loader2 className="w-8 h-8 text-pink-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!hasPortfolio) {
    return <CreatePortfolioSection onCreated={() => refetch()} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 space-y-8">
      {/* Portfolio Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{portfolio[3]}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Created {new Date(Number(portfolio[1]) * 1000).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {portfolio[2] && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                Staking Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AssetTrackingCard />
        <StakingCard />
        <TransferCard />
      </div>
    </div>
  );
}

// ============================================================
//                    CREATE PORTFOLIO
// ============================================================

function CreatePortfolioSection({ onCreated }: { onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    onCreated();
  }

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <PiggyBank className="w-12 h-12 text-pink-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Create Your Portfolio</h2>
        <p className="text-gray-400 text-sm mb-6">
          Set up your on-chain portfolio to start tracking assets and staking
        </p>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My Polkadot Portfolio"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 mb-4"
        />
        <button
          onClick={() =>
            writeContract({
              address: POLKAVAULT_ADDRESS,
              abi: POLKAVAULT_ABI,
              functionName: "createPortfolio",
              args: [label || "My Portfolio"],
            })
          }
          disabled={isPending}
          className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Creating...
            </span>
          ) : (
            "Create Portfolio"
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
//                    ASSET TRACKING CARD
// ============================================================

function AssetTrackingCard() {
  const { address } = useAccount();
  const [assetIdInput, setAssetIdInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { writeContract, isPending } = useWriteContract();

  const { data: trackedAssets } = useReadContract({
    address: POLKAVAULT_ADDRESS,
    abi: POLKAVAULT_ABI,
    functionName: "getTrackedAssets",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Coins className="w-4 h-4 text-pink-400" /> Assets
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Plus className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2">
          <select
            value={assetIdInput}
            onChange={(e) => setAssetIdInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          >
            <option value="">Select asset...</option>
            {Object.entries(KNOWN_ASSETS).map(([id, info]) => (
              <option key={id} value={id}>
                {info.symbol} - {info.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!assetIdInput) return;
              writeContract({
                address: POLKAVAULT_ADDRESS,
                abi: POLKAVAULT_ABI,
                functionName: "trackAsset",
                args: [BigInt(assetIdInput)],
              });
              setShowAdd(false);
              setAssetIdInput("");
            }}
            disabled={isPending || !assetIdInput}
            className="w-full py-2 rounded-lg bg-pink-600/20 text-pink-400 text-sm font-medium hover:bg-pink-600/30 transition-colors disabled:opacity-50"
          >
            Track Asset
          </button>
        </div>
      )}

      {trackedAssets && trackedAssets.length > 0 ? (
        <div className="space-y-2">
          {trackedAssets.map((id) => {
            const info = KNOWN_ASSETS[Number(id)];
            return (
              <div
                key={Number(id)}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5"
              >
                <span className="text-sm font-medium">
                  {info?.symbol || `Asset #${Number(id)}`}
                </span>
                <span className="text-xs text-gray-500">
                  {info?.name || `ID: ${Number(id)}`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">
          No assets tracked yet
        </p>
      )}
    </div>
  );
}

// ============================================================
//                    STAKING CARD
// ============================================================

function StakingCard() {
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"stake" | "unstake">("stake");
  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" /> Staking
      </h3>

      <div className="flex rounded-lg bg-white/5 p-0.5 mb-4">
        <button
          onClick={() => setAction("stake")}
          className={clsx(
            "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
            action === "stake"
              ? "bg-emerald-600/30 text-emerald-400"
              : "text-gray-400 hover:text-white"
          )}
        >
          Stake
        </button>
        <button
          onClick={() => setAction("unstake")}
          className={clsx(
            "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
            action === "unstake"
              ? "bg-red-600/30 text-red-400"
              : "text-gray-400 hover:text-white"
          )}
        >
          Unstake
        </button>
      </div>

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in DOT"
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 mb-3"
      />

      <button
        onClick={() => {
          if (!amount) return;
          const wei = parseEther(amount);
          writeContract({
            address: POLKAVAULT_ADDRESS,
            abi: POLKAVAULT_ABI,
            functionName: action === "stake" ? "stakeDOT" : "unstakeDOT",
            args: [wei],
          });
        }}
        disabled={isPending || !amount}
        className={clsx(
          "w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
          action === "stake"
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-red-600 hover:bg-red-500 text-white"
        )}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Processing...
          </span>
        ) : isSuccess ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Done!
          </span>
        ) : action === "stake" ? (
          "Stake DOT"
        ) : (
          "Unstake DOT"
        )}
      </button>
    </div>
  );
}

// ============================================================
//                    TRANSFER CARD
// ============================================================

function TransferCard() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const { writeContract, isPending } = useWriteContract();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <ArrowRightLeft className="w-4 h-4 text-blue-400" /> Transfer
      </h3>

      <input
        type="text"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Recipient address (0x...)"
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 mb-3"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in DOT"
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 mb-3"
      />

      <button
        onClick={() => {
          if (!recipient || !amount) return;
          writeContract({
            address: POLKAVAULT_ADDRESS,
            abi: POLKAVAULT_ABI,
            functionName: "transferDOT",
            args: [recipient as `0x${string}`, parseEther(amount)],
          });
        }}
        disabled={isPending || !recipient || !amount}
        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Sending...
          </span>
        ) : (
          "Send DOT"
        )}
      </button>
    </div>
  );
}

// ============================================================
//                    PRECOMPILE INFO
// ============================================================

function PrecompileInfo() {
  const precompiles = [
    {
      name: "Balances",
      address: "0x0402",
      description: "Native DOT (ERC-20 interface)",
      color: "text-pink-400",
    },
    {
      name: "Assets",
      address: "0x0403+",
      description: "USDT, USDC & native assets",
      color: "text-blue-400",
    },
    {
      name: "Staking",
      address: "0x0804",
      description: "Bond, nominate, unbond DOT",
      color: "text-emerald-400",
    },
    {
      name: "XCM",
      address: "0x0816",
      description: "Cross-chain messaging",
      color: "text-purple-400",
    },
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 py-12">
      <h2 className="text-lg font-semibold text-center mb-6">
        Powered by Polkadot Hub Precompiles
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {precompiles.map((p) => (
          <div
            key={p.name}
            className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
          >
            <p className={clsx("text-sm font-semibold mb-1", p.color)}>
              {p.name}
            </p>
            <code className="text-[10px] text-gray-500 block mb-2">
              {p.address}
            </code>
            <p className="text-xs text-gray-400">{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
//                    MAIN PAGE
// ============================================================

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <PiggyBank className="w-6 h-6 text-pink-500" />
          <span className="font-bold text-lg">PolkaVault</span>
          <span className="text-[10px] px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-full font-medium border border-pink-500/20">
            Testnet
          </span>
        </div>
        <ConnectButton
          showBalance={true}
          chainStatus="icon"
          accountStatus="avatar"
        />
      </nav>

      <HeroSection />
      <PortfolioOverview />
      <PrecompileInfo />

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-gray-600">
        PolkaVault &mdash; Polkadot Hackathon 2025 &mdash; Track 2: EVM Smart Contract
      </footer>
    </main>
  );
}
