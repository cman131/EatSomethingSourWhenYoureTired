---
name: fix-linting
description: Use when `ng lint` or ESLint reports multiple violations across multiple files in an Angular/SKY-UX project. Applies when errors span several rules and files and the instinct is to fix them error-by-error in file order.
---

# Resolving Angular/SKY-UX Lint Violations

## Overview

When `ng lint` reports dozens of errors, the natural instinct is to fix them top-to-bottom, file-by-file.
That approach misses root causes and multiplies work. The technique: **group by ESLint rule, trace each
cluster to one root cause, and fix the root** — collapsing many errors into a few targeted changes.

## When to Use

- `ng lint` reports 10+ errors across multiple files
- Errors span several ESLint rule names
- You want to close all errors with the fewest fixes

**When NOT to:** a single error in a single file — just fix it directly.

## The Technique (5 steps)

### Step 1: Run lint and capture output

```bash
node node_modules/@angular/cli/bin/ng.js lint 2>&1
```

> **Environment quirk:** `node` is only on PATH in the **Bash** tool (Git Bash), not PowerShell.
> Always run lint this way.

### Step 2: Pivot by rule, not by file

Re-read the output grouped by ESLint rule name, ignoring file ordering. Count errors per rule.
This turns "50 errors in 8 files" into "5 clusters of 1–12 errors each" and reveals where to look first.

### Step 3: Diagnose each cluster — the key diagnostic signal

**"error typed" vs "any typed" messages are different problems:**

| Message contains      | Meaning                                                                               | Action                                                                   |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `"error typed value"` | A TypeScript type error is cascading — usually a **broken or unresolved import**      | Investigate the import chain; the root is structural, not a typing tweak |
| `"any typed value"`   | Loose typing — an `as any` cast, untyped spy, or raw `DebugElement.componentInstance` | Fix the typing at the source                                             |

**"error typed" clusters are highest priority** — they often also break compilation and tests.

### Step 4: Match the fix to the root cause (not the symptom)

| Rule                                | Common root cause                                     | Fix                                                        |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `no-unsafe-*` **"error typed"**     | Broken import (module deleted/renamed)                | Remove the import _and_ every usage (provider, stub, etc.) |
| `no-unsafe-*` **"any typed"**       | `as any` cast or untyped spy/component instance       | Cast via scoped type alias: `as unknown as MyInternals`    |
| `no-explicit-any`                   | Direct `as any`                                       | `as unknown as T` or a typed local variable                |
| `no-unused-vars` on a mock param    | `get: (_key: string) => undefined`                    | Drop the param: `get: () => undefined`                     |
| `non-nullable-type-assertion-style` | `foo as SomeType` where `!` would suffice             | `const x: SomeType = foo!`                                 |
| `no-duplicate-imports`              | Two import lines from the same module                 | Merge into one line                                        |
| `no-deprecated`                     | Using a SKY UX legacy service/component               | **Decision point — see below**                             |
| `explicit-member-accessibility`     | Class property missing `public`/`protected`/`private` | Add the modifier                                           |

#### The `no-deprecated` decision point

Before migrating a deprecated API, determine whether the team _chose_ to keep it:

- **Unintentional** (team wasn't aware) → migrate to the recommended replacement.
- **Deliberate** (migration deferred, breaking change risk, etc.) → suppress with
  `// eslint-disable-next-line @typescript-eslint/no-deprecated` at each **usage site**.

> The rule fires at usage sites, not import declarations. Disabling on the import line has no effect.
> Never suppress globally (e.g. in `eslint.config.js`) for a single known-deprecated API.

### Step 5: Fix one cluster, re-run lint, repeat

After each root-cause fix, re-run lint before the next cluster. A single fix can clear 4–10 errors at
once and may reveal follow-on issues (e.g. a now-unused `eslint-disable` directive, a merged import
creating `no-duplicate-imports`). Re-running keeps the count accurate.

After all lint errors are gone, run tests:

```bash
node node_modules/@angular/cli/bin/ng.js test --watch=false
```

> **`--watch=false` is mandatory** — Karma runs in watch mode by default and hangs indefinitely.

## Worked Example: The Dead-Mock Cluster

**Symptom:** 4 errors in 4 spec files — all `no-unsafe-assignment`, all "error typed value", each on a
`TestBed.configureTestingModule` call.

**Investigation:** Each file imports `LegacyIdMappingService` from
`'../../../core/api/ppl-persn/services/legacy-id-mapping.service'`. The `ppl-persn/` folder no longer
exists (the API client was regenerated under a new name). TypeScript resolves the import to an error type,
which cascades into `TestBed.configureTestingModule` and its return value.

**One root cause:** the import path is dead.

**One fix per file (3 lines deleted):**

1. Delete the `LegacyIdMappingService` import line.
2. Delete the `{ provide: LegacyIdMappingService, useValue: ... }` provider object.
3. Remove `of` from the `rxjs` import if no longer used.

**Result:** 4 errors → 0, across 4 files.

## Common Mistakes

| Mistake                                                     | Why it's wrong                                                      | Better approach                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Fix in file-output order                                    | Misses shared root causes; 4× the work                              | Group by rule first                                   |
| Treat "error typed" like "any typed"                        | "error typed" signals a broken import, not loose typing             | Check the import chain                                |
| Add `as any` to silence a type error                        | Introduces 3+ new `no-unsafe-*` errors                              | Use `as unknown as T` with a scoped type alias        |
| Migrate `no-deprecated` without checking intent             | May conflict with team's deliberate deferral                        | Confirm intentional vs unintentional before migrating |
| Add `eslint-disable` on the import line for `no-deprecated` | Rule fires at usage sites, not imports; the directive has no effect | Suppress at each usage site                           |
| Skip the post-cluster lint re-run                           | Follow-on errors (unused disable, duplicate imports) go undetected  | Re-run after each cluster                             |
