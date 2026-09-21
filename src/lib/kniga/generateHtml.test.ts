import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { getDialogueAwareNext } from "./gameEngine.ts";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "generateHtml.ts"), "utf8");

test("standalone player treats end and missing scenes as a finale, not a jump to scene 0", () => {
  assert.match(src, /function isEndId/);
  assert.match(src, /ended: visibleChoices\.length === 0/);
  assert.match(src, /Конец истории/);
  assert.doesNotMatch(src, /scene = story\.scenes\[0\]/);
});

test("empty next in a normal scene is the end, in dialogue it stays", () => {
  assert.equal(getDialogueAwareNext({ text: "x", next: "" }, "start", false), "end");
  assert.equal(getDialogueAwareNext({ text: "x", next: "end" }, "start", false), "end");
  assert.equal(getDialogueAwareNext({ text: "x", next: "" }, "dialog1", true), "dialog1");
  assert.equal(getDialogueAwareNext({ text: "x", next: "quiet" }, "start", false), "quiet");
});
