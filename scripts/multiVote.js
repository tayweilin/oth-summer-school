/**
 * scripts/multiVote.js
 *
 * Exercises the "multiple Hedera accounts" requirement in one run: loops
 * through the numbered test accounts defined in .env (HEDERA_ACCOUNT_2,
 * HEDERA_ACCOUNT_3, HEDERA_ACCOUNT_4, ...) and has each cast a vote for a
 * given (or rotating) option.
 *
 * Usage:
 *   node scripts/multiVote.js                  -> each account votes for a
 *                                                   rotating option (2->0, 3->1, 4->2, ...)
 *   node scripts/multiVote.js --option 1        -> every account votes for option 1
 *   node scripts/multiVote.js --accounts 2,3,4  -> only use these account numbers
 *
 * Requires .env with CONTRACT_ID and the numbered test account credentials.
 * Any account that has already voted, is blocked, or hits the deadline will
 * fail loudly for that account but NOT stop the rest of the batch.
 */

import { ContractExecuteTransaction, ContractFunctionParameters, ContractId } from "@hashgraph/sdk";
import { makeClientForAccount, getContractId } from "../utils/hederaClient.js";

const GAS = 300_000;
const OPTION_NAMES = ["AI Agents", "Blockchain Security", "Cloud Computing"];
const DEFAULT_ACCOUNT_NUMBERS = [2, 3, 4];

function parseArgs(argv) {
  const opts = { fixedOption: null, accountNumbers: DEFAULT_ACCOUNT_NUMBERS };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--option") {
      opts.fixedOption = Number(argv[++i]);
    } else if (argv[i] === "--accounts") {
      opts.accountNumbers = argv[++i].split(",").map((n) => Number(n.trim()));
    }
  }
  return opts;
}

async function castVote(accountNumber, optionIndex, contractId) {
  let client;
  let accountId;
  try {
    const acct = makeClientForAccount(accountNumber);
    client = acct.client;
    accountId = acct.accountId;
  } catch (err) {
    return { accountNumber, ok: false, reason: `Missing credentials: ${err.message}` };
  }

  try {
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(GAS)
      .setFunction("vote", new ContractFunctionParameters().addUint256(optionIndex));

    const txResponse = await tx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    client.close();
    return {
      accountNumber,
      accountId,
      ok: true,
      optionIndex,
      status: receipt.status.toString(),
      txId: txResponse.transactionId.toString(),
    };
  } catch (err) {
    client.close();
    return {
      accountNumber,
      accountId,
      ok: false,
      optionIndex,
      reason: err.message ?? String(err),
    };
  }
}

async function main() {
  const { fixedOption, accountNumbers } = parseArgs(process.argv.slice(2));
  const contractId = ContractId.fromString(getContractId());

  console.log(`Casting votes from ${accountNumbers.length} account(s): [${accountNumbers.join(", ")}]`);
  console.log(
    fixedOption !== null
      ? `All accounts will vote for option ${fixedOption} (${OPTION_NAMES[fixedOption]})\n`
      : `Accounts will vote for a rotating option\n`
  );

  const results = [];
  for (let i = 0; i < accountNumbers.length; i++) {
    const accountNumber = accountNumbers[i];
    const optionIndex = fixedOption !== null ? fixedOption : i % OPTION_NAMES.length;

    console.log(`-> HEDERA_ACCOUNT_${accountNumber} voting for option ${optionIndex} (${OPTION_NAMES[optionIndex]}) ...`);
    const result = await castVote(accountNumber, optionIndex, contractId);
    results.push(result);

    if (result.ok) {
      console.log(`   ✅ SUCCESS (${result.status}) — tx ${result.txId}`);
    } else {
      console.log(`   ❌ FAILED — ${result.reason}`);
    }
  }

  console.log("\n=== Summary ===");
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);

  console.log("\nRun `node scripts/results.js` to see updated totals.");
}

main().catch((err) => {
  console.error("\n❌ Unexpected error:", err.message ?? err);
  process.exit(1);
});