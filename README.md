# Store Smash — Dash Rush

*A shopping-cart brawler and delivery race built on Dr. Mow's driving.* Take orders off the board, tear round a
two-storey grocery store with a cart (grinding the railings, flying off kickers, robbing rival dashers), jump in
your car and dash each order across town before another dasher poaches it. Most tips wins the shift.

## Run

```
python3 -m http.server 8080
```

Open `http://localhost:8080`. No build step: three.js r160 is vendored and loaded through an import map, as in
Dr. Mow.

**Live:** https://mtd-public.github.io/store-smash/ — every push runs the headless proof
(`.github/workflows/deploy.yml`); pushes to `main` deploy to GitHub Pages once it passes.

## How a shift plays

1. **Order board.** A handful of orders (2–4 items each, from different departments, each with its own drop-off
   address and tip). Take up to **3** at once. The CPU dashers only start taking orders once the shift starts
   (a second or two after GO), and they can take the same ones as you. Open the board again mid-shift with
   **O** / 📋 / pad Back: the shift holds still while it's open, so nobody poaches an order while you browse.
2. **Shop.** The store's **layout is shuffled every shift**: departments move between the four aisle blocks
   (two per floor), the front hall's produce bins and the outdoor yard's benches. Your list names only the
   department and its **icon** (a kawaii apple, toilet roll, plunger, teddy, rolled rug and potted sprout). Each
   department's floor is tinted in its colour and has its icon **printed in every aisle**. The same badges are on
   the hanging signs, the "UPPER FLOOR ↑" signposts and the **store directory** by the door. Anything on your
   list within about 24 m on your floor stands out: a big glowing copy bobs over its shelf and a ring marks
   where to grab it in the aisle. Roll past the shelf to grab it. Every department stocks its own shelf goods,
   and the goods are bigger and self-lit. Departments: Produce, Paper Goods (toilet paper), Hardware
   (plungers), Toys, Home & Carpet, Garden Center.
3. **Brawl.** One attack, **SMASH**: a short lunge with your cart. Catch a rival carrying something you need
   and you **steal** it straight into your cart; otherwise their stuff spills on the floor and they're dazed.
   Spilled items can be grabbed by anyone who needs them. A car hitting a shopper spills them too. When a rival
   is coming for you, an animated **HOSTILE DASHER APPROACHING** banner drops in. CPU dashers move about 15%
   slower than you, on foot and at the wheel.
4. **Tricks.** Hop onto any railing, travelator handrail, checkout ledge or yard bench edge to **grind** it
   (the handrails chain from the upper floor all the way down). Hop at the lip of a **kicker**: the one upstairs
   flies you over the edge rail and drops you into the front hall. Tricks, steals and smashes fill your
   **SLO-MO** meter; hold slow-mo for bullet time, and sick moments (launches, rail grabs off a hop, big drops)
   drop into a short burst on their own.
5. **Car.** With at least one order complete, touch your own car — in the outdoor lot, the indoor garage, or
   up on the garage roof across the skybridge. Your car **glows** in your colour, with a ring, a tall beam and a
   YOUR CAR tag. Once an order is ready, it pulses harder and an arrow on the edge of the screen points to it
   whenever it's off screen. Unfinished orders go back on the board; your cart stays behind
   as a prop anyone can smash.
6. **Dash.** Drive to each drop-off (the minimap and GPS chevrons only appear on the road). The first dasher to
   deliver an order gets the tip and **poaches** it from everyone else holding it. Nothing left to deliver?
   Park back at your spot and you're on foot again with a fresh cart.

The shift ends when every order is delivered (or after 6 minutes). Most money wins.

## Controls

| | One player | Two players (split screen) | Pad |
|---|---|---|---|
| Go that way | stick / WASD / arrows (screen directions) | P1 WASD, P2 arrows | left stick / d-pad |
| Hop | Space | P1 Space, P2 Enter | A |
| SMASH (lunge / steal) | Shift, F, E, J or K | P1 left Shift / Q / F / E, P2 right Shift / . / / | B, X or RT |
| Slow-mo (hold) | X | P1 R, P2 ' | LB / LT |
| Order board | O / Tab | O | Back |
| Camera (iso / chase) | C | C | Y |
| Pause | Esc / P | | Start |

Touch (one player): a floating stick on the left, HOP / SMASH / SLO-MO buttons on the right. In the
chase camera, keys steer like a car (←/→ turn, ↑ go, ↓ brake / back up).

## Seeing through the level

The camera is Dr. Mow's pulled-out isometric diorama (switch to a chase cam on the title screen or with **C**). Three things keep your
dasher visible in a two-storey building:

- **Dr. Mow's see-through veil** (`js/seethru.js`, copied from Dr. Mow): anything between the camera and you
  dithers away in a cone round you — shelves, walls, towers, trees.
- **The overhead cut** (added to the same shader): under a slab (the upper floor, the garage roof deck, the
  skybridge) everything above your head within ~13 m dithers away too, so the floor you're on reads like a
  cutaway.
- **Roof cutaway:** the store's roof and upper walls go whenever they would stand between the camera and you
  (inside, or behind the building in the yard).

Every dasher also draws an **x-ray silhouette** where the level hides them.

## Look

Characters and their cars are **toon-shaded** (three tones) with **ink outlines**: an inverted hull pushed out
along welded normals, scaled with distance so it stays a couple of pixels wide in both the iso and the chase
cameras. Shoppers wear a round delivery jacket with a collar and chest logo, an insulated bag on the back,
hair under a delivery cap, mitten hands and chunky sneakers. Each cart flies a pennant in its dasher's colour.
Cars are bubbly hatchbacks with rounded bodies, a glass band all round and a DASH sign on the roof. The
department icons are drawn on canvases in `js/icons.js`, with no image files.

### The city

The streets have white edge lines, stop bars at every crosswalk and manhole covers. Each corner has a traffic
light, and street lamps, benches, bins, hydrants and planters line the sidewalks. Lawns are mown in stripes.

- **Houses:** pitched, overhanging roofs with ridge caps and chimneys, clapboard siding with shuttered windows,
  picket fences, mailboxes, flower boxes, bushes and the odd garden gnome.
- **Apartments:** brick, with balconies (some with potted plants), entrance awnings, and rooftop water tanks,
  AC units and stair huts.
- **Office towers:** sky-blue curtain walls with floor bands, a glass lobby, and rooftop plant rooms, antennas
  or helipads.
- **Parks:** a rounded pond with a stone rim, lily pads, reeds and a family of ducks, plus a path loop with
  paths out to the sidewalks, flower beds, benches, lamps, a playground and picnic tables.
- **Stunt lot:** cones, chequered flags and tyre stacks.

Everything that only draws comes from `js/props.js`, using its own random stream so the collision layout stays
the same. The lamps, traffic lights and playground stand on thin posts at the building side of the sidewalk,
out of the traffic.

## Faces

Shoppers have chibi heads wearing **Dr. Mow's cartoon faces** (`js/faces.js`, the farmer's set copied as is):
joy on a grab, fired up on a smash or a grind, dizzy (@ @) when smashed, shock, cry when poached, and the
**on-fire pair (aghast / seethe) flipping back and forth** when you've been robbed or a hostile dasher is
closing in. Your current face shows in the HUD portrait.

## Code map

| File | Role |
|---|---|
| `js/tuning.js` | every feel number, with its reason: the cart and car HANDLING profiles, match, combat, slow-mo, camera |
| `js/drive.js` | **the character controller**, lifted from Dr. Mow's mower step and made generic: stick yaw spring, turn slow-down, grip/drift, hop with coyote time + jump buffer, step-up / snap-down, wall slide, ramp launches, ceilings, grind rails. The cart, the car and every CPU use it |
| `js/world.js` | Dr. Mow's platform collision (ground, walls, ceilings) with a spatial hash; rails |
| `js/level.js` | the test level as data: the store (upper floor, travelators, kickers, rails, department zones), outdoor yard, lot, two-level indoor garage + skybridge, 5×5 city with 134 addresses |
| `js/order.js` | products, the shuffled layout, shelf stock, the order board |
| `js/match.js` | the rules: board, shopping, combat, spills, tricks, car, delivery, poaching, parking, standings |
| `js/nav.js` | nav graphs sampled straight off the collision world (one per body), A*, Dijkstra |
| `js/ai.js` | CPU dashers: order picks, routing, combat, avoidance, escapes. Stuck on foot near a goal, a CPU drives straight at it and hops. Ten seconds boxed in anywhere, it gets towed a few metres down its route |
| `js/scene.js` | renderer: merged level meshes, signs, see-through, cutaways, x-ray, dashers, faces, guides, split screen |
| `js/models.js`, `js/faces.js` | procedural shopper / cart / car / products, toon material, ink outlines; Dr. Mow's faces |
| `js/icons.js` | the kawaii department icons and badges (floor decals, signs, directory, HUD, board) |
| `js/props.js` | city props: street furniture, house yards, roofs, balconies, rooftop kit, park, stunt lot, trees |
| `js/input.js` | touch stick, keys, pads, two local players |
| `js/main.js` | shell: title (live CPU match behind it), board, HUD, minimap, banner, slow-mo, toasts, results |
| `js/seethru.js`, `js/sfx-synth.js`, `js/utils.js` | Dr. Mow's kits |

## Tests

- `node tools/sim-check.mjs [matches]` — headless: the controller (hop arc, curb, ramp, floor vs ceiling, wall
  slide, car vs cart turning, stunt jump), grinds and kickers, reachability (every slot, car spot and address
  on the nav graphs), combat (smash steal, smash spill, pick-up), then whole 6-CPU shifts over several seeds: every
  order delivered and nobody stalls for 20 s.
- `BASE=http://localhost:8080/ CHROMIUM=/opt/pw-browsers/chromium node tools/smoke.mjs` — Playwright:
  desktop, phone and split screen; the board, keys, see-through shots, a grind, a kicker launch, an autoplayed
  shift; 0 console errors and 0 page scroll.

Console hooks: `GAME.start({ humans, cpus, seed })`, `GAME.ff(seconds)`, `GAME.autoplay = true` (a CPU brain
drives player 1), `GAME.force = ctl` (drive player 1 exactly, for tests).

## Multiplayer

Local: two players split screen (keys or two pads), plus up to 4 CPUs. Every dasher is just a control source
for the same sim (`matchStep(M, ctls)`, fixed 1/120 s step, deterministic from the seed), so an online player
would be one more control source; netcode isn't in this test level.

## Lineage

Built from **Dr. Mow** (`mtd-public/dr-mow`): the mower step (`js/sim.js`) became `js/drive.js`; its grind
rails, slow-mo meter, see-through veil, cartoon faces, floating stick, Versus controls, chase cam, sfx synth and
tuning-table conventions all carry over.
