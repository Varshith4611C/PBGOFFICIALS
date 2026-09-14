---
name: business-board-game
overview: >-
  A Monopoly-style 3D business board game with a tilted camera, AI bots and
  hot-seat play.
createdAt: '2026-09-13T15:04:18.092Z'
todos:
  - id: core-loop
    content: >-
      Build the playable core loop: procedural 3D board, dice roll, token
      movement, buy property or pay rent, money HUD, turn alternation.
    status: completed
  - id: full-rules
    content: >-
      Add the remaining board rules: colour groups, monopoly rent doubling,
      houses and hotels, tax and chance tiles, jail, bankruptcy and win.
    status: pending
  - id: ai-bots
    content: >-
      Give the AI bots working buy, upgrade and sell decisions so three bots
      play a full game.
    status: pending
  - id: hotseat-mode
    content: Add hot-seat play for 2-4 humans with a mode choice at game start.
    status: completed
  - id: board-dressing
    content: >-
      Dress the board with props for houses and hotels, tile labels, and a
      camera and lighting pass.
    status: pending
  - id: trade-auction
    content: Add property trading and auctions when a player declines to buy.
    status: pending
---
## Decisions locked
- Reference: Rento Fortune / Monopoly-style business dice board game.
- View: 3D board, tilted camera (whole board visible, leaning perspective).
- Players: AI bots AND hot-seat (2-4 humans) - a mode choice at game start.
- Language: GDScript. Main scene: res://main.tscn.
- Board: 40 tiles in a square ring, index 0 = GO at the bottom-right corner, running counter-clockwise (0-10 bottom, 10-20 left, 20-30 top, 30-40 right).
- All property names are ORIGINAL business/tycoon names (no trademarked Monopoly names).
- Rule: use -Z as world forward for anything that needs a facing direction; the board ring is a closed loop, so movement is index-based, not direction-based.

## Milestones
1. Playable core loop: procedural 3D board, 2 tokens, dice roll button, tile-by-tile movement, buy property / pay rent, GO salary, money HUD, turn alternation (1 human + 1 bot).
2. Full board rules: all 8 colour groups, monopoly rent doubling, houses/hotels, Chance-style and tax tiles, jail, win/bankruptcy.
3. AI opponents: 3 bots with buy/upgrade/sell decisions, difficulty feel, bankruptcy exit.
4. Hot-seat mode: 2-4 human players with distinct colours, start-screen mode selection, per-player turn prompt.
5. Board dressing: library props for houses/hotels, tile labels, camera and lighting polish.
6. Trading and auctions: property trade offers between players, auction on declined purchase.

## Verification
Static per milestone: no script parse errors, main scene set, input actions bound, node references resolve.
Runtime/visual feel is the user's playtest - do not claim a milestone looks or plays right without it.
