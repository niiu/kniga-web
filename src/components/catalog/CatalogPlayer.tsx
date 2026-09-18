import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Choice, Story } from "@/lib/kniga/types.ts";
import {
  applyEffects,
  evaluateCondition,
  evaluateRollOutcome,
  formatDialogueLine,
  getDialogueNpcNameForStep,
  getNextDialogueStep,
  processDisplayText,
} from "@/lib/kniga/gameEngine.ts";

interface Props {
  story: Story;
}

export function CatalogPlayer({ story }: Props) {
  const startId = story.startScene || story.scenes[0]?.id || "end";
  const [sceneId, setSceneId] = useState(startId);
  const [vars, setVars] = useState<Record<string, number>>({ ...story.variables });
  const [items, setItems] = useState<Record<string, number>>({ ...(story.items || {}) });
  const [dialogueHistory, setDialogueHistory] = useState(() => initDialogue(story, startId));
  const [dialogueStep, setDialogueStep] = useState(0);
  const [lastRoll, setLastRoll] = useState<string | null>(null);

  const scene = sceneId === "end" ? null : story.scenes.find((s) => s.id === sceneId) || null;

  const visibleChoices = useMemo(() => {
    if (!scene) return [];
    const state = { variables: vars, items };
    return (scene.choices || []).filter((choice) => {
      if (!evaluateCondition(choice.condition, state)) return false;
      if (!scene.isDialogue) return true;
      return (choice.npcLineIndex || 0) === dialogueStep;
    });
  }, [scene, vars, items, dialogueStep]);

  const isEnding = sceneId === "end" || (visibleChoices.length === 0 && !scene?.isDialogue);

  const displayText = processDisplayText(
    scene?.isDialogue && dialogueHistory ? dialogueHistory : scene?.text || "",
    { variables: vars, items },
    story.characterName,
  );

  function restart() {
    setSceneId(startId);
    setVars({ ...story.variables });
    setItems({ ...(story.items || {}) });
    setDialogueHistory(initDialogue(story, startId));
    setDialogueStep(0);
    setLastRoll(null);
  }

  function makeChoice(choice: Choice) {
    let effectsToApply = choice.effects;
    let nextId = choice.next || "";
    let rollValue: number | undefined;
    let tierLabel = "";

    if (choice.roll) {
      const outcome = evaluateRollOutcome(choice, vars);
      effectsToApply = outcome.effects;
      nextId = outcome.nextId;
      rollValue = outcome.rollValue;
      if (outcome.tier != null) tierLabel = ` (${outcome.tier}%)`;
    }

    const isDialogue = !!scene?.isDialogue;
    if (isDialogue && !nextId) nextId = sceneId;

    let nextHistory = dialogueHistory;
    let nextStep = dialogueStep;
    const newState = applyEffects(effectsToApply, { variables: { ...vars }, items: { ...items } });

    if (isDialogue && scene) {
      const npcName = getDialogueNpcNameForStep(scene, dialogueStep);
      const npcText =
        dialogueStep === 0 ? scene.text || "" : scene.npcResponses?.[dialogueStep - 1]?.text || "";
      const turn = `${formatDialogueLine(npcName, npcText)}\n\n${formatDialogueLine(undefined, choice.text, true)}`;
      nextHistory = (dialogueHistory ? dialogueHistory + "\n\n" : "") + turn;
      const thisStep = choice.npcLineIndex || 0;
      nextStep = getNextDialogueStep(thisStep, scene.npcResponses, newState);
      const newNpcName = getDialogueNpcNameForStep(scene, nextStep);
      const newNpcText = nextStep === 0 ? "" : scene.npcResponses?.[nextStep - 1]?.text || "";
      if (newNpcText) nextHistory += `\n\n${formatDialogueLine(newNpcName, newNpcText)}`;
    } else {
      nextHistory = "";
      nextStep = 0;
    }

    setVars(newState.variables);
    setItems(newState.items);
    setDialogueHistory(nextHistory);
    setDialogueStep(nextStep);
    setLastRoll(
      choice.roll && rollValue !== undefined ? `Бросок: ${choice.roll} → ${rollValue}${tierLabel}` : null,
    );

    if (nextId === "end" || !nextId) {
      setSceneId("end");
      setDialogueHistory("");
    } else if (nextId !== sceneId && story.scenes.some((s) => s.id === nextId)) {
      setSceneId(nextId);
      const nextScene = story.scenes.find((s) => s.id === nextId);
      if (nextScene?.isDialogue) {
        setDialogueHistory(initDialogue(story, nextId));
        setDialogueStep(0);
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft className="size-4" />
          К каталогу
        </Link>
        <Button variant="outline" size="sm" onClick={restart}>
          <RotateCcw className="size-4" />
          Сначала
        </Button>
      </div>

      <h1 className="font-display text-3xl font-medium tracking-tight">{story.title}</h1>

      <div className="flex flex-wrap justify-center gap-6 rounded-lg bg-card px-4 py-3">
        {Object.entries(vars)
          .filter(([, v]) => v !== 0)
          .map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-xs uppercase tracking-wide text-ink-subtle">{key}</div>
              <div className="font-display text-xl font-medium tabular-nums text-ok">{value}</div>
            </div>
          ))}
      </div>

      <div className="rounded-lg bg-card px-4 py-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-ink-subtle">Инвентарь</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(items)
            .filter(([, c]) => c !== 0)
            .map(([name, count]) => (
              <div key={name} className="text-center">
                <div className="text-sm">{name}</div>
                <div className="font-medium tabular-nums">{count}</div>
              </div>
            ))}
        </div>
      </div>

      {lastRoll ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">{lastRoll}</div>
      ) : null}

      <div className="min-h-64 whitespace-pre-wrap rounded-xl border border-border bg-card p-6 font-serif text-lg leading-relaxed md:p-10">
        {isEnding && sceneId === "end" ? "Конец истории." : displayText || "Конец истории."}
      </div>

      {isEnding ? (
        <div className="py-6 text-center">
          <h2 className="font-display text-2xl font-medium">Конец истории</h2>
          <Button className="mt-4" onClick={restart}>
            <RotateCcw className="size-4" />
            Начать сначала
          </Button>
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
              {scene?.isDialogue ? "Вы: " : ""}
              {choice.text}
              {choice.roll ? <span className="ml-2 font-mono text-xs text-ink-subtle">({choice.roll})</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function initDialogue(story: Story, sceneId: string) {
  const scene = story.scenes.find((s) => s.id === sceneId);
  if (!scene?.isDialogue || !scene.text) return "";
  return formatDialogueLine(getDialogueNpcNameForStep(scene, 0), scene.text);
}
