import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStoryStore } from "@/lib/kniga/storyStore.ts";

interface Props {
  startingVariables: Record<string, number>;
  onSetStartingVariable: (key: string, value: number) => void;
  onRenameStartingVariable: (oldKey: string, newKey: string) => void;
  onRemoveStartingVariable: (key: string) => void;
  onAddStartingVariable: (name: string, value: number) => void;
  onResetCurrentToStarting: () => void;
}

export function CharacterEditor({
  startingVariables,
  onSetStartingVariable,
  onRenameStartingVariable,
  onRemoveStartingVariable,
  onAddStartingVariable,
  onResetCurrentToStarting,
}: Props) {
  const story = useStoryStore((s) => s.story);
  const updateStory = useStoryStore((s) => s.updateStory);
  const addVariable = useStoryStore((s) => s.addVariable);
  const renameStoryVariable = useStoryStore((s) => s.renameStoryVariable);
  const removeStoryVariable = useStoryStore((s) => s.removeStoryVariable);
  const updateStoryVariables = useStoryStore((s) => s.updateStoryVariables);

  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState(10);
  const [startName, setStartName] = useState("");
  const [startValue, setStartValue] = useState(10);
  const [showStarting, setShowStarting] = useState(false);

  const startId = story.startScene || story.scenes[0]?.id || "scene1";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 md:p-8">
      <div>
        <Label htmlFor="hero-name">Имя героя</Label>
        <Input
          id="hero-name"
          className="mt-1 h-12 font-display text-2xl"
          value={story.characterName || ""}
          placeholder="Имя героя"
          onChange={(e) => updateStory((s) => ({ ...s, characterName: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="hero-desc">Описание</Label>
        <Textarea
          id="hero-desc"
          className="mt-1 min-h-24"
          value={story.characterDescription || ""}
          placeholder="Краткое описание персонажа..."
          onChange={(e) => updateStory((s) => ({ ...s, characterDescription: e.target.value }))}
        />
      </div>
      <div>
        <h3 className="mb-3 font-display text-lg font-medium">Характеристики</h3>
        <div className="space-y-2">
          {Object.keys(story.variables).map((key) => {
            const origin = story.variableOrigins?.[key];
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-card p-3">
                <Input
                  defaultValue={key}
                  onBlur={(e) => renameStoryVariable(key, e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  className="w-24 text-center"
                  value={story.variables[key]}
                  onChange={(e) =>
                    updateStoryVariables((v) => ({ ...v, [key]: parseInt(e.target.value, 10) || 0 }))
                  }
                />
                <Badge>{origin ? `сцена ${origin}` : "базовая"}</Badge>
                <button
                  type="button"
                  className="size-9 rounded-sm text-destructive hover:bg-muted"
                  onClick={() => removeStoryVariable(key)}
                  aria-label={`Удалить ${key}`}
                >
                  <X className="mx-auto size-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название новой характеристики"
            className="flex-1"
          />
          <Input
            type="number"
            className="w-full sm:w-24"
            value={newValue}
            onChange={(e) => setNewValue(parseInt(e.target.value, 10) || 0)}
          />
          <Button
            onClick={() => {
              const trimmed = newName.trim();
              if (!trimmed) return;
              addVariable(trimmed, newValue, startId);
              setNewName("");
              setNewValue(10);
            }}
          >
            <Plus className="size-4" />
            Добавить
          </Button>
        </div>
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
            {Object.keys(startingVariables).map((key) => (
              <div key={key} className="flex items-center gap-2 rounded-md bg-card p-2">
                <Input
                  defaultValue={key}
                  onBlur={(e) => onRenameStartingVariable(key, e.target.value)}
                  className="h-9 flex-1 text-sm"
                />
                <Input
                  type="number"
                  className="h-9 w-20 text-center text-sm"
                  value={startingVariables[key]}
                  onChange={(e) => onSetStartingVariable(key, parseInt(e.target.value, 10) || 0)}
                />
                <button
                  type="button"
                  className="size-8 text-destructive"
                  onClick={() => onRemoveStartingVariable(key)}
                >
                  <X className="mx-auto size-4" />
                </button>
              </div>
            ))}
            {Object.keys(startingVariables).length === 0 ? (
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
                value={startValue}
                onChange={(e) => setStartValue(parseInt(e.target.value, 10) || 0)}
              />
              <Button
                size="sm"
                onClick={() => {
                  const trimmed = startName.trim();
                  if (!trimmed) return;
                  onAddStartingVariable(trimmed, startValue);
                  setStartName("");
                  setStartValue(10);
                }}
              >
                Добавить
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={onResetCurrentToStarting}>
              Сбросить текущие к стартовым
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
