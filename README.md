# Store Smash — Dash Rush

A shopping-cart brawler and delivery race built on **Dr. Mow**'s driving mechanics. Take orders off the board,
shop a two-storey grocery store with a cart, barge rivals for their stuff, jump in your car and dash the order
across town before another dasher poaches it.

Run: `python3 -m http.server 8080`, open `http://localhost:8080`. No build step (three.js r160 is vendored).

Tests: `node tools/sim-check.mjs [matches]` (headless rules + controller + whole CPU matches),
`BASE=http://localhost:8080/ node tools/smoke.mjs` (Playwright: 0 console errors, 0 page scroll, screenshots).

(Full notes below once the current feature pass lands.)
