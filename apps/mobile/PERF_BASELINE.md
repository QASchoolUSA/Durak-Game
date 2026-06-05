# Performance baseline template

Record metrics **before and after** each optimization phase. Use the dev perf overlay (triple-tap top-left) plus RN Performance Monitor.

## Devices

| Device | OS | Refresh | Build |
|--------|-----|---------|-------|
| | | 60 / 120 Hz | Expo Go / EAS dev |

## Scenarios

1. Idle gameplay — 6 cards, timer running
2. Attack drag — standard play-drag
3. Beat/transfer drag — Perevodnoy defender
4. Deal animation — new cards entering fan
5. Table exit — take / round clear
6. Online opponent move — Convex update while idle
7. Home screen — CardFan + sparkles

## Metrics

| Scenario | UI FPS avg | UI FPS p95 | JS p95 ms | Drops &lt;55fps | GameScreen renders / 10s |
|----------|-----------|-----------|-----------|-----------------|--------------------------|
| Idle gameplay | | | | | |
| Beat/transfer drag | | | | | |
| Attack drag | | | | | |

## Acceptance targets

- 60Hz: ≥58 fps idle, ≥55 fps beat/transfer drag
- 120Hz (ProMotion + native config): ≥115 fps idle, ≥100 fps drag post Phase 2
- GameScreen renders during idle: ≤2 per 10s (post Phase 1)

## Tools

- In-app perf overlay (`__DEV__`)
- RN Performance Monitor
- React DevTools Profiler
- Xcode Instruments / Android Studio Profiler (dev builds)
