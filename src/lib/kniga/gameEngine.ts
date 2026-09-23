/**
 * gameEngine.ts
 *
 * ТИПИЗИРОВАННАЯ ОБЁРТКА + РЕДАКТОРСКИЕ УТИЛИТЫ.
 *
 * Вся playable-логика живёт только в src/lib/kniga/engine/runtime.js
 */
import type { Choice, Scene, Story } from "./types.ts";
import * as runtime from "./engine/runtime.js";

export interface GameState {
  variables: Record<string, number>;
  items: Record<string, number>;
}

export function rollDice(diceNotation: string, vars: Record<string, number>): number {
  return runtime.rollDice(diceNotation, vars);
}

export function getDiceMax(diceNotation: string, vars: Record<string, number>): number {
  return runtime.getDiceMax(diceNotation, vars);
}

export function getTargetForPercent(
  diceNotation: string,
  vars: Record<string, number>,
  percent: number,
): number {
  return runtime.getTargetForPercent(diceNotation, vars, percent);
}

export function resolveRollTierKey(rollValue: number, max: number): "0" | "25" | "50" | "85" | "100" {
  return runtime.resolveRollTierKey(rollValue, max) as "0" | "25" | "50" | "85" | "100";
}

export function applyEffects(effects: string | undefined, state: GameState): GameState {
  return runtime.applyEffects(effects, state);
}

export function evaluateCondition(condition: string | undefined, state: GameState): boolean {
  return runtime.evaluateCondition(condition, state);
}

export function processDisplayText(
  text: string,
  state: GameState,
  characterName: string = "Герой",
): string {
  return runtime.processDisplayText(text, state, characterName);
}

export function applyInlineSceneEffects(text: string, state: GameState): GameState {
  return runtime.applyInlineSceneEffects(text, state);
}

export function getNextSceneId(
  choice: Choice,
  stateForRoll: Record<string, number>,
  rollSuccessThreshold = 12,
): { nextId: string; rollResult?: number } {
  return runtime.getNextSceneId(choice, stateForRoll, rollSuccessThreshold);
}

export function getDialogueAwareNext(
  choice: Choice,
  currentSceneId: string,
  isDialogue: boolean,
): string {
  return runtime.getDialogueAwareNext(choice, currentSceneId, isDialogue);
}

export function resolveChoice(
  choice: Choice,
  currentState: GameState,
): {
  newState: GameState;
  nextSceneId: string;
  rollResult?: number;
} {
  const stateAfterEffects = applyEffects(choice.effects, currentState);
  const { nextId, rollResult } = getNextSceneId(choice, stateAfterEffects.variables);
  return {
    newState: stateAfterEffects,
    nextSceneId: nextId,
    rollResult,
  };
}

export function evaluateRollOutcome(
  choice: Choice,
  vars: Record<string, number>,
  forceTier?: 0 | 25 | 50 | 85 | 100,
): {
  rollValue: number;
  tier?: 0 | 25 | 50 | 85 | 100;
  nextId: string;
  effects?: string;
} {
  return runtime.evaluateRollOutcome(choice, vars, forceTier as never) as {
    rollValue: number;
    tier?: 0 | 25 | 50 | 85 | 100;
    nextId: string;
    effects?: string;
  };
}

export function getNextDialogueStep(
  afterNpcLineIndex: number,
  npcResponses: Array<{ text: string; condition?: string }> | undefined,
  state: GameState,
): number {
  return runtime.getNextDialogueStep(afterNpcLineIndex, npcResponses, state);
}

export function getDialogueNpcNameForStep(scene: Scene | null | undefined, step: number): string | undefined {
  return runtime.getDialogueNpcNameForStep(scene, step);
}

export function formatDialogueLine(
  speakerName: string | undefined,
  text: string,
  isPlayer: boolean = false,
): string {
  return runtime.formatDialogueLine(speakerName, text, isPlayer);
}

export function getConditionReferencedKeys(condition: string | undefined): string[] {
  if (!condition) return [];
  try {
    const tokens = runtime.tokenizeCondition(condition.trim()) as Array<{
      type: string;
      value?: string;
    }>;
    const keys: string[] = [];
    for (const token of tokens) {
      if (token.type === "KEY") {
        let key = token.value ?? "";
        if (
          (key.startsWith("'") && key.endsWith("'")) ||
          (key.startsWith('"') && key.endsWith('"'))
        ) {
          key = key.slice(1, -1);
        }
        if (!/^\d+$/.test(key)) {
          keys.push(key);
        }
      }
    }
    return keys;
  } catch {
    return [];
  }
}

export function isConditionValid(
  condition: string | undefined,
  variables: Record<string, number>,
  items: Record<string, number>,
): boolean {
  if (!condition?.trim()) return true;
  const keys = getConditionReferencedKeys(condition);
  const varKeys = Object.keys(variables || {});
  const itemKeys = Object.keys(items || {});
  return keys.every((k) => varKeys.includes(k) || itemKeys.includes(k));
}

export function normalizeLoadedStory(loaded: unknown): Story {
  const data = (loaded ?? {}) as Partial<Story> & { scenes?: unknown };
  const scenes = Array.isArray(data.scenes) ? data.scenes : [];

  let startScene = data.startScene;
  if (!scenes.some((s: unknown) => (s as Scene)?.id === startScene)) {
    startScene = (scenes[0] as Scene | undefined)?.id || "scene1";
  }

  const normalizedScenes = scenes.map((raw: unknown) => {
    const s = (raw ?? {}) as Partial<Scene>;
    const sceneId = s.id || `scene${Date.now()}`;
    const rawChoices = Array.isArray(s.choices) ? s.choices : [];
    const choicesSeen = new Set<string>();
    const choices = rawChoices.map((cRaw: unknown, idx: number) => {
      const c = (cRaw ?? {}) as Choice;
      let id = c.id || `${sceneId}-c${idx}-${Date.now().toString(36)}`;
      let attempt = 0;
      while (choicesSeen.has(id)) {
        attempt++;
        id = `${c.id || sceneId + "-c" + idx}-dedup${attempt}`;
      }
      choicesSeen.add(id);

      let rollTiers = c.rollTiers ? { ...c.rollTiers } : undefined;
      if (rollTiers) {
        for (const k of ["0", "25", "50", "85", "100"] as const) {
          if (!rollTiers[k]) {
            rollTiers[k] = { next: "", effects: "" };
          }
        }
      }

      return {
        id,
        text: c.text || "",
        next: c.next || "",
        roll: c.roll,
        onSuccess: c.onSuccess,
        onFail: c.onFail,
        effects: c.effects,
        condition: c.condition,
        rollTiers,
        npcLineIndex: c.npcLineIndex,
      };
    });

    const rawResponses = Array.isArray(s.npcResponses) ? s.npcResponses : undefined;
    const respSeen = new Set<string>();
    const npcResponses = rawResponses
      ? rawResponses.map((rRaw: unknown, ridx: number) => {
          const r = (rRaw ?? {}) as NonNullable<Scene["npcResponses"]>[number];
          let id = r.id || `${sceneId}-nr${ridx}`;
          let attempt = 0;
          while (respSeen.has(id)) {
            attempt++;
            id = `${r.id || sceneId + "-nr" + ridx}-dedup${attempt}`;
          }
          respSeen.add(id);
          return {
            id,
            text: r.text || "",
            condition: r.condition,
            npcName: r.npcName,
            emotion: r.emotion,
          };
        })
      : undefined;

    return {
      id: sceneId,
      text: s.text || "",
      choices,
      isDialogue: !!s.isDialogue,
      npcName: s.npcName,
      npcEmotion: s.npcEmotion,
      npcResponses,
    };
  });

  return {
    title: data.title || "Без названия",
    startScene: startScene ?? "scene1",
    scenes: normalizedScenes,
    variables: data.variables || {},
    items: data.items || {},
    variableOrigins: data.variableOrigins || {},
    itemOrigins: data.itemOrigins || {},
    suggestedVariables: Array.isArray(data.suggestedVariables) ? data.suggestedVariables : [],
    suggestedItems: Array.isArray(data.suggestedItems) ? data.suggestedItems : [],
    suggestedNpcNames: Array.isArray(data.suggestedNpcNames) ? data.suggestedNpcNames : [],
    suggestedEmotions: Array.isArray(data.suggestedEmotions) ? data.suggestedEmotions : [],
    characterName: data.characterName,
    characterDescription: data.characterDescription,
    knigaMarker: typeof (data as { knigaMarker?: unknown }).knigaMarker === "string"
      ? (data as { knigaMarker?: string }).knigaMarker
      : undefined,
    deletedScenes: Array.isArray(data.deletedScenes)
      ? data.deletedScenes.map((d) => ({
          originalIndex: typeof d?.originalIndex === "number" ? d.originalIndex : 0,
          scene: d?.scene
            ? normalizeLoadedStory({
                scenes: [d.scene],
                startScene: d.scene.id,
                variables: {},
                items: {},
                suggestedVariables: [],
                suggestedItems: [],
              }).scenes[0]
            : d?.scene,
        }))
      : [],
  };
}
