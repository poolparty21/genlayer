/**
 * Read-only diagnostic: fetch a Studio Next transaction by hash and print the
 * chain-recorded facts. Never signs or submits anything.
 *
 * Usage: node tx-facts.mjs <txHash>
 */
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const hash = process.argv[2];
if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
  console.error("Usage: node tx-facts.mjs <txHash>");
  process.exit(1);
}

const client = createClient({ chain: studioDevnet });
const tx = await client.getTransaction({ hash });

console.log(JSON.stringify(
  tx,
  (key, value) => (typeof value === "bigint" ? value.toString() : value),
  2,
));
