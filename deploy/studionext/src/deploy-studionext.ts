/**
 * Browser-wallet deployment utility for AgentzProofVerifier on Studio Next
 * (GenLayer Studio Devnet, chain 61997) using the matching genlayer-js
 * 2.0.0-rc.1 RC SDK (studioDevnet chain definition).
 *
 * This module is intentionally not imported by the production app. Load the
 * bundled `deploy.bundle.js` in a browser and explicitly call
 * `window.deployAgentzProofStudioNext()` (or the exported function).
 *
 * No wallet API is called while this module is imported. Deployment state is
 * kept in localStorage under a Studio Next-specific key so reloads resume a
 * known transaction and never submit a second deployment automatically.
 *
 * The Bradbury 4221 deployment path (scripts/deploy-browser.ts + genlayer-js
 * 1.1.8) remains intact and uses its own storage keys.
 */

import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { DecodedDeployData, TransactionHash } from "genlayer-js/types";
// Bundled from the repo's single source of truth at build time.
import contractSource from "../../../contracts/AgentzProofVerifier.py";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type DeploymentReceipt = {
  statusName?: TransactionStatus;
  txExecutionResultName?: ExecutionResult;
  txDataDecoded?: DecodedDeployData;
  data?: Record<string, unknown>;
};

type DeploymentState =
  | {
      status: "SUBMITTING";
      wallet: string;
      startedAt: string;
    }
  | {
      status: "PENDING";
      transactionHash: TransactionHash;
      wallet: string;
      submittedAt: string;
    }
  | {
      status: "SUCCESS";
      transactionHash: TransactionHash;
      contractAddress: string;
      wallet: string;
      finalizedAt: string;
      statusName: TransactionStatus.FINALIZED;
      executionResult: ExecutionResult.FINISHED_WITH_RETURN;
      explorerUrl: string | null;
      explorerNote: string;
    }
  | {
      status: "FAILED";
      transactionHash?: TransactionHash;
      wallet: string;
      failedAt: string;
      statusName?: string;
      executionResult?: string;
      error: string;
    }
  | {
      status: "RECOVERED";
      wallet: string;
      startedAt: string;
      recoveredAt: string;
      reason: "manual recovery after provider submission failed before transaction hash";
      recoveryAudit: {
        previousStatus: "SUBMITTING";
        wallet: string;
        startedAt: string;
        recoveryTimestamp: string;
        reason: "manual recovery after provider submission failed before transaction hash";
      };
    };

export type RecoveryResult = {
  status: "RECOVERED";
  wallet: string;
  startedAt: string;
  recoveryTimestamp: string;
  reason: "manual recovery after provider submission failed before transaction hash";
};

export type DeploymentResult = {
  network: string;
  chainId: number;
  wallet: string;
  deploymentTx: string;
  contractAddress: string;
  status: string;
  executionResult: string;
  /** Studio Next has no SDK-shipped block explorer; null means "none known". */
  explorerUrl: string | null;
};

const NETWORK_NAME = "Studio Next (GenLayer Studio Devnet)";
const EXPECTED_CHAIN_ID = "0xf22d"; // 61997
const EXPECTED_CHAIN_NUMBER = 61997;
const DEPLOYMENT_STATE_STORAGE_KEY = "agentzproof.studionext.deploymentState";
const RECOVERY_REASON =
  "manual recovery after provider submission failed before transaction hash" as const;

function getProvider(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("A browser EIP-1193 wallet provider is required.");
  }
  return window.ethereum as unknown as Eip1193Provider;
}

function requireAddress(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${fieldName} was not a valid address: ${String(value)}`);
  }
  return value;
}

function requireTransactionHash(value: unknown): TransactionHash {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      `GenLayer returned an invalid deployment transaction hash: ${String(value)}`,
    );
  }
  return value as TransactionHash;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function saveDeploymentState(state: DeploymentState): void {
  window.localStorage.setItem(DEPLOYMENT_STATE_STORAGE_KEY, JSON.stringify(state));
}

function parseStoredState(): DeploymentState | null {
  const storedState = window.localStorage.getItem(DEPLOYMENT_STATE_STORAGE_KEY);
  if (!storedState) return null;
  try {
    return JSON.parse(storedState) as DeploymentState;
  } catch (error) {
    throw new Error(`Stored deployment state is invalid: ${errorMessage(error)}`);
  }
}

function loadDeploymentState(): DeploymentState | null {
  return parseStoredState();
}

/**
 * Manually recover only a stale SUBMITTING state with no transaction hash.
 * No provider access, no deployment capability. Keeps an audit record as
 * RECOVERED rather than deleting the stale state.
 *
 * If `previousTxHash` is provided, the state is instead recorded as FAILED
 * with that hash preserved — used when a submission produced an on-chain
 * transaction that later reverted (e.g. FeeValueMustBeNonZero) so the
 * evidence stays on file before a corrected retry is allowed.
 */
export function recoverInterruptedDeploymentStudioNext(
  previousTxHash?: string,
): RecoveryResult {
  if (typeof window === "undefined") {
    throw new Error("Manual deployment recovery requires a browser.");
  }

  const rawState = window.localStorage.getItem(DEPLOYMENT_STATE_STORAGE_KEY);
  if (!rawState) {
    throw new Error("No persisted deployment state exists.");
  }

  let parsedState: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(rawState);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("state is not an object");
    }
    parsedState = value as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Stored deployment state is invalid: ${errorMessage(error)}`);
  }

  if (parsedState.status !== "SUBMITTING") {
    throw new Error(
      `Manual recovery is only allowed for SUBMITTING state; current state is ${String(parsedState.status)}.`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(parsedState, "transactionHash")) {
    throw new Error("Refusing recovery because the SUBMITTING state contains a transaction hash.");
  }

  const wallet = requireAddress(parsedState.wallet, "stored wallet");
  const startedAt = parsedState.startedAt;
  if (typeof startedAt !== "string" || !startedAt) {
    throw new Error("SUBMITTING state has no valid startedAt timestamp.");
  }

  console.log("Manual deployment recovery (Studio Next)");
  console.log("Current state: SUBMITTING");
  console.log(`Wallet: ${wallet}`);
  console.log(`Started at: ${startedAt}`);
  console.log(`Reason: ${RECOVERY_REASON}`);
  if (previousTxHash !== undefined) {
    console.log(`Known previous transaction (to be recorded as FAILED): ${previousTxHash}`);
  }

  const hashNote = previousTxHash
    ? `\n\nPrevious transaction will be recorded as FAILED: ${previousTxHash}`
    : "";
  if (
    !window.confirm(
      "Clear this stale SUBMITTING state? Confirm only if the provider failed before returning a usable deployment." +
        hashNote,
    )
  ) {
    throw new Error("Manual recovery cancelled by the user.");
  }

  const recoveryTimestamp = new Date().toISOString();

  if (previousTxHash) {
    const normalized = requireTransactionHash(previousTxHash);
    saveDeploymentState({
      status: "FAILED",
      transactionHash: normalized,
      wallet,
      failedAt: recoveryTimestamp,
      error:
        "Submission produced on-chain transaction that reverted (provider reported FeeValueMustBeNonZero(1)); recorded during manual recovery.",
    });
    return {
      status: "RECOVERED",
      wallet,
      startedAt,
      recoveryTimestamp,
      reason: RECOVERY_REASON,
    };
  }

  saveDeploymentState({
    status: "RECOVERED",
    wallet,
    startedAt,
    recoveredAt: recoveryTimestamp,
    reason: RECOVERY_REASON,
    recoveryAudit: {
      previousStatus: "SUBMITTING",
      wallet,
      startedAt,
      recoveryTimestamp,
      reason: RECOVERY_REASON,
    },
  });

  return {
    status: "RECOVERED",
    wallet,
    startedAt,
    recoveryTimestamp,
    reason: RECOVERY_REASON,
  };
}

function getContractAddress(receipt: DeploymentReceipt): string {
  const decodedAddress = receipt.txDataDecoded?.contractAddress;
  const dataAddress = receipt.data?.contract_address;
  return requireAddress(decodedAddress ?? dataAddress, "contract address");
}

function printDeploymentSummary(result: DeploymentResult): void {
  console.log("NETWORK", result.network);
  console.log("CHAIN_ID", result.chainId);
  console.log("WALLET", result.wallet);
  console.log("DEPLOYMENT_TX", result.deploymentTx);
  console.log("CONTRACT_ADDRESS", result.contractAddress);
  console.log("STATUS", result.status);
  console.log("EXECUTION_RESULT", result.executionResult);
  console.log("EXPLORER_URL", result.explorerUrl ?? "NONE_KNOWN_FOR_STUDIO_NEXT");
}

async function trackDeployment(
  client: ReturnType<typeof createClient>,
  wallet: string,
  deploymentTx: TransactionHash,
): Promise<DeploymentResult> {
  console.log("DEPLOYMENT_TX", deploymentTx);

  let receipt: DeploymentReceipt;
  try {
    receipt = (await client.waitForTransactionReceipt({
      hash: deploymentTx,
      status: TransactionStatus.FINALIZED,
      retries: 200,
    })) as DeploymentReceipt;
  } catch (error) {
    // A timeout or RPC error is not proof of failure. Keep PENDING so the next
    // explicit invocation resumes this same hash instead of deploying again.
    throw new Error(`Unable to finalize deployment ${deploymentTx}: ${errorMessage(error)}`);
  }

  if (receipt.statusName !== TransactionStatus.FINALIZED) {
    throw new Error(`Deployment did not finalize. Status: ${String(receipt.statusName)}`);
  }

  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    const failure = `Deployment finalized without successful execution. Execution result: ${String(receipt.txExecutionResultName)}`;
    saveDeploymentState({
      status: "FAILED",
      transactionHash: deploymentTx,
      wallet,
      failedAt: new Date().toISOString(),
      statusName: String(receipt.statusName),
      executionResult: String(receipt.txExecutionResultName),
      error: failure,
    });
    throw new Error(failure);
  }

  // Keep PENDING until both address extraction and code verification succeed;
  // a transient read failure must not make a second deployment possible.
  const contractAddress = getContractAddress(receipt);
  const deployedCode = await client.getContractCode(contractAddress as `0x${string}`);
  if (typeof deployedCode !== "string" || !deployedCode.trim()) {
    throw new Error(`GenLayer returned no deployed code for ${contractAddress}.`);
  }

  // Studio Next (chain 61997) ships with blockExplorers: undefined in the RC
  // SDK. There is no known explorer URL; we record null rather than guess.
  const explorerUrl: string | null = studioDevnet.blockExplorers?.default?.url
    ? `${studioDevnet.blockExplorers.default.url}/tx/${deploymentTx}`
    : null;

  const result: DeploymentResult = {
    network: NETWORK_NAME,
    chainId: studioDevnet.id,
    wallet,
    deploymentTx,
    contractAddress,
    status: String(receipt.statusName),
    executionResult: String(receipt.txExecutionResultName),
    explorerUrl,
  };

  saveDeploymentState({
    status: "SUCCESS",
    transactionHash: deploymentTx,
    contractAddress,
    wallet,
    finalizedAt: new Date().toISOString(),
    statusName: TransactionStatus.FINALIZED,
    executionResult: ExecutionResult.FINISHED_WITH_RETURN,
    explorerUrl: result.explorerUrl,
    explorerNote:
      "Studio Next preview deployment has no SDK-shipped block explorer; verify via RPC.",
  });
  printDeploymentSummary(result);
  return result;
}

function resultFromSuccess(
  state: Extract<DeploymentState, { status: "SUCCESS" }>,
): DeploymentResult {
  const result: DeploymentResult = {
    network: NETWORK_NAME,
    chainId: EXPECTED_CHAIN_NUMBER,
    wallet: state.wallet,
    deploymentTx: state.transactionHash,
    contractAddress: state.contractAddress,
    status: state.statusName,
    executionResult: state.executionResult,
    explorerUrl: state.explorerUrl,
  };
  printDeploymentSummary(result);
  return result;
}

/**
 * Deploy once to Studio Next, or resume tracking a known transaction. This is
 * the only entry point that can request wallet access or call deployContract().
 */
export async function deployAgentzProofStudioNext(): Promise<DeploymentResult> {
  const existingState = loadDeploymentState();

  if (existingState?.status === "SUCCESS") {
    console.warn(
      "Deployment already succeeded; returning the persisted result without wallet access or redeployment.",
    );
    return resultFromSuccess(existingState);
  }

  if (existingState?.status === "SUBMITTING") {
    throw new Error(
      `A deployment submission was interrupted at ${existingState.startedAt} before its transaction hash was recorded. Inspect the wallet/network manually; refusing to submit another deployment.`,
    );
  }

  const provider = getProvider();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("The browser wallet returned no account.");
  }
  const wallet = requireAddress(accounts[0], "wallet");

  const chainId = await provider.request({ method: "eth_chainId" });
  if (String(chainId).toLowerCase() !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wallet is on chain ${String(chainId)}; switch it to Studio Next (61997 / 0xf22d) before deploying.`,
    );
  }

  if (studioDevnet.id !== EXPECTED_CHAIN_NUMBER) {
    throw new Error(
      `Installed genlayer-js studioDevnet chain ID is ${studioDevnet.id}, expected ${EXPECTED_CHAIN_NUMBER}.`,
    );
  }

  const client = createClient({
    chain: studioDevnet,
    account: wallet as `0x${string}`,
    provider: provider as unknown as NonNullable<Parameters<typeof createClient>[0]>["provider"],
  });

  if (existingState?.status === "PENDING") {
    if (
      existingState.wallet !== "unknown" &&
      existingState.wallet.toLowerCase() !== wallet.toLowerCase()
    ) {
      throw new Error(
        `Pending deployment belongs to wallet ${existingState.wallet}; refusing to track it from ${wallet}.`,
      );
    }
    console.warn("Pending deployment found; resuming it without submitting another transaction.");
    return trackDeployment(client, wallet, existingState.transactionHash);
  }

  if (existingState?.status === "FAILED") {
    console.warn(`Previous deployment failed: ${existingState.error}`);
  }

  const contractByteLength = new TextEncoder().encode(contractSource).length;

  // Studio-dev (Consensus v0.6 RC) rejects zero-fee deploys with
  // FeeValueMustBeNonZero. Build the fee preset from the live network fee
  // policy — a read-only RPC call — before asking the wallet to sign.
  console.log("Estimating fees from the live Studio Next fee policy…");
  const feeEstimate = await client.estimateTransactionFees();
  if (!feeEstimate?.distribution || feeEstimate.feeValue === undefined) {
    throw new Error("Fee estimation returned an incomplete preset; refusing to deploy without fees.");
  }
  console.log(
    "ESTIMATED_FEE_VALUE (wei):", feeEstimate.feeValue.toString(),
    "(GEN):", (Number(feeEstimate.feeValue) / 1e18).toFixed(6),
  );

  console.log("AgentzProof deployment (Studio Next)");
  console.log("Network:", NETWORK_NAME);
  console.log("Chain ID: 61997 (0xf22d)");
  console.log("RPC:", studioDevnet.rpcUrls.default.http[0]);
  console.log(`Wallet: ${wallet}`);
  console.log("Contract: AgentzProofVerifier");
  console.log(`Contract source bytes: ${contractByteLength}`);
  console.log("Deployment action: submit exactly one deployContract transaction");

  // Pre-signature confirmation showing exactly what is being signed, per the
  // deployment safety gates. The wallet then shows its own confirmation UI.
  const feeValueGen = (Number(feeEstimate.feeValue) / 1e18).toFixed(6);
  if (
    !window.confirm(
      "Deploy AgentzProofVerifier to Studio Next (chain 61997)?\n\n" +
        "Network: GenLayer Studio Devnet\n" +
        "Chain ID: 61997 (0xf22d)\n" +
        "Contract: AgentzProofVerifier\n" +
        `Estimated fee: ${feeEstimate.feeValue.toString()} wei (~${feeValueGen} GEN)\n` +
        "Action: submit exactly one deployment transaction\n\n" +
        "This submits exactly one deployment transaction.",
    )
  ) {
    throw new Error("Deployment cancelled by the user before signing.");
  }

  // Write a durable lock before entering the SDK call. If the browser crashes
  // while the provider is submitting, the next invocation refuses to guess and
  // cannot accidentally submit a second deployment.
  saveDeploymentState({
    status: "SUBMITTING",
    wallet,
    startedAt: new Date().toISOString(),
  });

  // This call is intentionally single-shot. Never retry it automatically.
  let deploymentTx: TransactionHash;
  try {
    deploymentTx = requireTransactionHash(
      await client.deployContract({
        code: contractSource,
        args: [],
        fees: {
          distribution: feeEstimate.distribution,
          feeValue: feeEstimate.feeValue,
        },
      }),
    );
  } catch (error) {
    const message = errorMessage(error);
    // A wallet-level signature REJECTION (code 4001 or an explicit user-denied
    // message) is provably pre-broadcast: no transaction exists, so releasing
    // the lock cannot double-submit. Anything else keeps the SUBMITTING lock —
    // an uncertain provider outcome must be resolved manually, by hash.
    const userRejected =
      (error as { code?: number })?.code === 4001 ||
      /user rejected|user denied|signature? denied|rejected the request/i.test(message);
    if (!userRejected) {
      throw new Error(
        `Provider did not return a deployment transaction hash: ${message}. ` +
          "The SUBMITTING lock is kept; if a transaction was actually broadcast, resolve it by hash — do not redeploy.",
      );
    }
    saveDeploymentState({
      status: "FAILED",
      wallet,
      failedAt: new Date().toISOString(),
      error: `Wallet signature rejected before broadcast: ${message}`,
    });
    throw new Error(`Deployment cancelled in the wallet: ${message} (no transaction was broadcast).`);
  }
  saveDeploymentState({
    status: "PENDING",
    transactionHash: deploymentTx,
    wallet,
    submittedAt: new Date().toISOString(),
  });
  console.log("DEPLOYMENT_TX", deploymentTx);

  return trackDeployment(client, wallet, deploymentTx);
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    deployAgentzProofStudioNext?: typeof deployAgentzProofStudioNext;
    recoverInterruptedDeploymentStudioNext?: typeof recoverInterruptedDeploymentStudioNext;
  }
}

if (typeof window !== "undefined") {
  window.deployAgentzProofStudioNext = deployAgentzProofStudioNext;
  window.recoverInterruptedDeploymentStudioNext = recoverInterruptedDeploymentStudioNext;
}
