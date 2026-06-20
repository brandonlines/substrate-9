"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scriptStart = html.indexOf("<script>") + "<script>".length;
const engineStart = html.indexOf("const START_HP");
const context = {};

vm.runInNewContext(
  html.slice(scriptStart, engineStart) + `
    let S = null;
    globalThis.__game = {
      STORY,
      consequenceScores,
      routeReady,
      setState(next) { S = next; }
    };
  `,
  context
);

const game = context.__game;

function makeState(flags = {}, inv = {}, lockdown = 0) {
  return { scene: "hub", hp: 40, maxHp: 40, lockdown, inv, flags, uplinksUsed: {}, turn: 0 };
}

function choicesFor(sceneId, state) {
  game.setState(state);
  const value = game.STORY.scenes[sceneId].choices;
  return typeof value === "function" ? value() : value;
}

test("every story destination resolves to a scene", () => {
  const sceneIds = new Set(Object.keys(game.STORY.scenes));
  const missing = [];
  const refs = html.matchAll(/(?:goto|success|failure|onVictory|onDefeat):"([^"]+)"/g);

  for (const match of refs) {
    if (!match[1].startsWith("__") && !sceneIds.has(match[1])) missing.push(match[1]);
  }

  assert.deepEqual([...new Set(missing)], []);
});

test("dynamic scene fields render for weak and strong expedition states", () => {
  const weak = makeState();
  const strong = makeState({
    abacusTruthKnown: true,
    curatorUnderstood: true,
    foundStaffLogs: true,
    familyArchiveRecovered: true,
    staffDutyRosterRecovered: true,
    survivorSaved: true,
    hydroponicsPreserved: true,
    trustedPip: true,
    trustedVesta: true,
    trustedAbacus: true,
    securityOverride: true,
    waterRouted: true,
    hiddenVentRoute: true,
    sentinelAlly: true,
    containmentProtocolRestored: true,
    exitPowered: true,
    aiFragmentsUnified: true,
    endingShutdown: true,
    endingReconcile: true,
    endingContain: true,
    endingWitness: true,
    endingBargain: true,
    broadcastPrepared: true,
    controlledScram: true
  }, { memory: 3, seed: 1, datakey: 1 });

  for (const [sceneId, scene] of Object.entries(game.STORY.scenes)) {
    for (const state of [weak, strong]) {
      game.setState(state);
      for (const field of ["location", "title", "text", "bark", "choices"]) {
        if (typeof scene[field] === "function") {
          assert.doesNotThrow(() => scene[field](), `${sceneId}.${field}`);
        }
      }
    }
  }
});

test("ending routes require distinct preparation profiles", () => {
  const thin = makeState();
  const witness = makeState({
    abacusTruthKnown: true,
    curatorUnderstood: true,
    foundStaffLogs: true,
    familyArchiveRecovered: true,
    staffDutyRosterRecovered: true,
    securityOverride: true
  }, { memory: 2 });
  const exodus = makeState({
    survivorSaved: true,
    hydroponicsPreserved: true,
    familyArchiveRecovered: true,
    trustedPip: true,
    securityOverride: true,
    waterRouted: true,
    sentinelAlly: true
  });
  const bargain = makeState({
    securityOverride: true,
    waterRouted: true,
    trustedPip: true,
    foundStaffLogs: true
  });

  assert.equal(game.routeReady("reconcile", thin), false);
  assert.equal(game.routeReady("witness", witness), true);
  assert.equal(game.routeReady("exodus", exodus), true);
  assert.equal(game.routeReady("safeBargain", bargain), true);
  assert.equal(game.routeReady("cleanShutdown", thin), false);
});

test("final council locks and reveals strategies from accumulated choices", () => {
  const thin = makeState();
  const rich = makeState({
    abacusTruthKnown: true,
    curatorUnderstood: true,
    foundStaffLogs: true,
    familyArchiveRecovered: true,
    staffDutyRosterRecovered: true,
    securityOverride: true,
    curatorAware: true
  }, { memory: 2, seed: 1 });

  const thinChoices = choicesFor("capstone", thin);
  const richChoices = choicesFor("capstone", rich);
  const thinReconcile = thinChoices.find(choice => choice.goto === "intent_reconcile");
  const richWitness = richChoices.find(choice => choice.goto === "intent_witness");
  const bargain = richChoices.find(choice => choice.goto === "intent_bargain");

  assert.equal(thinReconcile.locked(thin), false);
  assert.equal(richWitness.locked(rich), true);
  assert.equal(bargain.show(rich), true);
});

test("restored containment unlocks the Nexus binding", () => {
  const state = makeState({ endingContain: true, containmentProtocolRestored: true });
  const bind = choicesFor("nexus_gate", state).find(choice => choice.goto === "nexus_bind");

  assert.ok(bind);
  assert.equal(bind.locked(state), true);
});

test("prior room outcomes unlock cross-system solutions", () => {
  const cryo = choicesFor("cryo_containment", makeState({ waterRouted: true, securityOverride: true }));
  const hydro = choicesFor("hydroponics", makeState({ survivorSaved: true, antidoteRecovered: true }, { antidote: 1 }));
  const security = choicesFor("security_annex", makeState({ hiddenVentRoute: true, survivorSaved: true, familyArchiveRecovered: true }));
  const server = choicesFor("server_spire", makeState({ familyArchiveRecovered: true }));
  const staff = choicesFor("staff_access", makeState({ securityDone: true, foundStaffLogs: true }));

  assert.ok(cryo.some(choice => choice.goto === "cryo_dual_save"));
  assert.ok(hydro.some(choice => choice.goto === "hydro_vale"));
  assert.ok(hydro.some(choice => choice.goto === "hydro_inoculate"));
  assert.ok(security.some(choice => choice.goto === "security_vent"));
  assert.ok(security.some(choice => choice.goto === "security_vale"));
  assert.ok(security.some(choice => choice.goto === "security_family_trace"));
  assert.ok(server.some(choice => choice.goto === "server_crossref"));
  assert.ok(staff.some(choice => choice.goto === "staff_crossref"));
});

test("Atrium companion confrontations lead to a team council", () => {
  const pending = choicesFor("hub", makeState({ serverDone: true, cryoDone: true }));
  const councilReady = choicesFor("hub", makeState({
    serverDone: true,
    cryoDone: true,
    abacusConfronted: true,
    vestaConfronted: true
  }));

  assert.ok(pending.some(choice => choice.goto === "abacus_confront"));
  assert.ok(pending.some(choice => choice.goto === "vesta_confront"));
  assert.ok(pending.some(choice => choice.goto === "pip_confront"));
  assert.ok(councilReady.some(choice => choice.goto === "team_council"));
});

test("all seven ending scenes remain available in the story graph", () => {
  const endings = [
    "ending_shutdown",
    "ending_reconciliation",
    "ending_containment",
    "ending_exodus",
    "ending_witness",
    "ending_bargain",
    "ending_extraction"
  ];

  for (const ending of endings) assert.ok(game.STORY.scenes[ending], ending);
});
