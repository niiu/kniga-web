import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Plus,
  Star,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStoryStore } from "@/lib/kniga/storyStore.ts";
import { isConditionValid } from "@/lib/kniga/gameEngine.ts";
import type { Choice, Scene } from "@/lib/kniga/types.ts";
import { cn, uid } from "@/lib/utils.ts";

const TIER_KEYS = ["0", "25", "50", "85", "100"] as const;
type TierKey = (typeof TIER_KEYS)[number];
const TIER_LABELS: Record<TierKey, string> = {
  "0": "0% слабый",
  "25": "25%",
  "50": "50%",
  "85": "85%",
  "100": "100% крит",
};

const OPS = [">", ">=", "<", "<=", "==", "and", "or", "not", "("];

interface Props {
  liveVariables?: Record<string, number>;
  liveItems?: Record<string, number>;
  onCopyToBuffer: (choice: Choice) => void;
}

export function SceneEditor({ liveVariables, liveItems, onCopyToBuffer }: Props) {
  const story = useStoryStore((s) => s.story);
  const currentSceneId = useStoryStore((s) => s.currentSceneId);
  const updateScene = useStoryStore((s) => s.updateScene);
  const updateChoice = useStoryStore((s) => s.updateChoice);
  const addChoice = useStoryStore((s) => s.addChoice);
  const removeChoice = useStoryStore((s) => s.removeChoice);
  const duplicateChoice = useStoryStore((s) => s.duplicateChoice);
  const removeNpcResponse = useStoryStore((s) => s.removeNpcResponse);
  const setSceneId = useStoryStore((s) => s.setSceneId);
  const setStartScene = useStoryStore((s) => s.setStartScene);
  const addSuggestedVariable = useStoryStore((s) => s.addSuggestedVariable);
  const addSuggestedItem = useStoryStore((s) => s.addSuggestedItem);
  const addSuggestedNpcName = useStoryStore((s) => s.addSuggestedNpcName);
  const addSuggestedEmotion = useStoryStore((s) => s.addSuggestedEmotion);
  const moveChoice = useStoryStore((s) => s.moveChoice);

  const scene = story.scenes.find((s) => s.id === currentSceneId) ?? null;
  const [idDraft, setIdDraft] = useState<string | null>(null);
  const [rollOpen, setRollOpen] = useState<Record<string, boolean>>({});
  const [collapsedStart, setCollapsedStart] = useState(false);
  const [collapsedNpc, setCollapsedNpc] = useState<Record<string, boolean>>({});

  const vars = liveVariables ?? story.variables;
  const items = liveItems ?? story.items;
  const sceneIds = story.scenes.map((s) => s.id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      e.preventDefault();
      const current = useStoryStore.getState();
      const sc = current.story.scenes.find((s) => s.id === current.currentSceneId);
      if (!sc) return;
      current.addChoice(sc.id, {
        text: "Новый ответ",
        next: "",
        npcLineIndex: sc.isDialogue ? 0 : undefined,
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Выберите сцену слева
      </div>
    );
  }

  const current = scene;
  const shownId = idDraft ?? current.id;
  const idTaken = story.scenes.some((s) => s.id === shownId && s.id !== current.id);

  function patchScene(partial: Partial<Scene>) {
    updateScene(current.id, (s) => ({ ...s, ...partial }));
  }

  function addPlayerChoice(npcLineIndex: number) {
    addChoice(current.id, {
      text: "Новый ответ",
      next: "",
      npcLineIndex: current.isDialogue ? npcLineIndex : undefined,
    });
    if (npcLineIndex === 0) setCollapsedStart(false);
  }

  function addNpcLine() {
    const responses = current.npcResponses || [];
    const prev = responses[responses.length - 1];
    const newResp = {
      id: uid(`${current.id}-nr`),
      text: "",
      condition: "",
      npcName: prev?.npcName || current.npcName || "",
      emotion: prev?.emotion || current.npcEmotion || "",
    };
    patchScene({ npcResponses: [...responses, newResp] });
    if (newResp.id) {
      setCollapsedNpc((m) => {
        const next = { ...m };
        delete next[newResp.id!];
        return next;
      });
    }
    if (newResp.npcName) addSuggestedNpcName(newResp.npcName);
    if (newResp.emotion) addSuggestedEmotion(newResp.emotion);
    queueMicrotask(() => {
      const areas = document.querySelectorAll<HTMLTextAreaElement>("textarea[data-npc-reply]");
      const last = areas[areas.length - 1];
      last?.focus();
      last?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function choicesForLine(line: number) {
    return current.choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice }) => (choice.npcLineIndex ?? 0) === line);
  }

  function renderChoiceCards(line: number) {
    const list = choicesForLine(line);
    return list.map(({ choice, index }, gi) => (
      <ChoiceCard
        key={choice.id || `c-${index}`}
        choice={choice}
        index={index}
        scene={current}
        sceneIds={sceneIds}
        vars={vars}
        items={items}
        suggestedVariables={story.suggestedVariables}
        suggestedItems={story.suggestedItems}
        rollOpen={!!rollOpen[choice.id || String(index)]}
        onToggleRoll={() =>
          setRollOpen((m) => {
            const k = choice.id || String(index);
            return { ...m, [k]: !m[k] };
          })
        }
        onChange={(updater) => updateChoice(current.id, index, updater)}
        onRemove={() => removeChoice(current.id, index)}
        onDuplicate={() => duplicateChoice(current.id, index)}
        onCopy={() => onCopyToBuffer(choice)}
        onMoveUp={() => moveChoice(current.id, index, index - 1)}
        onMoveDown={() => moveChoice(current.id, index, index + 1)}
        canUp={gi > 0}
        canDown={gi < list.length - 1}
        addSuggestedVariable={addSuggestedVariable}
        addSuggestedItem={addSuggestedItem}
      />
    ));
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor="scene-id">ID сцены</Label>
          <Input
            id="scene-id"
            className={cn("mt-1 font-mono", idTaken && "ring-2 ring-destructive")}
            value={shownId}
            onChange={(e) => setIdDraft(e.target.value)}
            onBlur={() => {
              if (!idDraft || idDraft === scene.id || idTaken || !idDraft.trim()) {
                setIdDraft(null);
                return;
              }
              setSceneId(scene.id, idDraft.trim());
              setIdDraft(null);
            }}
          />
          {idTaken ? <p className="mt-1 text-xs text-destructive">Такой ID уже есть</p> : null}
        </div>
        <Button
          variant={story.startScene === scene.id ? "default" : "outline"}
          onClick={() => setStartScene(scene.id)}
        >
          <Star className="size-4" />
          Старт
        </Button>
        <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
          <input
            type="checkbox"
            checked={!!scene.isDialogue}
            onChange={(e) => patchScene({ isDialogue: e.target.checked })}
          />
          Диалог
        </label>
      </div>

      {scene.isDialogue ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Имя NPC</Label>
            <Input
              className="mt-1"
              list="npc-names"
              value={scene.npcName || ""}
              onChange={(e) => {
                patchScene({ npcName: e.target.value });
                if (e.target.value) addSuggestedNpcName(e.target.value);
              }}
            />
          </div>
          <div>
            <Label>Эмоция</Label>
            <Input
              className="mt-1"
              list="npc-emotions"
              value={scene.npcEmotion || ""}
              onChange={(e) => {
                patchScene({ npcEmotion: e.target.value });
                if (e.target.value) addSuggestedEmotion(e.target.value);
              }}
            />
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor="scene-text">Текст сцены</Label>
        <Textarea
          id="scene-text"
          className="mt-1 min-h-36 font-serif text-base leading-relaxed"
          value={scene.text}
          onChange={(e) => patchScene({ text: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => addPlayerChoice(0)}>
          <Plus className="size-4" />
          Добавить ответ
        </Button>
        {scene.isDialogue ? (
          <Button size="sm" variant="outline" onClick={addNpcLine}>
            <Plus className="size-4" />
            Реплика NPC
          </Button>
        ) : null}
      </div>

      {scene.isDialogue ? (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground"
          onClick={() => setCollapsedStart((v) => !v)}
        >
          {collapsedStart ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          Ответы на стартовую реплику
        </button>
      ) : null}

      {scene.isDialogue ? (collapsedStart ? null : <div className="space-y-2">{renderChoiceCards(0)}</div>) : (
        <div className="space-y-2">{renderChoiceCards(0)}</div>
      )}

      {scene.isDialogue
        ? (scene.npcResponses || []).map((npc, j) => {
            const line = j + 1;
            const npcKey = npc.id || `idx-${line}`;
            const npcCollapsed = !!collapsedNpc[npcKey];
            return (
              <div key={npcKey} className="space-y-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium"
                      onClick={() => setCollapsedNpc((m) => ({ ...m, [npcKey]: !m[npcKey] }))}
                    >
                      {npcCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      Реплика NPC {line}
                    </button>
                    <button
                      type="button"
                      className="size-8 text-destructive"
                      onClick={() => removeNpcResponse(scene.id, j)}
                      aria-label="Удалить реплику"
                    >
                      <Trash2 className="mx-auto size-4" />
                    </button>
                  </div>
                  {npcCollapsed ? (
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-ink">
                        {npc.npcName || scene.npcName || "НПС"}
                        {npc.emotion ? ` (${npc.emotion})` : ""}:
                      </span>{" "}
                      {npc.text || "пустая реплика"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          list="npc-names"
                          placeholder="Имя"
                          value={npc.npcName || ""}
                          onChange={(e) => {
                            const next = [...(scene.npcResponses || [])];
                            next[j] = { ...npc, npcName: e.target.value };
                            patchScene({ npcResponses: next });
                            if (e.target.value) addSuggestedNpcName(e.target.value);
                          }}
                        />
                        <Input
                          list="npc-emotions"
                          placeholder="Эмоция"
                          value={npc.emotion || ""}
                          onChange={(e) => {
                            const next = [...(scene.npcResponses || [])];
                            next[j] = { ...npc, emotion: e.target.value };
                            patchScene({ npcResponses: next });
                            if (e.target.value) addSuggestedEmotion(e.target.value);
                          }}
                        />
                      </div>
                      <Textarea
                        data-npc-reply=""
                        placeholder="Текст реплики НПС"
                        value={npc.text}
                        onChange={(e) => {
                          const next = [...(scene.npcResponses || [])];
                          next[j] = { ...npc, text: e.target.value };
                          patchScene({ npcResponses: next });
                        }}
                      />
                      <Input
                        placeholder="Условие показа"
                        value={npc.condition || ""}
                        onChange={(e) => {
                          const next = [...(scene.npcResponses || [])];
                          next[j] = { ...npc, condition: e.target.value };
                          patchScene({ npcResponses: next });
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => addPlayerChoice(line)}>
                        <Plus className="size-4" />
                        Ответ на эту реплику
                      </Button>
                    </div>
                  )}
                </div>
                {npcCollapsed ? null : renderChoiceCards(line)}
              </div>
            );
          })
        : null}

      <datalist id="npc-names">
        {(story.suggestedNpcNames || []).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="npc-emotions">
        {(story.suggestedEmotions || []).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
}

function ChoiceCard({
  choice,
  index,
  scene,
  sceneIds,
  vars,
  items,
  suggestedVariables,
  suggestedItems,
  rollOpen,
  onToggleRoll,
  onChange,
  onRemove,
  onDuplicate,
  onCopy,
  onMoveUp,
  onMoveDown,
  canUp,
  canDown,
  addSuggestedVariable,
  addSuggestedItem,
}: {
  choice: Choice;
  index: number;
  scene: Scene;
  sceneIds: string[];
  vars: Record<string, number>;
  items: Record<string, number>;
  suggestedVariables: string[];
  suggestedItems: string[];
  rollOpen: boolean;
  onToggleRoll: () => void;
  onChange: (updater: (c: Choice) => Choice) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canUp: boolean;
  canDown: boolean;
  addSuggestedVariable: (n: string) => void;
  addSuggestedItem: (n: string) => void;
}) {
  const condError = choice.condition?.trim() && !isConditionValid(choice.condition, vars, items);

  function appendCond(piece: string) {
    const current = (choice.condition || "").trimEnd();
    let next = current;
    if (next && !/[\s(]$/.test(next)) next += " ";
    next += piece;
    onChange((c) => ({ ...c, condition: next }));
  }

  function appendEffect(piece: string) {
    const current = (choice.effects || "").trimEnd();
    let next = current;
    if (next && !next.endsWith(",")) next += ",";
    next += piece;
    onChange((c) => ({ ...c, effects: next }));
  }

  function ensureTiers(): NonNullable<Choice["rollTiers"]> {
    const existing = choice.rollTiers ? { ...choice.rollTiers } : {};
    for (const k of TIER_KEYS) {
      if (!existing[k]) existing[k] = { next: "", effects: "" };
    }
    return existing;
  }

  return (
    <article className="rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
          Ответ {index + 1}
        </span>
        <div className="flex items-center">
          <button type="button" className="size-8 text-ink disabled:opacity-30" disabled={!canUp} onClick={onMoveUp} aria-label="Выше">
            <ArrowUp className="mx-auto size-3.5" />
          </button>
          <button type="button" className="size-8 text-ink disabled:opacity-30" disabled={!canDown} onClick={onMoveDown} aria-label="Ниже">
            <ArrowDown className="mx-auto size-3.5" />
          </button>
          <button type="button" className="size-8 text-ink" title="В буфер" onClick={onCopy}>
            <ClipboardCopy className="mx-auto size-3.5" />
          </button>
          <button type="button" className="size-8 text-ink" title="Дублировать" onClick={onDuplicate}>
            <Copy className="mx-auto size-3.5" />
          </button>
          <button type="button" className="size-8 text-destructive" title="Удалить" onClick={onRemove}>
            <Trash2 className="mx-auto size-3.5" />
          </button>
        </div>
      </div>
      <Input
        placeholder="Текст выбора"
        value={choice.text}
        onChange={(e) => onChange((c) => ({ ...c, text: e.target.value }))}
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Следующая сцена</Label>
          <select
            className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm"
            value={choice.next || ""}
            onChange={(e) => onChange((c) => ({ ...c, next: e.target.value }))}
          >
            <option value="">(остаться / конец)</option>
            <option value="end">end</option>
            {sceneIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Бросок</Label>
          <Input
            className="mt-1 font-mono"
            placeholder="1d20+strength"
            value={choice.roll || ""}
            onChange={(e) =>
              onChange((c) => {
                const roll = e.target.value;
                if (roll && !c.rollTiers) return { ...c, roll, rollTiers: ensureTiers() };
                return { ...c, roll };
              })
            }
            onFocus={() => {
              if (choice.roll && !choice.rollTiers) {
                onChange((c) => ({ ...c, rollTiers: ensureTiers() }));
              }
            }}
          />
        </div>
      </div>
      <div className="mt-2">
        <Label>Условие</Label>
        <Input
          className={cn("mt-1 font-mono", condError && "ring-2 ring-destructive")}
          placeholder="health > 50 and gold >= 10"
          value={choice.condition || ""}
          onChange={(e) => onChange((c) => ({ ...c, condition: e.target.value }))}
        />
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.keys(vars).map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
              onClick={() => appendCond(k)}
            >
              {k}
            </button>
          ))}
          {Object.keys(items).map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
              onClick={() => appendCond(`'${k}'`)}
            >
              {k}
            </button>
          ))}
          {OPS.map((op) => (
            <button
              key={op}
              type="button"
              className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px]"
              onClick={() => appendCond(op)}
            >
              {op}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <Label>Эффекты</Label>
        <Input
          className="mt-1 font-mono"
          placeholder="health:-5, addItem:Ключ:1"
          value={choice.effects || ""}
          onChange={(e) => onChange((c) => ({ ...c, effects: e.target.value }))}
        />
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestedVariables.map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
              onClick={() => {
                addSuggestedVariable(k);
                appendEffect(`${k}:`);
              }}
            >
              {k}:
            </button>
          ))}
          {suggestedItems.map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
              onClick={() => {
                addSuggestedItem(k);
                appendEffect(`addItem:${k}:1`);
              }}
            >
              +{k}
            </button>
          ))}
        </div>
      </div>
      {choice.roll ? (
        <div className="mt-3 border-t border-border pt-2">
          <button type="button" className="flex items-center gap-1 text-xs font-medium" onClick={onToggleRoll}>
            {rollOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Пороги броска
          </button>
          {rollOpen ? (
            <div className="mt-2 space-y-2">
              {TIER_KEYS.map((pct) => {
                const tier = (choice.rollTiers ?? ensureTiers())[pct];
                return (
                  <div key={pct} className="grid gap-2 rounded-md bg-muted/60 p-2 sm:grid-cols-[7rem_1fr_1fr]">
                    <Badge className="h-8 justify-center self-center">{TIER_LABELS[pct]}</Badge>
                    <select
                      className="h-9 rounded-sm border border-border bg-card px-2 text-xs"
                      value={tier?.next || ""}
                      onChange={(e) =>
                        onChange((c) => ({
                          ...c,
                          rollTiers: {
                            ...ensureTiers(),
                            ...c.rollTiers,
                            [pct]: { ...(c.rollTiers?.[pct] || {}), next: e.target.value },
                          },
                        }))
                      }
                    >
                      <option value="">(как у ответа)</option>
                      <option value="end">end</option>
                      {sceneIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                    <Input
                      className="h-9 font-mono text-xs"
                      placeholder="эффекты тира"
                      value={tier?.effects || ""}
                      onChange={(e) =>
                        onChange((c) => ({
                          ...c,
                          rollTiers: {
                            ...ensureTiers(),
                            ...c.rollTiers,
                            [pct]: { ...(c.rollTiers?.[pct] || {}), effects: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
