import { useMemo, useState } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils.ts";
import type { DraftMeta } from "@/lib/kniga/draftsStore.ts";

interface DraftsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftMeta[];
  activeId: string | null;
  currentTitle: string;
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DraftsPanel({
  open,
  onOpenChange,
  drafts,
  activeId,
  currentTitle,
  onSave,
  onSaveAs,
  onNew,
  onLoad,
  onDelete,
}: DraftsPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const active = useMemo(() => drafts.find((item) => item.id === activeId), [drafts, activeId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPendingDelete(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Мои книги</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Сейчас открыта «{currentTitle || "Без названия"}»
            {active ? ". Правки пишутся в эту сохранённую книгу." : ". Сохраните, чтобы она появилась в списке."}
          </p>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave}>
            <Bookmark className="size-4" />
            {activeId ? "Обновить" : "Сохранить"}
          </Button>
          <Button variant="secondary" onClick={onSaveAs}>
            Как новую
          </Button>
          <Button variant="outline" onClick={onNew}>
            <Plus className="size-4" />
            Новая книга
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {drafts.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Пока нет сохранённых книг. Нажмите «Сохранить», и черновик останется в мастерской.
            </p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft) => {
                const isActive = draft.id === activeId;
                return (
                  <li
                    key={draft.id}
                    className={cn(
                      "rounded-md border border-border bg-background p-3",
                      isActive && "border-accent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{draft.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {draft.sceneCount}{" "}
                          {draft.sceneCount === 1 ? "сцена" : draft.sceneCount < 5 ? "сцены" : "сцен"}
                          {" · "}
                          {formatWhen(draft.updatedAt)}
                          {isActive ? " · открыта" : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant={isActive ? "secondary" : "outline"} onClick={() => onLoad(draft.id)}>
                          {isActive ? "Уже открыта" : "Открыть"}
                        </Button>
                        {pendingDelete === draft.id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              onDelete(draft.id);
                              setPendingDelete(null);
                            }}
                          >
                            Удалить
                          </Button>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Удалить «${draft.title}»`}
                            onClick={() => setPendingDelete(draft.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
