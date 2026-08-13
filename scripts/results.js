/**
 * scripts/results.js
 *
 * Prints full voting results: each option's vote count, total votes cast,
 * and the current winner (or tie). This is the "proper" results printer —
 * it works around the SDK's lack of a clean dynamic-array decoder by
 * looping getVotes(i) per option instead of relying on getAllResults().
 *
 * Usage:
 *   node scripts/results.js
 *
 * Requires .env with HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY / CONTRACT_ID.
 */

import { ContractCallQuery, ContractFunctionParameters, ContractId } from "@hashgraph/sdk";
import { makeTestnetClient, getContractId } from "../utils/hederaClient.js";

const GAS = 100_000;
const OPTION_NAMES = ["AI Agents", "Blockchain Security", "Cloud Computing"];

async function queryVotes(client, contractId, optionIndex) {
  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(GAS)
    .setFunction("getVotes", new ContractFunctionParameters().addUint256(optionIndex));
  const result = await query.execute(client);
  return Number(result.getUint256(0).toString());
}

async function queryWinner(client, contractId) {
  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(GAS)
    .setFunction("getWinner", new ContractFunctionParameters());
  const result = await query.execute(client);
  return {
    winnerName: result.getString(0),
    winningVotes: Number(result.getUint256(1).toString()),
    isTie: result.getBool(2),
  };
}

async function queryScalar(client, contractId, method, decode) {
  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(GAS)
    .setFunction(method, new ContractFunctionParameters());
  const result = await query.execute(client);
  return decode(result);
}

async function main() {
  const contractId = ContractId.fromString(getContractId());
  const client = makeTestnetClient();

  console.log(`Fetching results for contract ${contractId.toString()} ...\n`);

  const counts = [];
  for (let i = 0; i < OPTION_NAMES.length; i++) {
    counts.push(await queryVotes(client, contractId, i));
  }

  const totalVotes = counts.reduce((sum, c) => sum + c, 0);
  const winner = await queryWinner(client, contractId);
  const paused = await queryScalar(client, contractId, "paused", (r) => r.getBool(0));
  const secondsRemaining = await queryScalar(client, contractId, "timeRemaining", (r) =>
    Number(r.getUint256(0).toString())
  );

  console.log("=== Voting Results ===");
  OPTION_NAMES.forEach((name, i) => {
    const bar = "█".repeat(counts[i]);
    console.log(`  [${i}] ${name.padEnd(20)} : ${counts[i]} vote(s)  ${bar}`);
  });

  console.log(`\nTotal votes cast: ${totalVotes}`);
  console.log(`Voting paused:    ${paused}`);
  console.log(
    `Time remaining:   ${secondsRemaining > 0 ? `${secondsRemaining} seconds` : "Voting has ended"}`
  );

  console.log("\n=== Winner ===");
  if (totalVotes === 0) {
    console.log("  No votes cast yet.");
  } else if (winner.isTie) {
    console.log(`  It's a TIE at ${winner.winningVotes} vote(s) each.`);
  } else {
    console.log(`  ${winner.winnerName} — ${winner.winningVotes} vote(s)`);
  }

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Error fetching results:", err.message ?? err);
  process.exit(1);
});