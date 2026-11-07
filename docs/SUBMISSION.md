# Submission pack (NEAR HACKATHON)

## What the organizers look for (from nearhackathon.com and HACKATHON.md)

- A working prototype built in the window (Nov 1 to Nov 14, 23:59 UTC). Libraries and AI-written code are allowed if disclosed.
- A **public** GitHub repo. AI judges (Claude Code, Codex) screen first: does it run, and does it do what the README says. Humans decide.
- A README that states what it is, the problem, and "do X, see Y" steps, without marketing.
- A LICENSE file, and a list of pre-existing libraries.
- A public X post saying it was built at NEAR HACKATHON, tagging @NEARProtocol with #NEARHackathon, with a video or screenshots.
- The form: project name, lead, email, team size, tracks, mainnet NEAR address, repo URL, post URL, 20 to 2,000 character description. It cannot be edited after submitting.
- Social Money track hint: shared budgets, rewards and reputation-based access, building on Sputnik DAO and Trezu rather than rebuilding a multisig.

Remaining gaps judges may notice: wallet actions untested with a real wallet, no gas sponsorship, secretary is rules-based (no NEAR AI Cloud), no mainnet.

## X post draft

> Built at NEAR HACKATHON: Cowrie, savings circles (ajo/esusu/susu) where the contract holds the money, not an organizer.
>
> Miss a payment and collateral is slashed; the recipient is still paid in full. Collateral and safety pot come from published simulations.
>
> Demo, no wallet: https://cowrie-rho.vercel.app
> Code: https://github.com/victorhez/cowrie
>
> @NEARProtocol #NEARHackathon
> Who runs a circle today? What would stop you moving it on-chain?

Attach a screen recording of /demo: play three rounds, show the slash and the full payout.

## Form description (under 2,000 characters)

Cowrie puts the rotating savings circle (ajo, esusu, susu, tanda) on NEAR. A group pools a fixed amount each period and each member receives the whole pot once. The contract holds the money, enforce the schedule, slash collateral from members who miss a payment, pay the recipient in full and record every contribution publicly. On completion each member receives a non-transferable credential showing rounds completed, on-time payments and defaults, which lowers collateral in future circles. A safety pot and prepaid autopay reduce shortfalls, and anyone can settle a round for a small tip.

What is built and verifiable today: a reference rules engine with unit and property tests over thousands of random circles; Circle Lab, a Monte Carlo study that runs the real engine to recommend collateral and safety-pot levels; an independent-oracle equivalence check; a read-only secretary; and a web app with a no-wallet demo using accelerated rounds. What runs on NEAR testnet: three Rust contracts (circle, soulbound credential, test token) that replay 300 generated scenarios identically to the reference engine, and a complete circle played on-chain (slash, settler tip, credentials, collateral discount). What is pending: wallet actions tested with a real wallet, gas sponsorship, NEAR AI Cloud secretary, mainnet. Honest limits: not insurance, random order can be influenced, unaudited, testnet only. Try it: https://cowrie-rho.vercel.app

Tracks: Social Money, Real-World Money, NFTs That Do Something.

## Checklist

- [ ] Repo public, LICENSE present
- [ ] Live demo works without a wallet
- [x] Contracts on testnet
- [ ] Demo video recorded, X post public
- [ ] Mainnet NEAR address ready, form submitted before the deadline
