import type { Chapter } from "./types.ts";
import { reorderScenesByInsert } from "./reorder.ts";

export function normalizeChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const chapters: Chapter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; title?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = typeof record.title === "string" ? record.title.trim() : "";
    chapters.push({ id, title: title || "Глава" });
  }
  return chapters;
}

export function validChapterId(
  chapterId: unknown,
  chapters: readonly Chapter[],
): string | undefined {
  if (typeof chapterId !== "string") return undefined;
  const id = chapterId.trim();
  if (!id || !chapters.some((chapter) => chapter.id === id)) return undefined;
  return id;
}

export function createChapter(chapters: readonly Chapter[], id: string, title?: string): Chapter[] {
  const cleanId = id.trim();
  if (!cleanId || chapters.some((chapter) => chapter.id === cleanId)) return chapters as Chapter[];
  const name = title?.trim() || `Глава ${chapters.length + 1}`;
  return [...chapters, { id: cleanId, title: name }];
}

export function renameChapter(chapters: readonly Chapter[], id: string, title: string): Chapter[] {
  const name = title.trim();
  if (!name) return chapters as Chapter[];
  let changed = false;
  const next = chapters.map((chapter) => {
    if (chapter.id !== id || chapter.title === name) return chapter;
    changed = true;
    return { ...chapter, title: name };
  });
  return changed ? next : (chapters as Chapter[]);
}

/** Move a chapter one step. `-1` is up, `1` is down. Scene order is not involved. */
export function moveChapter(
  chapters: readonly Chapter[],
  id: string,
  direction: -1 | 1,
): Chapter[] {
  const index = chapters.findIndex((chapter) => chapter.id === id);
  if (index < 0) return chapters as Chapter[];
  const insertBefore = direction < 0 ? index - 1 : index + 2;
  if (insertBefore < 0) return chapters as Chapter[];
  return reorderScenesByInsert(chapters, id, insertBefore);
}

export function detachChapter<T extends { chapterId?: string }>(
  chapters: readonly Chapter[],
  scenes: readonly T[],
  chapterId: string,
): { chapters: Chapter[]; scenes: T[] } {
  if (!chapters.some((chapter) => chapter.id === chapterId)) {
    return { chapters: chapters as Chapter[], scenes: scenes as T[] };
  }
  return {
    chapters: chapters.filter((chapter) => chapter.id !== chapterId),
    scenes: clearChapterAssignment(scenes, chapterId),
  };
}

export function clearChapterAssignment<T extends { chapterId?: string }>(
  items: readonly T[],
  chapterId: string,
): T[] {
  let changed = false;
  const next = items.map((item) => {
    if (item.chapterId !== chapterId) return item;
    changed = true;
    const copy = { ...item };
    delete copy.chapterId;
    return copy;
  });
  return changed ? next : (items as T[]);
}

export function assignSceneToChapter<T extends { id: string; chapterId?: string }>(
  scenes: readonly T[],
  sceneId: string,
  chapterId: string | null,
  chapters: readonly Chapter[],
): T[] {
  const target = chapterId ? validChapterId(chapterId, chapters) : undefined;
  if (chapterId && !target) return scenes as T[];
  let changed = false;
  const next = scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;
    if ((scene.chapterId || undefined) === target) return scene;
    changed = true;
    const copy = { ...scene };
    if (target) copy.chapterId = target;
    else delete copy.chapterId;
    return copy;
  });
  return changed ? next : (scenes as T[]);
}

/**
 * Reorder scenes that share a chapter, writing them back into the same slots.
 * Other scenes stay put, so chapter membership does not reshuffle the book.
 * `chapterId` null is the unassigned group. When every scene is unassigned this
 * matches a flat reorder of `scenes`.
 */
export function reorderScenesInChapter<T extends { id: string; chapterId?: string }>(
  scenes: readonly T[],
  chapterId: string | null,
  fromId: string,
  insertBefore: number,
): T[] {
  const slots: number[] = [];
  const group: T[] = [];
  scenes.forEach((scene, index) => {
    if ((scene.chapterId || null) !== chapterId) return;
    slots.push(index);
    group.push(scene);
  });
  const reordered = reorderScenesByInsert(group, fromId, insertBefore);
  if (reordered === group) return scenes as T[];
  const next = scenes.slice();
  slots.forEach((slot, index) => {
    next[slot] = reordered[index];
  });
  return next;
}
