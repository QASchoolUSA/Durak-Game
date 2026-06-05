# Multiplayer QA — 2-Device Test Script

Run this checklist on two physical devices before each TestFlight multiplayer build.

**Setup:** Two devices with TestFlight/EAS build; same Convex deployment; `EXPO_PUBLIC_CONVEX_URL` set.

## Smoke (Podkidnoy, 2 humans, no AI)

1. Device A: PLAY → With friends → CREATE ROOM (2 players, Podkidnoy, throw-in all).
2. Share code; Device B: JOIN GAME → enter code + name.
3. Both: READY. Host: START GAME (compact, no auto-fill).
4. Play full round: attack, defend, pass, take.
5. Verify timer counts down; **do not** expect client auto-play on timeout — wait for server move.
6. Finish game → result screen shows correct durak/winner.
7. Device A: PLAY AGAIN → both land in lobby; ready + start again.
8. Device B: MAIN MENU → leave room.

## Perevodnoy + transfer

9. New room, variant Perevodnoy.
10. Defender: drag to **transfer** slot → verify `TRANSFER` applied on both devices.
11. Beat path: drag to beat slot → `DEFEND`.

## Abilities

12. Return: play card → tap ↩ within 3s → both see undo.
13. Graveyard: spend 1 gold → discard sheet opens on both (same discard from sync).
14. Reveal: spend 2 gold → pick opponent card → animation on initiator; **kill app mid-reveal, reopen** → card should appear via `pendingReveal` sync.

## Timeout

15. Let timer expire on defender → server TAKE; on attacker with open table → PASS/Done.

## Forfeit / reconnect

16. Mid-game Device A: ✕ exit → confirm → becomes AI; Device B game continues.
17. Device B: background app 60s, foreground → state resyncs via `getRoomView`.
18. Kill app during lobby → reopen → session restore to lobby.

## Reactions

19. Send emoji during play → appears on other device within subscription latency.

## Regression (solo)

20. PLAY → Vs AI → full game → no Convex calls; timer auto-plays locally.
21. **Card play (Expo Go):** touch + lift a card, drag attack/defend/throw-in, clear a 6-card round — app must not crash on drag start, play, or table exit animation.

## Automated coverage

These scenarios are partially covered by unit tests:

- `convex/lib/onlineRules.test.ts` — online rules force standard mode
- `convex/lib/views.test.ts` — hidden opponent hands
- `convex/lib/gameFlow.test.ts` — move sequences, return snapshot, timeout move
- `convex/lib/revealHelpers.test.ts` — reveal card picking
- `src/game/onlineMutationErrors.test.ts` — user-facing error messages
