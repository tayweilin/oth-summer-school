/**
 * scripts/vote.js
 *
 * Casts a vote from a specific Hedera account.
 *
 * Usage:
 *   node scripts/vote.js <optionIndex> [accountNumber]
 *
 * optionIndex: 0 = AI Agents, 1 = Blockchain Security, 2 = Cloud Computing
 * accountNumber: which .env account to vote from (2, 3, 4, ...).
 *                Omit to vote using the primary HEDERA_OPERATOR account.
 *
 * Examples:
 *   node scripts/vote.js 0              -> operator account votes for AI Agents
 *   node scripts/vote.js 1 2            -> HEDERA_ACCOUNT_2 votes for Blockchain Security
 *
 * Requires .env with CONTRACT_ID and the relevant account credentials.
 */

import { ContractExecuteTransaction, ContractFunctionParameters, ContractId } from "@hashgraph/sdk";
import {
  makeTestnetClient,
  makeClientForAccount,
  getContractId,
} from "../utils/hederaClient.js";

const GAS = 300_000;
const OPTION_NAMES = ["AI Agents", "Blockchain Security", "Cloud Computing"];

async function main() {
  const [, , optionArg, accountNumberArg] = process.argv;

  const optionIndex = Number(optionArg);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 2) {
    console.error(
      "Usage: node scripts/vote.js <optionIndex 0-2> [accountNumber]\n" +
        "  0 = AI Agents\n  1 = Blockchain Security\n  2 = Cloud Computing"
    );
    process.exit(1);
  }

  let client;
  let voterLabel;

  if (accountNumberArg) {
    const { client: acctClient, accountId } = makeClientForAccount(accountNumberArg);
    client = acctClient;
    voterLabel = `HEDERA_ACCOUNT_${accountNumberArg} (${accountId})`;
  } else {
    client = makeTestnetClient();
    voterLabel = `HEDERA_OPERATOR (${process.env.HEDERA_OPERATOR_ID})`;
  }

  const contractId = ContractId.fromString(getContractId());

  console.log(`Voting as ${voterLabel}`);
  console.log(`Option: ${optionIndex} (${OPTION_NAMES[optionIndex]})\n`);

  const tx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(GAS)
    .setFunction("vote", new ContractFunctionParameters().addUint256(optionIndex));

  try {
    const txResponse = await tx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    console.log("✅ Vote cast successfully");
    console.log(`  Status:          ${receipt.status.toString()}`);
    console.log(`  Transaction ID:  ${txResponse.transactionId.toString()}`);
    console.log(
      `  HashScan:        https://hashscan.io/testnet/transaction/${txResponse.transactionId.toString()}`
    );
  } catch (err) {
    // Revert reasons from the contract (e.g. "already voted", "blocked",
    // "deadline passed", "paused") surface here.
    console.error("\n❌ Vote failed:", err.message ?? err);
    process.exit(1);
  }

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Unexpected error:", err.message ?? err);
  process.exit(1);
});