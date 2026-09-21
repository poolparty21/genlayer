# Studio Next (chain 61997) deployment — AgentzProofVerifier

Isolated browser-wallet deployment for **GenLayer Studio Devnet (Studio Next,
chain 61997 / 0xf22d, RPC `https://studio-dev.genlayer.com/api`)** using the
matching **genlayer-js 2.0.0-rc.1** RC SDK (`studioDevnet` chain definition).

The Bradbury 4221 deployment path (`scripts/deploy-browser.ts` +
genlayer-js 1.1.8) is untouched and uses its own storage keys.

## Files

- `src/deploy-studionext.ts` — deployment utility (browser wallet flow).
  Bundles `contracts/AgentzProofVerifier.py` from the repo at build time.
- `verify-deployment.mjs` — **non-mutating** independent verification: re-reads
  the transaction and deployed code from the canonical RPC.
- `deploy.html` — minimal loader page for the bundle.

## Deploy

```bash
npm install          # already done if node_modules exists
npm run build        # produces deploy.bundle.js (1.3 MB, includes contract)
npm run serve        # http://127.0.0.1:8642/deploy.html
```

1. Open `http://127.0.0.1:8642/deploy.html` and the browser console (F12).
2. Switch the wallet to Studio Next (61997 / 0xf22d) if needed. The script
   verifies `eth_chainId` itself and refuses otherwise.
3. Click **Deploy**. The page prints network / chain id / contract / action and
   asks for confirmation; the wallet then shows its own confirmation UI.
4. On submission the transaction hash is persisted to
   `localStorage["agentzproof.studionext.deploymentState"]` (key `PENDING`)
   immediately. If the provider fails before returning a hash, the state stays
   `SUBMITTING` and the tool **refuses** to submit again; use
   `window.recoverInterruptedDeploymentStudioNext()` only to clear a proven
   stale lock (no argument: records `RECOVERED` — used when nothing was
   broadcast; with a `0x…` hash: records `FAILED` with that hash preserved —
   used when a submission produced an on-chain transaction that later
   reverted).
5. The tool waits for `FINALIZED` **and** requires
   `FINISHED_WITH_RETURN`, then reads back the deployed code via
   `getContractCode` before reporting `SUCCESS`.
6. Record the printed values. There is no re-deploy path: a repeat click
   resumes the persisted hash, it never submits a second transaction.

## Verify independently

```bash
node verify-deployment.mjs <deploymentTxHash> [contractAddress]
```

Checks, in order: raw `eth_chainId` == `0xf22d`; receipt `FINALIZED` +
`FINISHED_WITH_RETURN`; contract address extraction (receipt or CLI arg);
deployed code exists on-chain and contains the RC pin
`py-genlayer:5jycge4q8k…`. Read-only; exits non-zero on any failure.

## Explorer

The RC SDK ships `studioDevnet` with **no block explorer**
(`blockExplorers: undefined`): the stable Studio explorer does not index this
preview chain. The tool records `explorerUrl: null` rather than guessing.
Independent verification is RPC-based (script above).
