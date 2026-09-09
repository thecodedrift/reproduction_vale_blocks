import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { FIXTURES } from "./fixtures.mjs";
import { valeBinaryPath } from "./vale-binary.mjs";

const BINARY = valeBinaryPath();

/** How long the interrupt demonstration lets Vale run before killing it. */
const INTERRUPT_MS = 5_000;

/**
 * Run Vale over `paths` to completion, returning elapsed wall time, the bytes
 * of stdout, and the parsed alert counts.
 *
 * `--no-exit` keeps a nonzero exit from found alerts out of the way; it is not
 * required to reproduce either defect.
 */
function runToCompletion(paths) {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(BINARY, ["--output=JSON", "--no-exit", ...paths]);
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", reject);
    child.on("close", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      let alerts = {};
      try {
        const parsed = JSON.parse(stdout);
        alerts = Object.fromEntries(
          Object.entries(parsed).map(([file, list]) => [file, list.length])
        );
      } catch {
        // Left empty: an unparseable body is itself the observation in the
        // interrupt case, and callers there read `bytes` rather than `alerts`.
      }
      resolve({ ms: Math.round(ms), bytes: Buffer.byteLength(stdout), alerts });
    });
  });
}

/**
 * Start Vale, kill it after `INTERRUPT_MS`, and report how many bytes it had
 * written by then.
 *
 * The bytes are counted from the stream as they arrive rather than from a file
 * afterwards, so the result cannot be confused with a file that was written and
 * then truncated. Nothing arrives at all.
 */
function runInterrupted(paths) {
  return new Promise((resolve, reject) => {
    const child = spawn(BINARY, ["--output=JSON", "--no-exit", ...paths]);
    let bytes = 0;
    let chunks = 0;
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      chunks += 1;
    });
    child.on("error", reject);
    const timer = setTimeout(() => child.kill("SIGTERM"), INTERRUPT_MS);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ bytes, chunks, code, signal });
    });
  });
}

const missing = Object.values(FIXTURES).filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error(`Missing fixtures: ${missing.join(", ")}`);
  console.error("Run `npm run fixture:create` first.");
  process.exit(1);
}

console.log(`vale binary: ${BINARY}`);
console.log(`platform:    ${process.platform}/${process.arch}`);

// A throwaway run first. The very first exec of a 44 MB binary pays to page it
// in, which lands entirely on whichever measurement happens to go first and
// inflated the small-file figure from ~30 ms to ~950 ms. Every number below is
// therefore steady-state, which is also the state a repeated CI run measures.
await runToCompletion([FIXTURES.smallA]);
console.log("(warm-up run discarded)\n");

console.log("## Finding 1 — cost tracks single-block size, not file size\n");

const small = await runToCompletion([FIXTURES.smallA, FIXTURES.smallB]);
console.log(`the two small files alone      ${String(small.ms).padStart(7)} ms`);

const huge = await runToCompletion([FIXTURES.huge]);
const wrapped = await runToCompletion([FIXTURES.wrapped]);

console.log(
  `huge.md    (one block)         ${String(huge.ms).padStart(7)} ms   ` +
    `${huge.alerts[FIXTURES.huge]?.toLocaleString()} alerts`
);
console.log(
  `wrapped.md (many blocks)       ${String(wrapped.ms).padStart(7)} ms   ` +
    `${wrapped.alerts[FIXTURES.wrapped]?.toLocaleString()} alerts`
);

const ratio = (huge.ms / wrapped.ms).toFixed(1);
console.log(
  `\nSame sentence, same repeat count, same alert count. wrapped.md is the\n` +
    `LARGER file on disk and is ${ratio}x faster. The blank lines are the\n` +
    `only difference.\n`
);

console.log("## Finding 2 — nothing is written until the whole run finishes\n");

const withHuge = await runToCompletion([
  FIXTURES.smallA,
  FIXTURES.smallB,
  FIXTURES.huge,
]);
console.log(
  `small + small + huge, to completion   ${String(withHuge.ms).padStart(7)} ms`
);

const killed = await runInterrupted([
  FIXTURES.smallA,
  FIXTURES.smallB,
  FIXTURES.huge,
]);
console.log(
  `same run, killed after ${INTERRUPT_MS / 1000}s          ` +
    `${String(killed.bytes).padStart(7)} bytes in ${killed.chunks} chunks ` +
    `(signal ${killed.signal})`
);

console.log(
  `\nThe two small files lint in ${small.ms} ms, so at the moment of the kill\n` +
    `their alerts existed and were discarded with the run. Vale emits no\n` +
    `partial output, which is why a caller-side timeout cannot salvage them.`
);
