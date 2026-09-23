import { NextResponse } from "next/server";
import { fetchStudioNextContractStatus } from "@/lib/genlayer/studionext";

export const dynamic = "force-dynamic";

type CachedStatus = { payload: unknown; expiresAt: number };

// 60-second cache: keeps the home page fast while staying near-live. Studio
// Next is a preview network; state there changes on the scale of minutes.
let cache: CachedStatus | null = null;
const CACHE_MS = 60_000;

/**
 * Live Studio Next contract status — every field comes from a real RPC read
 * performed just now (chain id, contract view calls). Never throws: failures
 * are reported as data (`reachable: false` + `error`), so the badge can show
 * an honest OFFLINE state instead of a stale or fabricated one.
 */
export async function GET() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return NextResponse.json(cache.payload);
  }

  const status = await fetchStudioNextContractStatus();
  cache = { payload: status, expiresAt: now + CACHE_MS };
  return NextResponse.json(status);
}
