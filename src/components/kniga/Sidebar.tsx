import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useStoryStore } from "@/lib/kniga/storyStore.ts";
import { insertBeforeFromY } from "@/lib/kniga/reorder.ts";
import type { Scene } from "@/lib/kniga/types.ts";
import { cn } from "@/lib/utils.ts";

interface SidebarProps {
  onExport: () => void;
  onSelectScene: (id: string) => void;
}

type DragState = {
  id: string;
  pointerId: number;
  fromIndex: number;
  insertBefore: number;
  group: string;
};

export function Sidebar({ onExport, onSelectScene }: SidebarProps) {
  const story = useStoryStore((s) => s.story);
  const currentSceneId = useStoryStore((s) => s.currentSceneId);
  const setTitle = useStoryStore((s) => s.setTitle);
  const addScene = useStoryStore((s) => s.addScene);
  const insertSceneAfter = useStoryStore((s) => s.insertSceneAfter);
  const deleteScene = useStoryStore((s) => s.deleteScene);
  const restoreDeletedScene = useStoryStore((s) => s.restoreDeletedScene);
  const permanentlyDeleteDeletedScene = useStoryStore((s) => s.permanentlyDeleteDeletedScene);
  const reorderScene = useStoryStore((s) => s.reorderScene);
  const reorderScenesInGroup = useStoryStore((s) => s.reorderScenesInGroup);
  const addChapter = useStoryStore((s) => s.addChapter);
  const renameChapter = useStoryStore((s) => s.renameChapter);
  const moveChapterBy = useStoryStore((s) => s.moveChapterBy);
  const removeChapter = useStoryStore((s) => s.removeChapter);
  const setSceneChapter = useStoryStore((s) => s.setSceneChapter);
  const addSceneInChapter = useStoryStore((s) => s.addSceneInChapter);
  const [showDeleted, setShowDeleted] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<string | null>(null);
  const [insertBefore, setInsertBefore] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const listRefs = useRef(new Map<string, HTMLUListElement>());
  const listenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);
  const deleted = story.deletedScenes || [];
  const chapters = story.chapters ?? [];

  function detachListeners() {
    const listeners = listenersRef.current;
    if (!listeners) return;
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.up);
    listenersRef.current = null;
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  }

  function hitInsertBefore(clientY: number, list: HTMLUListElement | undefined) {
    if (!list) return 0;
    const rows = [...list.querySelectorAll<HTMLElement>(":scope > li[data-scene-id]")].map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
    return insertBeforeFromY(clientY, rows);
  }

  function autoScroll(clientY: number, list: HTMLUListElement | undefined) {
    const viewport = list?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const zone = 36;
    if (clientY < rect.top + zone) viewport.scrollTop -= 14;
    else if (clientY > rect.bottom - zone) viewport.scrollTop += 14;
  }

  function startDrag(
    sceneId: string,
    fromIndex: number,
    group: string,
    e: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      id: sceneId,
      pointerId: e.pointerId,
      fromIndex,
      insertBefore: fromIndex,
      group,
    };
    setDragId(sceneId);
    setDragGroup(group);
    setInsertBefore(fromIndex);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const move = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      autoScroll(ev.clientY, listRefs.current.get(drag.group));
      const next = hitInsertBefore(ev.clientY, listRefs.current.get(drag.group));
      if (next === drag.insertBefore) return;
      drag.insertBefore = next;
      setInsertBefore(next);
    };
    const up = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const { id, insertBefore: dropAt, group: droppedGroup } = drag;
      dragRef.current = null;
      setDragId(null);
      setDragGroup(null);
      setInsertBefore(null);
      detachListeners();
      if (droppedGroup === "all") reorderScene(id, dropAt);
      else reorderScenesInGroup(droppedGroup === "none" ? null : droppedGroup, id, dropAt);
    };
    listenersRef.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  useEffect(() => () => detachListeners(), []);

  function toggleCollapsed(key: string) {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  }

  function renderSceneList(scenes: Scene[], group: string) {
    return (
      <ul
        ref={(node) => {
          if (node) listRefs.current.set(group, node);
          else listRefs.current.delete(group);
        }}
        className="space-y-0.5"
        aria-label={group === "all" || group === "none" ? "Список сцен" : "Сцены главы"}
      >
        {scenes.map((scene, index) => {
          const dropBefore = dragGroup === group && dragId != null && insertBefore === index;
          const inPlace =
            dragId === scene.id && (insertBefore === index || insertBefore === index + 1);
          return (
            <li
              key={scene.id}
              data-scene-id={scene.id}
              className={cn(
                "rounded-md",
                dragId === scene.id && "opacity-50",
                dropBefore && !inPlace && "border-t-2 border-accent",
              )}
            >
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-sm border border-border bg-card text-ink hover:bg-muted active:cursor-grabbing touch-none select-none"
                  title="Перетащить"
                  aria-label="Перетащить сцену"
                  aria-grabbed={dragId === scene.id}
                  draggable={false}
                  onPointerDown={(e) => startDrag(scene.id, index, group, e)}
                >
                  <GripVertical className="size-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectScene(scene.id)}
                  className={cn(
                    "min-h-11 min-w-0 flex-1 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                    scene.id === currentSceneId
                      ? "bg-ink text-paper"
                      : "hover:bg-muted text-foreground",
                  )}
                >
                  <span className="block truncate font-mono text-[13px]">{scene.id}</span>
                  {scene.id === story.startScene ? (
                    <span
                      className={cn(
                        "text-[10px]",
                        scene.id === currentSceneId ? "text-paper/70" : "text-ink-subtle",
                      )}
                    >
                      старт
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-card text-ink hover:bg-muted"
                  title="Добавить сцену после этой"
                  aria-label="Добавить сцену после этой"
                  onClick={() => insertSceneAfter(scene.id)}
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-card text-ink hover:bg-muted hover:text-destructive"
                  title="Удалить сцену"
                  aria-label="Удалить сцену"
                  onClick={() => deleteScene(scene.id)}
                >
                  <Trash2 className="size-4" strokeWidth={2.5} />
                </button>
              </div>
              {chapters.length > 0 ? (
                <label className="mb-1 flex items-center gap-2 px-1 text-[11px] text-ink-subtle">
                  <span className="shrink-0">Глава</span>
                  <select
                    className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                    aria-label={`Глава сцены ${scene.id}`}
                    value={scene.chapterId || ""}
                    onChange={(e) => setSceneChapter(scene.id, e.target.value || null)}
                  >
                    <option value="">Без главы</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </li>
          );
        })}
        {dragGroup === group && dragId != null && insertBefore === scenes.length ? (
          <li aria-hidden className="h-0.5 rounded-full bg-accent" />
        ) : null}
      </ul>
    );
  }

  const unassigned = story.scenes.filter((scene) => !scene.chapterId);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <BookOpen className="size-5 shrink-0" strokeWidth={1.75} />
        <Input
          value={story.title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 border-0 bg-transparent px-1 font-display text-lg font-medium tracking-tight shadow-none focus-visible:ring-0"
          aria-label="Название книги"
        />
      </div>
      <div className="space-y-2 px-3 pb-3">
        <Button className="w-full" onClick={() => addScene()}>
          <Plus className="size-4" />
          Новая сцена
        </Button>
        <Button variant="outline" className="w-full" onClick={() => addChapter()}>
          <Plus className="size-4" />
          Новая глава
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="space-y-3 pb-4">
          {chapters.length === 0 ? (
            renderSceneList(story.scenes, "all")
          ) : (
            <>
              <section>
                <button
                  type="button"
                  onClick={() => toggleCollapsed("none")}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted"
                  aria-expanded={!collapsed.none}
                >
                  {collapsed.none ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  Без главы
                  <span className="text-xs font-normal text-ink-subtle">{unassigned.length}</span>
                </button>
                {collapsed.none ? null : unassigned.length > 0 ? (
                  renderSceneList(unassigned, "none")
                ) : (
                  <p className="px-3 py-1 text-xs text-ink-subtle">Все сцены разложены по главам</p>
                )}
              </section>
              {chapters.map((chapter, index) => {
                const scenes = story.scenes.filter((scene) => scene.chapterId === chapter.id);
                const isCollapsed = !!collapsed[chapter.id];
                return (
                  <section key={chapter.id}>
                    <div className="flex items-center gap-0.5 px-1">
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? "Развернуть главу" : "Свернуть главу"}
                        onClick={() => toggleCollapsed(chapter.id)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                      <Input
                        value={titleDrafts[chapter.id] ?? chapter.title}
                        onChange={(e) =>
                          setTitleDrafts((drafts) => ({ ...drafts, [chapter.id]: e.target.value }))
                        }
                        onBlur={(e) => {
                          renameChapter(chapter.id, e.target.value);
                          setTitleDrafts((drafts) => {
                            const next = { ...drafts };
                            delete next[chapter.id];
                            return next;
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                        }}
                        aria-label={`Название главы ${chapter.title}`}
                        className="h-8 min-w-0 flex-1 px-2 text-sm"
                      />
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-sm hover:bg-muted disabled:opacity-40"
                        aria-label="Поднять главу"
                        disabled={index === 0}
                        onClick={() => moveChapterBy(chapter.id, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-sm hover:bg-muted disabled:opacity-40"
                        aria-label="Опустить главу"
                        disabled={index === chapters.length - 1}
                        onClick={() => moveChapterBy(chapter.id, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-sm text-ink hover:bg-muted hover:text-destructive"
                        aria-label="Убрать главу"
                        title="Убрать главу. Сцены останутся в книге."
                        onClick={() => removeChapter(chapter.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
                        aria-label="Добавить сцену в главу"
                        title="Добавить сцену в главу"
                        onClick={() => {
                          setCollapsed((current) => ({ ...current, [chapter.id]: false }));
                          addSceneInChapter(chapter.id);
                        }}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    {isCollapsed ? null : scenes.length > 0 ? (
                      renderSceneList(scenes, chapter.id)
                    ) : (
                      <p className="px-3 py-1 text-xs text-ink-subtle">
                        В этой главе пока нет сцен
                      </p>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setShowDeleted((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="size-3.5" />
            Корзина
            <Badge>{deleted.length}</Badge>
          </span>
          {showDeleted ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        {showDeleted ? (
          <div className="mt-1 space-y-1 pl-2">
            {deleted.length === 0 ? (
              <p className="px-1 py-2 text-xs text-ink-subtle">Нет удалённых сцен</p>
            ) : (
              deleted.map((entry, i) => (
                <div
                  key={`${entry.scene.id}-${i}`}
                  className="flex items-center justify-between gap-2 py-1 text-sm"
                >
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {entry.scene.id}
                  </span>
                  <div className="flex">
                    <button
                      type="button"
                      className="size-7 rounded-sm text-ok hover:bg-muted"
                      title="Восстановить"
                      onClick={() => restoreDeletedScene(i)}
                    >
                      <Undo2 className="mx-auto size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="size-7 rounded-sm text-destructive hover:bg-muted"
                      title="Удалить навсегда"
                      onClick={() => permanentlyDeleteDeletedScene(i)}
                    >
                      <X className="mx-auto size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border p-3">
        <Button variant="secondary" className="w-full" onClick={onExport}>
          Экспорт HTML
        </Button>
        <p className="mt-2 text-center text-[11px] text-ink-subtle">
          Самостоятельная игра для читателя
        </p>
      </div>
    </aside>
  );
}
