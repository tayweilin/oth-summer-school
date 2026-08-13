/**
 * compile.js
 *
 * NOTE: This project compiles Voting.sol using Remix IDE (browser-based),
 * not a local solc/Hardhat pipeline. This script does NOT compile the
 * contract — instead it validates that artifacts/Voting.json (produced by
 * copying the ABI + Bytecode out of Remix's Compilation Details panel) is
 * well-formed and ready to deploy.
 *
 * Why: keeps compile.js as a useful sanity-check step in the workflow
 * (contracts/Voting.sol -> [compile in Remix] -> artifacts/Voting.json ->
 * compile.js validates -> deploy.js deploys) without duplicating a compiler
 * toolchain that isn't otherwise used in this project.
 *
 * Usage:
 *   node compile.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_PATH = path.join(__dirname, "contracts", "Voting.sol");
const ARTIFACT_PATH = path.join(__dirname, "artifacts", "Voting.json");

function checkContractExists() {
  if (!fs.existsSync(CONTRACT_PATH)) {
    throw new Error(`Missing contract source at ${CONTRACT_PATH}`);
  }
  const source = fs.readFileSync(CONTRACT_PATH, "utf8");
  const hasPragma = /pragma solidity/.test(source);
  const hasContractDecl = /contract\s+Voting/.test(source);
  if (!hasPragma || !hasContractDecl) {
    throw new Error(
      "contracts/Voting.sol doesn't look like a valid Solidity contract (missing pragma or contract declaration)."
    );
  }
  console.log(`✅ Found contracts/Voting.sol (${source.length} chars)`);
}

function checkArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(
      `Missing artifacts/Voting.json. Compile contracts/Voting.sol in Remix ` +
        `(Solidity Compiler tab -> Compilation Details) and paste the ABI + ` +
        `Bytecode into artifacts/Voting.json.`
    );
  }

  const raw = fs.readFileSync(ARTIFACT_PATH, "utf8");
  let artifact;
  try {
    artifact = JSON.parse(raw);
  } catch (err) {
    throw new Error(`artifacts/Voting.json is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
    throw new Error("artifacts/Voting.json has no ABI entries.");
  }

  if (!artifact.bytecode || artifact.bytecode === "0xPASTE_YOUR_BYTECODE_HERE" || artifact.bytecode.length < 10) {
    throw new Error("artifacts/Voting.json has no valid bytecode.");
  }

  // Spot-check that expected functions are present in the ABI.
  const expectedFunctions = [
    "vote",
    "getVotes",
    "getAllResults",
    "getWinner",
    "blockVoter",
    "unblockVoter",
    "pauseVoting",
    "resumeVoting",
  ];
  const abiFunctionNames = artifact.abi
    .filter((entry) => entry.type === "function")
    .map((entry) => entry.name);

  const missing = expectedFunctions.filter((fn) => !abiFunctionNames.includes(fn));
  if (missing.length > 0) {
    throw new Error(
      `ABI is missing expected function(s): ${missing.join(", ")}. ` +
        `Did you copy the full ABI from Remix?`
    );
  }

  console.log(`✅ ABI valid — ${artifact.abi.length} entries, all expected functions present`);
  console.log(`✅ Bytecode present — ${artifact.bytecode.length} characters`);
}

function main() {
  console.log("Validating compiled contract artifact (compiled via Remix IDE)...\n");
  checkContractExists();
  checkArtifact();
  console.log("\n✅ artifacts/Voting.json is ready. You can now run: node deploy.js");
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}