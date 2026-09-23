// @ts-nocheck
/**
 * runtime.js — ЕДИНСТВЕННЫЙ ИСТОЧНИК ИГРОВОЙ ЛОГИКИ
 *
 * Используется в двух местах:
 *   1. `import ... from '$lib/engine/runtime.js?raw'` в generateHtml.ts
 *      → код вставляется как есть внутрь экспортируемого standalone .html
 *      (должен работать в обычном <script>, без модулей).
 *
 *   2. `import * as runtime from './engine/runtime.js'` в gameEngine.ts
 *      → даёт типизированный доступ + editor-only функции поверх.
 *
 * ПРАВИЛА:
 * - Здесь живут **только** функции, нужные для проигрывания истории.
 * - НИКАКИХ редакторских вещей: normalizeLoadedStory, getConditionReferencedKeys,
 *   DnD, буферы, свёртки, suggested*, сохранение UI и т.п.
 * - Функции объявлены как обычные function (чтобы были в глобальной области после inlining).
 * - В конце файла есть блок экспортов — он автоматически вырезается при ?raw.
 *
 * ВСЁ, ЧТО КАСАЕТСЯ МЕХАНИКИ ИГРЫ (броски, тиры, эффекты, условия, диалоги),
 * ИЗМЕНЯЕТСЯ ТОЛЬКО В ЭТОМ ФАЙЛЕ.
 */

function rollDice(diceNotation, vars) {
  let expr = diceNotation;
  Object.entries(vars || {}).forEach(([key, value]) => {
    expr = expr.replace(new RegExp(`\\b${key}\\b`, 'gi'), String(value));
  });
  expr = expr.replace(/\s+/g, '');
  const termMatches = expr.match(/[+-]?(?:\d+d\d+|\d+)/gi) || [];
  if (termMatches.length === 0) return 10;
  let total = 0;
  for (let raw of termMatches) {
    let sign = 1;
    if (raw.startsWith('-')) {
      sign = -1;
      raw = raw.slice(1);
    } else if (raw.startsWith('+')) {
      raw = raw.slice(1);
    }
    if (raw.includes('d')) {
      const [numStr, sidesStr] = raw.split('d');
      const num = parseInt(numStr, 10) || 1;
      const sides = parseInt(sidesStr, 10) || 6;
      for (let i = 0; i < num; i++) {
        total += sign * (Math.floor(Math.random() * sides) + 1);
      }
    } else {
      total += sign * (parseInt(raw, 10) || 0);
    }
  }
  return total;
}

function applyEffects(effects, state) {
  if (!effects) return { variables: {...state.variables}, items: {...state.items} };
  const variables = {...state.variables};
  const items = {...state.items};
  const effectsList = effects.split(',').map(e => e.trim()).filter(Boolean);
  for (const effect of effectsList) {
    if (effect.startsWith('addItem:') || effect.startsWith('removeItem:')) {
      const parts = effect.split(':');
      const action = parts[0];
      const itemName = parts[1];
      const qty = parseInt(parts[2] || '1', 10) || 1;
      if (itemName) {
        const current = items[itemName] ?? 0;
        items[itemName] = action === 'addItem' ? current + qty : Math.max(0, current - qty);
      }
    } else {
      const [key, valStr] = effect.split(':');
      if (key && valStr !== undefined) {
        const val = parseInt(valStr, 10);
        if (!isNaN(val)) variables[key] = (variables[key] || 0) + val;
      }
    }
  }
  return { variables, items };
}

function tokenizeCondition(str) {
  const tokens = [];
  let i = 0;
  const len = str.length;
  while (i < len) {
    if (/\s/.test(str[i])) { i++; continue; }
    if (str[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (str[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (str.startsWith('>=', i)) { tokens.push({ type: 'OP', value: '>=' }); i += 2; continue; }
    if (str.startsWith('<=', i)) { tokens.push({ type: 'OP', value: '<=' }); i += 2; continue; }
    if (str.startsWith('==', i)) { tokens.push({ type: 'OP', value: '==' }); i += 2; continue; }
    if (str[i] === '>') { tokens.push({ type: 'OP', value: '>' }); i++; continue; }
    if (str[i] === '<') { tokens.push({ type: 'OP', value: '<' }); i++; continue; }
    if (str.startsWith('and', i) && (i + 3 >= len || /[\s()]/.test(str[i + 3]))) { tokens.push({ type: 'AND' }); i += 3; continue; }
    if (str.startsWith('or', i) && (i + 2 >= len || /[\s()]/.test(str[i + 2]))) { tokens.push({ type: 'OR' }); i += 2; continue; }
    if (str.startsWith('not', i) && (i + 3 >= len || /[\s()]/.test(str[i + 3]))) { tokens.push({ type: 'NOT' }); i += 3; continue; }
    if (str[i] === "'" || str[i] === '"') {
      const q = str[i]; let j = i + 1; let val = '';
      while (j < len && str[j] !== q) { val += str[j]; j++; }
      if (j < len) j++;
      tokens.push({ type: 'KEY', value: val }); i = j; continue;
    }
    if (/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(str[i])) {
      let j = i;
      while (j < len && /[a-zA-Zа-яА-ЯёЁ0-9_]/.test(str[j])) j++;
      const word = str.slice(i, j);
      tokens.push({ type: 'KEY', value: word }); i = j; continue;
    }
    i++;
  }
  return tokens;
}

function evaluateCondition(condition, state) {
  if (!condition) return true;
  const tokens = tokenizeCondition(condition.trim());
  if (tokens.length === 0) return true;
  let pos = 0;

  function parseOr() {
    let val = parseAnd();
    while (pos < tokens.length && tokens[pos].type === 'OR') {
      pos++; const right = parseAnd(); val = val || right;
    }
    return val;
  }
  function parseAnd() {
    let val = parseNot();
    while (pos < tokens.length && tokens[pos].type === 'AND') {
      pos++; const right = parseNot(); val = val && right;
    }
    return val;
  }
  function parseNot() {
    if (pos < tokens.length && tokens[pos].type === 'NOT') {
      pos++; return !parseNot();
    }
    return parsePrimary();
  }
  function parsePrimary() {
    if (pos < tokens.length && tokens[pos].type === 'LPAREN') {
      pos++; const val = parseOr();
      if (pos < tokens.length && tokens[pos].type === 'RPAREN') pos++;
      return val;
    }
    if (pos >= tokens.length) return true; // malformed -> graceful true
    let key = tokens[pos].value;
    if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
      key = key.slice(1, -1);
    }
    pos++;
    if (pos >= tokens.length || tokens[pos].type !== 'OP') return true; // invalid syntax -> graceful true
    const op = tokens[pos].value; pos++;
    if (pos >= tokens.length) return true;
    const valStr = tokens[pos].value; pos++;
    const value = parseInt(valStr, 10);
    if (isNaN(value)) return true;

    const varExists = key in state.variables;
    const itemExists = key in state.items;

    if (!varExists && !itemExists) {
      return false; // characteristic or item does not exist -> condition is false
    }

    if (varExists) {
      const v = state.variables[key];
      if (op === '>') return v > value;
      if (op === '>=') return v >= value;
      if (op === '<') return v < value;
      if (op === '<=') return v <= value;
      if (op === '==') return v === value;
    }
    if (itemExists) {
      const count = state.items[key] ?? 0;
      if (op === '>') return count > value;
      if (op === '>=') return count >= value;
      if (op === '<') return count < value;
      if (op === '<=') return count <= value;
      if (op === '==') return count === value;
    }
    return false;
  }
  return parseOr();
}

function getNextDialogueStep(afterNpcLineIndex, npcResponses, state) {
  if (!npcResponses || npcResponses.length === 0) {
    return afterNpcLineIndex + 1;
  }
  for (let idx = afterNpcLineIndex; idx < npcResponses.length; idx++) {
    const resp = npcResponses[idx];
    if (!resp.condition || evaluateCondition(resp.condition, state)) {
      return idx + 1;
    }
  }
  return npcResponses.length + 1;
}

function getDialogueNpcNameForStep(scene, step) {
  if (!scene) return undefined;
  let name;
  let emotion;
  if (step === 0) {
    name = scene.npcName;
    emotion = scene.npcEmotion;
  } else {
    const resp = scene.npcResponses?.[step - 1];
    name = resp?.npcName || scene.npcName;
    emotion = resp?.emotion;
  }
  if (!name) return undefined;
  if (emotion) return `${name} (${emotion})`;
  return name;
}

function formatDialogueLine(speakerName, text, isPlayer) {
  if (!text) return '';
  if (isPlayer) {
    return `Вы: ${text}`;
  }
  const prefix = speakerName ? speakerName + ': ' : '';
  return prefix + text;
}

function processDisplayText(text, state, characterName = 'Герой') {
  if (!text) return '';
  return text
    .replace(/\{(\w+):[+-]?\d+\}/g, '')
    .replace(/\{(addItem|removeItem):[^}]+\}/g, '')
    .replace(/\{(\w+)\}/g, (match, key) => {
      if (key === 'characterName') {
        return characterName || 'Герой';
      }
      if (key in state.variables) {
        return String(state.variables[key]);
      }
      return match;
    });
}

function applyInlineSceneEffects(text, state) {
  if (!text) return { ...state };
  const itemRegex = /\{(addItem|removeItem):([^:]+):(\d+)\}/g;
  let match;
  let changed = false;
  const newItems = { ...state.items };
  while ((match = itemRegex.exec(text)) !== null) {
    const [, action, itemName, qtyStr] = match;
    const qty = parseInt(qtyStr, 10) || 1;
    const current = newItems[itemName] ?? 0;
    if (action === 'addItem') {
      newItems[itemName] = current + qty;
    } else {
      newItems[itemName] = Math.max(0, current - qty);
    }
    changed = true;
  }
  if (!changed) {
    return { ...state };
  }
  return {
    variables: { ...state.variables },
    items: newItems,
  };
}

function getNextSceneId(choice, varsForRoll, threshold = 12) {
  let nextId = choice.next || '';
  let rollResult;
  if (choice.roll) {
    rollResult = rollDice(choice.roll, varsForRoll);
    const success = rollResult >= threshold;
    nextId = success && choice.onSuccess ? choice.onSuccess : (choice.onFail || choice.next || '');
  }
  // Do not force 'end' here; caller (makeChoice equivalent) decides (dialogue stay vs end game).
  return { nextId, rollResult };
}

function getDialogueAwareNext(choice, currentSceneId, isDialogue) {
  if (isDialogue && !choice.next) {
    return currentSceneId;
  }
  return choice.next || 'end';
}

// === Многоуровневые пороги (0/25/50/85/100) ===
function getDiceMax(diceNotation, vars) {
  let expr = diceNotation;
  Object.entries(vars || {}).forEach(([key, value]) => {
    expr = expr.replace(new RegExp(`\\b${key}\\b`, 'gi'), String(value));
  });
  expr = expr.replace(/\s+/g, '');
  const termMatches = expr.match(/[+-]?(?:\d+d\d+|\d+)/gi) || [];
  if (termMatches.length === 0) return 10;
  let max = 0;
  for (let raw of termMatches) {
    let sign = 1;
    if (raw.startsWith('-')) {
      sign = -1;
      raw = raw.slice(1);
    } else if (raw.startsWith('+')) {
      raw = raw.slice(1);
    }
    if (raw.includes('d')) {
      const [numStr, sidesStr] = raw.split('d');
      const num = parseInt(numStr, 10) || 1;
      const sides = parseInt(sidesStr, 10) || 6;
      max += sign * (num * sides);
    } else {
      max += sign * (parseInt(raw, 10) || 0);
    }
  }
  return max;
}

function getTargetForPercent(diceNotation, vars, percent) {
  const max = getDiceMax(diceNotation, vars);
  if (max <= 0) return 1;
  return Math.max(1, Math.ceil(max * (percent / 100)));
}

function resolveRollTierKey(rollValue, max) {
  const percentile = max > 0 ? (Number(rollValue) / max) * 100 : 0;
  const tierBands = [
    { key: '100', min: 95 },
    { key: '85', min: 85 },
    { key: '50', min: 50 },
    { key: '25', min: 25 },
    { key: '0', min: 0 },
  ];
  for (const band of tierBands) {
    if (percentile >= band.min) return band.key;
  }
  return '0';
}

function tierPayload(choice, tierKey) {
  const stored = choice.rollTiers && choice.rollTiers[tierKey] ? choice.rollTiers[tierKey] : {};
  const next = stored.next && String(stored.next).trim() ? String(stored.next).trim() : (choice.next || '');
  const effects = stored.effects && String(stored.effects).trim() ? String(stored.effects).trim() : choice.effects;
  return {
    tier: parseInt(tierKey, 10),
    nextId: next,
    effects: effects || undefined,
  };
}

function evaluateRollOutcome(choice, vars, forceTier = null) {
  if (!choice.roll) {
    return {
      rollValue: 0,
      nextId: choice.next || '',
      effects: choice.effects,
    };
  }

  if (forceTier != null) {
    const max = getDiceMax(choice.roll, vars);
    let fakePercent = 50;
    if (forceTier === 0) fakePercent = 12;
    else if (forceTier === 25) fakePercent = 37;
    else if (forceTier === 50) fakePercent = 67;
    else if (forceTier === 85) fakePercent = 92;
    else if (forceTier === 100) fakePercent = 98;
    const fakeRoll = max > 0 ? Math.floor((max * fakePercent) / 100) : 0;
    return {
      rollValue: fakeRoll,
      ...tierPayload(choice, String(forceTier)),
    };
  }

  const rollValue = rollDice(choice.roll, vars);
  const max = getDiceMax(choice.roll, vars);
  const tierKey = resolveRollTierKey(rollValue, max);
  return {
    rollValue,
    ...tierPayload(choice, tierKey),
  };
}

function appendDialogueTurn(history, npcName, npcText, playerText) {
  const turn = formatDialogueLine(npcName, npcText) + '<br><br>' + formatDialogueLine(undefined, playerText, true);
  return (history ? history + '<br><br>' : '') + turn;
}

// --- EXPORTS FOR BUNDLER ONLY ---
// Everything below this marker is stripped when this file is loaded via ?raw
// and inlined into the <script> of a standalone HTML export (classic script, not module).
// This prevents "export declarations may only appear at top level of a module".
// The function declarations above stay and become available globally to the player code.
export {
  rollDice,
  applyEffects,
  evaluateCondition,
  tokenizeCondition,
  processDisplayText,
  applyInlineSceneEffects,
  getDiceMax,
  getTargetForPercent,
  evaluateRollOutcome,
  resolveRollTierKey,
  getNextDialogueStep,
  getDialogueNpcNameForStep,
  formatDialogueLine,
  getNextSceneId,
  getDialogueAwareNext,
  appendDialogueTurn
};
