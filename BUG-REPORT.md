# Lint time is superlinear in the size of a single block, and no output is emitted until every file finishes

**Vale version:** 3.20.0
**Platform:** darwin/arm64, macOS 26.5.1 (Apple silicon)
**Config:** the `.vale.ini` and one-rule style below; no other styles installed

## Summary

Two findings, the second of which turns the first from "slow" into "silent".

1. Lint time scales with the size of a single Markdown **block**, not with file
   size. A 3 MB file written as one block takes **80.7 s**; the same sentences,
   same count, with a blank line after each, take **4.2 s**. The second file is
   *larger* on disk and produces the *identical* 42,500 alerts.
2. Vale writes nothing until every file has been linted. A run interrupted
   part-way emits **zero bytes**, so the results for files that finished in
   milliseconds are lost along with the slow one. This holds for
   `--output=JSON`, `--output=line`, and the default CLI output.

Together these mean one large file does not merely delay a run, it can cost the
entire run its findings under any external time limit (CI step timeout, editor
integration, pre-commit hook).

## Reproduction

The commands below are self-contained plain `sh`. This repository also runs the
same experiment through `npm run fixture:create` and `npm run bug:reproduce`,
which pin the Vale version via npm rather than relying on whichever build is on
your PATH.

### Config

`.vale.ini`:

```ini
StylesPath = styles
MinAlertLevel = suggestion

[**/*.md]
Repro.Hedging = warning
```

`styles/Repro/Hedging.yml`:

```yaml
extends: existence
message: "Avoid hedging: '%s'"
level: warning
ignorecase: true
tokens:
  - simply
  - basically
```

### Script 1 — two normal-sized files

```sh
printf 'This is simply a small file.\n'          > small-a.md
printf 'This is basically another small file.\n' > small-b.md
```

### Script 2 — one 3 MB file

The sentence repeats with a trailing space and no blank lines, so the whole
3 MB is a single Markdown block.

```sh
{
  printf '# Heading\n\n'
  i=0
  while [ $i -lt 42500 ]; do
    printf 'This is simply a sentence of prose that a writer might reasonably produce. '
    i=$((i + 1))
  done
  printf '\n'
} > huge.md
```

### Script 3 — the control

The same sentences, the same count, one blank line after each.

```sh
{
  printf '# Heading\n\n'
  i=0
  while [ $i -lt 42500 ]; do
    printf 'This is simply a sentence of prose that a writer might reasonably produce.\n\n'
    i=$((i + 1))
  done
} > wrapped.md
```

## Observed

### The two small files alone: 28 ms

```sh
$ time vale --output=JSON --no-exit small-a.md small-b.md
# 28 ms, both files reported, one alert each
```

### Adding the 3 MB file: 80.7 s

```sh
$ time vale --output=JSON --no-exit small-a.md small-b.md huge.md
# 80703 ms
#   huge.md     42500 alerts
#   small-a.md      1 alert
#   small-b.md      1 alert
```

### Block size is the variable, not file size

```sh
$ time vale --output=JSON --no-exit huge.md      # 80688 ms, 42500 alerts
$ time vale --output=JSON --no-exit wrapped.md   #  4242 ms, 42500 alerts
```

| file          | bytes     | alerts | time     |
| ------------- | --------- | ------ | -------- |
| `huge.md`     | 3,187,512 | 42,500 | 80,688 ms |
| `wrapped.md`  | 3,230,011 | 42,500 |  4,242 ms |

`wrapped.md` is 42 KB larger and 19x faster. The only difference is where the
blank lines are.

Sweeping one block upward, cost grows faster than linearly in block size
(equivalent generated content, single file per run):

| single block | time    |
| ------------ | ------- |
| 128 KB       |  194 ms |
| 256 KB       |  542 ms |
| 512 KB       | 2060 ms |
| 3 MB         | ~80 s   |

The same byte totals split into ordinary paragraphs stay close to linear:
128 KB 42 ms, 256 KB 67 ms, 512 KB 158 ms, 1 MB 485 ms, 3 MB 3855 ms.

### Nothing is emitted until the whole run finishes

Interrupt the run after five seconds, well past the point where both small
files have been linted:

```sh
$ vale --output=JSON --no-exit small-a.md small-b.md huge.md > out.json &
$ sleep 5
$ kill -TERM $!
$ wc -c out.json
0 out.json
```

Zero bytes. The two small files were linted in the first few milliseconds and
their alerts are lost with the run. Same result for `--output=line` and for the
default CLI output, so this is the reporting phase rather than the JSON writer.

## Expected

Some output. Either of these independently addresses it:

- Alerts for files that have been linted are written as they complete, so an
  interrupted run still reports what it finished.
- Lint time for a block of size N does not grow faster than linearly in N.

## Notes

- `--no-exit` is used so a nonzero exit from found alerts does not mask the
  behaviour; it is not required to reproduce.
- Alert counts are equal across the two 3 MB files, so the difference is not
  explained by differing amounts of work.
