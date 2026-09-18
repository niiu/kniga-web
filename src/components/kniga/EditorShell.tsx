import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Bookmark,
  ChevronUp,
  ClipboardList,
  Download,
  FolderOpen,
  Globe,
  Library,
  Menu,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/kniga/Sidebar";
import { DraftsPanel } from "@/components/kniga/DraftsPanel";
import { SceneEditor } from "@/components/kniga/SceneEditor";
import { CharacterEditor } from "@/components/kniga/CharacterEditor";
import { InventoryEditor } from "@/components/kniga/InventoryEditor";
import { PreviewPanel } from "@/components/kniga/PreviewPanel";
import {
  computeBaseStartingFromStory,
  loadAnswerBuffer,
  loadCleanBase,
  loadEditorUIState,
  saveAnswerBuffer,
  saveCleanBase,
  saveEditorUIState,
  useStoryStore,
  type CleanBase,
  type EditorTab,
} from "@/lib/kniga/storyStore.ts";
import {
  applyEffects,
  evaluateRollOutcome,
  formatDialogueLine,
  getDialogueNpcNameForStep,
  getNextDialogueStep,
} from "@/lib/kniga/gameEngine.ts";
import { parseBookText, parseErrorMessage, stampStory } from "@/lib/kniga/marker.ts";
import { publishBook } from "@/lib/catalog/books.ts";
import {
  clearActiveDraft,
  deleteDraft,
  getActiveDraftId,
  getDraft,
  listDrafts,
  saveDraft,
  setActiveDraftId,
  type DraftMeta,
} from "@/lib/kniga/draftsStore.ts";
import {
  autoSave,
  getAllSlots,
  loadAutoSave,
  loadSlot,
  saveToSlot,
  type SaveData,
} from "@/lib/kniga/saveStore.ts";
import type { Choice, Story } from "@/lib/kniga/types.ts";
import { cn, downloadText, uid } from "@/lib/utils.ts";

const TABS: { id: EditorTab; label: string }[] = [
  { id: "editor", label: "Редактор" },
  { id: "character", label: "Персонаж" },
  { id: "inventory", label: "Инвентарь" },
  { id: "preview", label: "Просмотр" },
];

type RollTier = 0 | 25 | 50 | 85 | 100;

function fileBaseName(title: string) {
  const base = (title || "Интерактивная_история")
    .trim()
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return base || "Интерактивная_история";
}

function withDiscovered(base: Record<string, number>, current: Record<string, number>) {
  const restored = { ...base };
  for (const [k, v] of Object.entries(current || {})) {
    if (!(k in base)) restored[k] = v;
  }
  return restored;
}

export function EditorShell() {
  const navigate = useNavigate();
  const story = useStoryStore((s) => s.story);
  const currentSceneId = useStoryStore((s) => s.currentSceneId);
  const hydrated = useStoryStore((s) => s.hydrated);
  const hydrate = useStoryStore((s) => s.hydrate);
  const setStory = useStoryStore((s) => s.setStory);
  const setCurrentSceneId = useStoryStore((s) => s.setCurrentSceneId);
  const updateStory = useStoryStore((s) => s.updateStory);
  const updateStoryVariables = useStoryStore((s) => s.updateStoryVariables);
  const updateStoryItems = useStoryStore((s) => s.updateStoryItems);
  const mergeDiscoveredItems = useStoryStore((s) => s.mergeDiscoveredItems);
  const mergeDiscoveredVariables = useStoryStore((s) => s.mergeDiscoveredVariables);
  const addChoice = useStoryStore((s) => s.addChoice);
  const resetDraft = useStoryStore((s) => s.resetDraft);
  const restoreFromBackup = useStoryStore((s) => s.restoreFromBackup);
  const resetStateToInitial = useStoryStore((s) => s.resetStateToInitial);
  const persistBackup = useStoryStore((s) => s.persistBackup);

  const [tab, setTab] = useState<EditorTab>("editor");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [buffer, setBuffer] = useState<Choice[]>([]);
  const [cleanBase, setCleanBase] = useState<CleanBase>({ variables: {}, items: {} });
  const [sessionBase, setSessionBase] = useState<CleanBase>({ variables: {}, items: {} });
  const [previewSceneId, setPreviewSceneId] = useState(story.startScene);
  const [previewVars, setPreviewVars] = useState<Record<string, number>>({ ...story.variables });
  const [previewItems, setPreviewItems] = useState<Record<string, number>>({ ...story.items });
  const [sceneStates, setSceneStates] = useState<
    Record<string, { variables: Record<string, number>; items: Record<string, number> }>
  >({});
  const [previewEntrySceneId, setPreviewEntrySceneId] = useState("");
  const [previousSceneId, setPreviousSceneId] = useState<string | null>(null);
  const [previousState, setPreviousState] = useState<{
    variables: Record<string, number>;
    items: Record<string, number>;
  } | null>(null);
  const [dialogueHistory, setDialogueHistory] = useState("");
  const [currentDialogueStep, setCurrentDialogueStep] = useState(0);
  const [forcedRollTier, setForcedRollTier] = useState<RollTier | null>(null);
  const [lastPreviewSceneForDialogue, setLastPreviewSceneForDialogue] = useState("");
  const [lastRoll, setLastRoll] = useState<string | null>(null);
  const [slots, setSlots] = useState<(SaveData | null)[]>([]);
  const [autoSaveData, setAutoSaveData] = useState<SaveData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fileMenu, setFileMenu] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [activeDraftId, setActiveDraftIdState] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const lastTabRef = useRef<EditorTab>("editor");
  const transferOnEditorEntry = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrate();
    const ui = loadEditorUIState();
    if (ui.tab && TABS.some((t) => t.id === ui.tab)) setTab(ui.tab);
    setBuffer(loadAnswerBuffer());
    const savedBase = loadCleanBase();
    const after = useStoryStore.getState().story;
    const computed = computeBaseStartingFromStory(after);
    setCleanBase(savedBase ?? computed);
    if (!savedBase) saveCleanBase(computed);
    persistBackup();
    refreshSaves();
    refreshDrafts();
    const id = window.setInterval(() => persistBackup(), 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveEditorUIState({ tab, currentSceneId });
  }, [tab, currentSceneId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveCleanBase(cleanBase);
  }, [cleanBase, hydrated]);

  useEffect(() => {
    saveAnswerBuffer(buffer);
  }, [buffer]);

  useEffect(() => {
    if (previewSceneId && previewSceneId !== lastPreviewSceneForDialogue) {
      setLastPreviewSceneForDialogue(previewSceneId);
      const scene = story.scenes.find((s) => s.id === previewSceneId);
      if (scene?.isDialogue && scene.text) {
        const firstNpcLabel = getDialogueNpcNameForStep(scene, 0);
        setDialogueHistory(formatDialogueLine(firstNpcLabel, scene.text));
        setCurrentDialogueStep(0);
      } else if (previewSceneId !== "end") {
        setDialogueHistory("");
        setCurrentDialogueStep(0);
      }
    }
  }, [previewSceneId, lastPreviewSceneForDialogue, story.scenes]);

  useEffect(() => {
    if (tab !== "preview" || !previewSceneId || previewSceneId === "end") return;
    setSceneStates((prev) => ({
      ...prev,
      [previewSceneId]: { variables: { ...previewVars }, items: { ...previewItems } },
    }));
    // snapshot on scene enter only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, previewSceneId]);

  function refreshSaves() {
    setSlots(getAllSlots());
    setAutoSaveData(loadAutoSave());
  }

  function refreshDrafts() {
    setDrafts(listDrafts());
    setActiveDraftIdState(getActiveDraftId());
  }

  function saveCurrentBook(asNew = false) {
    const meta = saveDraft(useStoryStore.getState().story, asNew ? null : getActiveDraftId());
    refreshDrafts();
    toast.success(asNew || !activeDraftId ? `«${meta.title}» сохранена` : `«${meta.title}» обновлена`);
  }

  function loadBook(id: string) {
    const loaded = getDraft(id);
    if (!loaded) {
      toast.error("Книга не найдена");
      return;
    }
    persistBackup();
    setActiveDraftId(id);
    applyStory(loaded, "editor");
    refreshDrafts();
    setDraftsOpen(false);
    toast.success(`Открыта «${loaded.title || "Без названия"}»`);
  }

  function removeBook(id: string) {
    deleteDraft(id);
    refreshDrafts();
    toast.success("Книга удалена из мастерской");
  }

  function startNewBook() {
    persistBackup();
    resetDraft();
    const fresh = computeBaseStartingFromStory(useStoryStore.getState().story);
    setCleanBase(fresh);
    refreshDrafts();
    setDraftsOpen(false);
    toast.success("Новая книга");
  }

  function applyStartOrigins(vars: Record<string, number>, items: Record<string, number>) {
    const applyStartId = useStoryStore.getState().story.startScene || useStoryStore.getState().story.scenes[0]?.id || "";
    if (!applyStartId) return;
    updateStory((s) => {
      const vO = { ...(s.variableOrigins || {}) };
      Object.keys(vars || {}).forEach((k) => {
        vO[k] = applyStartId;
      });
      const iO = { ...(s.itemOrigins || {}) };
      Object.keys(items || {}).forEach((k) => {
        iO[k] = applyStartId;
      });
      return { ...s, variableOrigins: vO, itemOrigins: iO };
    });
  }

  function resetGlobalToPristineSessionBase() {
    let nextVars: Record<string, number> = {};
    let nextItems: Record<string, number> = {};
    if (Object.keys(cleanBase.variables).length > 0 || Object.keys(cleanBase.items).length > 0) {
      nextVars = { ...cleanBase.variables };
      nextItems = { ...cleanBase.items };
    } else {
      const current = useStoryStore.getState().story;
      nextVars = { ...(current.variables || {}) };
      nextItems = { ...(current.items || {}) };
    }
    setSessionBase({ variables: nextVars, items: nextItems });
    if (Object.keys(nextVars).length > 0 || Object.keys(nextItems).length > 0) {
      updateStoryVariables(() => ({ ...nextVars }));
      updateStoryItems(() => ({ ...nextItems }));
    } else {
      resetStateToInitial();
    }
    applyStartOrigins(nextVars, nextItems);
  }

  function transferCurrentPreviewToGlobal() {
    if (Object.keys(sessionBase.variables).length > 0 || Object.keys(sessionBase.items).length > 0) {
      updateStoryVariables(() => withDiscovered(sessionBase.variables, previewVars));
      updateStoryItems(() => withDiscovered(sessionBase.items, previewItems));
    }
  }

  function leavePreview(next: EditorTab) {
    const from = lastTabRef.current;
    if (from === "preview" && next !== "preview") {
      if (next === "editor") {
        if (transferOnEditorEntry.current) {
          transferCurrentPreviewToGlobal();
          transferOnEditorEntry.current = false;
        } else {
          resetGlobalToPristineSessionBase();
          transferOnEditorEntry.current = false;
        }
        setDialogueHistory("");
        setCurrentDialogueStep(0);
      } else {
        transferCurrentPreviewToGlobal();
        if (previewSceneId && previewSceneId !== "end") setCurrentSceneId(previewSceneId);
      }
    }
    lastTabRef.current = next;
    setTab(next);
  }

  function startPreview(baseOverride?: CleanBase) {
    transferOnEditorEntry.current = false;
    setForcedRollTier(null);
    const current = useStoryStore.getState();
    const base = baseOverride ?? cleanBase;
    if (Object.keys(base.variables).length > 0 || Object.keys(base.items).length > 0) {
      updateStoryVariables(() => ({ ...base.variables }));
      updateStoryItems(() => ({ ...base.items }));
      applyStartOrigins(base.variables, base.items);
    }
    const fresh = useStoryStore.getState().story;
    const sess = { variables: { ...fresh.variables }, items: { ...(fresh.items || {}) } };
    setSessionBase(sess);
    const entry = (baseOverride ? fresh.startScene : current.currentSceneId) || fresh.startScene;
    setPreviewEntrySceneId(entry);
    setPreviewSceneId(entry);
    setPreviewVars({ ...sess.variables });
    setPreviewItems({ ...sess.items });
    setSceneStates({
      [entry]: { variables: { ...sess.variables }, items: { ...sess.items } },
    });
    setLastPreviewSceneForDialogue("");
    setLastRoll(null);
    lastTabRef.current = "preview";
    setTab("preview");
  }

  function enterPreview() {
    const comingFromEditor = tab === "editor" || lastTabRef.current === "editor";
    if (comingFromEditor) {
      startPreview();
      return;
    }
    if (previewSceneId && Object.keys(sessionBase.variables).length > 0) {
      lastTabRef.current = "preview";
      setTab("preview");
    } else {
      startPreview();
    }
  }

  function handleTab(next: EditorTab) {
    if (next === "preview") enterPreview();
    else leavePreview(next);
  }

  function restartPreview() {
    transferOnEditorEntry.current = false;
    setForcedRollTier(null);
    resetGlobalToPristineSessionBase();
    const sess = {
      variables:
        Object.keys(cleanBase.variables).length > 0
          ? { ...cleanBase.variables }
          : { ...useStoryStore.getState().story.variables },
      items:
        Object.keys(cleanBase.items).length > 0
          ? { ...cleanBase.items }
          : { ...(useStoryStore.getState().story.items || {}) },
    };
    setSessionBase(sess);
    const entry = previewEntrySceneId || useStoryStore.getState().story.startScene;
    setPreviewSceneId(entry);
    setPreviewVars({ ...sess.variables });
    setPreviewItems({ ...sess.items });
    setSceneStates({
      [entry]: { variables: { ...sess.variables }, items: { ...sess.items } },
    });
    setLastPreviewSceneForDialogue("");
    setLastRoll(null);
    setPreviousSceneId(null);
    setPreviousState(null);
  }

  function editCurrentSceneFromPreview() {
    if (previewSceneId && previewSceneId !== "end") setCurrentSceneId(previewSceneId);
    transferOnEditorEntry.current = true;
    leavePreview("editor");
  }

  function selectScene(id: string) {
    if (tab === "editor" && id) {
      setSceneStates((prev) => (prev[id] ? { [id]: prev[id] } : {}));
    }
    setCurrentSceneId(id);
    setSidebarOpen(false);
  }

  const makeChoice = useCallback(
    (choice: Choice) => {
      const preChoiceSceneId = previewSceneId;
      const preChoiceState = { variables: { ...previewVars }, items: { ...previewItems } };
      let effectsToApply = choice.effects;
      let nextId = choice.next || "";
      let rollValue: number | undefined;
      let tierLabel = "";

      if (choice.roll) {
        const outcome = evaluateRollOutcome(choice, previewVars, forcedRollTier ?? undefined);
        effectsToApply = outcome.effects;
        nextId = outcome.nextId;
        rollValue = outcome.rollValue;
        if (outcome.tier != null) tierLabel = ` (${outcome.tier}%)`;
      }

      const currentScene = story.scenes.find((s) => s.id === previewSceneId);
      const isDialogue = !!currentScene?.isDialogue;
      if (isDialogue && !nextId) nextId = previewSceneId;

      const willEnd = nextId === "end" || !nextId;
      if (willEnd || (nextId && nextId !== preChoiceSceneId)) {
        setPreviousSceneId(preChoiceSceneId);
        setPreviousState(preChoiceState);
      }

      let nextHistory = dialogueHistory;
      let nextStep = currentDialogueStep;
      if (isDialogue) {
        const currentNpcName = getDialogueNpcNameForStep(currentScene, currentDialogueStep);
        const currentNpcText =
          currentDialogueStep === 0
            ? currentScene?.text || ""
            : currentScene?.npcResponses?.[currentDialogueStep - 1]?.text || "";
        const turn = `${formatDialogueLine(currentNpcName, currentNpcText)}\n\n${formatDialogueLine(undefined, choice.text, true)}`;
        nextHistory = (dialogueHistory ? dialogueHistory + "\n\n" : "") + turn;
        const postState = applyEffects(effectsToApply, {
          variables: { ...previewVars },
          items: { ...previewItems },
        });
        const thisStep = choice.npcLineIndex || 0;
        nextStep = getNextDialogueStep(thisStep, currentScene?.npcResponses, postState);
        const newNpcName = getDialogueNpcNameForStep(currentScene, nextStep);
        const newNpcText = nextStep === 0 ? "" : currentScene?.npcResponses?.[nextStep - 1]?.text || "";
        if (newNpcText) nextHistory += `\n\n${formatDialogueLine(newNpcName, newNpcText)}`;
        setDialogueHistory(nextHistory);
        setCurrentDialogueStep(nextStep);
      } else {
        setDialogueHistory("");
        setCurrentDialogueStep(0);
      }

      const newState = applyEffects(effectsToApply, {
        variables: { ...previewVars },
        items: { ...previewItems },
      });

      const arrivalId =
        nextId && nextId !== "end" && story.scenes.some((s) => s.id === nextId) ? nextId : null;

      if (arrivalId) {
        const itemsToMerge: Record<string, number> = {};
        for (const [k, v] of Object.entries(newState.items)) {
          if (!(k in sessionBase.items)) itemsToMerge[k] = v;
        }
        if (Object.keys(itemsToMerge).length > 0) mergeDiscoveredItems(itemsToMerge, arrivalId);

        const varsToMerge: Record<string, number> = {};
        for (const [k, v] of Object.entries(newState.variables)) {
          if (!(k in sessionBase.variables)) varsToMerge[k] = v;
        }
        if (Object.keys(varsToMerge).length > 0) mergeDiscoveredVariables(varsToMerge, arrivalId);

        setSceneStates((prev) => ({
          ...prev,
          [arrivalId]: { variables: { ...newState.variables }, items: { ...newState.items } },
        }));
      }

      setPreviewVars({ ...newState.variables });
      setPreviewItems({ ...newState.items });

      if (choice.roll && rollValue !== undefined) {
        setLastRoll(`Бросок: ${choice.roll} → ${rollValue}${tierLabel}`);
      } else {
        setLastRoll(null);
      }

      if (nextId === "end" || !nextId) {
        setPreviewSceneId("end");
        setDialogueHistory("");
      } else if (nextId !== previewSceneId && story.scenes.some((s) => s.id === nextId)) {
        setPreviewSceneId(nextId);
      }

      try {
        const saved = autoSave(
          nextId === "end" || !nextId ? "end" : nextId || previewSceneId,
          newState.variables,
          newState.items,
          isDialogue ? nextHistory : "",
          isDialogue ? nextStep : 0,
          sceneStates,
        );
        setAutoSaveData(saved);
      } catch {
        /* ignore */
      }
    },
    [
      previewSceneId,
      previewVars,
      previewItems,
      forcedRollTier,
      story.scenes,
      dialogueHistory,
      currentDialogueStep,
      sessionBase,
      mergeDiscoveredItems,
      mergeDiscoveredVariables,
      sceneStates,
    ],
  );

  function returnToPreviousScene() {
    if (!previousSceneId || !previousState) return;
    setPreviewSceneId(previousSceneId);
    setPreviewVars({ ...previousState.variables });
    setPreviewItems({ ...previousState.items });
    setLastPreviewSceneForDialogue("");
    setPreviousSceneId(null);
    setPreviousState(null);
    setLastRoll(null);
  }

  function onRewindTo(id: string) {
    const snap = sceneStates[id];
    if (snap) {
      setPreviewVars({ ...snap.variables });
      setPreviewItems({ ...snap.items });
    }
    setPreviewSceneId(id);
    setPreviousSceneId(null);
    setPreviousState(null);
    setLastPreviewSceneForDialogue("");
    setLastRoll(null);
  }

  function storyForExport() {
    const baseV = Object.keys(cleanBase.variables).length > 0 ? cleanBase.variables : sessionBase.variables;
    const baseI = Object.keys(cleanBase.items).length > 0 ? cleanBase.items : sessionBase.items;
    if (Object.keys(baseV).length > 0 || Object.keys(baseI).length > 0) {
      return { ...story, variables: { ...baseV }, items: { ...baseI } };
    }
    return story;
  }

  function applyStory(loaded: Story, then: "editor" | "preview" = "editor") {
    persistBackup();
    setStory(loaded);
    const loadedBase = computeBaseStartingFromStory(loaded);
    setCleanBase(loadedBase);
    saveCleanBase(loadedBase);
    setPreviewSceneId(loaded.startScene);
    setPreviewVars({ ...loaded.variables });
    setPreviewItems({ ...loaded.items });
    setSceneStates({});
    setLastRoll(null);
    setDialogueHistory("");
    setCurrentDialogueStep(0);
    if (then === "preview") {
      startPreview(loadedBase);
    } else {
      lastTabRef.current = "editor";
      setTab("editor");
    }
  }

  async function exportHtml() {
    try {
      const { generateFullStandaloneHtml } = await import("@/lib/kniga/generateHtml.ts");
      const html = generateFullStandaloneHtml(storyForExport());
      downloadText(`${fileBaseName(story.title)}.html`, html, "text/html");
      toast.success("Игра сохранена как HTML-файл");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось собрать HTML");
    }
  }

  function exportStory() {
    downloadText(`${fileBaseName(story.title)}.story`, JSON.stringify(stampStory(storyForExport()), null, 2), "application/json");
    toast.success("Файл .story сохранён");
  }

  async function publishToSite() {
    if (publishing) return;
    setPublishing(true);
    try {
      const payload = stampStory(storyForExport());
      const meta = await publishBook({
        data: {
          fileName: `${fileBaseName(payload.title)}.story`,
          text: JSON.stringify(payload, null, 2),
        },
      });
      setFileMenu(false);
      toast.success(`«${meta.title}» в каталоге`, {
        action: {
          label: "Читать",
          onClick: () => {
            void navigate({ to: "/read/$bookId", params: { bookId: meta.id } });
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось опубликовать");
    } finally {
      setPublishing(false);
    }
  }

  function exportCleanStory() {
    const clean = {
      ...story,
      variables: Object.keys(sessionBase.variables).length ? sessionBase.variables : cleanBase.variables,
      items: Object.keys(sessionBase.items).length ? sessionBase.items : cleanBase.items,
    };
    downloadText(`${fileBaseName(story.title)}.story`, JSON.stringify(stampStory(clean), null, 2), "application/json");
    toast.success("Чистая версия сохранена");
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBookText(String(reader.result), file.name);
        persistBackup();
        clearActiveDraft();
        applyStory(parsed.story, "editor");
        refreshDrafts();
        toast.success("История загружена");
      } catch (err) {
        toast.error(parseErrorMessage(err));
      }
    };
    reader.readAsText(file);
  }

  function applyLoadedSave(data: SaveData | null, emptyMsg: string) {
    if (!data) {
      toast.error(emptyMsg);
      return;
    }
    setPreviewSceneId(data.sceneId);
    setPreviewVars({ ...data.variables });
    setPreviewItems({ ...data.items });
    setDialogueHistory(data.dialogueHistory || "");
    setCurrentDialogueStep(data.currentDialogueStep || 0);
    if (data.sceneStates) setSceneStates(data.sceneStates);
    setLastPreviewSceneForDialogue("");
    toast.success("Сохранение загружено");
  }

  function captureSave() {
    return {
      sceneId: previewSceneId,
      variables: previewVars,
      items: previewItems,
      dialogueHistory,
      currentDialogueStep,
      sceneStates,
    };
  }

  const liveForEditor = useMemo(() => {
    if (tab === "preview" && previewSceneId === currentSceneId) {
      return { variables: previewVars, items: previewItems };
    }
    return sceneStates[currentSceneId];
  }, [tab, previewSceneId, currentSceneId, previewVars, previewItems, sceneStates]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <div className="hidden w-72 shrink-0 md:flex md:flex-col">
        <Sidebar onExport={exportHtml} onSelectScene={selectScene} />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Закрыть список сцен"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="font-display text-sm">Сцены</span>
              <button type="button" className="size-10" onClick={() => setSidebarOpen(false)} aria-label="Закрыть">
                <X className="mx-auto size-4" />
              </button>
            </div>
            <Sidebar onExport={exportHtml} onSelectScene={selectScene} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-stretch border-b border-border bg-card">
          <button
            type="button"
            className="flex size-12 shrink-0 items-center justify-center border-r border-border text-ink md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Список сцен"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTab(t.id)}
                className={cn(
                  "min-h-12 flex-1 px-3 text-sm font-medium tracking-wide transition-colors",
                  tab === t.id
                    ? "border-b-2 border-accent text-ink"
                    : "text-muted-foreground hover:text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              refreshDrafts();
              setDraftsOpen(true);
            }}
            className="inline-flex min-h-12 w-12 shrink-0 items-center justify-center gap-2 border-l border-border text-sm text-ink hover:bg-muted md:w-auto md:px-3"
            aria-label="Мои книги"
          >
            <Library className="size-4" />
            <span className="hidden md:inline">Книги</span>
          </button>
          <Link
            to="/"
            className="inline-flex min-h-12 shrink-0 items-center border-l border-border px-2.5 text-sm text-accent hover:bg-muted md:px-3"
          >
            Каталог
          </Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "editor" ? (
            <SceneEditor
              liveVariables={liveForEditor?.variables}
              liveItems={liveForEditor?.items}
              onCopyToBuffer={(choice) => {
                const clone: Choice = {
                  ...JSON.parse(JSON.stringify(choice)),
                  id: uid("buf"),
                };
                setBuffer((prev) => [...prev, clone]);
                toast.success("Ответ скопирован в буфер");
              }}
            />
          ) : null}
          {tab === "character" ? (
            <CharacterEditor
              startingVariables={cleanBase.variables}
              onSetStartingVariable={(key, value) =>
                setCleanBase((b) => ({ ...b, variables: { ...b.variables, [key]: value } }))
              }
              onRenameStartingVariable={(oldKey, newKey) => {
                const trimmed = newKey.trim();
                if (!trimmed || trimmed === oldKey) return;
                setCleanBase((b) => {
                  if (!(oldKey in b.variables)) return b;
                  const next = { ...b.variables };
                  const val = next[oldKey];
                  delete next[oldKey];
                  next[trimmed] = val;
                  return { ...b, variables: next };
                });
              }}
              onRemoveStartingVariable={(key) =>
                setCleanBase((b) => {
                  const next = { ...b.variables };
                  delete next[key];
                  return { ...b, variables: next };
                })
              }
              onAddStartingVariable={(name, value) =>
                setCleanBase((b) => ({ ...b, variables: { ...b.variables, [name]: value } }))
              }
              onResetCurrentToStarting={() => {
                updateStoryVariables(() => ({ ...cleanBase.variables }));
                toast.success("Характеристики сброшены к стартовым");
              }}
            />
          ) : null}
          {tab === "inventory" ? (
            <InventoryEditor
              startingItems={cleanBase.items}
              onSetStartingItem={(name, count) =>
                setCleanBase((b) => ({ ...b, items: { ...b.items, [name]: count } }))
              }
              onRenameStartingItem={(oldName, newName) => {
                const trimmed = newName.trim();
                if (!trimmed || trimmed === oldName) return;
                setCleanBase((b) => {
                  if (!(oldName in b.items)) return b;
                  const next = { ...b.items };
                  const val = next[oldName];
                  delete next[oldName];
                  next[trimmed] = val;
                  return { ...b, items: next };
                });
              }}
              onRemoveStartingItem={(name) =>
                setCleanBase((b) => {
                  const next = { ...b.items };
                  delete next[name];
                  return { ...b, items: next };
                })
              }
              onAddStartingItem={(name, count) =>
                setCleanBase((b) => ({ ...b, items: { ...b.items, [name]: count } }))
              }
              onResetCurrentToStarting={() => {
                updateStoryItems(() => ({ ...cleanBase.items }));
                toast.success("Инвентарь сброшен к стартовому");
              }}
            />
          ) : null}
          {tab === "preview" ? (
            <PreviewPanel
              previewSceneId={previewSceneId}
              previewVars={previewVars}
              previewItems={previewItems}
              makeChoice={makeChoice}
              onRestart={restartPreview}
              onEditCurrent={editCurrentSceneFromPreview}
              dialogueHistory={dialogueHistory}
              currentDialogueStep={currentDialogueStep}
              previousSceneId={previousSceneId}
              onReturnToPreviousScene={returnToPreviousScene}
              forcedRollTier={forcedRollTier}
              onForcedRollTierChange={setForcedRollTier}
              startingVariables={cleanBase.variables}
              startingItems={cleanBase.items}
              sceneStates={sceneStates}
              onRewindTo={onRewindTo}
              lastRoll={lastRoll}
              slots={slots}
              autoSaveData={autoSaveData}
              onQuickSave={() => {
                const cap = captureSave();
                const data = autoSave(
                  cap.sceneId,
                  cap.variables,
                  cap.items,
                  cap.dialogueHistory,
                  cap.currentDialogueStep,
                  cap.sceneStates,
                );
                setAutoSaveData(data);
                toast.success("Автосохранение записано");
              }}
              onSaveToSlot={(slot) => {
                const cap = captureSave();
                saveToSlot(
                  slot,
                  cap.sceneId,
                  cap.variables,
                  cap.items,
                  cap.dialogueHistory,
                  cap.currentDialogueStep,
                  cap.sceneStates,
                );
                refreshSaves();
                toast.success(`Слот ${slot} сохранён`);
              }}
              onLoadSlot={(slot) => applyLoadedSave(loadSlot(slot), "Слот пуст")}
              onLoadAuto={() => applyLoadedSave(loadAutoSave(), "Нет автосохранения")}
            />
          ) : null}
        </div>

        {showBuffer ? (
          <div className="border-t border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">Буфер ответов ({buffer.length})</div>
              <Button size="sm" variant="ghost" onClick={() => setShowBuffer(false)}>
                Закрыть
              </Button>
            </div>
            {buffer.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Буфер пуст. Скопируйте ответ в карточке выбора.
              </p>
            ) : (
              <div className="grid max-h-52 grid-cols-2 gap-3 overflow-auto md:grid-cols-4">
                {buffer.map((item, idx) => (
                  <div key={item.id || idx} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.text || "(пустой ответ)"}</div>
                        {item.roll ? (
                          <div className="mt-0.5 truncate font-mono text-[10px] text-ok">{item.roll}</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="size-8 shrink-0 text-destructive"
                        onClick={() => setBuffer((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Удалить из буфера"
                      >
                        <X className="mx-auto size-3.5" />
                      </button>
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      variant="secondary"
                      onClick={() => {
                        const clone = {
                          ...JSON.parse(JSON.stringify(item)),
                          id: uid(`${currentSceneId}-c`),
                          npcLineIndex: 0,
                        } as Choice;
                        addChoice(currentSceneId, clone);
                        toast.success("Ответ вставлен в сцену");
                      }}
                    >
                      Вставить
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <footer className="border-t border-border bg-card md:px-4 md:py-3">
          <div className="grid grid-cols-2 divide-x divide-border md:hidden">
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium text-ink"
              onClick={() => setFileMenu(true)}
              aria-expanded={fileMenu}
              aria-haspopup="dialog"
            >
              <ChevronUp className="size-4" />
              Файл
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium text-ink"
              onClick={() => setShowBuffer((v) => !v)}
              aria-expanded={showBuffer}
            >
              <ChevronUp className={cn("size-4 transition-transform duration-[var(--motion-quick)]", showBuffer && "rotate-180")} />
              Буфер{buffer.length ? ` (${buffer.length})` : ""}
            </button>
          </div>
          <div className="hidden flex-wrap gap-2 md:flex">
            <Button onClick={() => void publishToSite()} disabled={publishing}>
              <Globe className="size-4" />
              {publishing ? "Публикация…" : "Опубликовать"}
            </Button>
            <Button variant="secondary" onClick={() => saveCurrentBook()}>
              <Bookmark className="size-4" />
              Сохранить книгу
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                refreshDrafts();
                setDraftsOpen(true);
              }}
            >
              <Library className="size-4" />
              Мои книги
            </Button>
            <Button variant="outline" onClick={exportStory}>
              <Download className="size-4" />
              Сохранить .story
            </Button>
            <Button variant="secondary" onClick={exportCleanStory}>
              <Upload className="size-4" />
              Чистая версия
            </Button>
            <Button variant="outline" asChild>
              <label htmlFor="kniga-open-story">
                <FolderOpen className="size-4" />
                Загрузить
              </label>
            </Button>
            <Button variant="outline" onClick={() => setConfirmReset(true)}>
              <Trash2 className="size-4" />
              Сбросить черновик
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const result = restoreFromBackup();
                if (result === "ok") {
                  const restored = computeBaseStartingFromStory(useStoryStore.getState().story);
                  setCleanBase(restored);
                  toast.success("Восстановлено из резервной копии");
                } else if (result === "empty") toast.error("Резервная копия пуста");
                else toast.error("Не удалось восстановить");
              }}
            >
              <Undo2 className="size-4" />
              Из копии
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetGlobalToPristineSessionBase();
                toast.success("Глобальное состояние сброшено");
              }}
            >
              <RotateCcw className="size-4" />
              Сбросить статы
            </Button>
            <Button variant="ghost" onClick={() => setShowBuffer((v) => !v)}>
              <ClipboardList className="size-4" />
              Буфер ({buffer.length})
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                try {
                  localStorage.removeItem("kniga-engine-editor-ui");
                  localStorage.removeItem("kniga-engine-collapses");
                  localStorage.removeItem("kniga-engine-answer-buffer");
                } catch {
                  /* ignore */
                }
                setBuffer([]);
                setShowBuffer(false);
                setTab("editor");
                const startId = story.startScene || story.scenes[0]?.id || "scene1";
                setCurrentSceneId(startId);
                toast.success("Состояние редактора очищено");
              }}
            >
              <BookOpen className="size-4" />
              Очистить UI
            </Button>
          </div>
        </footer>
      </div>

      <input
        id="kniga-open-story"
        ref={fileRef}
        type="file"
        accept=".story,.json,.html,.htm,application/json,text/html"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = "";
        }}
      />

      {fileMenu ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 md:hidden"
          onClick={() => setFileMenu(false)}
        >
          <div
            role="dialog"
            aria-label="Файл и черновик"
            className="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium">Файл и черновик</h2>
              <button type="button" className="size-10" onClick={() => setFileMenu(false)} aria-label="Закрыть">
                <X className="mx-auto size-4" />
              </button>
            </div>
            <div className="grid min-h-0 gap-2 overflow-y-auto">
              <Button onClick={() => void publishToSite()} disabled={publishing}>
                <Globe className="size-4" />
                {publishing ? "Публикация…" : "Опубликовать"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  saveCurrentBook();
                  setFileMenu(false);
                }}
              >
                <Bookmark className="size-4" />
                Сохранить книгу
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFileMenu(false);
                  refreshDrafts();
                  setDraftsOpen(true);
                }}
              >
                <Library className="size-4" />
                Мои книги
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  exportStory();
                  setFileMenu(false);
                }}
              >
                <Download className="size-4" />
                Сохранить .story
              </Button>
              <Button variant="outline" asChild>
                <label
                  htmlFor="kniga-open-story"
                  onClick={() => setFileMenu(false)}
                >
                  <FolderOpen className="size-4" />
                  Загрузить
                </label>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  exportCleanStory();
                  setFileMenu(false);
                }}
              >
                <Upload className="size-4" />
                Чистая версия .story
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFileMenu(false);
                  setConfirmReset(true);
                }}
              >
                Сбросить черновик
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const result = restoreFromBackup();
                  if (result === "ok") {
                    const restored = computeBaseStartingFromStory(useStoryStore.getState().story);
                    setCleanBase(restored);
                    toast.success("Восстановлено из резервной копии");
                  } else if (result === "empty") toast.error("Резервная копия пуста");
                  else toast.error("Не удалось восстановить");
                  setFileMenu(false);
                }}
              >
                Восстановить из копии
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetGlobalToPristineSessionBase();
                  toast.success("Глобальное состояние сброшено");
                  setFileMenu(false);
                }}
              >
                Сбросить статы
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DraftsPanel
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        drafts={drafts}
        activeId={activeDraftId}
        currentTitle={story.title}
        onSave={() => saveCurrentBook()}
        onSaveAs={() => saveCurrentBook(true)}
        onNew={startNewBook}
        onLoad={loadBook}
        onDelete={removeBook}
      />

      {confirmReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="font-display text-lg font-medium">Сбросить черновик?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Текущая книга будет заменена демо-историей. Резервная копия сохранится.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Отмена
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  persistBackup();
                  resetDraft();
                  const fresh = computeBaseStartingFromStory(useStoryStore.getState().story);
                  setCleanBase(fresh);
                  refreshDrafts();
                  setConfirmReset(false);
                  toast.success("Черновик сброшен");
                }}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
