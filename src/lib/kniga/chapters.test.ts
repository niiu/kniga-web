import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignSceneToChapter,
  clearChapterAssignment,
  createChapter,
  detachChapter,
  moveChapter,
  normalizeChapters,
  reorderScenesInChapter,
  validChapterId,
} from "./chapters.ts";
import { normalizeLoadedStory } from "./gameEngine.ts";
import { jsonForHtmlScript, KNIGA_MARKER, parseBookText } from "./marker.ts";
import { reorderScenesByInsert } from "./reorder.ts";
import type { Story } from "./types.ts";

function legacyStory(): Story {
  return {
    title: "Старая книга",
    startScene: "a",
    scenes: [
      {
        id: "a",
        text: "Начало",
        choices: [{ text: "Дальше", next: "b" }],
      },
      {
        id: "b",
        text: "Конец",
        choices: [{ text: "В начало", next: "a" }],
      },
    ],
    variables: { health: 10 },
    items: { Факел: 1 },
    suggestedVariables: [],
    suggestedItems: [],
    suggestedNpcNames: [],
    suggestedEmotions: [],
  };
}

function playShape(story: Story) {
  return {
    startScene: story.startScene,
    ids: story.scenes.map((scene) => scene.id),
    links: story.scenes.map((scene) => scene.choices.map((choice) => choice.next)),
    texts: story.scenes.map((scene) => scene.text),
  };
}

test("an old story without chapters keeps scenes, links and the start scene", () => {
  const loaded = parseBookText(JSON.stringify(legacyStory()), "old.story").story;
  assert.deepEqual(playShape(loaded), playShape(legacyStory()));
  assert.equal(loaded.chapters, undefined);
  assert.equal(
    loaded.scenes.every((scene) => scene.chapterId === undefined),
    true,
  );
  assert.equal(loaded.variables.health, 10);
  assert.equal(loaded.items["Факел"], 1);
});

test("chapters round-trip through .story, HTML export and a second normalize", () => {
  const source = legacyStory();
  source.chapters = [
    { id: "ch-forest", title: "Лес" },
    { id: "ch-town", title: "Город" },
  ];
  source.scenes[0] = { ...source.scenes[0], chapterId: "ch-forest" };
  source.scenes[1] = { ...source.scenes[1], chapterId: "ch-town" };

  const fromStory = parseBookText(JSON.stringify(source), "book.story").story;
  const payload = jsonForHtmlScript(fromStory);
  const html = `<!DOCTYPE html><html data-kniga-engine="${KNIGA_MARKER}"><script type="application/json" id="kniga-story-data" data-kniga-engine="${KNIGA_MARKER}">${payload}</script></html>`;
  const fromHtml = parseBookText(html, "book.html").story;
  const republished = normalizeLoadedStory(JSON.parse(JSON.stringify(fromHtml)));

  assert.deepEqual(republished.chapters, source.chapters);
  assert.equal(republished.scenes[0].chapterId, "ch-forest");
  assert.equal(republished.scenes[1].chapterId, "ch-town");
  assert.deepEqual(playShape(republished), playShape(source));
});

test("assigning and reordering chapters does not change play order or links", () => {
  const chapters = createChapter(createChapter([], "ch-1", "Лес"), "ch-2", "Город");
  const scenes = legacyStory().scenes;
  const assigned = assignSceneToChapter(scenes, "b", "ch-2", chapters);
  assert.deepEqual(
    assigned.map((scene) => scene.id),
    ["a", "b"],
  );
  assert.equal(assigned[0].chapterId, undefined);
  assert.equal(assigned[1].chapterId, "ch-2");
  assert.deepEqual(
    assigned.map((scene) => scene.choices.map((choice) => choice.next)),
    scenes.map((scene) => scene.choices.map((choice) => choice.next)),
  );

  const moved = moveChapter(chapters, "ch-1", 1);
  assert.deepEqual(
    moved.map((chapter) => chapter.id),
    ["ch-2", "ch-1"],
  );
  assert.deepEqual(
    assigned.map((scene) => scene.id),
    ["a", "b"],
  );
});

test("reorder inside a chapter only swaps that chapter's slots", () => {
  const scenes = [
    { id: "a", chapterId: undefined },
    { id: "b", chapterId: "ch" },
    { id: "c" },
    { id: "d", chapterId: "ch" },
  ];
  const next = reorderScenesInChapter(scenes, "ch", "d", 0);
  assert.deepEqual(
    next.map((scene) => scene.id),
    ["a", "d", "c", "b"],
  );
  assert.equal(next[0].chapterId, undefined);
  assert.equal(next[1].chapterId, "ch");
  assert.equal(next[2].chapterId, undefined);
  assert.equal(next[3].chapterId, "ch");
});

test("flat reorder of an unassigned book matches the existing scene reorder", () => {
  const scenes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    reorderScenesInChapter(scenes, null, "a", 3).map((scene) => scene.id),
    reorderScenesByInsert(scenes, "a", 3).map((scene) => scene.id),
  );
});

test("removing a chapter unassigns its scenes and keeps the scenes", () => {
  const story = normalizeLoadedStory({
    ...legacyStory(),
    chapters: [{ id: "ch", title: "Лес" }],
    scenes: [
      { ...legacyStory().scenes[0], chapterId: "ch" },
      { ...legacyStory().scenes[1], chapterId: "ch" },
    ],
    deletedScenes: [
      {
        originalIndex: 2,
        scene: { id: "c", text: "В корзине", choices: [], chapterId: "ch" },
      },
    ],
  });
  assert.equal(story.deletedScenes?.[0]?.scene.chapterId, "ch");
  assert.equal(story.startScene, "a");
  const detached = detachChapter(story.chapters || [], story.scenes, "ch");
  const cleared = detached.scenes;
  const clearedDeleted = clearChapterAssignment(
    (story.deletedScenes || []).map((entry) => entry.scene),
    "ch",
  );
  assert.deepEqual(detached.chapters, []);
  assert.deepEqual(
    cleared.map((scene) => scene.id),
    ["a", "b"],
  );
  assert.equal(
    cleared.every((scene) => scene.chapterId === undefined),
    true,
  );
  assert.equal(clearedDeleted[0].id, "c");
  assert.equal(clearedDeleted[0].chapterId, undefined);
  assert.deepEqual(
    cleared.map((scene) => scene.choices.map((choice) => choice.next)),
    [["b"], ["a"]],
  );
});

test("a dangling chapter id is dropped and the scene stays", () => {
  const loaded = normalizeLoadedStory({
    ...legacyStory(),
    chapters: [{ id: "real", title: "Лес" }],
    scenes: [
      { ...legacyStory().scenes[0], chapterId: "missing" },
      { ...legacyStory().scenes[1], chapterId: "real" },
    ],
  });
  assert.equal(loaded.scenes[0].id, "a");
  assert.equal(loaded.scenes[0].chapterId, undefined);
  assert.equal(loaded.scenes[1].chapterId, "real");
  assert.equal(loaded.startScene, "a");
  assert.deepEqual(
    normalizeChapters([
      { id: "real", title: "  " },
      { id: "real", title: "Другая" },
    ]),
    [{ id: "real", title: "Глава" }],
  );
  assert.equal(validChapterId("missing", loaded.chapters || []), undefined);
});
