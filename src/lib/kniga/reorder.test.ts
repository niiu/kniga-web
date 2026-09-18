import assert from "node:assert/strict";
import { test } from "node:test";
import { insertBeforeFromY, reorderScenesByInsert } from "./reorder.ts";

const list = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

test("moves first scene to the bottom", () => {
  const next = reorderScenesByInsert(list, "a", 4);
  assert.deepEqual(
    next.map((s) => s.id),
    ["b", "c", "d", "a"],
  );
});

test("moves last scene to the top", () => {
  const next = reorderScenesByInsert(list, "d", 0);
  assert.deepEqual(
    next.map((s) => s.id),
    ["d", "a", "b", "c"],
  );
});

test("drops in place are a no-op and keep the same array", () => {
  assert.equal(reorderScenesByInsert(list, "b", 1), list);
  assert.equal(reorderScenesByInsert(list, "b", 2), list);
});

test("unknown id is a no-op", () => {
  assert.equal(reorderScenesByInsert(list, "missing", 0), list);
});

test("insertBeforeFromY uses the row midpoint", () => {
  const rows = [
    { top: 0, height: 40 },
    { top: 40, height: 40 },
    { top: 80, height: 40 },
  ];
  assert.equal(insertBeforeFromY(10, rows), 0);
  assert.equal(insertBeforeFromY(30, rows), 1);
  assert.equal(insertBeforeFromY(90, rows), 2);
  assert.equal(insertBeforeFromY(200, rows), 3);
});
