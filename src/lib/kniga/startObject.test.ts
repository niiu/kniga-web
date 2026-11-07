import assert from "node:assert/strict";
import { test } from "node:test";
import { hasStartUpdates, mergeStartValues, startCopyAction } from "./startObject.ts";

test("merge keeps unpicked start fields and does not mutate inputs", () => {
  const starting = { health: 10, gold: 3 };
  const picked = { health: 80 };
  const next = mergeStartValues(starting, picked);
  assert.deepEqual(next, { health: 80, gold: 3 });
  assert.deepEqual(starting, { health: 10, gold: 3 });
  assert.deepEqual(picked, { health: 80 });
});

test("merge adds a missing field and copies zero", () => {
  const next = mergeStartValues({ gold: 1 }, { Факел: 0 });
  assert.deepEqual(next, { gold: 1, Факел: 0 });
});

test("merge returns the same object when every picked value already matches", () => {
  const starting = { health: 10, gold: 0 };
  const next = mergeStartValues(starting, { health: 10, missing: Number.NaN, "  ": 4 });
  assert.equal(next, starting);
});

test("merge ignores blank names and non-finite numbers", () => {
  const starting = { gold: 1 };
  const next = mergeStartValues(starting, {
    "": 2,
    "   ": 3,
    health: Number.NaN,
    strength: Number.POSITIVE_INFINITY,
  });
  assert.equal(next, starting);
});

test("merge trims a name and updates only that field", () => {
  const next = mergeStartValues({ health: 10, gold: 1 }, { " health ": 40 });
  assert.deepEqual(next, { health: 40, gold: 1 });
});

test("startCopyAction distinguishes add, update, and same", () => {
  const starting = { health: 10 };
  assert.equal(startCopyAction(starting, "gold", 0), "add");
  assert.equal(startCopyAction(starting, "health", 12), "update");
  assert.equal(startCopyAction(starting, "health", 10), "same");
});

test("merge tolerates a missing start map from an older save", () => {
  const next = mergeStartValues(undefined, { health: 10, gold: 1 });
  assert.deepEqual(next, { health: 10, gold: 1 });
  assert.deepEqual(mergeStartValues(null, null), {});
});

test("hasStartUpdates is false when the sheet already matches the start object", () => {
  const starting = { health: 10, gold: 1 };
  assert.equal(hasStartUpdates(starting, { health: 10, gold: 1 }), false);
  assert.equal(hasStartUpdates(starting, { health: 10, gold: 2 }), true);
  assert.equal(hasStartUpdates(starting, {}), false);
});
