/**
 * call.js
 *
 * General-purpose read-only (query) caller for the deployed Voting contract.
 * Use this for quick checks; scripts/results.js and scripts/vote.js are the
 * more purpose-built versions for the main workflows.
 *
 * Usage:
 *   node call.js <method> [args...]
 *
 * Examples:
 *   node call.js getAllResults
 *   node call.js getWinner
 *   node call.js getVotes 0
 *   node call.js isBlocked 0.0.123456
 *   node call.js timeRemaining
 *   node call.js owner
 *   node call.js paused
 *   node call.js votingEndTime
 *
 * Requires .env with HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY / CONTRACT_ID.
 */

import {
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  AccountId,
} from "@hashgraph/sdk";
import { makeTestnetClient, getContractId } from "./utils/hederaClient.js";

const GAS = 100_000;

// Maps a method name to how to build its params and how to decode its result.
const METHODS = {
  getAllResults: {
    build: () => new ContractFunctionParameters(),
    decode: (r) => {
      const options = [];
      const optionCount = 3; // AI Agents, Blockchain Security, Cloud Computing
      // getAllResults returns (string[] options, uint256[] counts)
      // Hedera SDK decodes dynamic arrays via getStringArray / getUint256Array-like access;
      // it doesn't have a native array getter, so we decode manually by offsets is fragile —
      // instead we call getVotes per-index for reliability. See NOTE below.
      return { note: "Use `node scripts/results.js` for full results — see below." };
    },
  },
  getWinner: {
    build: () => new ContractFunctionParameters(),
    decode: (r) => ({
      winnerName: r.getString(0),
      winningVotes: r.getUint256(1).toString(),
      isTie: r.getBool(2),
    }),
  },
  getVotes: {
    build: (args) => new ContractFunctionParameters().addUint256(Number(args[0])),
    decode: (r) => ({ votes: r.getUint256(0).toString() }),
  },
  isBlocked: {
    build: (args) =>
      new ContractFunctionParameters().addAddress(toEvmAddress(args[0])),
    decode: (r) => ({ blocked: r.getBool(0) }),
  },
  hasVoted: {
    build: (args) =>
      new ContractFunctionParameters().addAddress(toEvmAddress(args[0])),
    decode: (r) => ({ hasVoted: r.getBool(0) }),
  },
  timeRemaining: {
    build: () => new ContractFunctionParameters(),
    decode: (r) => ({ secondsRemaining: r.getUint256(0).toString() }),
  },
  owner: {
    build: () => new ContractFunctionParameters(),
    decode: (r) => ({ owner: "0x" + r.getAddress(0) }),
  },
  paused: {
    build: () => new ContractFunctionParameters(),
    decode: (r) => ({ paused: r.getBool(0) }),
  },
  votingEndTime: {
    build: () => new ContractFunctionParameters(),
    decode: (r) => ({ votingEndTime: r.getUint256(0).toString() }),
  },
};

/** Convert a Hedera 0.0.x id or a 0x EVM address to a solidity address. */
function toEvmAddress(value) {
  if (value.startsWith("0x")) return value;
  return AccountId.fromString(value).toSolidityAddress();
}

async function main() {
  const [, , methodName, ...args] = process.argv;

  if (!methodName || !METHODS[methodName]) {
    console.error(
      `Usage: node call.js <method> [args...]\n` +
        `Available methods: ${Object.keys(METHODS).join(", ")}\n` +
        `(For full option-by-option results, use: node scripts/results.js)`
    );
    process.exit(1);
  }

  const contractId = ContractId.fromString(getContractId());
  const client = makeTestnetClient();
  const { build, decode } = METHODS[methodName];

  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(GAS)
    .setFunction(methodName, build(args));

  console.log(`Calling ${methodName}(${args.join(", ")}) ...\n`);

  const result = await query.execute(client);
  const decoded = decode(result);

  console.log("Result:");
  for (const [key, value] of Object.entries(decoded)) {
    console.log(`  ${key}: ${value}`);
  }

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Call error:", err.message ?? err);
  process.exit(1);
});