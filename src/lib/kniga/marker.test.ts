import assert from "node:assert/strict";
import { test } from "node:test";
import { BookParseError, KNIGA_MARKER, jsonForHtmlScript, parseBookText, stampStory } from "./marker.ts";
import { defaultStory } from "./defaultStory.ts";

test("rejects random HTML without marker", () => {
  assert.throws(
    () => parseBookText("<!DOCTYPE html><html><body>hi</body></html>", "page.html"),
    (err: unknown) => err instanceof BookParseError && err.code === "no_marker",
  );
});

test("rejects random JSON", () => {
  assert.throws(
    () => parseBookText('{"foo":1}', "notes.json"),
    (err: unknown) => err instanceof BookParseError && err.code === "not_story",
  );
});

test("accepts legacy .story with scenes", () => {
  const { story, source } = parseBookText(JSON.stringify(defaultStory), "demo.story");
  assert.equal(source, "story");
  assert.equal(story.title, defaultStory.title);
  assert.ok(story.scenes.length > 0);
});

test("accepts stamped HTML export", () => {
  const payload = jsonForHtmlScript(defaultStory);
  const html = `<!DOCTYPE html>
<html lang="ru" data-kniga-engine="${KNIGA_MARKER}">
<head><meta name="kniga-engine" content="${KNIGA_MARKER}"></head>
<body>
<script type="application/json" id="kniga-story-data" data-kniga-engine="${KNIGA_MARKER}">${payload}</script>
</body></html>`;
  const { story, source } = parseBookText(html, "book.html");
  assert.equal(source, "html");
  assert.equal(story.title, defaultStory.title);
  assert.equal(story.knigaMarker, KNIGA_MARKER);
});

test("stampStory writes marker", () => {
  assert.equal(stampStory(defaultStory).knigaMarker, KNIGA_MARKER);
});
