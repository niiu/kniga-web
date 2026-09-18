import type { Story } from "./types.ts";
import { normalizeLoadedStory } from "./gameEngine.ts";

/** Маркер подлинности книг Книги. Без него HTML не принимается. */
export const KNIGA_MARKER = "KNIGA-ENGINE-v1";

export type BookSource = "html" | "story";
export type ParseErrorCode = "empty" | "no_marker" | "not_story" | "bad_json";

export class BookParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = "BookParseError";
    this.code = code;
  }
}

export function stampStory(story: Story): Story {
  return { ...story, knigaMarker: KNIGA_MARKER };
}

export function jsonForHtmlScript(story: Story): string {
  return JSON.stringify(stampStory(story), null, 2).replace(/</g, "\\u003c");
}

export function hasKnigaHtmlMarker(html: string): boolean {
  if (!html) return false;
  if (html.includes(`data-kniga-engine="${KNIGA_MARKER}"`)) return true;
  if (html.includes(`data-kniga-engine='${KNIGA_MARKER}'`)) return true;
  if (/name=["']kniga-engine["'][^>]*content=["']KNIGA-ENGINE-v1["']/i.test(html)) return true;
  if (/content=["']KNIGA-ENGINE-v1["'][^>]*name=["']kniga-engine["']/i.test(html)) return true;
  if (html.includes("<!-- KNIGA-ENGINE-v1")) return true;
  if (/id=["']kniga-story-data["']/i.test(html) && html.includes(KNIGA_MARKER)) return true;
  return false;
}

function extractStoryJsonFromHtml(html: string): unknown {
  const tagged = html.match(
    /<script\b[^>]*\bid=["']kniga-story-data["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (tagged?.[1]) {
    return JSON.parse(tagged[1]);
  }
  const assigned = html.match(/const\s+story\s*=\s*(\{[\s\S]*?\});/);
  if (assigned?.[1]) {
    return JSON.parse(assigned[1]);
  }
  throw new BookParseError("not_story", "В HTML нет данных книги");
}

export function looksLikeStory(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as { scenes?: unknown; knigaMarker?: unknown };
  if (!Array.isArray(d.scenes)) return false;
  if (d.knigaMarker != null && d.knigaMarker !== KNIGA_MARKER) return false;
  return true;
}

export function parseBookText(
  text: string,
  fileName = "",
): { story: Story; source: BookSource } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new BookParseError("empty", "Файл пуст");
  }

  const lower = fileName.toLowerCase();
  const looksHtml =
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    /^\s*<(!DOCTYPE|html|head|meta|script)/i.test(trimmed);

  if (looksHtml) {
    if (!hasKnigaHtmlMarker(trimmed)) {
      throw new BookParseError(
        "no_marker",
        "Файл отклонён: это не HTML-книга Книги (нет маркера KNIGA-ENGINE-v1)",
      );
    }
    let parsed: unknown;
    try {
      parsed = extractStoryJsonFromHtml(trimmed);
    } catch (err) {
      if (err instanceof BookParseError) throw err;
      throw new BookParseError("not_story", "Не удалось прочитать историю из HTML");
    }
    if (!looksLikeStory(parsed)) {
      throw new BookParseError("not_story", "HTML помечен, но внутри нет истории Книги");
    }
    return { story: normalizeLoadedStory(parsed), source: "html" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new BookParseError("bad_json", "Файл не похож ни на .story, ни на HTML-книгу");
  }

  if (!looksLikeStory(parsed)) {
    throw new BookParseError("not_story", "Это не книга: нет списка сцен Книги");
  }

  const marker = (parsed as { knigaMarker?: unknown }).knigaMarker;
  if (marker != null && marker !== KNIGA_MARKER) {
    throw new BookParseError("no_marker", "Чужой маркер — файл отклонён");
  }

  return { story: normalizeLoadedStory(parsed), source: "story" };
}

export function parseErrorMessage(err: unknown): string {
  if (err instanceof BookParseError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Не удалось прочитать файл";
}
