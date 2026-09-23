import { NextResponse } from "next/server";
import { verificationStore } from "@/lib/store/verification-store";

export const runtime = "nodejs";

/**
 * Persist the REAL transaction hash returned by the browser wallet after the
 * client signed and submitted the Studio Next `verify` write (chain 61997).
 *
 * The server never fabricates, guesses, or accepts a simulated hash: only a
 * well-formed 0x-prefixed 64-hex value is accepted, and only for a
 * verification that is currently VERIFYING without a recorded hash. Finalize
 * polling then resumes on this same hash server-side, keyless.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { transactionHash?: unknown };
    const hash = typeof body.transactionHash === "string" ? body.transactionHash.trim() : "";
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return NextResponse.json(
        { error: "A valid 0x-prefixed 64-hex transaction hash is required." },
        { status: 400 },
      );
    }

    const verification = await verificationStore.get(id);
    if (!verification) {
      return NextResponse.json({ error: "Verification not found." }, { status: 404 });
    }
    if (verification.txHash === hash) {
      // Idempotent: the client may retry posting the same hash.
      return NextResponse.json({ status: "VERIFYING", transactionHash: hash }, { status: 202 });
    }
    if (verification.txHash) {
      return NextResponse.json(
        { error: "A different transaction hash is already recorded for this verification." },
        { status: 409 },
      );
    }
    if (verification.status !== "VERIFYING") {
      return NextResponse.json(
        { error: `Verification is ${verification.status}; expected VERIFYING.` },
        { status: 409 },
      );
    }

    const updated = await verificationStore.update(id, { txHash: hash });
    if (!updated) {
      return NextResponse.json({ error: "Verification not found." }, { status: 404 });
    }
    return NextResponse.json({ status: "VERIFYING", transactionHash: hash }, { status: 202 });
  } catch (err) {
    console.error(`POST /api/verifications/${id}/verify-hash failed`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
