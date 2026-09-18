export interface SaveData {
  slot: number;
  sceneId: string;
  variables: Record<string, number>;
  items: Record<string, number>;
  timestamp: string;
  timestampMs?: number;
  dialogueHistory?: string;
  currentDialogueStep?: number;
  sceneStates?: Record<string, { variables: Record<string, number>; items: Record<string, number> }>;
}

const PREFIX = "ist-game-save-slot-";
const AUTO_SAVE_KEY = "ist-game-autosave";

function getKey(slot: number) {
  return `${PREFIX}${slot}`;
}

function read(key: string): SaveData | null {
  try {
    const str = localStorage.getItem(key);
    if (!str) return null;
    const data = JSON.parse(str) as SaveData;
    data.dialogueHistory = data.dialogueHistory || "";
    data.currentDialogueStep = data.currentDialogueStep || 0;
    return data;
  } catch {
    return null;
  }
}

export function saveToSlot(
  slot: number,
  sceneId: string,
  variables: Record<string, number>,
  items: Record<string, number>,
  dialogueHistory = "",
  currentDialogueStep = 0,
  sceneStates: Record<string, { variables: Record<string, number>; items: Record<string, number> }> = {},
) {
  const data: SaveData = {
    slot,
    sceneId,
    variables: { ...variables },
    items: { ...items },
    timestamp: new Date().toLocaleString("ru-RU"),
    timestampMs: Date.now(),
    dialogueHistory,
    currentDialogueStep,
    sceneStates: sceneStates && Object.keys(sceneStates).length > 0 ? { ...sceneStates } : undefined,
  };
  localStorage.setItem(getKey(slot), JSON.stringify(data));
  return data;
}

export function loadSlot(slot: number): SaveData | null {
  return read(getKey(slot));
}

export function getAllSlots(): (SaveData | null)[] {
  const slots: (SaveData | null)[] = [];
  for (let i = 1; i <= 4; i++) slots.push(loadSlot(i));
  return slots;
}

export function autoSave(
  sceneId: string,
  variables: Record<string, number>,
  items: Record<string, number>,
  dialogueHistory = "",
  currentDialogueStep = 0,
  sceneStates: Record<string, { variables: Record<string, number>; items: Record<string, number> }> = {},
) {
  const data: SaveData = {
    slot: 0,
    sceneId,
    variables: { ...variables },
    items: { ...items },
    timestamp: new Date().toLocaleString("ru-RU"),
    timestampMs: Date.now(),
    dialogueHistory,
    currentDialogueStep,
    sceneStates: sceneStates && Object.keys(sceneStates).length > 0 ? { ...sceneStates } : undefined,
  };
  localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
  return data;
}

export function loadAutoSave(): SaveData | null {
  return read(AUTO_SAVE_KEY);
}
