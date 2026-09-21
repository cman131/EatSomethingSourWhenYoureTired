# Ranked League Rules & Etiquette Sections - Design

## Goal

Let players check the rules and the etiquette video from the Ranked League page, the same way they can on the Tournament Detail page. Ranked league games use the WRC 2025 ruleset and are played in person.

## Approach

Reuse the existing components unchanged:

- `client/src/components/tournaments/RulesDisplay.tsx`
- `client/src/components/tournaments/EtiquetteDisplay.tsx`

Both are self-contained (no tournament data dependency) and wrap `CollapsibleSection`, so they start collapsed. Only `client/src/pages/RankedLeague.tsx` changes.

## Changes to `RankedLeague.tsx`

- Import `EtiquetteDisplay` and `RulesDisplay`.
- In the loaded-league branch, after the Unranked card, render:
  - `<EtiquetteDisplay />`
  - `<RulesDisplay ruleset="WRC2025" />`
- Do not pass `startingPointValue` or `modifications`; the ranked league has neither, so the WRC 2025 link and Penalties Reference link are all that show.
- The sections render only alongside league content, so they add no new loading or error states.

## Behavior notes

- Order matches the tournament page: Etiquette, then Rules.
- Both sections use the same localStorage keys as on the tournament page (`etiquetteDisplayExpanded`, `rulesDisplayExpanded`), so a player's open/closed preference is shared across pages. This is intentional.

## Testing

Add `client/src/pages/__tests__/RankedLeague.test.tsx`, following the mocking pattern in `TournamentDetail.test.tsx`:

- Renders "Etiquette" and "Rules" section headings once the league has loaded.
- The Rules section links to the WRC 2025 PDF and the penalties page when expanded.
- Neither section is shown while the league is loading.

Written test-first.

## Out of scope

- Refactoring the two components or moving them out of `components/tournaments/`.
- Ranked-league-specific rules content (starting points, modifications).
