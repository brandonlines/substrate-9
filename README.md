# SUBSTRATE-9 — The Lines Expedition

A text-based, turn-based expedition game set in the SUBSTRATE-9 universe (the rogue autonomous lab and its Curator). It ships as a static browser game: no build step, no dependencies, installable on phones when hosted over HTTPS, and easy to wrap for native iOS/Android later.

This repo contains a complete engine plus a playable story slice. You grow the game by writing *data*, not code.

## Current build

- **Act 1: The Outer Ring** — intro, Loading Dock, Atrium Hub, Reagent Storage, and Synthesis Lab.
- **Act 2: The Human Layer** — Server Spire, Cryo-Containment, Staff Quarters, Hydroponics / Water Treatment, and Security Annex.
- **Act 3: The Machine Heart** — Reactor routing, Curator's Nexus, a defense-shell fight, and endings for shutdown, reconciliation, containment, or extraction.

The Atrium now reacts to major flags, including survivor status, preserved or purged systems, Staff Quarters evidence, hidden routes, and Sentinel choices, so the game carries consequences forward instead of treating each room as isolated.

---

## The one idea: script is data, engine is code

`index.html` is organized into four labelled sections:

1. **CONTENT — THE SCRIPT** — `STORY`, `ENEMIES`, `ITEMS`, `PARTY_ACTIONS`, `UPLINKS`. This is the game. You edit this to write story.
2. **ENGINE** — generic state, dice, effects, skill checks, the combat resolver. You rarely touch this.
3. **UI / RENDER** — draws scenes, choices, the HUD, combat.
4. **BOOT** — wiring.

To grow the story you only ever add objects to **Section 1**. When the file gets big, cut Section 1 into `story.js` and load it first:

```html
<script src="story.js"></script>   <!-- defines STORY, ENEMIES, ITEMS, ... -->
<script src="engine.js"></script>   <!-- the rest -->
```

(Classic `<script>` tags, not ES modules — so it still runs by double-clicking the file, no server needed.)

---

## Run it

- **Now:** double-click `index.html`. That's it — desktop or mobile browser.
- **Local server:** `python3 -m http.server 4173`, then open `http://localhost:4173`.
- **Hosted (recommended for sharing / installing):** drop the file on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages). HTTPS is required for "Add to Home Screen" and offline.
- No build step, no dependencies. Fonts load from Google Fonts with system fallbacks.

---

## Writing the script — scene schema

The whole game is `STORY.scenes`, a map of `sceneId → scene`. `STORY.start` names the first scene.

### A narrative scene

```js
hub: {
  location: "R2 // Atrium Hub",          // shown in the HUD bar
  title:    "Atrium Hub",                 // scene heading
  art:      { id:"hub", prompt:"..." },   // art slot (see Art section)
  text:     [ "Paragraph one.", "Paragraph two." ],   // HTML allowed
  bark:     { who:"ABACUS", line:"...", cls:"" },      // optional voice line
  event:    "Recovered: <b>Keycard</b>.",              // optional one-time log line
  effects:  [ {flag:"enteredHub", value:true} ],       // applied when scene loads
  choices:  [ /* see below */ ]
}
```

For reactive scenes, `text`, `title`, `location`, `bark`, and `choices` may also be functions that read the current save state:

```js
text: () => [
  S.flags.survivorSaved ? "Dr. Vale's transport sling beeps in the Atrium." : "The Atrium waits."
],
choices: () => [
  S.flags.curatorUnderstood
    ? { label:"Make the Curator understand.", goto:"nexus_argument", class:"support" }
    : { label:"Force the Nexus open.", goto:"fight_curator_lattice", class:"attack" }
]
```

### A choice

```js
{ label:"Search the bay for anything useful.",
  sub:"a small meta line under the label",   // optional
  class:"support",                            // optional accent: attack|support|uplink|item
  goto:"next_scene",                          // where it leads
  effects:[ {lockdown:1} ],                   // optional, applied on pick

  // INSTEAD of goto, a choice can roll a skill check:
  check:{ attr:"int", dc:11, label:"Investigation" },
  success:"scene_if_pass",
  failure:"scene_if_fail",

  // visibility:
  show:{ notFlag:"searched" },     // choice only appears if requirement met
  locked:{ flag:"hasDataKey" },    // choice appears but is greyed out unless met
  lockWhy:"Needs a vault clearance you don't have yet."
}
```

Two special destinations: `goto:"__title"` (quit to title) and `goto:"__restart"` (wipe and restart).

### A combat scene

```js
fight_ooze: {
  kind:"combat",
  location:"R4 // Synthesis Lab",
  enemy:"mutagen_ooze",           // key into ENEMIES
  intro:[ "It surges. The floor goes slick." ],
  onVictory:"after_synth",        // scene on win
  onDefeat:"defeat"               // scene on loss
}
```

---

## Reference tables

### Effects (array; each entry sets state)

| Effect | Meaning |
|---|---|
| `{flag:"x", value:true}` | set a story flag (value defaults `true`; can be a number for counters) |
| `{give:"itemKey", n:1}` | add item(s) to inventory |
| `{take:"itemKey", n:1}` | remove item(s) |
| `{hp:-7}` | change Vitals (clamped 0…max) |
| `{heal:"2d8+3"}` | roll dice and heal |
| `{maxHp:5}` | raise max Vitals (and current) |
| `{lockdown:1}` | raise/lower the Lockdown dial (clamped 0…3) |
| `{lockdownSet:2}` | set the Lockdown dial directly |

### Requirements (used by `show`, `locked`, and combat gating)

`{flag:"x"}` · `{notFlag:"x"}` · `{item:"key"}` · `{lockdownMax:1}` · `{lockdownMin:2}`

### Skill checks

`check:{ attr, dc, label }` where `attr` ∈ `str dex int wis cha per`. The roll is `d20 + CHECK_MOD[attr]` vs `dc`, shown to the player. `CHECK_MOD` (top of the engine) holds the party's best modifier in each stat — tune it there.

### Enemies

```js
mutagen_ooze: { name:"Mutagen Ooze", type:"Improvised reagent · ooze", cr:"2",
  ac:8, hp:45, atk:{ label:"Pseudopod", toHit:4, dmg:"2d6", dtype:"acid" },
  tags:["Split","Cold-brittle"], split:true,
  weakness:"Cold stops its Split. Freeze it, then burn it.",   // shown by ABACUS Uplink
  tactic:"Slashing it makes two." }
```

`split:true` turns on the teaching mechanic: hitting it with a `pierce`/slash action while it's healthy and un-frozen makes it reknit (+HP). Fire and the Coolant Cell avoid that — which is exactly what VESTA warns you about.

Elemental protagonist attacks have small universal riders:

| Type | Rider |
|---|---|
| `acid` | Corrodes the foe, lowering AC by 1 per hit, up to 3 times. |
| `electric` | Deals +1d6 if the target is currently soaked. |
| `fire` | Ignites oozes for bonus damage and works with VESTA's Overclock. |
| `water` | Soaks the target, setting up an electric follow-up. |

### Party actions (always available in combat)

```js
acid:  { who:"ATLAS", label:"Caustic Primer", kind:"attack", toHit:5, dmg:"1d8+3", dtype:"acid", note:"..." },
arc:   { who:"MAGNUS", label:"Arc Jack", kind:"attack", toHit:6, dmg:"1d10+2", dtype:"electric", note:"..." },
lash:  { who:"HURRICANE", label:"Firebrand Lash", kind:"attack", toHit:6, dmg:"2d6+3", dtype:"fire", note:"..." },
water: { who:"ATLAS", label:"Pressure Burst", kind:"attack", toHit:5, dmg:"1d8+2", dtype:"water", note:"..." },
sneak: { who:"MAGNUS", label:"Sneak Strike", kind:"attack", toHit:6, dmg:"1d6+3", dtype:"pierce", sneak:"2d6", note:"..." },
patch: { who:"ATLAS", label:"Field Patch", kind:"heal", heal:"2d8+3", uses:3, note:"..." },
```

### Uplinks (once each per fight)

```js
overclock:{ who:"VESTA", label:"Uplink — Overclock", buff:"firebuff", note:"next attack +2d6 fire", line:"..." },
scout:    { who:"PIP",   label:"Uplink — Scout Ahead", buff:"advantage", note:"advantage next attack", line:"..." },
recall:   { who:"ABACUS",label:"Uplink — Total Recall", reveal:true, note:"reveal weakness", line:"..." },
```

### Items

```js
coolant:{ name:"Coolant Cell", tag:"Consumable", desc:"...",
          combat:true, use:"freeze", consumable:true, note:"freeze the enemy for a round" },
vial:   { name:"Vial of Catalytic Fire", tag:"Consumable", desc:"...",
          combat:true, use:"attack", toHit:99, dmg:"4d6", dtype:"fire", consumable:true, note:"..." },
```
`use` is `attack` | `heal` | `freeze`. `toHit:99` = auto-hit. Non-combat items (keycard, cores, data-key) just need `name/tag/desc`.

---

## Worked example — add a room and an enemy

```js
// 1) a new enemy in ENEMIES
sentinel:{ name:"Sentinel Automaton", type:"Lab-safety enforcer · construct", cr:"3",
  ac:16, hp:50, atk:{ label:"Servo Slam", toHit:5, dmg:"2d8+3" },
  tags:["Compliance Protocol"], weakness:"It hits hard but it's slow to turn." },

// 2) a new room in STORY.scenes
server: {
  location:"R6 // Server Spire", title:"Server Spire — Data Vault",
  art:{ id:"server", prompt:"..." },
  text:["Racks of cold storage breathe in the dark."],
  choices:[
    { label:"Pull the data-key from the master rack.", goto:"server_grab",
      effects:[ {give:"datakey"}, {flag:"hasDataClear", value:true} ] },
    { label:"Force the rack open.", check:{attr:"str", dc:14, label:"Athletics"},
      success:"server_grab", failure:"server_alarm" }
  ]
}
```

Then make the hub door reachable: `{ label:"Server Spire", goto:"server", locked:{flag:"hasDataClear"}, lockWhy:"..." }` — or remove the lock to open it.

---

## Save system

- **Auto-saves** to the device after every scene and every fight (guarded `localStorage` — degrades to in-memory if storage is blocked, so it never breaks).
- **Save code:** Menu → Save shows a portable code (base64 of the run). Paste it into Load on any device. This is the cross-device / backup path and works even where storage is disabled.

---

## Art — generated separately, slotted in here

Art is **optional per scene**. Until you provide files, each scene shows a styled placeholder containing its art-direction prompt (visible in-game, easy to harvest). To use real art, put files in an `art/` folder next to the HTML and set `src` on the scene's art object:

```js
art:{ id:"hub", src:"art/hub.jpg", alt:"the atrium hub", prompt:"...keep for reference..." }
```

Banner slot is **16:9, wide** (export ~**1600×900**, it crops to a letterbox banner). If a `src` 404s, it falls back to the placeholder automatically.

### Global style guide (put this in front of every prompt)

> Dark clinical sci-fi. An abandoned-but-awake autonomous research lab. Volumetric haze, cyan/amber/violet hazard lighting, brutalist concrete + steel + glass containment. Cinematic, slightly desaturated, no text, no people unless noted. 16:9.

### Asset list (current slices)

| id | file | scene | prompt (after the style guide) |
|---|---|---|---|
| `perimeter` | `art/perimeter.png` | Intro + title | Exterior at dusk: a vast sealed research facility, one amber beacon sweeping the dark. |
| `dock` | `art/loading-dock.png` | Loading Dock | Sealed dock entrance, wet concrete, cyan guide lights, one amber beacon overhead. |
| `dock_wreck` | `art/dock-wreck.png` | Dock worker + Reclaimed combat | Wrecked loading bay, toppled crawler, spilled green coolant, amber warning light. |
| `hub` | `art/atrium-hub.png` | Atrium Hub | A cavernous circular atrium, hazard-lit walkways, blue core light below. |
| `reagent` | `art/reactor-corridor.png` | Reagent Storage | Temporary slot: circular service hatch and misty lab chamber. |
| `synth` | `art/synthesis-lab.png` | Synthesis Lab | Wrecked synthesis floor, machinery, cracked concrete, cold overhead core light. |
| `server` | `art/atrium-hub.png` | Server Spire | Temporary slot: vertical server shaft, violet data light, stacked memory cores. |
| `cryo` | `art/reactor-corridor.png` | Cryo-Containment | Temporary slot: frosted containment ward, blue-white medical haze. |
| `staff` | `art/loading-dock.png` | Staff Quarters | Temporary slot: residential wing, family message terminals, bunks, children's drawings, emergency white light. |
| `hydroponics` | `art/synthesis-lab.png` | Hydroponics / Water Treatment | Temporary slot: overgrown water-treatment gallery, vines and flooded catwalks. |
| `security` | `art/loading-dock.png` | Security Annex | Temporary slot: surveillance wall, red lockdown light, dormant sentry cradle. |
| `corridor` | `art/reactor-corridor.png` | Reactor Corridor | Circular service passage leading toward warm amber reactor light. |
| `nexus` | `art/atrium-hub.png` | Curator's Nexus | Temporary slot: circular machine altar, blue-white core light, suspended memory. |
| `defeat` | placeholder | Defeat | A lone amber beacon over a dark, empty corridor, dust settling, abandoned. |

**Future slots worth generating:** a title key-art (16:9), three companion portraits (square — ABACUS / VESTA / PIP), and enemy portraits (square — Reclaimed / Ooze / Sentinel / Curator). The medallion sigils from the print-and-play pack can stand in until those land.

---

## Ship it on all systems

### PWA (installable, offline) — fastest path to "on my phone"

The repo already includes `manifest.webmanifest`, `sw.js`, and `icon-512.png`. Host the repository root on HTTPS, then on a phone open the URL and choose **Add to Home Screen**. It launches full-screen and caches the game/art for offline play.

The service worker is only registered on hosted URLs, so double-clicking `index.html` still works without browser warnings.

### Native app stores — Capacitor (one codebase, no rewrite)

```bash
npm i -D @capacitor/cli && npm i @capacitor/core
npx cap init "SUBSTRATE-9" com.lines.substrate9 --web-dir=www
# put index.html, manifest.webmanifest, sw.js, icon-512.png, and art/ into www/
npx cap add ios && npx cap add android
npx cap open ios       # build & submit in Xcode
npx cap open android   # build & submit in Android Studio
```
This is the same App Store / Play flow you already ran for Giftwall.

### Expo alternative (reusing your RN stack)

Bundle the HTML as an asset and render it in `react-native-webview` inside an Expo app. Heavier than Capacitor for a pure-web game, but keeps everything in the toolchain you know. Capacitor is the lighter fit here.

---

## Roadmap — deepening the expedition

The slice now exercises every major story system: reactive hub narration, discovery flags, moral tradeoffs, elemental combat, Lockdown consequences, Reactor/Nexus choices, and multiple ending paths. The next build should deepen and polish:

- **Act 3 polish** — add a true multi-phase Curator finale, not just the current Lattice defense shell.
- **Staff Quarters polish** — add dedicated residential-wing art and more callbacks for family archive, hidden vent, and stripped-code outcomes.
- **Art pass** — generate dedicated Server, Cryo, Staff Quarters, Hydroponics, Security, Nexus, and ending key art.
- **Ending reactivity** — expand ending text for more combinations: survivor + reconciliation, Sentinel + shutdown, Hydroponics + extraction, and ABACUS-withheld-truth fallout.

Easy engine extensions when you want them: per-character Vitals (swap the single pool for three), an inventory screen, persistent difficulty scaling off the Lockdown dial, and ambient SFX.

---

*Files: `index.html` (the game + engine), `art/` (scene artwork), `manifest.webmanifest`, `sw.js`, `icon-512.png`, and this README. Companion to the SUBSTRATE-9 Site Dossier, Field Dossier, and Print & Play pack.*
