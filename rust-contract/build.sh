#!/bin/bash
# Build the YieldOptimizer Rust PVM contract
set -e

echo "Building YieldOptimizer for PolkaVM (RISC-V)..."
cargo +nightly-2024-11-19 build --release

echo "Linking with polkatool..."
polkatool link --strip \
  target/riscv64emac-unknown-none-polkavm/release/yield-optimizer \
  -o yield-optimizer.polkavm

echo "Done! Output: yield-optimizer.polkavm"
ls -la yield-optimizer.polkavm
