# Design Loop

How we iterate on AutoDelver — the process, not the product.

## The loop in one picture

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │  1. HYPOTHS  │──▶│  2. BUILD    │──▶│  3. PLAYTEST │
 │  "what if?"  │   │  smallest    │   │  me + 1 more │
 │              │   │  testable    │   │              │
 └──────────────┘   └──────────────┘   └──────┬───────┘
        ▲                                     │
        │                                     ▼
 ┌──────┴───────┐   ┌──────────────┐   ┌──────────────┐
 │  6. DECIDE   │◀──│  5. REVIEW   │◀──│  4. MEASURE  │
 │  keep/cut/   │   │  against     │   │  telemetry   │
 │  mutate      │   │  pillars     │   │  + notes     │
 └──────────────┘   └──────────────┘   └──────────────┘
```

One full lap = **one week** during active development.

## 1. Hypothesis

Every change starts as a written hypothesis in `docs/log/YYYY-MM-DD-<slug>.md`:

> **Hypothesis:** Adding `ctx.predict()` will encourage defensive scripting and reduce "surprise deaths" without making the game trivial.
>
> **Expected signal:** Players who unlock `predict` will survive +20% longer on average; deaths-per-run drops but total deaths stays similar (people push deeper).
>
> **Kill criteria:** If survival time increases *and* depth doesn't, `predict` is a crutch — cut it or nerf it.

No hypothesis, no build. This keeps us honest about *why*.

## 2. Build the smallest testable thing

- Prefer feature flags over forks. Every experimental mechanic is gated behind a flag in `src/config/flags.ts`.
- Target: hypothesis → playable in the build within **one session** (2–3h). If it takes longer, the hypothesis is too big; split it.
- Land it behind the flag, off by default, with telemetry hooks wired in.

## 3. Playtest

Two modes, both required:

- **Solo playtest** — minimum 3 runs with the flag on, 3 with it off. Take rough notes in the log file.
- **One outside playtest** — a friend or the discord channel, cold. They record their screen + narrate. We don't explain the change; we watch what they do.

Playtest lengths:
- Early (pre-MVP): 15 min sessions.
- Mid (MVP+): 30 min sessions.
- Late: full 1-hour sessions with a reset.

## 4. Measure

Telemetry (local-only, opt-in for outside testers):
- Time-to-first-descend (writing phase length)
- Tick count per run, depth reached, cause of death
- Edits per death (how many script changes between deaths)
- API usage frequency (which methods get called)
- "Rage quit" signal: close-tab within 30s of a death

Qualitative:
- Did the tester laugh? Curse? Lean in?
- At what moment did they first *re-read* their own script?
- What did they *expect* an API to do that it didn't?

## 5. Review against the pillars

For each change, re-check the five pillars from `CONCEPT.md`:

| Pillar | Question |
|---|---|
| Code is the verb | Did this make scripting richer, or did it add a click-based shortcut? |
| Failure is legible | Can a dead delver's cause be named in one sentence? |
| Emergent coordination | Does this reward multi-delver interaction? (N/A is a valid answer.) |
| Idle-respectful | Does this punish offline play? Does it punish presence? |
| Readable by default | Can a new player read a sample using this feature in 30s? |

Any "no" requires a written defense or a revision.

## 6. Decide: keep / cut / mutate

Three outcomes, no fourth:

- **Keep** — flag stays on by default, feature becomes canonical, docs updated.
- **Cut** — flag removed, code deleted (not commented out). The log entry becomes the memorial.
- **Mutate** — flag stays off, hypothesis rewritten based on what we learned, re-enter loop at step 1.

"Let's leave it and decide later" is a cut in disguise. Decide.

## Rhythms and ceremonies

**Daily:** Work on the top flag from the queue. Update the log as you go.

**Weekly (Friday):** "Descent Review." 30 min.
- Walk through the week's log entries.
- Run the pillar check for each.
- Decide keep/cut/mutate for anything ready.
- Pick next week's top 1–2 hypotheses.

**Monthly:** "Depth Check." 2 hours.
- Play a full run ourselves, pillar-by-pillar.
- Diff against the roadmap — are we still building the right game?
- Update `ROADMAP.md` if priorities shifted.

**Quarterly:** External playtest batch. 5+ testers. Record, collate, compress into top-5 issues.

## The log folder

```
docs/log/
  2026-05-02-ctx-predict.md      # hypothesis + outcome
  2026-05-09-healer-signals.md
  2026-05-16-tick-budget-nerf.md  [cut]
```

Each entry is a living doc: hypothesis → build notes → playtest notes → decision. When a feature is cut, the entry stays as a gravestone.

## Anti-process rules

To keep the loop from becoming a cage:
- **Spike first when unsure.** If a hypothesis is murky, spike a prototype in an afternoon, *then* write the hypothesis. Don't ceremony-first an unknown.
- **One "vibes" change per month is allowed** — a pure feel/aesthetic change without a measured hypothesis. Games need soul.
- **Cut is the default.** When in doubt at review, cut. Games die from accretion, not from missing features.
