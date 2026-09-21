/**
 * Independent Studio Next deployment verification (chain 61997).
 *
 * Non-mutating: this script NEVER signs or submits anything. It re-reads the
 * deployment from the chain using the RC SDK against the canonical RPC and
 * checks:
 *   1. eth_chainId == 0xf22d (61997) — raw JSON-RPC, independent of the SDK
 *   2. transaction status is FINALIZED with FINISHED_WITH_RETURN
 *   3. the deployed contract address is non-empty
 *   4. on-chain deployed code exists and contains the RC py-genlayer pin
 *
 * Usage:
 *   node verify-deployment.mjs <deploymentTxHash> [contractAddress]
 *
 * If contractAddress is omitted it is extracted from the transaction receipt.
 * This script only READS. Exit code 0 = verified, 1 = not verified / error.
 */

import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

const RPC_URL = studioDevnet.rpcUrls.default.http[0];
const EXPECTED_CHAIN_ID_HEX = "0xf22d";

const [, , txHashArg, addressArg] = process.argv;

if (!txHashArg || !/^0x[a-fA-F0-9]{64}$/.test(txHashArg)) {
  console.error("Usage: node verify-deployment.mjs <deploymentTxHash> [contractAddress]");
  console.error("  <deploymentTxHash> must be a 0x-prefixed 32-byte transaction hash.");
  process.exit(1);
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${method}`);
  const body = await res.json();
  if (body.error) throw new Error(`RPC error for ${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function main() {
  console.log("RPC:", RPC_URL);

  // 1. Chain identity — raw JSON-RPC, independent of the SDK client.
  const chainId = await rpc("eth_chainId", []);
  console.log("eth_chainId:", chainId);
  if (String(chainId).toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
    throw new Error(`Expected chain ${EXPECTED_CHAIN_ID_HEX} (61997), got ${String(chainId)}`);
  }

  const client = createClient({ chain: studioDevnet });

  // 2. Transaction outcome as the chain recorded it.
  const tx = await client.getTransaction({ hash: txHashArg });
  const statusName = tx.statusName ?? tx.status;
  const resultName = tx.txExecutionResultName;
  console.log("TRANSACTION_STATUS:", String(statusName));
  console.log("EXECUTION_RESULT:", String(resultName));

  if (String(statusName) !== "FINALIZED") {
    throw new Error(`Transaction is not FINALIZED (status: ${String(statusName)}). Do not treat it as deployed.`);
  }
  if (resultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Execution did not finish with return (result: ${String(resultName)}).`);
  }

  // 3. Contract address from the receipt or the CLI argument.
  const candidate =
    addressArg ||
    tx.txDataDecoded?.contractAddress ||
    tx.data?.contract_address;
  if (typeof candidate !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(candidate)) {
    throw new Error(
      "Could not determine the deployed contract address from the receipt; pass it as the second argument.",
    );
  }
  console.log("CONTRACT_ADDRESS:", candidate);

  // 4. Deployed code exists on-chain and matches the RC std pin.
  const code = await client.getContractCode(candidate);
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new Error(`No deployed code returned for ${candidate}.`);
  }
  const hasPin = code.includes("5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng");
  console.log("DEPLOYED_CODE_BYTES:", code.length);
  console.log("RC py-genlayer pin present in deployed code:", hasPin);
  if (!hasPin) {
    throw new Error("Deployed code does not contain the expected RC py-genlayer pin.");
  }

  console.log("VERIFIED: transaction FINALIZED + FINISHED_WITH_RETURN; contract code exists on 61997.");
}

main().catch((error) => {
  console.error("VERIFICATION FAILED:", error && error.message ? error.message : error);
  process.exit(1);
});
