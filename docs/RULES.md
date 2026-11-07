# Circle rules

The reference implementation is `src/engine/circle.ts`. The NEAR contract must match it rule for rule.

## States

`open` → `active` → `completed`, or `open` → `cancelled` (before start only).

## Rules

1. **Join.** Lock collateral `C × (N − 1) × collateral% / 100` in the circle token. A member with at least `min_credentials` credentials locks `discount%` less. The circle starts when all N seats are filled (N between 2 and 24).
2. **Order.** Fixed at start. `creator` uses the given list. `random` uses a seeded shuffle; on-chain this would use block randomness, which block producers can influence.
3. **Contribute.** In the current round a member pays exactly `C`, once. Wrong amount, wrong round or a second payment is rejected.
4. **Settle.** Anyone, once every member has paid or `due + grace` has passed. For each member who has not paid: draw the prepaid balance; then slash `min(missing, collateral)` into the pot; then use the safety pot; record the rest as owed. The recipient is paid the pot minus what the recipient owes (the offset returns to the safety pot). A round settles once.
5. **Defaults.** One default is recorded per missed round. After two defaults a member who has not yet been paid is removed from payouts and their turn passes to the next eligible member. If no eligible member remains, the pot joins the safety pot.
6. **Finish.** After the last round: return remaining collateral and prepaid balances, return the safety pot equally (rounding dust to the first member), mint credentials. Calling again changes nothing.
7. **Safety pot.** `reserve_bps` of each real contribution goes to the safety pot.
8. **Autopay.** A prepaid balance is drawn at settle for an unpaid contribution, at most once per round and never beyond the balance.
9. **Settler tip.** When a round is settled late, the caller receives `min(tip_cap, safety pot)`.
10. **Exit and seat transfer.** Before start a member can leave with a full refund. After start the creator can approve a seat transfer; position, owed amount and collateral move together.
11. **No admin.** After start nobody can move funds except through these rules.

## Cowrie Score (0 to 1000)

```
rate    = on_time_rounds / total_rounds
volume  = min(1, total_rounds / 30)
penalty = min(0.5, 0.1 × defaults)
score   = round(1000 × max(0, 0.7 × rate + 0.3 × volume − penalty))
```

## Invariants and where they are tested

| # | Invariant | Test |
|---|---|---|
| I1 | tokens in = tokens out + held, no negative balances | property harness, after every operation |
| I2 | a round pays out once | property harness; unit "settled round cannot settle again" |
| I3 | nobody withdraws more than their collateral, reserve share and payout | covered by I1 and I8 |
| I4 | slashing never exceeds locked collateral | property harness |
| I5 | removed members never receive; eligible members always do | property harness; unit "two defaults" |
| I6 | settle and finish are idempotent | property harness; unit |
| I7 | credentials only after finish, one per member | property harness |
| I8 | everything is returned at finish | property harness |
| I9 | autopay never exceeds the prepaid balance | property harness (no negative balances); unit |
| I10 | seat transfer preserves totals | property harness |
| I11 | tips never exceed the cap | property harness |

The engine is in-memory. These tests demonstrate the specification, not the contract. Contract tests will reuse the same scenarios.
