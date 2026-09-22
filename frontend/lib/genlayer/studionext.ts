/**
 * Studio Next (GenLayer Studio Devnet, chain 61997) verification support.
 *
 * Isolated on purpose: this module is the ONLY place the RC SDK
 * (genlayer-js 2.0.0-rc.1, installed under the alias `genlayer-js-rc`) is
 * loaded. The Bradbury 4221 live path keeps using genlayer-js 1.1.8 through
 * `frontend/lib/genlayer/verifier.ts` and is untouched.
 *
 * Signing model (differs from Bradbury, per the Studio Next RC stack):
 *   - The verification WRITE is signed by the user's browser wallet
 *     (EIP-1193 provider) — the server never sees or stores any key for this
 *     network, matching the Studio Next deployment flow.
 *   - Finalization and result read-back are read-only and run server-side
 *     (waitForTransactionReceipt + readContract), so polling needs no wallet.
 *
 * Fees: Consensus v0.6 rejects writes with zero fee value
 * (FeeValueMustBeNonZero), so the write estimates fees from the live network
 * policy via estimateTransactionFeesForWrite before asking the wallet to sign.
 *
 * This file must stay importable from client components: no static imports of
 * server-only modules (result normalization happens server-side in
 * lib/verifier/service.ts, shared with the Bradbury path).
 */

export const STUDIO_NEXT_CHAIN_ID = 61997;
export const STUDIO_NEXT_CHAIN_ID_HEX = "0xf22d";
export const STUDIO_NEXT_NETWORK_NAME = "studioDevnet";
export const STUDIO_NEXT_RPC_URL = "https://studio-dev.genlayer.com/api";
export const STUDIO_NEXT_EXPLORER_BASE = "https://explorer-studio-dev.genlayer.com";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type RcModule = typeof import("genlayer-js-rc");
type RcChainsModule = typeof import("genlayer-js-rc/chains");

export type StudioNextClient = Awaited<ReturnType<RcModule["createClient"]>>;

/** Load the RC SDK pieces lazily — the 1.1.8 path never pays this cost. */
async function loadRcSdk(): Promise<{
  createClient: RcModule["createClient"];
  studioDevnet: RcChainsModule["studioDevnet"];
}> {
  const [{ createClient }, chains] = await Promise.all([
    import("genlayer-js-rc"),
    import("genlayer-js-rc/chains"),
  ]);
  return { createClient, studioDevnet: chains.studioDevnet };
}

function getInjectedProvider(): Eip1193Provider {
  if (typeof window === "undefined") {
    throw new Error("Studio Next verification signing requires a browser wallet.");
  }
  const candidate = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!candidate || typeof (candidate as Eip1193Provider).request !== "function") {
    throw new Error(
      "No browser wallet provider found. A GenLayer-compatible wallet connected to Studio Next is required.",
    );
  }
  return candidate as Eip1193Provider;
}

/**
 * Ask the wallet to switch to Studio Next (61997). If the chain is missing
 * (4902), add it with the canonical parameters first. The wallet's own
 * confirmation UI is the user approval for both steps.
 */
export async function switchWalletToStudioNext(): Promise<unknown> {
  const provider = getInjectedProvider();
  try {
    return await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_NEXT_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    const message = String((err as Error)?.message ?? "");
    if (code === 4902 || /unrecognized|not added/i.test(message)) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: STUDIO_NEXT_CHAIN_ID_HEX,
            chainName: "GenLayer Studio Devnet (Studio Next)",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: ["https://studio-dev.genlayer.com/api"],
          },
        ],
      });
      return provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: STUDIO_NEXT_CHAIN_ID_HEX }],
      });
    }
    throw err;
  }
}

/** Keyless read-only client for the canonical Studio Next RPC (server-safe). */
export async function createStudioNextClient(): Promise<StudioNextClient> {
  const { createClient, studioDevnet } = await loadRcSdk();
  return createClient({ chain: studioDevnet }) as StudioNextClient;
}

/**
 * Browser-only: submit the `verify` write through the user's EIP-1193 wallet,
 * mirroring the proven deployment flow (chain guard, account from the wallet,
 * provider-backed client, live fee estimation). Returns ONLY the real
 * transaction hash returned by the provider — never a simulated one.
 */
export async function submitVerificationViaWallet(args: {
  contractAddress: string;
  verificationId: string;
  requestJson: string;
}): Promise<{ transactionHash: string; feeValueWei: string; wallet: string }> {
  const provider = getInjectedProvider();

  const chainId = await provider.request({ method: "eth_chainId" });
  if (String(chainId).toLowerCase() !== STUDIO_NEXT_CHAIN_ID_HEX) {
    throw new Error(
      `Wallet is on chain ${String(chainId)}; switch it to Studio Next (61997 / ${STUDIO_NEXT_CHAIN_ID_HEX}) before verifying.`,
    );
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const wallet = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof wallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    throw new Error("The browser wallet returned no usable account.");
  }

  const { createClient, studioDevnet } = await loadRcSdk();
  const client = createClient({
    chain: studioDevnet,
    account: wallet as `0x${string}`,
    provider: provider as unknown as NonNullable<
      Parameters<typeof createClient>[0]
    >["provider"],
  }) as StudioNextClient;

  const feeEstimate = await client.estimateTransactionFeesForWrite({
    address: args.contractAddress as `0x${string}`,
    functionName: "verify",
    args: [args.verificationId, args.requestJson],
    value: 0n,
  });
  if (!feeEstimate?.distribution || feeEstimate.feeValue === undefined) {
    throw new Error(
      "Studio Next fee estimation returned an incomplete preset; refusing to submit without fees.",
    );
  }

  const hash = await client.writeContract({
    address: args.contractAddress as `0x${string}`,
    functionName: "verify",
    args: [args.verificationId, args.requestJson],
    value: 0n,
    fees: {
      distribution: feeEstimate.distribution,
      feeValue: feeEstimate.feeValue,
    },
  });

  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(
      "Wallet provider did not return a valid verification transaction hash.",
    );
  }
  return { transactionHash: hash, feeValueWei: feeEstimate.feeValue.toString(), wallet };
}

/**
 * Server-side, keyless finalization: wait for FINALIZED, require successful
 * execution (not FINISHED_WITH_ERROR), then read the stored verification
 * record back from the contract.
 *
 * MAJORITY_DISAGREE is a TERMINAL, SUCCESSFUL outcome — the validators ran,
 * executed the contract, and voted; they simply did not converge, and the
 * contract stores nothing by design. It is returned as structured data
 * (`consensusOutcome: "MAJORITY_DISAGREE"`) so the app can present it as a
 * divergence proof, never as a timeout-style error.
 *
 * Returns the raw on-chain object — normalization to the app result shape
 * happens server-side in lib/verifier/service.ts (shared with Bradbury).
 */
export async function finalizeStudioNextVerification(args: {
  contractAddress: string;
  verificationId: string;
  txHash: string;
}): Promise<
  | { stored: Record<string, unknown>; consensusOutcome: "MAJORITY_AGREE" | string }
  | { stored: undefined; consensusOutcome: "MAJORITY_DISAGREE" }
> {
  const client = await createStudioNextClient();

  // Poll the raw JSON-RPC transaction record instead of the SDK's receipt
  // waiter: the hosted studio-dev backend reports finality as numeric status
  // 6, which the 2.0.0-rc.1 waiter does not map, so it times out even for
  // finalized transactions. Reading the chain directly is version-proof and
  // fully independent of SDK status mappings.
  const MAX_TRIES = 60; // ~5 minutes at 5s intervals
  let txRecord: Record<string, unknown> | undefined;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const result = (await client.request({
      method: "eth_getTransactionByHash",
      params: [args.txHash as `0x${string}` & { length: 66 }],
    })) as Record<string, unknown> | null;
    if (result && typeof result === "object") {
      txRecord = result;
      if (result.status === "FINALIZED") break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (!txRecord || txRecord.status !== "FINALIZED") {
    throw new Error(
      `Studio Next verification transaction did not finalize within the polling window (last status: ${String(txRecord?.status)}).`,
    );
  }
  const executionResult = String(txRecord.txExecutionResultName ?? "");
  if (executionResult === "FINISHED_WITH_ERROR") {
    throw new Error(`Contract execution failed: ${executionResult}`);
  }

  const consensusOutcome = String(txRecord.result_name ?? "");
  if (consensusOutcome === "MAJORITY_DISAGREE") {
    // Terminal divergence: nothing is stored on-chain by design. Return the
    // outcome instead of attempting a read-back that would be empty.
    return { stored: undefined, consensusOutcome };
  }

  const raw = await client.readContract({
    address: args.contractAddress as `0x${string}`,
    functionName: "get_verification",
    args: [args.verificationId],
  });

  let storedObj: unknown = raw;
  if (typeof storedObj === "string") {
    storedObj = storedObj.length > 0 ? JSON.parse(storedObj) : {};
  }
  if (
    typeof storedObj !== "object" ||
    storedObj === null ||
    Object.keys(storedObj as object).length === 0
  ) {
    throw new Error(
      "Verification finalized but the contract holds no stored result for this id " +
        "(get_verification returned empty).",
    );
  }
  return { stored: storedObj as Record<string, unknown>, consensusOutcome };
}

export function studioNextExplorerUrl(txHash: string): string {
  return `${STUDIO_NEXT_EXPLORER_BASE}/tx/${txHash}`;
}

export function studioNextAddressExplorerUrl(address: string): string {
  return `${STUDIO_NEXT_EXPLORER_BASE}/address/${address}`;
}

/** Live contract status as reported by the chain itself — no cached or hardcoded values. */
export type StudioNextContractStatus = {
  chainId: number | null;
  chainIdHex: string | null;
  contractAddress: string | null;
  reachable: boolean;
  contractName: string | null;
  verificationCount: number | null;
  error: string | null;
  checkedAt: string;
};

async function rawStudioNextRpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(STUDIO_NEXT_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${method}`);
  const body = (await res.json()) as { error?: unknown; result?: unknown };
  if (body.error) throw new Error(`RPC error for ${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

/**
 * Probe the live Studio Next network with REAL reads only: raw JSON-RPC
 * `eth_chainId` (independent of the SDK) plus two contract view calls
 * (`get_contract_info`, `get_verification_ids`) through the RC SDK. Never
 * throws — every failure becomes data so the status endpoint can always
 * answer. Server-side use only (falls back to GENLAYER_CONTRACT_ADDRESS).
 */
export async function fetchStudioNextContractStatus(args?: {
  contractAddress?: string;
}): Promise<StudioNextContractStatus> {
  const status: StudioNextContractStatus = {
    chainId: null,
    chainIdHex: null,
    contractAddress: null,
    reachable: false,
    contractName: null,
    verificationCount: null,
    error: null,
    checkedAt: new Date().toISOString(),
  };

  const contractAddress =
    args?.contractAddress ?? process.env.GENLAYER_CONTRACT_ADDRESS?.trim();
  if (contractAddress && /^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    status.contractAddress = contractAddress;
  }

  try {
    const chainIdHex = await rawStudioNextRpc("eth_chainId");
    if (typeof chainIdHex !== "string") {
      throw new Error(`Unexpected eth_chainId response: ${String(chainIdHex)}`);
    }
    status.chainIdHex = chainIdHex;
    status.chainId = Number.parseInt(chainIdHex, 16);
    if (chainIdHex.toLowerCase() !== STUDIO_NEXT_CHAIN_ID_HEX) {
      throw new Error(
        `Chain id mismatch: expected ${STUDIO_NEXT_CHAIN_ID_HEX} (61997), got ${chainIdHex}`,
      );
    }
    if (!status.contractAddress) {
      throw new Error("No Studio Next contract address configured");
    }

    const client = await createStudioNextClient();

    const infoRaw = await client.readContract({
      address: status.contractAddress as `0x${string}`,
      functionName: "get_contract_info",
    });
    const info = (typeof infoRaw === "string" && infoRaw.length > 0
      ? JSON.parse(infoRaw)
      : infoRaw) as Record<string, unknown> | null;
    if (info && typeof info === "object") {
      const name = info.name ?? info.title;
      if (typeof name === "string" && name.length > 0) status.contractName = name;
    }

    const idsRaw = await client.readContract({
      address: status.contractAddress as `0x${string}`,
      functionName: "get_verification_ids",
    });
    const ids = (typeof idsRaw === "string" && idsRaw.length > 0
      ? JSON.parse(idsRaw)
      : idsRaw) as unknown;
    if (Array.isArray(ids)) status.verificationCount = ids.length;

    status.reachable = true;
  } catch (err) {
    status.error = String(err instanceof Error ? err.message : err);
  }
  return status;
}
