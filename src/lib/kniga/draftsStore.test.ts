import assert from "node:assert/strict";
import { test } from "node:test";
import type { Story } from "./types.ts";
import {
  clearActiveDraft,
  deleteDraft,
  getActiveDraftId,
  getDraft,
  listDrafts,
  saveDraft,
  syncActiveDraft,
} from "./draftsStore.ts";

function clearAll() {
  for (const item of listDrafts()) deleteDraft(item.id);
  clearActiveDraft();
}

function story(title: string, scenes = 1): Story {
  return {
    title,
    startScene: "s1",
    scenes: Array.from({ length: scenes }, (_, i) => ({
      id: `s${i + 1}`,
      text: "text",
      choices: [],
    })),
    variables: {},
    items: {},
    suggestedVariables: [],
    suggestedItems: [],
    suggestedNpcNames: [],
    suggestedEmotions: [],
  };
}

test("saves several books and lists newest first", () => {
  clearAll();
  const first = saveDraft(story("Лес", 2));
  const second = saveDraft(story("Город", 3), null);
  const listed = listDrafts();
  assert.equal(listed[0]?.id, second.id);
  assert.equal(listed[0]?.title, "Город");
  assert.equal(listed[0]?.sceneCount, 3);
  assert.ok(listed.some((item) => item.id === first.id));
});

test("save with the same id overwrites and stays active", () => {
  clearAll();
  const created = saveDraft(story("Черновик", 1));
  const updated = saveDraft(story("Черновик правленый", 4), created.id);
  assert.equal(updated.id, created.id);
  assert.equal(getActiveDraftId(), created.id);
  assert.equal(getDraft(created.id)?.title, "Черновик правленый");
  assert.equal(getDraft(created.id)?.scenes.length, 4);
});

test("delete removes the book and clears active if needed", () => {
  clearAll();
  const created = saveDraft(story("Удалить"));
  deleteDraft(created.id);
  assert.equal(getDraft(created.id), null);
  assert.equal(getActiveDraftId(), null);
  assert.equal(listDrafts().some((item) => item.id === created.id), false);
});

test("syncActiveDraft writes only when a book is open", () => {
  clearAll();
  syncActiveDraft(story("Не должна появиться"));
  const before = listDrafts().length;
  const created = saveDraft(story("Открытая"));
  syncActiveDraft(story("Открытая и правленная", 2));
  assert.equal(getDraft(created.id)?.title, "Открытая и правленная");
  assert.equal(listDrafts().length, before + 1);
});
