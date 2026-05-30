# Durak

A beautiful, animated mobile **Durak** (Podkidnoy variant) card game built with Expo / React Native and TypeScript.

This repository is a monorepo so the game rules can be shared between the mobile client today and an authoritative multiplayer server later.

## Structure

```
durak-game/
├─ packages/
│  └─ game-core/      Pure TypeScript rules engine (no React Native). Fully unit-tested.
└─ apps/
   └─ mobile/         Expo app: portrait UI, animated table, custom-drawn cards, AI opponents.
```

- **`@durak/game-core`** — deck, Podkidnoy rules, the `applyMove` reducer (the future server's authority), and a heuristic AI bot. Framework-agnostic and deterministic (seedable shuffle).
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

## How to play (Phase 1)

- Choose 2-4 players on the home screen and tap **Play vs AI**.
- You sit at the bottom; opponents are AI. The active player is highlighted in gold.
- **Drag a card up** onto the table (or tap it) to attack or defend. Only playable cards are highlighted.
- As defender, beat each attack or press **Take**. As attacker, press **Done** when you are finished.
- You have ~12 seconds per turn; if you run out, a safe move is auto-played.
- Lowest trump leads first; the last player holding cards is the **Durak**.

## Roadmap (designed for, not yet built)

- **Phase 2** — Accounts, friends, and an in-app inbox for requests/invites (Supabase Auth + Postgres).
- **Phase 3** — Online rooms/lobbies reusing `game-core` as the server authority; reconnect handling.
- **Phase 4** — Virtual credits with buy-in/pot settlement, live reactions, and timeout kick/forfeit.

The reactions bar and pot badge in the game are visual stubs that already reserve a place for the Phase 4 features.
