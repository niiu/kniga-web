import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStoryStore } from "@/lib/kniga/storyStore.ts";
import { evaluateCondition, processDisplayText } from "@/lib/kniga/gameEngine.ts";
import type { Choice } from "@/lib/kniga/types.ts";
import type { SaveData } from "@/lib/kniga/saveStore.ts";
import { cn } from "@/lib/utils.ts";

interface Props {
  previewSceneId: string;
  previewVars: Record<string, number>;
  previewItems: Record<string, number>;
  makeChoice: (choice: Choice) => void;
  onRestart: () => void;
  onEditCurrent: () => void;
  dialogueHistory: string;
  currentDialogueStep: number;
  previousSceneId: string | null;
  onReturnToPreviousScene: () => void;
  forcedRollTier: 0 | 25 | 50 | 85 | 100 | null;
  onForcedRollTierChange: (tier: 0 | 25 | 50 | 85 | 100 | null) => void;
  startingVariables: Record<string, number>;
  startingItems: Record<string, number>;
  sceneStates: Record<string, { variables: Record<string, number>; items: Record<string, number> }>;
  onRewindTo: (id: string) => void;
  lastRoll: string | null;
  slots: (SaveData | null)[];
  autoSaveData: SaveData | null;
  onQuickSave: () => void;
  onSaveToSlot: (slot: number) => void;
  onLoadSlot: (slot: number) => void;
  onLoadAuto: () => void;
}

export function PreviewPanel({
  previewSceneId,
  previewVars,
  previewItems,
  makeChoice,
  onRestart,
  onEditCurrent,
  dialogueHistory,
  currentDialogueStep,
  previousSceneId,
  onReturnToPreviousScene,
  forcedRollTier,
  onForcedRollTierChange,
  startingVariables,
  startingItems,
  sceneStates,
  onRewindTo,
  lastRoll,
  slots,
  autoSaveData,
  onQuickSave,
  onSaveToSlot,
  onLoadSlot,
  onLoadAuto,
}: Props) {
  const story = useStoryStore((s) => s.story);
  const [showStarting, setShowStarting] = useState(false);
  const [slotModal, setSlotModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const currentScene =
    previewSceneId === "end"
      ? null
      : story.scenes.find((s) => s.id === previewSceneId) || story.scenes[0] || null;

  const visibleChoices = useMemo(() => {
    const scene = currentScene;
    if (!scene) return [];
    return (scene.choices || []).filter((choice) => {
      const condOk = evaluateCondition(choice.condition, {
        variables: previewVars,
        items: previewItems,
      });
      if (!scene.isDialogue) return condOk;
      return condOk && (choice.npcLineIndex || 0) === currentDialogueStep;
    });
  }, [currentScene, previewVars, previewItems, currentDialogueStep]);

  const isEnding =
    previewSceneId === "end" || (visibleChoices.length === 0 && !currentScene?.isDialogue);

  const displayText = processDisplayText(
    currentScene?.isDialogue && dialogueHistory ? dialogueHistory : currentScene?.text || "",
    { variables: previewVars, items: previewItems },
    story.characterName,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-wrap justify-center gap-6 rounded-lg bg-card px-4 py-3">
        {Object.entries(previewVars)
          .filter(([, v]) => v !== 0)
          .map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-ink-subtle">{key}</div>
              <div className="font-display text-xl font-medium tabular-nums text-ok">{value}</div>
            </div>
          ))}
      </div>
      <div className="rounded-lg bg-card px-4 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-ink-subtle">Инвентарь</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(previewItems)
            .filter(([, c]) => c !== 0)
            .map(([name, count]) => (
              <div key={name} className="text-center">
                <div className="text-sm">{name}</div>
                <div className="font-medium tabular-nums">{count}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 text-xs">
        <div className="mb-1.5 font-medium text-muted-foreground">Тест порогов (без случайного броска)</div>
        <div className="flex flex-wrap items-center gap-3">
          {([0, 25, 50, 85, 100] as const).map((pct) => (
            <label key={pct} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={forcedRollTier === pct}
                onChange={(e) => onForcedRollTierChange(e.target.checked ? pct : null)}
              />
              <span className="font-mono">{pct}%</span>
            </label>
          ))}
          {forcedRollTier != null ? (
            <button type="button" className="text-destructive" onClick={() => onForcedRollTierChange(null)}>
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowStarting((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left text-sm"
        >
          Стартовый объект
          {showStarting ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {showStarting ? (
          <div className="mt-2 space-y-2 border-l-2 border-border pl-4 text-sm">
            <div className="flex flex-wrap gap-4">
              {Object.entries(startingVariables).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] text-ink-subtle">{k}</div>
                  <div className="font-medium tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(startingItems).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] text-ink-subtle">{k}</div>
                  <div className="font-medium tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Сцена: <span className="font-mono">{previewSceneId}</span>
        </span>
        <button type="button" className="inline-flex items-center gap-1 text-accent hover:underline" onClick={onEditCurrent}>
          <Pencil className="size-3.5" />
          Редактировать сцену
        </button>
      </div>

      {Object.keys(sceneStates).length > 1 ? (
        <div>
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground"
            onClick={() => setShowHistory((v) => !v)}
          >
            История прохождения
          </button>
          {showHistory ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.keys(sceneStates).map((sid) => (
                <button
                  key={sid}
                  type="button"
                  onClick={() => onRewindTo(sid)}
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px]",
                    sid === previewSceneId ? "bg-ink text-paper" : "bg-muted",
                  )}
                >
                  {sid}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {lastRoll ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">{lastRoll}</div>
      ) : null}

      <div className="min-h-64 whitespace-pre-wrap rounded-xl border border-border bg-card p-6 font-serif text-lg leading-relaxed md:p-10">
        {isEnding && !currentScene?.isDialogue && visibleChoices.length === 0 && previewSceneId === "end"
          ? "Конец истории."
          : displayText || "Конец истории."}
      </div>

      {isEnding ? (
        <div className="py-8 text-center">
          <h2 className="font-display text-3xl font-medium">Конец истории</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">Вы дошли до финала этой ветки.</p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button size="lg" onClick={onRestart}>
              <RotateCcw className="size-4" />
              Начать сначала
            </Button>
            {previousSceneId ? (
              <Button variant="outline" onClick={onReturnToPreviousScene}>
                <Undo2 className="size-4" />
                Вернуться в {previousSceneId}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onEditCurrent}>
              <Pencil className="size-4" />
              Редактировать сцену
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {visibleChoices.map((choice) => (
            <button
              key={choice.id || choice.text}
              type="button"
              onClick={() => makeChoice(choice)}
              className="w-full rounded-lg border border-border bg-card px-4 py-4 text-left text-base transition-colors hover:border-accent hover:bg-muted"
            >
              {currentScene?.isDialogue ? "Вы: " : ""}
              {choice.text}
              {choice.roll ? <span className="ml-2 font-mono text-xs text-ink-subtle">({choice.roll})</span> : null}
            </button>
          ))}
          {currentScene?.isDialogue && visibleChoices.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Ветка диалога завершена.</p>
          ) : null}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Сохранения</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={onQuickSave}>
              Сохранить
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSlotModal(true)}>
              В слот...
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {slots.map((data, i) => {
            const slotNum = i + 1;
            return (
              <button
                key={slotNum}
                type="button"
                onClick={() => onLoadSlot(slotNum)}
                className={cn(
                  "rounded-lg border p-3 text-left text-xs transition-colors",
                  data ? "border-ok/40 bg-ok/5" : "border-border",
                )}
              >
                <div className="text-ink-subtle">Слот {slotNum}</div>
                {data ? (
                  <>
                    <div className="truncate font-medium">{data.sceneId}</div>
                    <div className="text-[10px] text-ink-subtle">{data.timestamp}</div>
                  </>
                ) : (
                  <div className="italic text-ink-subtle">Пусто</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <div>
            Автосохранение:{" "}
            {autoSaveData ? (
              <span>
                {autoSaveData.timestamp} — {autoSaveData.sceneId}
              </span>
            ) : (
              <span className="text-ink-subtle">нет</span>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={onLoadAuto}>
            Загрузить
          </Button>
        </div>
      </div>

      <Dialog open={slotModal} onOpenChange={setSlotModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить в слот</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((slot) => (
              <button
                key={slot}
                type="button"
                className="rounded-lg border border-border bg-muted p-4 text-left"
                onClick={() => {
                  onSaveToSlot(slot);
                  setSlotModal(false);
                }}
              >
                Слот {slot}
                {slots[slot - 1] ? (
                  <div className="mt-1 text-xs text-muted-foreground">{slots[slot - 1]!.timestamp}</div>
                ) : null}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
