import { create } from "zustand";
import type { Choice, Scene, Story } from "./types.ts";
import { normalizeLoadedStory } from "./gameEngine.ts";
import { defaultStory } from "./defaultStory.ts";
import { reorderScenesByInsert } from "./reorder.ts";
import { clearActiveDraft, syncActiveDraft } from "./draftsStore.ts";
import { uid } from "@/lib/utils.ts";

const STORAGE_KEY = "interactive-story-editor-last";
const BACKUP_KEY = "interactive-story-editor-backup";
const EDITOR_UI_KEY = "kniga-engine-editor-ui";
const BUFFER_KEY = "kniga-engine-answer-buffer";
const CLEAN_BASE_KEY = "kniga-engine-clean-base";

export type EditorTab = "editor" | "character" | "inventory" | "preview";

function cloneStory(story: Story): Story {
  return normalizeLoadedStory(JSON.parse(JSON.stringify(story)));
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota */
  }
}

export interface CleanBase {
  variables: Record<string, number>;
  items: Record<string, number>;
}

export function computeBaseStartingFromStory(story: Story): CleanBase {
  const startId = story.startScene || story.scenes[0]?.id || "";
  const startIdx = story.scenes.findIndex((sc) => sc.id === startId);
  const variables: Record<string, number> = {};
  const items: Record<string, number> = {};

  Object.entries(story.variables || {}).forEach(([name, val]) => {
    const origin = story.variableOrigins?.[name];
    if (!origin) {
      variables[name] = val;
      return;
    }
    const oIdx = story.scenes.findIndex((sc) => sc.id === origin);
    if (oIdx >= 0 && oIdx <= startIdx) variables[name] = val;
  });

  Object.entries(story.items || {}).forEach(([name, val]) => {
    const origin = story.itemOrigins?.[name];
    if (!origin) {
      items[name] = val;
      return;
    }
    const oIdx = story.scenes.findIndex((sc) => sc.id === origin);
    if (oIdx >= 0 && oIdx <= startIdx) items[name] = val;
  });

  return { variables, items };
}

export function loadCleanBase(): CleanBase | null {
  const raw = safeGet(CLEAN_BASE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CleanBase;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveCleanBase(base: CleanBase) {
  safeSet(CLEAN_BASE_KEY, JSON.stringify(base));
}

interface StoryStore {
  story: Story;
  currentSceneId: string;
  hydrated: boolean;
  hydrate: () => void;
  setStory: (story: Story) => void;
  setTitle: (title: string) => void;
  setCurrentSceneId: (id: string) => void;
  updateStory: (updater: (story: Story) => Story) => void;
  updateScene: (sceneId: string, updater: (scene: Scene) => Scene) => void;
  updateChoice: (sceneId: string, index: number, updater: (choice: Choice) => Choice) => void;
  addScene: (scene?: Scene) => string;
  insertSceneAfter: (afterId: string) => string;
  deleteScene: (sceneId: string) => void;
  restoreDeletedScene: (deletedIndex: number) => void;
  permanentlyDeleteDeletedScene: (deletedIndex: number) => void;
  reorderScene: (fromId: string, insertBefore: number) => void;
  moveChoice: (sceneId: string, fromIndex: number, toIndex: number) => void;
  addChoice: (sceneId: string, choice: Choice) => void;
  insertChoice: (sceneId: string, choice: Choice) => void;
  removeChoice: (sceneId: string, index: number) => void;
  duplicateChoice: (sceneId: string, index: number) => void;
  removeNpcResponse: (sceneId: string, index: number) => void;
  setSceneId: (oldId: string, newId: string) => void;
  setStartScene: (id: string) => void;
  addVariable: (name: string, initialValue: number, introducedInScene: string) => void;
  addItem: (name: string, initialCount: number, introducedInScene: string) => void;
  renameStoryVariable: (oldKey: string, newKey: string) => void;
  renameStoryItem: (oldKey: string, newKey: string) => void;
  removeStoryVariable: (key: string) => void;
  removeStoryItem: (key: string) => void;
  updateStoryVariables: (updater: (vars: Record<string, number>) => Record<string, number>) => void;
  updateStoryItems: (updater: (items: Record<string, number>) => Record<string, number>) => void;
  addSuggestedVariable: (name: string) => void;
  addSuggestedItem: (name: string) => void;
  addSuggestedNpcName: (name: string) => void;
  addSuggestedEmotion: (emotion: string) => void;
  mergeDiscoveredItems: (newItems: Record<string, number>, sceneId: string) => void;
  mergeDiscoveredVariables: (newVars: Record<string, number>, sceneId: string) => void;
  resetDraft: () => void;
  restoreFromBackup: () => string;
  resetStateToInitial: () => void;
  persistBackup: () => void;
}

function persistStory(story: Story) {
  safeSet(STORAGE_KEY, JSON.stringify(story, null, 2));
  syncActiveDraft(story);
}

function defaultSceneId(story: Story) {
  return story.startScene || story.scenes[0]?.id || "scene1";
}

export const useStoryStore = create<StoryStore>()((set, get) => {
  const apply = (story: Story) => {
    persistStory(story);
    set({ story });
  };

  const updateStory = (updater: (story: Story) => Story) => {
    const next = updater(get().story);
    apply(next);
    const current = get().currentSceneId;
    if (!next.scenes.some((s) => s.id === current)) {
      set({ currentSceneId: next.startScene || next.scenes[0]?.id || "scene1" });
    }
  };

  return {
    story: cloneStory(defaultStory),
    currentSceneId: defaultSceneId(defaultStory),
    hydrated: false,
    hydrate: () => {
      if (typeof window === "undefined") return;
      try {
        const saved = safeGet(STORAGE_KEY);
        const story = saved
          ? normalizeLoadedStory(JSON.parse(saved))
          : cloneStory(defaultStory);
        const ui = loadEditorUIState();
        const currentSceneId =
          ui.currentSceneId && story.scenes.some((s) => s.id === ui.currentSceneId)
            ? ui.currentSceneId
            : story.startScene || story.scenes[0]?.id || "scene1";
        set({ story, currentSceneId, hydrated: true });
      } catch {
        set({ story: cloneStory(defaultStory), currentSceneId: "scene1", hydrated: true });
      }
    },
    setStory: (story) => {
      const normalized = normalizeLoadedStory(story);
      apply(normalized);
      set({ currentSceneId: normalized.startScene || normalized.scenes[0]?.id || "scene1" });
    },
    setTitle: (title) => updateStory((s) => ({ ...s, title })),
    setCurrentSceneId: (id) => set({ currentSceneId: id }),
    updateStory,
    updateScene: (sceneId, updater) =>
      updateStory((s) => ({
        ...s,
        scenes: s.scenes.map((scene) => (scene.id === sceneId ? updater(scene) : scene)),
      })),
    updateChoice: (sceneId, index, updater) =>
      get().updateScene(sceneId, (scene) => ({
        ...scene,
        choices: scene.choices.map((ch, i) => (i === index ? updater(ch) : ch)),
      })),
    addScene: (scene) => {
      const newId = scene?.id || `scene${Date.now()}`;
      const newScene: Scene = scene ?? { id: newId, text: "Новая сцена...", choices: [] };
      updateStory((s) => ({ ...s, scenes: [...s.scenes, newScene] }));
      set({ currentSceneId: newScene.id });
      return newScene.id;
    },
    insertSceneAfter: (afterId) => {
      const newId = `scene${Date.now()}`;
      const newScene: Scene = { id: newId, text: "Новая сцена...", choices: [] };
      updateStory((s) => {
        const index = s.scenes.findIndex((sc) => sc.id === afterId);
        if (index === -1) return { ...s, scenes: [...s.scenes, newScene] };
        const scenes = [...s.scenes];
        scenes.splice(index + 1, 0, newScene);
        return { ...s, scenes };
      });
      set({ currentSceneId: newId });
      return newId;
    },
    deleteScene: (sceneId) =>
      updateStory((s) => {
        const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
        if (idx === -1 || s.scenes.length <= 1) return s;
        const sceneToDelete = s.scenes[idx];
        const newScenes = s.scenes.filter((_, i) => i !== idx);
        const currentDeleted = Array.isArray(s.deletedScenes) ? s.deletedScenes : [];
        let newStartScene = s.startScene;
        if (s.startScene === sceneId && newScenes.length > 0) {
          newStartScene = newScenes[0].id;
        }
        return {
          ...s,
          scenes: newScenes,
          startScene: newStartScene,
          deletedScenes: [
            ...currentDeleted,
            { scene: JSON.parse(JSON.stringify(sceneToDelete)) as Scene, originalIndex: idx },
          ],
        };
      }),
    restoreDeletedScene: (deletedIndex) =>
      updateStory((s) => {
        const deleted = Array.isArray(s.deletedScenes) ? [...s.deletedScenes] : [];
        if (deletedIndex < 0 || deletedIndex >= deleted.length) return s;
        const [entry] = deleted.splice(deletedIndex, 1);
        const restoredScene = JSON.parse(JSON.stringify(entry.scene)) as Scene;
        const newScenes = [...s.scenes];
        let insertAt = entry.originalIndex;
        if (insertAt > newScenes.length) insertAt = newScenes.length;
        if (insertAt < 0) insertAt = 0;
        newScenes.splice(insertAt, 0, restoredScene);
        return { ...s, scenes: newScenes, deletedScenes: deleted };
      }),
    permanentlyDeleteDeletedScene: (deletedIndex) =>
      updateStory((s) => {
        const deleted = Array.isArray(s.deletedScenes) ? s.deletedScenes : [];
        if (deletedIndex < 0 || deletedIndex >= deleted.length) return s;
        return { ...s, deletedScenes: deleted.filter((_, i) => i !== deletedIndex) };
      }),
    reorderScene: (fromId, insertBefore) =>
      updateStory((s) => {
        const scenes = reorderScenesByInsert(s.scenes, fromId, insertBefore);
        if (scenes === s.scenes) return s;
        return { ...s, scenes };
      }),
    moveChoice: (sceneId, fromIndex, toIndex) =>
      get().updateScene(sceneId, (scene) => {
        if (toIndex < 0 || toIndex >= scene.choices.length) return scene;
        const choices = [...scene.choices];
        const [moved] = choices.splice(fromIndex, 1);
        choices.splice(toIndex, 0, moved);
        return { ...scene, choices };
      }),
    addChoice: (sceneId, choice) =>
      get().updateScene(sceneId, (scene) => ({
        ...scene,
        choices: [...scene.choices, { ...choice, id: choice.id || uid(`${sceneId}-c`) }],
      })),
    insertChoice: (sceneId, choice) => get().addChoice(sceneId, choice),
    removeChoice: (sceneId, index) =>
      get().updateScene(sceneId, (scene) => ({
        ...scene,
        choices: scene.choices.filter((_, i) => i !== index),
      })),
    duplicateChoice: (sceneId, index) =>
      get().updateScene(sceneId, (scene) => {
        const original = scene.choices[index];
        if (!original) return scene;
        return {
          ...scene,
          choices: [...scene.choices, { ...original, id: uid(`${sceneId}-c-dup`) }],
        };
      }),
    removeNpcResponse: (sceneId, index) =>
      get().updateScene(sceneId, (scene) => {
        if (!scene.npcResponses || index < 0 || index >= scene.npcResponses.length) return scene;
        const responses = [...scene.npcResponses];
        responses.splice(index, 1);
        const adjustedChoices = scene.choices
          .map((c) => {
            if (c.npcLineIndex === undefined) return c;
            if (c.npcLineIndex === index + 1) return null;
            if (c.npcLineIndex > index + 1) return { ...c, npcLineIndex: c.npcLineIndex - 1 };
            return c;
          })
          .filter(Boolean) as Choice[];
        return { ...scene, npcResponses: responses, choices: adjustedChoices };
      }),
    setSceneId: (oldId, newId) => {
      if (!oldId || !newId || oldId === newId) return;
      updateStory((s) => {
        const scenes = s.scenes.map((scene) => {
          const base = scene.id === oldId ? { ...scene, id: newId } : scene;
          const updatedChoices = base.choices.map((c) => {
            const updated = { ...c };
            if (c.next === oldId) updated.next = newId;
            if (c.onSuccess === oldId) updated.onSuccess = newId;
            if (c.onFail === oldId) updated.onFail = newId;
            if (updated.rollTiers) {
              const newTiers: NonNullable<Choice["rollTiers"]> = {};
              for (const [pct, tier] of Object.entries(updated.rollTiers)) {
                const key = pct as keyof NonNullable<Choice["rollTiers"]>;
                newTiers[key] = { ...tier };
                if (tier.next === oldId) newTiers[key]!.next = newId;
              }
              updated.rollTiers = newTiers;
            }
            return updated;
          });
          return { ...base, choices: updatedChoices };
        });
        const varOrigins = { ...(s.variableOrigins || {}) };
        for (const [k, orig] of Object.entries(varOrigins)) {
          if (orig === oldId) varOrigins[k] = newId;
        }
        const itemOrigins = { ...(s.itemOrigins || {}) };
        for (const [k, orig] of Object.entries(itemOrigins)) {
          if (orig === oldId) itemOrigins[k] = newId;
        }
        return {
          ...s,
          scenes,
          startScene: s.startScene === oldId ? newId : s.startScene,
          variableOrigins: varOrigins,
          itemOrigins: itemOrigins,
        };
      });
      if (get().currentSceneId === oldId) set({ currentSceneId: newId });
    },
    setStartScene: (id) => updateStory((s) => ({ ...s, startScene: id })),
    addVariable: (name, initialValue, introducedInScene) => {
      if (!name || !introducedInScene) return;
      updateStory((s) => ({
        ...s,
        variables: { ...(s.variables || {}), [name]: initialValue },
        variableOrigins: { ...(s.variableOrigins || {}), [name]: introducedInScene },
        suggestedVariables: (s.suggestedVariables || []).includes(name)
          ? s.suggestedVariables
          : [...(s.suggestedVariables || []), name],
      }));
    },
    addItem: (name, initialCount, introducedInScene) => {
      if (!name || !introducedInScene) return;
      updateStory((s) => ({
        ...s,
        items: { ...(s.items || {}), [name]: initialCount },
        itemOrigins: { ...(s.itemOrigins || {}), [name]: introducedInScene },
        suggestedItems: (s.suggestedItems || []).includes(name)
          ? s.suggestedItems
          : [...(s.suggestedItems || []), name],
      }));
    },
    renameStoryVariable: (oldKey, newKey) => {
      const trimmed = newKey.trim();
      if (!oldKey || !trimmed || trimmed === oldKey) return;
      updateStory((s) => {
        const vars = { ...(s.variables || {}) };
        if (!(oldKey in vars)) return s;
        const value = vars[oldKey];
        delete vars[oldKey];
        vars[trimmed] = value;
        const origins = { ...(s.variableOrigins || {}) };
        if (origins[oldKey] !== undefined) {
          origins[trimmed] = origins[oldKey];
          delete origins[oldKey];
        }
        const sugg = [...(s.suggestedVariables || [])];
        const idx = sugg.indexOf(oldKey);
        if (idx !== -1) sugg[idx] = trimmed;
        return { ...s, variables: vars, variableOrigins: origins, suggestedVariables: sugg };
      });
    },
    renameStoryItem: (oldKey, newKey) => {
      const trimmed = newKey.trim();
      if (!oldKey || !trimmed || trimmed === oldKey) return;
      updateStory((s) => {
        const itms = { ...(s.items || {}) };
        if (!(oldKey in itms)) return s;
        const count = itms[oldKey];
        delete itms[oldKey];
        itms[trimmed] = count;
        const origins = { ...(s.itemOrigins || {}) };
        if (origins[oldKey] !== undefined) {
          origins[trimmed] = origins[oldKey];
          delete origins[oldKey];
        }
        const sugg = [...(s.suggestedItems || [])];
        const idx = sugg.indexOf(oldKey);
        if (idx !== -1) sugg[idx] = trimmed;
        return { ...s, items: itms, itemOrigins: origins, suggestedItems: sugg };
      });
    },
    removeStoryVariable: (key) => {
      if (!key) return;
      updateStory((s) => {
        const vars = { ...(s.variables || {}) };
        delete vars[key];
        const origins = { ...(s.variableOrigins || {}) };
        delete origins[key];
        return {
          ...s,
          variables: vars,
          variableOrigins: origins,
          suggestedVariables: (s.suggestedVariables || []).filter((n) => n !== key),
        };
      });
    },
    removeStoryItem: (key) => {
      if (!key) return;
      updateStory((s) => {
        const items = { ...(s.items || {}) };
        delete items[key];
        const origins = { ...(s.itemOrigins || {}) };
        delete origins[key];
        return {
          ...s,
          items,
          itemOrigins: origins,
          suggestedItems: (s.suggestedItems || []).filter((n) => n !== key),
        };
      });
    },
    updateStoryVariables: (updater) =>
      updateStory((s) => ({ ...s, variables: updater({ ...(s.variables || {}) }) })),
    updateStoryItems: (updater) =>
      updateStory((s) => ({ ...s, items: updater({ ...(s.items || {}) }) })),
    addSuggestedVariable: (name) => {
      if (!name) return;
      updateStory((s) =>
        (s.suggestedVariables || []).includes(name)
          ? s
          : { ...s, suggestedVariables: [...(s.suggestedVariables || []), name] },
      );
    },
    addSuggestedItem: (name) => {
      if (!name) return;
      updateStory((s) =>
        (s.suggestedItems || []).includes(name)
          ? s
          : { ...s, suggestedItems: [...(s.suggestedItems || []), name] },
      );
    },
    addSuggestedNpcName: (name) => {
      if (!name) return;
      updateStory((s) =>
        (s.suggestedNpcNames || []).includes(name)
          ? s
          : { ...s, suggestedNpcNames: [...(s.suggestedNpcNames || []), name] },
      );
    },
    addSuggestedEmotion: (emotion) => {
      if (!emotion) return;
      updateStory((s) =>
        (s.suggestedEmotions || []).includes(emotion)
          ? s
          : { ...s, suggestedEmotions: [...(s.suggestedEmotions || []), emotion] },
      );
    },
    mergeDiscoveredItems: (newItems, sceneId) =>
      updateStory((s) => {
        const items = { ...(s.items || {}) };
        const origins = { ...(s.itemOrigins || {}) };
        const suggested = [...(s.suggestedItems || [])];
        let changed = false;
        for (const [name, count] of Object.entries(newItems)) {
          const isNew = !(name in items);
          if (isNew) {
            origins[name] = sceneId;
            if (!suggested.includes(name)) suggested.push(name);
            changed = true;
          }
          if (items[name] !== count) {
            items[name] = count;
            changed = true;
          }
        }
        if (!changed) return s;
        return { ...s, items, itemOrigins: origins, suggestedItems: suggested };
      }),
    mergeDiscoveredVariables: (newVars, sceneId) =>
      updateStory((s) => {
        const vars = { ...(s.variables || {}) };
        const origins = { ...(s.variableOrigins || {}) };
        const suggested = [...(s.suggestedVariables || [])];
        let changed = false;
        for (const [name, value] of Object.entries(newVars)) {
          const isNew = !(name in vars);
          if (isNew) {
            origins[name] = sceneId;
            if (!suggested.includes(name)) suggested.push(name);
            changed = true;
          }
          if (vars[name] !== value) {
            vars[name] = value;
            changed = true;
          }
        }
        if (!changed) return s;
        return { ...s, variables: vars, variableOrigins: origins, suggestedVariables: suggested };
      }),
    resetDraft: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      clearActiveDraft();
      const fresh = cloneStory(defaultStory);
      apply(fresh);
      set({ currentSceneId: fresh.startScene });
    },
    restoreFromBackup: () => {
      const backup = safeGet(BACKUP_KEY);
      if (!backup) return "empty";
      try {
        const restored = normalizeLoadedStory(JSON.parse(backup));
        apply(restored);
        set({ currentSceneId: restored.startScene });
        return "ok";
      } catch {
        return "error";
      }
    },
    resetStateToInitial: () =>
      updateStory((s) => {
        const startId = s.startScene || s.scenes[0]?.id || "";
        const startIdx = s.scenes.findIndex((sc) => sc.id === startId);
        const newVariables: Record<string, number> = {};
        const newVariableOrigins: Record<string, string> = {};
        const newItems: Record<string, number> = {};
        const newItemOrigins: Record<string, string> = {};
        Object.entries(s.variables || {}).forEach(([name, val]) => {
          const origin = s.variableOrigins?.[name];
          if (!origin) newVariables[name] = val;
          else {
            const oIdx = s.scenes.findIndex((sc) => sc.id === origin);
            if (oIdx >= 0 && oIdx <= startIdx) {
              newVariables[name] = val;
              newVariableOrigins[name] = origin;
            }
          }
        });
        Object.entries(s.items || {}).forEach(([name, val]) => {
          const origin = s.itemOrigins?.[name];
          if (!origin) newItems[name] = val;
          else {
            const oIdx = s.scenes.findIndex((sc) => sc.id === origin);
            if (oIdx >= 0 && oIdx <= startIdx) {
              newItems[name] = val;
              newItemOrigins[name] = origin;
            }
          }
        });
        return {
          ...s,
          variables: newVariables,
          items: newItems,
          variableOrigins: newVariableOrigins,
          itemOrigins: newItemOrigins,
        };
      }),
    persistBackup: () => {
      const current = safeGet(STORAGE_KEY);
      if (current) safeSet(BACKUP_KEY, current);
    },
  };
});

export interface EditorUIState {
  tab?: EditorTab;
  currentSceneId?: string;
}

export function saveEditorUIState(state: EditorUIState) {
  safeSet(EDITOR_UI_KEY, JSON.stringify(state));
}

export function loadEditorUIState(): Partial<EditorUIState> {
  const raw = safeGet(EDITOR_UI_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as EditorUIState;
  } catch {
    return {};
  }
}

export function saveAnswerBuffer(buffer: Choice[]) {
  safeSet(BUFFER_KEY, JSON.stringify(buffer));
}

export function loadAnswerBuffer(): Choice[] {
  const raw = safeGet(BUFFER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((item: Choice) => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch {
    return [];
  }
}
