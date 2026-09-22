# Redeploy runbook — studio-dev (Studio Next, 61997) reset

GenLayer's official docs state studio-dev is a temporary RC preview network:
**"expect resets."** When it resets, the contract and every stored verification
vanish. This runbook restores the exact stack end-to-end — same tooling, same
gates, no improvisation — and re-points the steward submission. Typical time:
**~15 minutes** (10 of it waiting for consensus).

The Bradbury 4221 path is never touched by any step here.

---

## 0. Known-good reference values (pre-reset run, Sep 21–22 2026)

| Item | Value |
|---|---|
| Contract address | `0xEd091f5d891274864eAeE0f1E388dDa14e5ee1cE` |
| Deployment tx | `0xc4a42255f728b71a881d9e20ed5c0d3f85e195cc938f95b7307f1c9674332076` |
| Verification tx (PASS 3/3) | `0xdeaf14db37230f98a4de3b975c3f8d0f170bcc04096518bd07222e2433e1962a` |
| Verification ID | `f0f3b22d-3879-4236-a327-9db10dcdfc6e` |
| Verification tx (LLM divergence case) | `0x338cb850d8ebcedf10558e415021b5d164b114d1fd572a49f77ee1746975805d` |
| Wallet | `0x6f69286d7c51de0f0cf5f3c03c8ca3eda8a322f9` |

Toolchain pins (must match — do not upgrade mid-runbook):

- `genlayer-js` **2.0.0-rc.1** (deploy/studionext; aliased `genlayer-js-rc` in frontend)
- `genlayer-py` **0.19.0rc2**, `genlayer-test` **0.30.0rc2**, `genvm_linter` **0.11.1rc2**, `genvm-universal` **v0.6.0-rc6**
- Contract pin: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

Commit chain: `2b719f3` (RC migration) → `1dcc956` (deploy tooling) →
`44f4b32` (frontend wiring) → `72fd91a` (divergence UX).

## 1. Detect the reset (read-only, no signing)

```bash
cd deploy/studionext
node tx-facts.mjs 0xc4a42255f728b71a881d9e20ed5c0d3f85e195cc938f95b7307f1c9674332076
```

- **RPC error / not found** → chain was reset (or down). Confirm the chain
  itself is back: `curl -s https://studio-dev.genlayer.com/api -X POST -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'`
  must return `0xf22d`.
- **Returns FINALIZED but the explorer shows a fresh contract** → verify
  whether the address still executes (view call via `verify-deployment.mjs`).
  A reset zeroes balances too: the wallet will need faucet funds again.

Do not redeploy until `eth_chainId` returns `0xf22d` and the faucet has funded
the wallet (Studio UI 💧 button / `rpcClient.fundAccount`).

## 2. Preconditions (2 minutes)

```bash
git log --oneline -6        # commit chain above present; working tree clean
node --version              # >= 20 (crypto.getRandomValues in deploy page)
cd deploy/studionext && npm install && npm run build   # bundles the CURRENT contracts/AgentzProofVerifier.py
```

Browser wallet: MetaMask active on **Studio Next (61997 / 0xf22d)**, funded
(≈0.3 GEN is plenty; a deployment consumes ~0.0003, verification ~0.1 deposit,
mostly refunded).

## 3. Redeploy the contract (Phase A)

```bash
npm run serve    # http://127.0.0.1:8642/deploy.html — open it + console (F12)
```

1. The page verifies `eth_chainId` itself and refuses otherwise.
2. Click **Deploy** → wallet confirmation → wait for `FINALIZED` +
   `FINISHED_WITH_RETURN`, then code read-back with the RC pin → `SUCCESS`.
3. The hash is persisted to
   `localStorage["agentzproof.studionext.deploymentState"]` the moment the
   provider returns it. If a submission dies before a hash is recorded, the
   tool locks `SUBMITTING` and **refuses** to resubmit — do not force it; use
   `window.recoverInterruptedDeploymentStudioNext()` only to record a proven
   outcome (no arg = nothing was broadcast; with a hash = record FAILED).
   Never redeploy "just in case" — that is how duplicate contracts happen.

Record now: `NEW_DEPLOYMENT_TX`, `NEW_CONTRACT_ADDRESS` (from the page output).

## 4. Independent deployment verification (Phase B — never skip)

```bash
node verify-deployment.mjs <NEW_DEPLOYMENT_TX> [<NEW_CONTRACT_ADDRESS>]
```

Exit 0 requires: raw `eth_chainId` == `0xf22d` · receipt `FINALIZED` +
`FINISHED_WITH_RETURN` · non-empty address · deployed code contains the RC
pin. The script is read-only; a failure here is a hard stop.

## 5. Re-point the live app (Phase C)

Edit `frontend/.env.local` (never commit it):

```
GENLAYER_NETWORK=studioDevnet
GENLAYER_CONTRACT_ADDRESS=<NEW_CONTRACT_ADDRESS>
```

Keep `DATA_FILE` pointing at the persistence JSON — old records reference a
dead contract after a reset, so archive that file instead of carrying it
forward. Restart the dev server. Sanity check: any page hitting the verifier
must show the new address, and no `GENLAYER_PRIVATE_KEY` may be set for the
studioDevnet network (signing is wallet-only by design).

## 6. Run the fresh on-chain verification (Phase D)

Through the **published app flow** (this is what the steward asks for — not a
script): create the verification, submit the deliverable, then open
`/verify/<id>` and approve the one wallet signature for the `verify` write on
the new contract.

Requirements recipe that reliably converges on studio-dev (proven in the
pre-reset run): use **deterministic checks only** (`function_exists`,
`string_present`, `reported`). Free-text/LLM-judged requirements can diverge
(`MAJORITY_DISAGREE`) — legitimate on-chain behavior, but it stores nothing
and won't satisfy the "completed verification" request. If it diverges, the
app now shows the amber DIVERGED panel with the tx evidence; just rerun with
deterministic checks.

Record now: `NEW_VERIFICATION_ID`, `NEW_VERIFICATION_TX`.

## 7. Independent verification of the verification (Phase E)

1. `node tx-facts.mjs <NEW_VERIFICATION_TX>` → `FINALIZED`,
   `FINISHED_WITH_RETURN`, `MAJORITY_AGREE`.
2. Contract read-back via the RC SDK: `get_verification_ids` contains
   `<NEW_VERIFICATION_ID>`; `get_verification` returns decision `PASS`
   (for a converged run).
3. Optional UI check: reload `/verify/<NEW_VERIFICATION_ID>` — the proof panel
   must render from the persisted on-chain result.

## 8. Re-point the steward submission (Phase F)

Paste-only-changed-values template (all values must come from Phases B–E,
never inferred):

```
Studio Next contract (chain 61997): <NEW_CONTRACT_ADDRESS>
Contract link: https://explorer-studio-dev.genlayer.com/address/<NEW_CONTRACT_ADDRESS>

Completed on-chain verification via the app flow: ID <NEW_VERIFICATION_ID>; tx
<NEW_VERIFICATION_TX> (browser-wallet signed, AgentzProof app). FINALIZED,
FINISHED_WITH_RETURN, MAJORITY_AGREE. Contract read-back (get_verification):
PASS, 3/3 requirements, score 1.0.
Proof link: https://explorer-studio-dev.genlayer.com/tx/<NEW_VERIFICATION_TX>
Deployment tx: <NEW_DEPLOYMENT_TX> — FINALIZED, RC py-genlayer pin verified in
deployed code. Toolchain: genlayer-js 2.0.0-rc.1, genlayer-py 0.19.0rc2,
genvm-universal v0.6.0-rc6. Previous run (pre-reset): contract
0xEd091f5d891274864eAeE0f1E388dDa14e5ee1cE, tx 0xdeaf14db…e1962a — network was
reset per vendor docs ("expect resets"); this is the redeployed contract.
```

The hackathon form's "Studio Next contract link" field takes **only** the
address URL (plain text — markdown backticks have broken that form before).

## Never-do list (unchanged from the original brief)

- Never request/use a private key, seed phrase, or wallet export.
- Never auto-redeploy after an uncertain submission — resume by hash.
- Never record a value the chain did not return.
- Never weaken the gates in `verify-deployment.mjs` to make a check pass.
