import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { parseBookText, parseErrorMessage } from "@/lib/kniga/marker.ts";

export interface PublishedBookMeta {
  id: string;
  title: string;
  source: string;
  sceneCount: number;
  createdAt: string;
}

function newId() {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const listPublishedBooks = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublishedBookMeta[]> => {
    try {
      const sql = await getSql();
      const rows = await sql<{
        id: string;
        title: string;
        source: string;
        scene_count: number;
        created_at: string;
      }>`
        select id, title, source, scene_count, created_at::text as created_at
        from published_books
        order by created_at desc
      `;
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        source: r.source,
        sceneCount: Number(r.scene_count) || 0,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("[catalog] list failed:", err);
      return [];
    }
  },
);

export const getPublishedBook = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ meta: PublishedBookMeta; storyJson: string }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      source: string;
      scene_count: number;
      created_at: string;
      story_json: string;
    }>`
      select id, title, source, scene_count, created_at::text as created_at, story_json
      from published_books
      where id = ${data.id}
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("Книга не найдена");
    }
    return {
      meta: {
        id: row.id,
        title: row.title,
        source: row.source,
        sceneCount: Number(row.scene_count) || 0,
        createdAt: row.created_at,
      },
      storyJson: row.story_json,
    };
  });

export const publishBook = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fileName: z.string().min(1).max(200),
      text: z.string().min(2).max(1_500_000),
    }),
  )
  .handler(async ({ data }): Promise<PublishedBookMeta> => {
    let parsed;
    try {
      parsed = parseBookText(data.text, data.fileName);
    } catch (err) {
      throw new Error(parseErrorMessage(err));
    }
    const id = newId();
    const sql = await getSql();
    const storyJson = JSON.stringify(parsed.story);
    await sql`
      insert into published_books (id, title, source, scene_count, story_json)
      values (
        ${id},
        ${parsed.story.title || "Без названия"},
        ${parsed.source},
        ${parsed.story.scenes.length},
        ${storyJson}
      )
    `;
    return {
      id,
      title: parsed.story.title || "Без названия",
      source: parsed.source,
      sceneCount: parsed.story.scenes.length,
      createdAt: new Date().toISOString(),
    };
  });
