/**
 * scripts/admin.js
 *
 * Exercises admin-only controls: block/unblock a voter, pause/resume voting.
 * Also lets you verify (by using a non-operator account) that these calls
 * correctly fail when attempted by a non-admin account.
 *
 * Usage:
 *   node scripts/admin.js block <accountIdOrEvmAddress> [accountNumber]
 *   node scripts/admin.js unblock <accountIdOrEvmAddress> [accountNumber]
 *   node scripts/admin.js pause [accountNumber]
 *   node scripts/admin.js resume [accountNumber]
 *
 * If [accountNumber] is omitted, the call is made as HEDERA_OPERATOR (the
 * real admin) — this should succeed. Pass an accountNumber (e.g. 2) to
 * attempt the same call as a non-admin account — this should fail with
 * "Only admin can perform this action".
 *
 * Examples:
 *   node scripts/admin.js block 0.0.999999          -> admin blocks account 0.0.999999
 *   node scripts/admin.js pause 3                    -> account 3 (non-admin) tries to
 *                                                        pause voting -> should fail
 *
 * Requires .env with CONTRACT_ID and HEDERA_OPERATOR_ID/KEY (and the
 * relevant numbered account credentials if testing non-admin rejection).
 */

import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountId,
} from "@hashgraph/sdk";
import {
  makeTestnetClient,
  makeClientForAccount,
  getContractId,
} from "../utils/hederaClient.js";

const GAS = 200_000;

/** Convert a Hedera 0.0.x id or a 0x EVM address to a solidity address. */
function toEvmAddress(value) {
  if (value.startsWith("0x")) return value;
  return AccountId.fromString(value).toSolidityAddress();
}

function getClient(accountNumberArg) {
  if (accountNumberArg) {
    const { client, accountId } = makeClientForAccount(accountNumberArg);
    return { client, label: `HEDERA_ACCOUNT_${accountNumberArg} (${accountId}) [non-admin test]` };
  }
  const client = makeTestnetClient();
  return { client, label: `HEDERA_OPERATOR (${process.env.HEDERA_OPERATOR_ID}) [admin]` };
}

async function runAdminCall(functionName, params, client, label, contractId) {
  console.log(`Calling ${functionName}() as ${label} ...`);

  const tx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(GAS)
    .setFunction(functionName, params);

  try {
    const txResponse = await tx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    console.log(`✅ SUCCESS — status: ${receipt.status.toString()}`);
    console.log(
      `   HashScan: https://hashscan.io/testnet/transaction/${txResponse.transactionId.toString()}`
    );
  } catch (err) {
    console.log(`❌ FAILED — ${err.message ?? err}`);
    console.log(
      `   (Expected if this was a non-admin account attempting an admin-only action.)`
    );
  }

  client.close();
}

async function main() {
  const [, , action, ...rest] = process.argv;
  const contractId = ContractId.fromString(getContractId());

  if (!["block", "unblock", "pause", "resume"].includes(action)) {
    console.error(
      "Usage:\n" +
        "  node scripts/admin.js block <accountIdOrEvmAddress> [accountNumber]\n" +
        "  node scripts/admin.js unblock <accountIdOrEvmAddress> [accountNumber]\n" +
        "  node scripts/admin.js pause [accountNumber]\n" +
        "  node scripts/admin.js resume [accountNumber]"
    );
    process.exit(1);
  }

  if (action === "block" || action === "unblock") {
    const [targetAccount, accountNumberArg] = rest;
    if (!targetAccount) {
      console.error(`Usage: node scripts/admin.js ${action} <accountIdOrEvmAddress> [accountNumber]`);
      process.exit(1);
    }
    const { client, label } = getClient(accountNumberArg);
    const params = new ContractFunctionParameters().addAddress(toEvmAddress(targetAccount));
    await runAdminCall(action === "block" ? "blockVoter" : "unblockVoter", params, client, label, contractId);
  } else {
    // pause / resume
    const [accountNumberArg] = rest;
    const { client, label } = getClient(accountNumberArg);
    const params = new ContractFunctionParameters();
    await runAdminCall(action === "pause" ? "pauseVoting" : "resumeVoting", params, client, label, contractId);
  }
}

main().catch((err) => {
  console.error("\n❌ Unexpected error:", err.message ?? err);
  process.exit(1);
});