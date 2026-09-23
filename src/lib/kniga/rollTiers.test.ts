import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateRollOutcome, resolveRollTierKey } from "./gameEngine.ts";

test("percentile bands map onto the five thresholds", () => {
  assert.equal(resolveRollTierKey(19, 20), "100");
  assert.equal(resolveRollTierKey(17, 20), "85");
  assert.equal(resolveRollTierKey(10, 20), "50");
  assert.equal(resolveRollTierKey(5, 20), "25");
  assert.equal(resolveRollTierKey(4, 20), "0");
});

test("a roll without saved tiers still lands on a threshold", () => {
  const weak = evaluateRollOutcome(
    { text: "бросок", next: "base", roll: "1d20" },
    {},
    0,
  );
  assert.equal(weak.tier, 0);
  assert.equal(weak.nextId, "base");

  const crit = evaluateRollOutcome(
    {
      text: "бросок",
      next: "base",
      roll: "1d20",
      rollTiers: { "100": { next: "crit", effects: "gold:10" } },
    },
    {},
    100,
  );
  assert.equal(crit.tier, 100);
  assert.equal(crit.nextId, "crit");
  assert.equal(crit.effects, "gold:10");
});
