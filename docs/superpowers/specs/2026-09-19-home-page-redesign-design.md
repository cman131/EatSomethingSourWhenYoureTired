# Home Page Redesign & /events Redirect

**Date:** 2026-09-19  
**Status:** Approved

## Overview

Redesign the home page to prioritize welcoming new members to the club rather than prompting account creation or game logging. Add a `/events` redirect to home. The page serves two distinct audiences with entirely separate views.

Design is **mobile-first** — 90% of users are on mobile. All tap targets are full-width, no hover-dependent interactions.

---

## /events Redirect

Add `<Route path="/events" element={<Navigate to="/" replace />} />` in `client/src/App.tsx`.

Import `Navigate` from `react-router-dom` (already used in the project).

---

## Two-Persona Views

### Guest View (logged out)

The primary audience is a prospective new member who found the site and wants to know if this club is for them. The page answers: _who are we, when/where do we meet, how do I get involved?_

**Sections (top to bottom):**

1. **Hero** — centered gradient (indigo-to-purple), matching the existing brand color
   - Small location label: "Charleston, SC"
   - Club name headline: "Riichi Mahjong Club" (large, bold)
   - Schedule + venue: "Sundays 10am–1pm · Annie O'Loves · All welcome!"
   - Two full-width stacked CTAs:
     - Primary (white bg, indigo text): "📅 Join us on Meetup" → `https://www.meetup.com/charleston-riichi-mahjong/events/`
     - Secondary (translucent white border): "💬 Join our Discord" → `https://discord.gg/xhZtZZF3Jk`

2. **Photo strip** — 3-column horizontal grid of real club photos, immediately below the hero
   - Photos: `best_pic.jpg`, `20260906_110257.jpg`, `PXL_20260531_160148385.MP.jpg`
   - Fixed height (~120px on mobile), `object-fit: cover`
   - Caption below: _"Our Sunday sessions at Annie O'Loves"_

3. **Calculator quick-link** — a single slim row (not a card grid), right-aligned link text
   - "Score a hand" label + "🧮 Calculator →" link to `/calculator`
   - Acts as a discoverable utility link, not a featured item

4. **Upcoming Tournament card** — rendered only if an upcoming tournament exists
   - Fetched via `tournamentsApi.getTournaments(1, 20)` (no auth required); filter client-side for `status === 'NotStarted'` and `date >= today`, sort ascending, take first result
   - Shows: tournament name, date, venue
   - "View details →" link to `/tournaments/:id`
   - Hidden entirely (not a placeholder) if no upcoming tournament exists

**Removed from guest view:**
- "Get Started" → Register CTA
- Feature card grid (Events, Games, Quiz, Shop, etc.)
- "Get Started" section header

---

### Authenticated View (logged in)

Members know the site — give them their tools immediately. No welcome copy, no hero.

**Sections (top to bottom):**

1. **Greeting strip** — single slim bar
   - Left: "Welcome back, [displayName]!" (no subtext — keep it simple)
   - Right: "Submit Game" button → `/submit-game`

2. **Tournaments section**
   - Section header: "Tournaments" with "View all →" link to `/tournaments`
   - Upcoming tournament card (same as guest view, always shown here if exists)
   - Ranked League card → `/ranked`

3. **Recent Games section**
   - Existing implementation kept as-is
   - Section header: "Recent Games" with "View all →" link to `/games`

**Removed from authenticated view:**
- Hero / gradient banner
- "Submit New Game" / "View Profile" hero buttons (Submit Game moves to greeting strip)
- Feature card grid

---

## Photo Assets

Three photos from the club photo library are copied into `client/public/images/club/`:

| Filename | Usage |
|---|---|
| `best_pic.jpg` | Photo strip slot 1 |
| `session-mural.jpg` (rename from `20260906_110257.jpg`) | Photo strip slot 2 |
| `session-wide.jpg` (rename from `PXL_20260531_160148385.MP.jpg`) | Photo strip slot 3 |

Photos are served as static assets via the public directory. No backend changes needed.

---

## Architecture

- **`client/src/pages/Home.tsx`** — primary file changed. Split into two conditional render paths based on `isAuthenticated`.
- **`client/src/App.tsx`** — add `/events` redirect route.
- **`client/public/images/club/`** — new directory with 3 photo files copied from Downloads.
- No new components required; the tournament card and recent games section reuse existing patterns.
- Tournament data for guest view: single API call to get the next upcoming tournament (already available via `tournamentsApi`).

---

## Out of Scope

- Navigation changes
- Adding a "what is riichi mahjong" explainer section
- Authenticated user subtext ("Sunday session is tomorrow") — keep as static greeting or omit
- Any changes to tournament detail, games list, or other pages
