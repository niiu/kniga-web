import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Plus, Trash2, Undo2, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useStoryStore } from "@/lib/kniga/storyStore.ts";
import { insertBeforeFromY } from "@/lib/kniga/reorder.ts";
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
  const [showDeleted, setShowDeleted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertBefore, setInsertBefore] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);
  const deleted = story.deletedScenes || [];

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

  function hitInsertBefore(clientY: number) {
    const list = listRef.current;
    if (!list) return 0;
    const rows = [...list.querySelectorAll<HTMLElement>(":scope > li[data-scene-id]")].map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
    return insertBeforeFromY(clientY, rows);
  }

  function autoScroll(clientY: number) {
    const viewport = listRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const zone = 36;
    if (clientY < rect.top + zone) viewport.scrollTop -= 14;
    else if (clientY > rect.bottom - zone) viewport.scrollTop += 14;
  }

  function startDrag(sceneId: string, fromIndex: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: sceneId, pointerId: e.pointerId, fromIndex, insertBefore: fromIndex };
    setDragId(sceneId);
    setInsertBefore(fromIndex);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const move = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      autoScroll(ev.clientY);
      const next = hitInsertBefore(ev.clientY);
      if (next === drag.insertBefore) return;
      drag.insertBefore = next;
      setInsertBefore(next);
    };
    const up = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const { id, insertBefore: dropAt } = drag;
      dragRef.current = null;
      setDragId(null);
      setInsertBefore(null);
      detachListeners();
      reorderScene(id, dropAt);
    };
    listenersRef.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  useEffect(() => () => detachListeners(), []);

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
      <div className="px-3 pb-3">
        <Button className="w-full" onClick={() => addScene()}>
          <Plus className="size-4" />
          Новая сцена
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <ul ref={listRef} className="space-y-0.5 pb-4" aria-label="Список сцен">
          {story.scenes.map((scene, index) => {
            const dropBefore = dragId != null && insertBefore === index;
            const inPlace =
              dragId === scene.id && (insertBefore === index || insertBefore === index + 1);
            return (
              <li
                key={scene.id}
                data-scene-id={scene.id}
                className={cn(
                  "flex items-center gap-0.5 rounded-md",
                  dragId === scene.id && "opacity-50",
                  dropBefore && !inPlace && "border-t-2 border-accent",
                )}
              >
                <button
                  type="button"
                  className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-sm border border-border bg-card text-ink hover:bg-muted active:cursor-grabbing touch-none select-none"
                  title="Перетащить"
                  aria-label="Перетащить сцену"
                  aria-grabbed={dragId === scene.id}
                  draggable={false}
                  onPointerDown={(e) => startDrag(scene.id, index, e)}
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
                    <span className={cn("text-[10px]", scene.id === currentSceneId ? "text-paper/70" : "text-ink-subtle")}>
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
              </li>
            );
          })}
          {dragId != null && insertBefore === story.scenes.length ? (
            <li aria-hidden className="h-0.5 rounded-full bg-accent" />
          ) : null}
        </ul>
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
          {showDeleted ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        {showDeleted ? (
          <div className="mt-1 space-y-1 pl-2">
            {deleted.length === 0 ? (
              <p className="px-1 py-2 text-xs text-ink-subtle">Нет удалённых сцен</p>
            ) : (
              deleted.map((entry, i) => (
                <div key={`${entry.scene.id}-${i}`} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span className="truncate font-mono text-xs text-muted-foreground">{entry.scene.id}</span>
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
        <p className="mt-2 text-center text-[11px] text-ink-subtle">Самостоятельная игра для читателя</p>
      </div>
    </aside>
  );
}
