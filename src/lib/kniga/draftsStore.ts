import type { Story } from "./types.ts";
import { normalizeLoadedStory } from "./gameEngine.ts";
import { uid } from "../utils.ts";

const INDEX_KEY = "kniga-engine-drafts-index";
const ACTIVE_KEY = "kniga-engine-active-draft";
const memory = new Map<string, string>();

export interface DraftMeta {
  id: string;
  title: string;
  sceneCount: number;
  updatedAt: number;
}

function bodyKey(id: string) {
  return `kniga-engine-draft:${id}`;
}

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
  } catch {
    /* fall through */
  }
  return memory.get(key) ?? null;
}

function safeSet(key: string, value: string) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    /* fall through */
  }
  memory.set(key, value);
}

function safeRemove(key: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

function readIndex(): DraftMeta[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DraftMeta[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string");
  } catch {
    return [];
  }
}

function writeIndex(items: DraftMeta[]) {
  safeSet(INDEX_KEY, JSON.stringify(items));
}

function metaFromStory(id: string, story: Story): DraftMeta {
  const title = (story.title || "").trim() || "Без названия";
  return {
    id,
    title,
    sceneCount: Array.isArray(story.scenes) ? story.scenes.length : 0,
    updatedAt: Date.now(),
  };
}

export function listDrafts(): DraftMeta[] {
  return [...readIndex()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveDraftId(): string | null {
  return safeGet(ACTIVE_KEY);
}

export function setActiveDraftId(id: string | null) {
  if (!id) safeRemove(ACTIVE_KEY);
  else safeSet(ACTIVE_KEY, id);
}

export function clearActiveDraft() {
  setActiveDraftId(null);
}

export function writeDraft(id: string, story: Story): DraftMeta {
  const meta = metaFromStory(id, story);
  safeSet(bodyKey(id), JSON.stringify(story));
  const index = readIndex().filter((item) => item.id !== id);
  index.unshift(meta);
  writeIndex(index);
  return meta;
}

export function saveDraft(story: Story, existingId?: string | null): DraftMeta {
  const id = existingId && readIndex().some((item) => item.id === existingId) ? existingId : uid("book");
  const meta = writeDraft(id, story);
  setActiveDraftId(id);
  return meta;
}

export function getDraft(id: string): Story | null {
  const raw = safeGet(bodyKey(id));
  if (!raw) return null;
  try {
    return normalizeLoadedStory(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteDraft(id: string) {
  safeRemove(bodyKey(id));
  writeIndex(readIndex().filter((item) => item.id !== id));
  if (getActiveDraftId() === id) clearActiveDraft();
}

export function syncActiveDraft(story: Story) {
  const id = getActiveDraftId();
  if (!id) return;
  if (!readIndex().some((item) => item.id === id)) {
    clearActiveDraft();
    return;
  }
  writeDraft(id, story);
}
