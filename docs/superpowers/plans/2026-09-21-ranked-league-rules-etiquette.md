# Ranked League Rules & Etiquette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the collapsible Rules (WRC 2025) and Etiquette video sections on the Ranked League page.

**Architecture:** Reuse the existing `RulesDisplay` and `EtiquetteDisplay` components unchanged. Render them in `RankedLeague.tsx` inside the loaded-league branch, after the Unranked card. Spec: `docs/superpowers/specs/2026-09-21-ranked-league-rules-etiquette-design.md`.

**Tech Stack:** React 18, TypeScript, Jest + React Testing Library (via `react-scripts test`).

**Branch:** `feature/ranked-league-rules-etiquette` (already created; the spec is committed there).

---

## File Structure

- Modify: `client/src/pages/RankedLeague.tsx` — add two imports and render the two sections.
- Create: `client/src/pages/__tests__/RankedLeague.test.tsx` — page-level test. The real `RulesDisplay`, `EtiquetteDisplay` and `CollapsibleSection` are used (not mocked) so the test proves the sections actually appear.

No changes to `RulesDisplay`, `EtiquetteDisplay`, or `CollapsibleSection`.

---

### Task 1: Add Rules and Etiquette sections to the Ranked League page

**Files:**
- Create: `client/src/pages/__tests__/RankedLeague.test.tsx`
- Modify: `client/src/pages/RankedLeague.tsx` (imports at lines 1-7; render block after the Unranked card, currently ending at line 176)

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/__tests__/RankedLeague.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RankedLeague from '../RankedLeague';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../services/api', () => ({
  rankedLeaguesApi: {
    getCurrent: jest.fn(),
    joinLeague: jest.fn(),
  },
}));

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../components/user/UserDisplay', () => () => <div />);

import { rankedLeaguesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const mockRankedLeaguesApi = rankedLeaguesApi as jest.Mocked<typeof rankedLeaguesApi>;
const mockUseAuth = useAuth as jest.Mock;

function buildLeague() {
  return {
    _id: 'league-1',
    startDate: new Date().toISOString(),
    players: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: { _id: 'user-1' } });
});

describe('RankedLeague rules and etiquette', () => {
  it('renders Etiquette and Rules sections once the league has loaded', async () => {
    mockRankedLeaguesApi.getCurrent.mockResolvedValue({
      data: { league: buildLeague() },
    } as any);

    render(<RankedLeague />);

    expect(await screen.findByRole('button', { name: 'Etiquette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
  });

  it('shows the WRC 2025 and penalties links when Rules is expanded', async () => {
    mockRankedLeaguesApi.getCurrent.mockResolvedValue({
      data: { league: buildLeague() },
    } as any);

    render(<RankedLeague />);

    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));

    expect(screen.getByRole('link', { name: 'WRC 2025' })).toHaveAttribute(
      'href',
      'https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf'
    );
    expect(screen.getByRole('link', { name: /WRC Penalties 2025/ })).toHaveAttribute(
      'href',
      '/penalties'
    );
  });

  it('does not show Rules or Etiquette while the league is loading', async () => {
    mockRankedLeaguesApi.getCurrent.mockReturnValue(new Promise(() => {}));

    render(<RankedLeague />);

    await waitFor(() => {
      expect(screen.getByText('Loading ranked league...')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Rules' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Etiquette' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/RankedLeague"`

Expected: the first two tests FAIL (`Unable to find role="button" and name "Etiquette"` / `"Rules"`). The third test (loading) already passes, since nothing is rendered yet — that is expected; it guards against rendering the sections outside the loaded branch.

- [ ] **Step 3: Write the minimal implementation**

In `client/src/pages/RankedLeague.tsx`, add the imports after the `UserDisplay` import (line 6):

```tsx
import UserDisplay from '../components/user/UserDisplay';
import EtiquetteDisplay from '../components/tournaments/EtiquetteDisplay';
import RulesDisplay from '../components/tournaments/RulesDisplay';
import { StarIcon } from '@heroicons/react/24/outline';
```

Then render the sections right after the Unranked card, before the closing `</>`. The end of the file's JSX should become:

```tsx
          {unrankedPlayers.length > 0 && (
            <div className="card">
              {/* ...existing Unranked card unchanged... */}
            </div>
          )}

          <EtiquetteDisplay />
          <RulesDisplay ruleset="WRC2025" />
        </>
      ) : null}
```

Do not pass `startingPointValue` or `modifications`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/RankedLeague"`

Expected: 3 tests PASS.

- [ ] **Step 5: Run the wider checks**

Run, from `client/`:

```bash
npx prettier --check src/pages/RankedLeague.tsx src/pages/__tests__/RankedLeague.test.tsx
npx tsc --noEmit
npm test -- --watchAll=false
```

Expected: Prettier reports both files formatted (run `npx prettier --write` on them if not, but only if the pre-existing `RankedLeague.tsx` diff stays limited to this change — otherwise skip formatting the untouched lines), `tsc` prints no errors, and the full suite passes including `TournamentDetail.test.tsx`.

- [ ] **Step 6: Manual check in the browser (optional but recommended)**

Run `cd client && npm start` (with the server running), open `/ranked`, and confirm:
- Etiquette and Rules cards appear below the leaderboard and Unranked list, collapsed by default.
- Expanding Rules shows the WRC 2025 link and the WRC Penalties 2025 link; expanding Etiquette plays the video.
- Expanding one on this page and visiting a tournament page shows the same open state (shared localStorage keys — intended).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/RankedLeague.tsx client/src/pages/__tests__/RankedLeague.test.tsx
git commit -m "$(cat <<'EOF'
feat: show rules and etiquette on the ranked league page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
