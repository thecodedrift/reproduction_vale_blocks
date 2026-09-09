import { mkdirSync, statSync, writeFileSync } from "node:fs";

import { FIXTURE_DIR, FIXTURES, REPEAT, SENTENCE } from "./fixtures.mjs";

/**
 * Build the four fixtures.
 *
 * `huge.md` and `wrapped.md` are the controlled pair, and the control is the
 * whole point: same sentence, same repeat count, same resulting alert count.
 * The only difference is the separator — a space keeps the 3 MB as ONE
 * Markdown block, a blank line splits it into 42,500 small ones. Anything that
 * makes them differ in another way (a different sentence, a different count,
 * trimming one of them) destroys the comparison this repository exists to make.
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
