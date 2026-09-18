import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStoryStore } from "@/lib/kniga/storyStore.ts";

interface Props {
  startingItems: Record<string, number>;
  onSetStartingItem: (name: string, count: number) => void;
  onRenameStartingItem: (oldName: string, newName: string) => void;
  onRemoveStartingItem: (name: string) => void;
  onAddStartingItem: (name: string, count: number) => void;
  onResetCurrentToStarting: () => void;
}

export function InventoryEditor({
  startingItems,
  onSetStartingItem,
  onRenameStartingItem,
  onRemoveStartingItem,
  onAddStartingItem,
  onResetCurrentToStarting,
}: Props) {
  const story = useStoryStore((s) => s.story);
  const addItem = useStoryStore((s) => s.addItem);
  const renameStoryItem = useStoryStore((s) => s.renameStoryItem);
  const removeStoryItem = useStoryStore((s) => s.removeStoryItem);
  const updateStoryItems = useStoryStore((s) => s.updateStoryItems);

  const [newName, setNewName] = useState("");
  const [newCount, setNewCount] = useState(1);
  const [startName, setStartName] = useState("");
  const [startCount, setStartCount] = useState(1);
  const [showStarting, setShowStarting] = useState(false);
  const startId = story.startScene || story.scenes[0]?.id || "scene1";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 md:p-8">
      <h3 className="font-display text-lg font-medium">Инвентарь</h3>
      <div className="space-y-2">
        {Object.entries(story.items).map(([name, count]) => {
          const origin = story.itemOrigins?.[name];
          return (
            <div key={name} className="flex items-center gap-2 rounded-lg bg-card p-3">
              <Input defaultValue={name} onBlur={(e) => renameStoryItem(name, e.target.value)} className="flex-1" />
              <Input
                type="number"
                className="w-24 text-center"
                value={count}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                  updateStoryItems((items) => ({ ...items, [name]: v }));
                }}
              />
              <Badge>{origin ? `сцена ${origin}` : "базовый"}</Badge>
              <button
                type="button"
                className="size-9 rounded-sm text-destructive hover:bg-muted"
                onClick={() => removeStoryItem(name)}
                aria-label={`Удалить ${name}`}
              >
                <X className="mx-auto size-4" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Название предмета"
          className="flex-1"
        />
        <Input
          type="number"
          className="w-full sm:w-24"
          value={newCount}
          onChange={(e) => setNewCount(parseInt(e.target.value, 10) || 0)}
        />
        <Button
          onClick={() => {
            const trimmed = newName.trim();
            if (!trimmed) return;
            addItem(trimmed, newCount, startId);
            setNewName("");
            setNewCount(1);
          }}
        >
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>
      <div>
        <button
          type="button"
          onClick={() => setShowStarting((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg bg-muted px-4 py-3 text-left text-sm font-medium"
        >
          Стартовый объект
          {showStarting ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {showStarting ? (
          <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
            {Object.entries(startingItems).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 rounded-md bg-card p-2">
                <Input
                  defaultValue={name}
                  onBlur={(e) => onRenameStartingItem(name, e.target.value)}
                  className="h-9 flex-1 text-sm"
                />
                <Input
                  type="number"
                  className="h-9 w-20 text-center text-sm"
                  value={count}
                  onChange={(e) => onSetStartingItem(name, Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
                <button type="button" className="size-8 text-destructive" onClick={() => onRemoveStartingItem(name)}>
                  <X className="mx-auto size-4" />
                </button>
              </div>
            ))}
            {Object.keys(startingItems).length === 0 ? (
              <p className="p-2 text-xs text-ink-subtle">Нет сохранённых начальных значений.</p>
            ) : null}
            <div className="flex gap-2">
              <Input
                value={startName}
                onChange={(e) => setStartName(e.target.value)}
                placeholder="В стартовый объект"
                className="h-9 flex-1 text-sm"
              />
              <Input
                type="number"
                className="h-9 w-20 text-sm"
                value={startCount}
                onChange={(e) => setStartCount(parseInt(e.target.value, 10) || 0)}
              />
              <Button
                size="sm"
                onClick={() => {
                  const trimmed = startName.trim();
                  if (!trimmed) return;
                  onAddStartingItem(trimmed, startCount);
                  setStartName("");
                  setStartCount(1);
                }}
              >
                Добавить
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={onResetCurrentToStarting}>
              Сбросить текущий инвентарь к стартовому
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
