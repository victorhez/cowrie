#!/usr/bin/env bash
# Builds the three contracts to wasm in contracts/out/. Needs Rust with the wasm32-unknown-unknown target.
# Post-MVP wasm features are disabled so the NEAR runtime accepts the output.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export RUSTFLAGS="-C link-arg=-s -C target-feature=-reference-types,-multivalue,-bulk-memory,-sign-ext,-nontrapping-fptoint"
cargo build --release --target wasm32-unknown-unknown
mkdir -p out
cp target/wasm32-unknown-unknown/release/{cowrie_circle,cowrie_credential,mock_usdc}.wasm out/
ls -la out
