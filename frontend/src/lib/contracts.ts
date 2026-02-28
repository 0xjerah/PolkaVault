export const POLKAVAULT_ADDRESS = "0x0000000000000000000000000000000000000000" as const; // TODO: deploy and update

export const POLKAVAULT_ABI = [
  {
    type: "function",
    name: "createPortfolio",
    inputs: [{ name: "label", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "trackAsset",
    inputs: [{ name: "assetId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "untrackAsset",
    inputs: [{ name: "assetId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stakeDOT",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stakeMoreDOT",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unstakeDOT",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "nominateValidators",
    inputs: [{ name: "validators", type: "bytes32[]", internalType: "bytes32[]" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferAsset",
    inputs: [
      { name: "assetId", type: "uint256", internalType: "uint256" },
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferDOT",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPortfolioOverview",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [
      { name: "label", type: "string", internalType: "string" },
      { name: "assetIds", type: "uint256[]", internalType: "uint256[]" },
      { name: "balances", type: "uint256[]", internalType: "uint256[]" },
      { name: "dotBalance", type: "uint256", internalType: "uint256" },
      { name: "stakingActive", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAssetInfo",
    inputs: [{ name: "assetId", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "assetName", type: "string", internalType: "string" },
      { name: "assetSymbol", type: "string", internalType: "string" },
      { name: "assetDecimals", type: "uint8", internalType: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTrackedAssets",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "portfolios",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "createdAt", type: "uint256", internalType: "uint256" },
      { name: "stakingEnabled", type: "bool", internalType: "bool" },
      { name: "label", type: "string", internalType: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStakeHistoryCount",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTransferHistoryCount",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PortfolioCreated",
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "label", type: "string", indexed: false, internalType: "string" },
    ],
  },
  {
    type: "event",
    name: "AssetTracked",
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "assetId", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "StakingInitiated",
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "TransferExecuted",
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;

// Well-known asset IDs on Polkadot Hub
export const KNOWN_ASSETS: Record<number, { name: string; symbol: string; decimals: number }> = {
  1984: { name: "Tether USD", symbol: "USDT", decimals: 6 },
  1337: { name: "USD Coin", symbol: "USDC", decimals: 6 },
};
