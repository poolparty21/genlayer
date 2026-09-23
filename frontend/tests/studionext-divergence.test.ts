/**
 * Studio Next divergence UX — locks the behavior that a MAJORITY_DISAGREE
 * consensus outcome is a terminal, structured result (never a thrown error)
 * and that it persists a DIVERGED record carrying the real transaction hash
 * and explorer link. Also locks the converged PASS path staying unchanged.
 *
 * The RC SDK (`genlayer-js-rc`) is mocked at its module boundary: no real
 * network calls, no viem ABI machinery, and the 1.1.8 Bradbury SDK stays
 * untouched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_NEXT_NETWORK_NAME,
  fetchStudioNextContractStatus,
  finalizeStudioNextVerification,
  studioNextExplorerUrl,
} from "@/lib/genlayer/studionext";
import { finalizeVerify } from "@/lib/verifier/service";
import { verificationStore } from "@/lib/store/verification-store";

const WALLET_HASH = `0x${"a".repeat(64)}`;
const CONTRACT = `0x${"e".repeat(40)}`;

const { requestMock, readContractMock, createClientMock, fetchMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  readContractMock: vi.fn(),
  createClientMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("genlayer-js-rc", () => ({
  createClient: createClientMock,
}));
vi.mock("genlayer-js-rc/chains", () => ({ studioDevnet: { id: 61997 } }));

// Default RC client used by the finalizer tests; the status suite overrides it.
createClientMock.mockImplementation(() => ({
  request: requestMock,
  readContract: readContractMock,
}));

function finalizedTx(resultName: string) {
  return {
    status: "FINALIZED",
    txExecutionResultName: "FINISHED_WITH_RETURN",
    result_name: resultName,
  };
}

/** On-chain result object exactly as the contract's get_verification returns it. */
function makeStoredResult() {
  return {
    decision: "PASS",
    score: 1,
    summary: "2 of 2 requirements satisfied. Decision: PASS.",
    requirements: [
      {
        id: "REQ-1",
        requirement: "Implements a documented hello_world() function.",
        status: "PASS",
        checked_by: "deterministic",
        reason: "Function hello_world found in submitted code.",
      },
      {
        id: "REQ-2",
        requirement: "Returns the exact string 'Hello, GenLayer!'.",
        status: "PASS",
        checked_by: "deterministic",
        reason: "Required string found in submitted code.",
      },
    ],
    evidence: [],
    consensus: {
      principle: "equivalence_principle",
      judge: "genlayer_llm",
      web_evidence: "strict_eq",
      llm_adjudication: "leader_fn_validator_fn",
    },
  };
}

function makeSnapshot(id: string) {
  return {
    id,
    title: "Studio Next verification",
    description: "d",
    task: "d",
    requirements: [
      { id: "REQ-1", text: "Implements a documented hello_world() function." },
      { id: "REQ-2", text: "Returns the exact string 'Hello, GenLayer!'." },
    ],
    creator: "creator",
    agent: "agent",
    evidenceRequirements: [],
    evidence: [],
    evidenceUrls: [],
    status: "VERIFYING" as const,
    txHash: WALLET_HASH,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("studioNextExplorerUrl", () => {
  it("builds the studio-dev explorer transaction link", () => {
    expect(studioNextExplorerUrl(WALLET_HASH)).toBe(
      `https://explorer-studio-dev.genlayer.com/tx/${WALLET_HASH}`,
    );
  });
});

describe("finalizeStudioNextVerification outcome mapping", () => {
  afterEach(() => {
    requestMock.mockReset();
    readContractMock.mockReset();
  });

  it("returns MAJORITY_DISAGREE as terminal data and never reads the contract", async () => {
    requestMock.mockResolvedValue(finalizedTx("MAJORITY_DISAGREE"));

    const outcome = await finalizeStudioNextVerification({
      contractAddress: CONTRACT,
      verificationId: "dv-1",
      txHash: WALLET_HASH,
    });

    expect(outcome.consensusOutcome).toBe("MAJORITY_DISAGREE");
    expect(outcome.stored).toBeUndefined();
    expect(readContractMock).not.toHaveBeenCalled();
  });

  it("returns the stored record with its consensus outcome when converged", async () => {
    requestMock.mockResolvedValue(finalizedTx("MAJORITY_AGREE"));
    readContractMock.mockResolvedValue(JSON.stringify(makeStoredResult()));

    const outcome = await finalizeStudioNextVerification({
      contractAddress: CONTRACT,
      verificationId: "dv-2",
      txHash: WALLET_HASH,
    });

    expect(outcome.consensusOutcome).toBe("MAJORITY_AGREE");
    expect(outcome.stored).toBeDefined();
    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "get_verification", args: ["dv-2"] }),
    );
  });
});

describe("finalizeVerify on Studio Next", () => {
  beforeEach(() => {
    vi.stubEnv("GENLAYER_NETWORK", STUDIO_NEXT_NETWORK_NAME);
    vi.stubEnv("GENLAYER_CONTRACT_ADDRESS", CONTRACT);
    vi.stubEnv("DATA_FILE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    requestMock.mockReset();
    readContractMock.mockReset();
  });

  it("persists a DIVERGED record with the real hash and explorer link", async () => {
    requestMock.mockResolvedValue(finalizedTx("MAJORITY_DISAGREE"));

    const snapshot = makeSnapshot("dv-diverged") as Parameters<
      typeof verificationStore.upsert
    >[0];
    await verificationStore.upsert(snapshot);

    const { verification, result } = await finalizeVerify(snapshot.id);
    expect(verification.status).toBe("DIVERGED");
    expect(verification.txHash).toBe(WALLET_HASH);
    expect(result.decision).toBe("FAIL");
    expect(result.score).toBe(0);
    expect(result.summary).toContain("MAJORITY_DISAGREE");
    expect(result.tx?.network).toBe(STUDIO_NEXT_NETWORK_NAME);
    expect(result.tx?.status).toBe("FINALIZED");
    expect(result.tx?.transactionHash).toBe(WALLET_HASH);
    expect(result.tx?.explorerUrl).toBe(studioNextExplorerUrl(WALLET_HASH));
    for (const req of result.requirements) {
      expect(req.status).toBe("FAIL");
      expect(req.checkedBy).toBe("llm");
      expect(req.reason).toContain("Consensus diverged");
    }

    const persisted = await verificationStore.get(snapshot.id);
    expect(persisted?.status).toBe("DIVERGED");
    expect(persisted?.result?.tx?.transactionHash).toBe(WALLET_HASH);
  });

  it("keeps the converged PASS path unchanged", async () => {
    requestMock.mockResolvedValue(finalizedTx("MAJORITY_AGREE"));
    readContractMock.mockResolvedValue(JSON.stringify(makeStoredResult()));

    const snapshot = makeSnapshot("dv-passed") as Parameters<
      typeof verificationStore.upsert
    >[0];
    await verificationStore.upsert(snapshot);

    const { verification, result } = await finalizeVerify(snapshot.id);
    expect(verification.status).toBe("PASSED");
    expect(result.decision).toBe("PASS");
    expect(result.score).toBe(1);
    expect(result.requirements).toHaveLength(2);
    expect(result.requirements.every((req) => req.status === "PASS")).toBe(true);
    expect(result.requirements[0]?.checkedBy).toBe("deterministic");

    const persisted = await verificationStore.get(snapshot.id);
    expect(persisted?.status).toBe("PASSED");
  });
});

describe("fetchStudioNextContractStatus (live status reads)", () => {
  function rpcBody(result: unknown) {
    return { jsonrpc: "2.0", id: 1, result };
  }

  function contractClient(contractExists: boolean) {
    return ({
      request: requestMock,
      readContract: (call: { functionName: string }) => {
        readContractMock(call); // shared tracking so assertions see the calls
        if (!contractExists) {
          return Promise.reject(new Error("Contract not found or not executable"));
        }
        if (call.functionName === "get_contract_info") {
          return Promise.resolve(
            JSON.stringify({ name: "AgentzProofVerifier", purpose: "Agent work verification" }),
          );
        }
        if (call.functionName === "get_verification_ids") {
          return Promise.resolve(JSON.stringify(["v-1", "v-2"]));
        }
        return Promise.reject(new Error("Unknown function"));
      },
    }) as never;
  }

  beforeEach(() => {
    vi.stubEnv("GENLAYER_CONTRACT_ADDRESS", CONTRACT);
    vi.stubGlobal("fetch", fetchMock);
    (createClientMock as ReturnType<typeof vi.fn>).mockImplementation(() =>
      contractClient(true),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    requestMock.mockReset();
    readContractMock.mockReset();
  });

  it("reports a live chain and contract from real RPC reads", async () => {
    fetchMock.mockResolvedValue(Response.json(rpcBody("0xf22d")));

    const status = await fetchStudioNextContractStatus();

    expect(status.reachable).toBe(true);
    expect(status.error).toBeNull();
    expect(status.chainId).toBe(61997);
    expect(status.chainIdHex).toBe("0xf22d");
    expect(status.contractAddress).toBe(CONTRACT);
    expect(status.contractName).toBe("AgentzProofVerifier");
    expect(status.verificationCount).toBe(2);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://studio-dev.genlayer.com/api",
      expect.objectContaining({ method: "POST" }),
    );
    const [rpcUrl, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(rpcUrl).toBe("https://studio-dev.genlayer.com/api");
    expect(JSON.parse(init.body).method).toBe("eth_chainId");
    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "get_contract_info" }),
    );
    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "get_verification_ids" }),
    );
  });

  it("reports unreachable with the real error when the contract is gone after a reset", async () => {
    fetchMock.mockResolvedValue(Response.json(rpcBody("0xf22d")));
    (createClientMock as ReturnType<typeof vi.fn>).mockImplementation(() =>
      contractClient(false),
    );

    const status = await fetchStudioNextContractStatus();

    expect(status.chainId).toBe(61997);
    expect(status.reachable).toBe(false);
    expect(status.error).toContain("not found");
    expect(status.verificationCount).toBeNull();
  });

  it("never reads the contract when the chain id is wrong", async () => {
    fetchMock.mockResolvedValue(Response.json(rpcBody("0x1")));

    const status = await fetchStudioNextContractStatus();

    expect(status.chainId).toBe(1);
    expect(status.reachable).toBe(false);
    expect(status.error).toContain("Chain id mismatch");
    expect(readContractMock).not.toHaveBeenCalled();
  });

  it("reports a missing configured address without inventing one", async () => {
    vi.stubEnv("GENLAYER_CONTRACT_ADDRESS", "");
    fetchMock.mockResolvedValue(Response.json(rpcBody("0xf22d")));

    const status = await fetchStudioNextContractStatus();

    expect(status.chainId).toBe(61997);
    expect(status.contractAddress).toBeNull();
    expect(status.reachable).toBe(false);
    expect(status.error).toContain("No Studio Next contract address configured");
    expect(readContractMock).not.toHaveBeenCalled();
  });
});
