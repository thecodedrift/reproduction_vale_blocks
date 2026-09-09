import { mkdirSync, statSync, writeFileSync } from "node:fs";

import { FIXTURE_DIR, FIXTURES, REPEAT, SENTENCE } from "./fixtures.mjs";

/**
 * Build a large fixture: the shared sentence repeated `REPEAT` times, joined by
 * `separator`.
 *
 * A space keeps the whole 3 MB as ONE Markdown block; a blank line splits it
 * into 42,500 small ones. That separator is the only thing `huge.md` and
 * `wrapped.md` may differ in. See "The controlled pair" in the README before
 * changing the sentence, the count, or either fixture.
 */
function build(separator) {
  return `# Heading\n\n${new Array(REPEAT).fill(SENTENCE).join(separator)}\n`;
}

mkdirSync(FIXTURE_DIR, { recursive: true });

writeFileSync(FIXTURES.smallA, "This is simply a small file.\n");
writeFileSync(FIXTURES.smallB, "This is basically another small file.\n");
// A single space: the whole file is one block.
writeFileSync(FIXTURES.huge, build(" "));
// A blank line: the same text as many small blocks.
writeFileSync(FIXTURES.wrapped, build("\n\n"));

for (const path of Object.values(FIXTURES)) {
  const { size } = statSync(path);
  console.log(`${path.padEnd(22)} ${size.toLocaleString().padStart(11)} bytes`);
}
