# Security notes

**These contracts are unaudited. Do not claim or imply an audit.** This file lists what was looked at and what was not.

## Who holds keys (testnet)

- `circle` contract (`cto4o69.cowrie-circle-b07415.testnet`): no admin or withdrawal function. Funds move only through the rules in `contracts/circle/src/engine.rs`. The account was created by `scripts/deploy.mjs` and its full-access key is held by the author's deploy machine. Anyone holding that key could redeploy the contract, so on testnet "no organizer holds your money" means *by design of the code*, not *by key custody*. Before mainnet the key must be deleted or put behind a multisig/DAO.
- `credential` contract: one `owner` who can point the minter at a new circle contract (`set_minter`). Nothing else is owner-only.
- `mock-usdc`: public `faucet` method; test token with no value.

## Checked once by the author (read-through, not formal)

- Access control: `contribute`/`join`/`prepay` only via `ft_on_transfer` from the configured token; `mint` only by the registered circle contract; `transfer_seat` creator-only.
- Integer math: all amounts are `u128` with checked/saturating operations in the engine; conservation (money in = money out + held) is a property-tested invariant and a contract view (`conserved`).
- Re-entrancy: state is updated before payout transfers are fired; transfers are independent receipts and do not call back into the contract.
- NEAR runtime issue found and fixed: a function cannot return a joint promise (see README).

## Not checked

- No third-party audit or formal verification.
- Storage registration on the token: an unregistered recipient makes a payout `ft_transfer` fail. Rollback behaviour of failed payout receipts is not covered by tests (the unit tests cannot simulate cross-contract receipts). Treat as an open risk.
- Wrong-amount contributions: covered by engine unit tests; not exercised on-chain.
- 12-member gas limits; 5-member on-chain run beyond round 2.
- Random turn order can be influenced by block producers.

## Design limits

- One contract holds many circles, capped at 12 members each on-chain (engine supports 24). A sub-account-per-circle factory is on the roadmap because it isolates circles from each other's storage and failures.

## What exists where

| Feature | Engine (TypeScript/Rust) | On-chain tested |
|---|---|---|
| join, contribute, settle, defaults, slashing, safety pot, tip, credentials | Yes | Yes (`docs/testnet-run.log`) |
| collateral discount for returning members | Yes | Yes |
| seat transfer, exit | Yes | Not verified on-chain |
| prepaid autopay | Yes | Not verified on-chain |
