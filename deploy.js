/**
 * deploy.js
 *
 * Deploys the compiled Voting contract (artifacts/Voting.json) to Hedera
 * Testnet. The deploying account automatically becomes the contract's
 * admin/owner (see Voting.sol constructor).
 *
 * Usage:
 *   node deploy.js [votingDurationSeconds]
 *
 * Examples:
 *   node deploy.js            -> defaults to 3600 seconds (1 hour) of voting
 *   node deploy.js 86400      -> voting stays open for 24 hours
 *
 * Requires .env with HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY.
 */

import fs from "node:fs";
import path from "node:path";
import {
  ContractCreateFlow,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";
import {
  makeTestnetClient,
  loadArtifact,
  getProjectRoot,
} from "./utils/hederaClient.js";

const DEFAULT_VOTING_DURATION_SECONDS = 3600; // 1 hour
const GAS = 2_000_000; // constructor does a few storage writes (owner, 3 push()s, timestamps)

async function main() {
  const durationArg = process.argv[2];
  const votingDurationSeconds = durationArg
    ? Number(durationArg)
    : DEFAULT_VOTING_DURATION_SECONDS;

  if (!Number.isFinite(votingDurationSeconds) || votingDurationSeconds <= 0) {
    throw new Error(
      `Invalid voting duration "${durationArg}". Provide a positive number of seconds.`
    );
  }

  const artifact = loadArtifact();
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(
      "artifacts/Voting.json has no bytecode. Did you paste it in from Remix?"
    );
  }

  const bytecode = artifact.bytecode.startsWith("0x")
    ? artifact.bytecode.slice(2)
    : artifact.bytecode;

  const client = makeTestnetClient();

  console.log(`Deploying Voting.sol to Hedera Testnet ...`);
  console.log(`  Voting duration: ${votingDurationSeconds} seconds`);
  console.log(`  Gas limit:       ${GAS}`);

  const constructorParams = new ContractFunctionParameters().addUint256(
    votingDurationSeconds
  );

  const flow = new ContractCreateFlow()
    .setGas(GAS)
    .setBytecode(bytecode)
    .setConstructorParameters(constructorParams)

  const txResponse = await flow.execute(client);
  const receipt = await txResponse.getReceipt(client);

  const contractId = receipt.contractId;
  if (!contractId) {
    throw new Error(`Deployment failed with status: ${receipt.status.toString()}`);
  }

  const evmAddress = contractId.toSolidityAddress();
  const deployedAt = new Date().toISOString();
  const votingEndsAt = new Date(
    Date.now() + votingDurationSeconds * 1000
  ).toISOString();

  console.log("\n✅ Contract deployed successfully");
  console.log(`  Contract ID  : ${contractId.toString()}`);
  console.log(`  EVM address  : 0x${evmAddress}`);
  console.log(`  Voting ends  : ${votingEndsAt}`);
  console.log(`  HashScan     : https://hashscan.io/testnet/contract/${contractId.toString()}`);

  // Persist deployment details so other scripts (call.js, results.js, etc.)
  // don't need to guess where the contract lives.
  const deploymentInfo = {
    contractId: contractId.toString(),
    evmAddress: `0x${evmAddress}`,
    network: "testnet",
    votingDurationSeconds,
    deployedAt,
    votingEndsAt,
    hashscanUrl: `https://hashscan.io/testnet/contract/${contractId.toString()}`,
  };

  const outPath = path.join(getProjectRoot(), "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📝 Wrote deployment details to ${outPath}`);
  console.log(
    `\n👉 Next: copy "${contractId.toString()}" into CONTRACT_ID in your .env file.`
  );

  client.close();
  return contractId.toString();
}

main().catch((err) => {
  console.error("\n❌ Deployment error:", err.message ?? err);
  process.exit(1);
});