# Decentralized Voting DApp — Hedera Testnet

A smart-contract-based voting system for the question:
**"Which topic should the next tech workshop cover?"**

Options: `AI Agents` | `Blockchain Security` | `Cloud Computing`

Built with Solidity, compiled in Remix IDE, and deployed/interacted with via
the Hedera JavaScript SDK on Hedera Testnet.

---

## Features

### Core
- One vote per Hedera account (`hasVoted` mapping enforced on-chain).
- Voting results are retrievable at any time and printable via a script.
- Admin can block specific accounts from voting.
- Security checks: `onlyOwner` modifier, double-vote prevention, invalid
  option-index guard, blocked-account guard.

### Additional
- **Voting deadline** — set at deployment (`votingEndTime`); votes revert
  once the deadline passes.
- **Winner calculation** — `getWinner()` returns the leading option, its
  vote count, and whether there's a tie.
- **Admin controls** — the deploying account becomes `owner` and is the only
  account that can block/unblock voters or pause/resume voting.
- **Events** — `VoteCast`, `VoterBlocked`, `VoterUnblocked`, `VotingPaused`,
  `VotingResumed` are emitted for a full on-chain audit trail.

---

## Project Structure
oth-summer-school/
│
├── contracts/
│ └── Voting.sol # The Solidity contract
│
├── artifacts/
│ └── Voting.json # ABI + bytecode (compiled in Remix)
│
├── utils/
│ └── hederaClient.js # Shared Hedera SDK client/helpers
│
├── scripts/
│ ├── vote.js # Cast a vote from a given account
│ ├── results.js # Print full results + winner/tie
│ ├── multiVote.js # Batch-vote from multiple test accounts
│ └── admin.js # Block/unblock, pause/resume voting
│
├── compile.js # (not used — compilation done in Remix)
├── deploy.js # Deploy the contract to Hedera Testnet
├── call.js # General-purpose read-only query CLI
├── deployment.json # Auto-generated after deploy.js runs
│
├── .env.example
├── .gitignore
├── package.json
└── README.md

---

## Setup

1. **Install dependencies**
```bash
   npm install
```

2. **Create testnet accounts**
   Go to the [Hedera Portal](https://portal.hedera.com/) and create at least
   2–4 testnet accounts (funded automatically with test HBAR).

3. **Configure environment**
```bash
   cp .env.example .env
```
   Fill in `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` (this account becomes
   the contract admin) and as many `HEDERA_ACCOUNT_N_ID` / `_KEY` pairs as
   you want to test with.

4. **Compile the contract in Remix**
   - Paste `contracts/Voting.sol` into [Remix IDE](https://remix.ethereum.org).
   - Compile with Solidity `0.8.19+`.
   - Copy the **ABI** and **Bytecode** (`evm.bytecode.object`) from
     Compilation Details into `artifacts/Voting.json`.

5. **Deploy to Hedera Testnet**
```bash
   node deploy.js 3600
```
   (Argument = voting duration in seconds; defaults to 3600.)
   Copy the printed `Contract ID` into `CONTRACT_ID` in `.env`.

---

## Usage

### Cast a vote
```bash
node scripts/vote.js <optionIndex 0-2> [accountNumber]
# 0 = AI Agents, 1 = Blockchain Security, 2 = Cloud Computing
# omit accountNumber to vote as HEDERA_OPERATOR
```

### View results
```bash
node scripts/results.js
```

### Batch-vote from multiple accounts (multi-account test)
```bash
node scripts/multiVote.js                  # rotating options
node scripts/multiVote.js --option 1       # all vote for option 1
node scripts/multiVote.js --accounts 2,3,4 # choose which accounts
```

### Admin actions
```bash
node scripts/admin.js block <accountId>     [accountNumber]
node scripts/admin.js unblock <accountId>   [accountNumber]
node scripts/admin.js pause                 [accountNumber]
node scripts/admin.js resume                [accountNumber]
# omit accountNumber to act as the real admin (HEDERA_OPERATOR)
# pass one to test that non-admins are correctly rejected
```

### Ad-hoc read queries
```bash
node call.js owner
node call.js paused
node call.js timeRemaining
node call.js votingEndTime
node call.js getVotes <0-2>
node call.js isBlocked <accountId>
node call.js hasVoted <accountId>
node call.js getWinner
```

---

## Design Notes

- **Tie detection**: `getWinner()` only counts a genuine tie once at least
  one vote exists (`highest > 0`). Before any votes are cast, the contract
  reports the first option (index 0) with 0 votes and `isTie: false`,
  since "no data yet" isn't the same as a real tie — `results.js` handles
  this case explicitly in its own display logic.
- **Gas limits**: the constructor needs ~2,000,000 gas (three `push()`
  calls to a dynamic `string[]` plus several storage writes cost more than
  a typical simple constructor). `vote()` and admin functions use lower,
  fixed gas budgets since they touch far less storage.
- **Revert reasons**: Hedera's `getReceipt()` generally surfaces failures as
  `CONTRACT_REVERT_EXECUTED` rather than the Solidity `require()` string
  itself — this is expected SDK/network behavior, not a bug in the contract.

---

## Tested Scenarios

- ✅ Single vote succeeds; repeat vote from same account reverts.
- ✅ Multiple distinct Hedera accounts each successfully vote once.
- ✅ Blocked account is rejected when attempting to vote.
- ✅ Non-admin account is rejected when calling admin-only functions.
- ✅ Admin successfully blocks/unblocks accounts and pauses/resumes voting.
- ✅ Voting while paused is rejected; resumes correctly afterward.
- ✅ `getWinner()` correctly identifies a leading option once votes diverge.