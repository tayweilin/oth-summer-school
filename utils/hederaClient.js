/**
 * utils/hederaClient.js
 *
 * Shared Hedera SDK helpers used across deploy.js, call.js, and everything
 * under scripts/. Centralizing this avoids copy-pasting client setup logic
 * into every script.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { Client, PrivateKey, AccountId, Hbar } from "@hashgraph/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Parse a private key that may be DER-encoded or a raw ECDSA/ED25519 hex string.
 * Same logic used in deploy.js / call.js, kept here as the single source of truth.
 */
export function parsePrivateKey(raw) {
  try {
    return PrivateKey.fromStringDer(raw);
  } catch {
    return PrivateKey.fromStringECDSA(raw);
  }
}

/**
 * Build a Hedera Testnet client using the primary operator account
 * (HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY from .env).
 */
export function makeTestnetClient() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKeyRaw = process.env.HEDERA_OPERATOR_KEY;

  if (!operatorId || !operatorKeyRaw) {
    throw new Error(
      "Please set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in your .env file."
    );
  }

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), parsePrivateKey(operatorKeyRaw));
  client.setDefaultMaxTransactionFee(new Hbar(100));
  return client;
}

/**
 * Build a Hedera Testnet client for an arbitrary account (used to simulate
 * multiple different voters). Pass the numeric suffix used in .env, e.g.
 * makeClientForAccount(2) reads HEDERA_ACCOUNT_2_ID / HEDERA_ACCOUNT_2_KEY.
 */
export function makeClientForAccount(accountNumber) {
  const idKey = `HEDERA_ACCOUNT_${accountNumber}_ID`;
  const keyKey = `HEDERA_ACCOUNT_${accountNumber}_KEY`;

  const accountId = process.env[idKey];
  const accountKeyRaw = process.env[keyKey];

  if (!accountId || !accountKeyRaw) {
    throw new Error(
      `Please set ${idKey} and ${keyKey} in your .env file.`
    );
  }

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(accountId), parsePrivateKey(accountKeyRaw));
  client.setDefaultMaxTransactionFee(new Hbar(20));
  return { client, accountId };
}
/**
 * Load the compiled contract artifact (ABI) from artifacts/Voting.json.
 */
export function loadArtifact() {
  const artifactPath = path.join(PROJECT_ROOT, "artifacts", "Voting.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Could not find artifact at ${artifactPath}. Did you create it?`);
  }
  const raw = fs.readFileSync(artifactPath, "utf8");
  return JSON.parse(raw);
}

/**
 * Read the deployed CONTRACT_ID from .env. Throws a clear error if it's
 * missing or still a placeholder, since every script after deploy.js needs it.
 */
export function getContractId() {
  const contractId = process.env.CONTRACT_ID;
  if (!contractId || contractId.includes("xxxxxx")) {
    throw new Error(
      "CONTRACT_ID is not set in .env. Run `node deploy.js` first, then paste " +
        "the resulting Contract ID into CONTRACT_ID in your .env file."
    );
  }
  return contractId;
}

/**
 * Get the project root path — useful for scripts that need to read/write
 * files like deployment.json relative to the repo root regardless of cwd.
 */
export function getProjectRoot() {
  return PROJECT_ROOT;
}