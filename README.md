# Vale block-size reproduction

Two defects in [Vale](https://vale.sh) 3.20.0, reproduced with one config, one
rule, and four generated Markdown files.

1. **Lint cost tracks the size of a single Markdown block, not the size of the
   file.** 3 MB written as one block takes ~80 s. The same sentences, same
   count, with a blank line after each take ~4 s, from a file that is *larger*
   on disk and produces the *identical* alert count.
2. **Vale writes nothing until every file has been linted.** A run interrupted
   part-way emits zero bytes, so files that finished in milliseconds lose their
   alerts along with the slow one.

Finding 2 is what makes finding 1 matter. A slow file on its own is just slow.
With no partial output, one slow block costs an entire run its findings under
any external time limit: a CI step timeout, an editor integration, a pre-commit
hook.

`BUG-REPORT.md` is the writeup, with equivalent plain-`sh` commands for anyone
who would rather not run a Node script.

## Running it

```sh
npm install
npm run fixture:create
npm run bug:reproduce
```

Budget about three minutes. `bug:reproduce` lints the 3 MB single-block file
twice, and that file is the slow one by design. A discarded warm-up run goes
first, so the cost of paging in a 44 MB binary does not land on whichever
measurement happens to run first.

Measured on darwin/arm64, macOS 26.5.1, Apple silicon:

```
## Finding 1 — cost tracks single-block size, not file size

the two small files alone           13 ms
huge.md    (one block)           81090 ms   42,500 alerts
wrapped.md (many blocks)          4415 ms   42,500 alerts

## Finding 2 — nothing is written until the whole run finishes

small + small + huge, to completion     81345 ms
same run, killed after 5s                0 bytes in 0 chunks (signal SIGTERM)
```

## How it is put together

| path | what it is |
| --- | --- |
| `.vale.ini` | Applies one rule to every Markdown file |
| `styles/Repro/Hedging.yml` | An `existence` rule matching `simply` and `basically` |
| `scripts/fixtures.mjs` | The shared sentence, repeat count, and fixture paths |
| `scripts/create-fixtures.mjs` | `npm run fixture:create` |
| `scripts/reproduce.mjs` | `npm run bug:reproduce` |
| `scripts/vale-binary.mjs` | Resolves the vendored binary for this host |

Vale arrives as an npm dependency rather than a checked-in binary or a
`brew install` step, so the version under test is pinned in `package.json` and
identical on every machine. The `@taskless/vale-*` packages are published from
[taskless/cli](https://github.com/taskless/cli) as `@taskless/vale-<os>-<cpu>`,
using node's own `process.platform` and `process.arch` spellings. All six are
`optionalDependencies` with `os`/`cpu` constraints, so `npm install` fetches
exactly the one your host can run. Prebuilt binaries cover darwin, linux, and
win32 on arm64 and x64. On any other host, `bug:reproduce` names the missing
package rather than failing obscurely.

## The controlled pair

`huge.md` and `wrapped.md` are the experiment. Everything about them is held
constant except the separator:

| | `huge.md` | `wrapped.md` |
| --- | --- | --- |
| sentence | identical | identical |
| repetitions | 42,500 | 42,500 |
| separator | `" "` | `"\n\n"` |
| bytes | 3,187,511 | 3,230,010 |
| alerts | 42,500 | 42,500 |
| time | ~78 s | ~4.4 s |

If you edit the fixtures, keep that invariant. Change the sentence, change the
count, or trim one of the two, and the comparison is no longer evidence. The
equal alert counts are what rule out "one file simply had more work to do".

## Expected behaviour

Either of these independently removes the practical damage, so neither depends
on the other:

- Alerts for files that have been linted are written as they complete, so an
  interrupted run still reports what it finished.
- Lint time for a block of size N does not grow faster than linearly in N.
