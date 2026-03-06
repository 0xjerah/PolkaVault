//! YieldOptimizer — Rust PVM contract for PolkaVault
//!
//! Computes annualized APY in basis points from exchange rate growth.
//! This runs natively on PolkaVM (RISC-V) and is callable cross-VM
//! from our Solidity PolkaVault contract via pallet-revive.
//!
//! ABI: computeApy(uint256 prevRate, uint256 newRate, uint256 elapsed)
//!        returns (uint256 apyBps)
//!
//! Encoding (100 bytes total):
//!   bytes  0..4   : function selector (ignored — single function)
//!   bytes  4..36  : prevRate  (32-byte big-endian uint256)
//!   bytes 36..68  : newRate   (32-byte big-endian uint256)
//!   bytes 68..100 : elapsed   (32-byte big-endian uint256, seconds)
//!
//! Formula:
//!   apyBps = (newRate - prevRate) * 10_000 * 365_days / (prevRate * elapsed)
//!
//! Uses u128 arithmetic — sufficient for exchange rates up to ~3.4e38.

#![no_std]
#![no_main]

use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags};

/// Seconds in a 365-day year
const SECONDS_PER_YEAR: u128 = 365 * 24 * 3600; // 31_536_000

/// Basis points multiplier
const BPS: u128 = 10_000;

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read 100 bytes: selector(4) + prevRate(32) + newRate(32) + elapsed(32)
    input!(buf: &[u8; 100],);

    // Extract u128 from the lower 16 bytes of each 32-byte ABI slot
    let prev_rate = u128::from_be_bytes(buf[20..36].try_into().unwrap());
    let new_rate  = u128::from_be_bytes(buf[52..68].try_into().unwrap());
    let elapsed   = u128::from_be_bytes(buf[84..100].try_into().unwrap());

    let mut output = [0u8; 32];

    // Guard: return 0 if inputs are invalid or no growth
    if elapsed == 0 || prev_rate == 0 || new_rate <= prev_rate {
        api::return_value(ReturnFlags::empty(), &output);
    }

    // apyBps = (newRate - prevRate) * BPS * SECONDS_PER_YEAR / (prevRate * elapsed)
    let delta = new_rate - prev_rate;
    let numerator = delta
        .saturating_mul(BPS)
        .saturating_mul(SECONDS_PER_YEAR);
    let denominator = prev_rate.saturating_mul(elapsed);

    let apy_bps = if denominator > 0 {
        numerator / denominator
    } else {
        0
    };

    // Write result as big-endian u128 in the lower half of a 32-byte slot
    output[16..32].copy_from_slice(&apy_bps.to_be_bytes());

    api::return_value(ReturnFlags::empty(), &output);
}
