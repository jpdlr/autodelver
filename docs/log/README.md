# Design Log

One file per hypothesis. Naming: `YYYY-MM-DD-<slug>.md`.

See [`../DESIGN_LOOP.md`](../DESIGN_LOOP.md) for the full process.

## Template

```markdown
---
date: YYYY-MM-DD
status: open | kept | cut | mutated
flag: flagName (if applicable)
---

# Short title

## Hypothesis
What do we think is true? What change are we making?

## Expected signal
How will we know it worked? Numbers where possible.

## Kill criteria
What would make us cut this?

## Build notes
What we actually shipped, links to commits.

## Playtest notes
Solo + outside observations.

## Pillar check
- Code is the verb: ✓ / ✗ / n/a
- Failure is legible: ✓ / ✗ / n/a
- Emergent coordination: ✓ / ✗ / n/a
- Idle-respectful: ✓ / ✗ / n/a
- Readable by default: ✓ / ✗ / n/a

## Decision
Keep / Cut / Mutate — and why.
```
