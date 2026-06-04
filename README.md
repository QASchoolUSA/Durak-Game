# Durak

A beautiful, animated mobile **Durak** card game built with Expo / React Native and TypeScript.

This repository is a monorepo so the game rules can be shared between the mobile client today and an authoritative multiplayer server later.

## Structure

```
durak-game/
├─ packages/
│  └─ game-core/      Pure TypeScript rules engine (no React Native). Fully unit-tested.
└─ apps/
   └─ mobile/         Expo app: portrait UI, animated table, custom-drawn cards, AI opponents.
```

- **`@durak/game-core`** — deck, Podkidnoy and Perevodnoy rules, the `applyMove` reducer (the future server's authority), and difficulty-aware heuristic AI. Framework-agnostic and deterministic (seedable shuffle).
- **`@durak/mobile`** — the Expo client. Cards are drawn in code (React Native views), animated with Reanimated, and dragged with Gesture Handler. Runs in **Expo Go** (no native build required).

## Prerequisites

- Node 20+ and **pnpm** (`npm install -g pnpm`)
- The **Expo Go** app on your iOS/Android device (or a simulator/emulator)

## Install

```bash
pnpm install
```

## Run the game

```bash
pnpm mobile            # or: cd apps/mobile && pnpm start
```

Then scan the QR code with Expo Go (or press `i` / `a` for a simulator/emulator).

## Test the rules engine

```bash
pnpm test              # runs the @durak/game-core vitest suite
```

## Test online multiplayer (simulator + iPhone)

Online play uses a **Convex** backend. Configure `apps/mobile/.env.local` with your deployment URL (see `apps/mobile/.env.example`). After changing `convex/` code:

```bash
pnpm convex:deploy     # deploy to preview (requires CONVEX_DEPLOY_KEY in .env.local)
pnpm mobile:clear      # restart Expo so env vars reload
```

- **iOS Simulator:** press `i` in the Expo terminal.
- **iPhone (Expo Go):** same Wi‑Fi as your Mac, scan the QR code. Game state syncs over the internet via Convex; Wi‑Fi is only needed to load the JS bundle from Metro. If the phone cannot reach Metro, use Expo tunnel (`npx expo start --tunnel`).

**Flow:**

1. Device A: **PLAY** → **With friends** → **CREATE ROOM** → share the 6-digit code.
2. Device B: **JOIN GAME** → enter code and a display name.
3. Host alone: lobby shows **Waiting for a friend** and **PLAY WITH AI** (fills empty seats with bots).
4. Host with a friend: **START GAME** (any remaining seats are filled with AI).

Do not commit `.env.local` (it contains deploy keys).

### Invite friends anywhere (TestFlight)

Multiplayer runs on Convex in the cloud — friends do **not** need to be on your Wi‑Fi. They need a **TestFlight build** of the app (not Expo Go on your Mac’s QR code).

**One-time setup**

1. `eas login` and link your Apple Developer account.
2. Build an internal iOS app (embeds the preview Convex URL from [`apps/mobile/eas.json`](apps/mobile/eas.json)):

```bash
pnpm ios:preview
```

3. Upload to TestFlight:

```bash
pnpm ios:preview:submit
```

   Or download the `.ipa` from the EAS dashboard and upload via App Store Connect.

4. In [App Store Connect](https://appstoreconnect.apple.com) → your app → **TestFlight**, add internal or external testers and send invites.

**When you change backend code** (`convex/`): run `pnpm convex:deploy` — testers keep the same app; no new build required.

**When you change the mobile app**: run `pnpm ios:preview` again and distribute a new TestFlight build.

**Play together**

1. Host: **PLAY** → **With friends** → **CREATE ROOM** → share the 6-digit code (text, iMessage, etc.).
2. Friend: open Durak from TestFlight → **JOIN GAME** → code + display name.
3. Host starts when ready (**START GAME** with a friend, or **PLAY WITH AI** if alone).

## How to play (Phase 1)

- Tap **PLAY** on the home screen to open the new-game drawer. Choose **2–6 players**, variant (**Podkidnoy** or **Perevodnoy / Transfer**), throw-in rules, **Standard** or **Abilities** mode, and AI difficulty.
- Your last game configuration is remembered between sessions.
- You sit at the bottom; opponents are AI. The active player is highlighted.
- **Drag a card up** onto the table (or tap it) to attack or defend. Only playable cards are highlighted.
- As defender, beat each attack or press **Take**. As attacker, press **Done** when you are finished.
- Turn timer defaults to **12 seconds** (configurable in Settings: Off / 12s / 15s / 30s / 60s). When time runs out, you automatically **Take** (defender) or **Done** (attacker); opening attacks play your lowest card.
- **Abilities mode** adds Return (3s undo), Graveyard (view discards), and Reveal (peek at an opponent's card).
- Lowest trump leads first; the last player holding cards is the **Durak**.
- Change **appearance** (8 table/card presets) in Settings — theming applies across home, game, drawers, and results.

## Settings

- **Sound effects** and **haptic feedback** (persisted)
- **Turn timer** duration
- **Appearance** presets (light/dark table + card backs)

## Roadmap (designed for, not yet built)

- **Phase 2** — Accounts, friends, and an in-app inbox for requests/invites (Supabase Auth + Postgres).
- **Phase 3** — Online rooms/lobbies reusing `game-core` as the server authority; reconnect handling.
- **Phase 4** — Virtual credits with buy-in/pot settlement, live reactions, and timeout kick/forfeit.

The reactions bar and pot badge in the game are visual stubs that already reserve a place for the Phase 4 features.
