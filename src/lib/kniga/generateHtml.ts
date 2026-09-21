import runtimeEngineCode from './engine/runtime.js?raw';
import { KNIGA_MARKER, jsonForHtmlScript } from './marker.ts';
import type { Story } from './types.ts';

/**
 * Генерирует полностью самостоятельный .html файл.
 *
 * Берёт содержимое src/lib/engine/runtime.js (единственный источник
 * playable-логики) через ?raw и вставляет его внутрь <script>.
 * Никаких зависимостей — игрок просто открывает файл.
 *
 * Важно: при изменении механики игры правки вносятся только в runtime.js.
 */
export function generateFullStandaloneHtml(story: Story): string {
  const storyJson = jsonForHtmlScript(story);

  // Use the raw source of runtime.js, but strip the "exports for bundler only" block.
  // This is critical: the standalone HTML uses a classic <script> (not type=module),
  // so top-level `export` declarations are a SyntaxError.
  // The function declarations themselves remain and become globals for the player code that follows.
  let engineCode = runtimeEngineCode.replace(/\/\/ --- EXPORTS FOR BUNDLER ONLY[\s\S]*$/, '').trim();

  const safeTitle = (story.title || 'Интерактивная история')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="ru" data-kniga-engine="${KNIGA_MARKER}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="kniga-engine" content="${KNIGA_MARKER}">
  <meta name="generator" content="Книга">
  <!-- KNIGA-ENGINE-v1 | интерактивная книга -->
  <title>${safeTitle}</title>
  <style>
    /* ====================== КАСТОМНЫЕ СТИЛИ ИСТОРИИ ====================== */
    .btn-save {
  background: linear-gradient(to right, #059669, #0f766e);
  color: white;
  font-weight: 600;
  padding: 0.75rem 1.75rem;
  border-radius: 1rem;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  cursor: pointer;
}

.btn-save:hover {
  background: linear-gradient(to right, #10b981, #14b8a6);
  transform: translateY(-2px);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3);
}

.btn-save:active {
  transform: scale(0.95);
}

    body { 
      font-family: Georgia, serif; 
      background: #1a120b; 
      color: #f5e6c4; 
      line-height: 1.6; 
      margin: 0; 
      padding: 0; 
    }
    
    .choice { 
      transition: all 0.2s; 
      color: #fcd34d !important; 
      font-weight: 600; 
      font-size: 1.1rem; 
    }
    .choice:hover { 
      transform: translateX(12px); 
      background-color: #1e40af !important; 
    }

    .slot { 
      transition: all 0.15s; 
      min-height: 70px; 
      padding: 1.25rem 1rem; 
    }
    .slot:hover { background-color: #27272a; }

    /* ====================== TAILWIND УТИЛИТЫ (из all-tailwind-classes-full-min.css) ====================== */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-wrap { flex-wrap: wrap; }
    .grid { display: grid; }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .flex-1 { flex: 1 1 0%; }

    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .gap-x-8 { column-gap: 2rem; }
    .gap-y-2 { row-gap: 0.5rem; }

    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }

    .p-4 { padding: 1rem; }
    .p-5 { padding: 1.25rem; }
    .p-6 { padding: 1.5rem; }
    .p-12 { padding: 3rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .px-16 { padding-left: 4rem; padding-right: 4rem; }
    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .py-12 { padding-top: 3rem; padding-bottom: 3rem; }

    .mt-8 { margin-top: 2rem; }
    .mt-10 { margin-top: 2.5rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }

    .max-w-3xl { max-width: 48rem; }
    .max-w-md { max-width: 28rem; }
    .w-full { width: 100%; }
    .min-h-screen { min-height: 100vh; }
    .min-h-\\[85vh\\] { min-height: 85vh; }
    .min-h-\\[45vh\\] { min-height: 45vh; }

    /* Цвета */
    .bg-\\[\\#1a120b\\] { background-color: #1a120b; }
    .bg-\\[\\#2a1f17\\] { background-color: #2a1f17; }
    .bg-zinc-900 { background-color: #18181b; }
    .bg-zinc-900\\/80 { background-color: rgba(24,24,27,0.8); }
    .bg-zinc-800 { background-color: #27272a; }
    .bg-zinc-700 { background-color: #3f3f46; }
    .bg-zinc-950 { background-color: #09090b; }
    .bg-emerald-950\\/50 { background-color: rgba(5 150 105 / 0.5); }
    .bg-emerald-600 { background-color: #059669; }
    .bg-emerald-500 { background-color: #10b981; }
    .bg-amber-600 { background-color: #d97706; }
    .bg-amber-500 { background-color: #f59e0b; }
    .bg-blue-600 { background-color: #2563eb; }
    .bg-black\\/80 { background-color: rgba(0,0,0,0.8); }

    /* Hover цвета */
    .hover\\:bg-emerald-500:hover { background-color: #10b981; }
    .hover\\:bg-amber-500:hover { background-color: #f59e0b; }
    .hover\\:bg-blue-600:hover { background-color: #2563eb; }
    .hover\\:bg-zinc-700:hover { background-color: #3f3f46; }

    /* Текст */
    .text-amber-300 { color: #fcd34d; }
    .text-emerald-400 { color: #34d399; }
    .text-amber-400 { color: #fbbf24; }
    .text-zinc-400 { color: #a1a1aa; }
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-4xl { font-size: 2.25rem; }
    .text-5xl { font-size: 3rem; }
    .text-\\[120px\\] { font-size: 120px; }

    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .font-serif { font-family: Georgia, serif; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .leading-relaxed { line-height: 1.625; }
    .uppercase { text-transform: uppercase; }
    .opacity-60 { opacity: 0.6; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Градиент */
    .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
    .from-emerald-600 { --tw-gradient-from: #059669; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgb(5 150 105 / 0)); }
    .to-teal-600 { --tw-gradient-to: #0f766e; }
    .hover\\:from-emerald-500:hover { --tw-gradient-from: #10b981; }
    .hover\\:to-teal-500:hover { --tw-gradient-to: #14b8a6; }

    /* Эффекты */
    .transition-all { transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
    .active\\:scale-95:active { transform: scale(0.95); }

    .border { border-width: 1px; }
    .border-amber-900 { border-color: #78350f; }
    .border-zinc-700 { border-color: #3f3f46; }
    .border-emerald-600 { border-color: #059669; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-3xl { border-radius: 1.5rem; }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.4); }

    .fixed { position: fixed; }
    .inset-0 { inset: 0; }
    .z-50 { z-index: 50; }
    .mx-auto { margin-left: auto; margin-right: auto; }
  </style>
</head>
<body class="min-h-screen p-8 bg-[#1a120b]">
  <div class="max-w-3xl mx-auto">
    <div id="game" class="bg-[#2a1f17] rounded-3xl p-12 shadow-2xl border border-amber-900 min-h-[85vh] flex flex-col"></div>
  </div>

  <script type="application/json" id="kniga-story-data" data-kniga-engine="${KNIGA_MARKER}">${storyJson}</script>
  <script>
    const story = JSON.parse(document.getElementById('kniga-story-data').textContent || '{}');
    
    // === Единая игровая логика из gameEngine (single source of truth) ===
    ${engineCode}

    let currentId = story.startScene;
    if (!story.scenes?.some(s => s.id === currentId)) {
      currentId = story.scenes?.[0]?.id || 'end';
    }

    let vars = {...story.variables};
    let items = {...(story.items || {})};
    let currentSlot = 1;

    // Для диалогов: накопленная история (вопрос НПС + ответ игрока + ...)
    let dialogueHistory = '';
    let currentDialogueStep = 0;

    const STORAGE_KEY = 'ist-game-save-slot-';
    const AUTO_SAVE_KEY = 'ist-game-autosave';

    function getSlotKey(slot) { return STORAGE_KEY + slot; }

    function saveToSlot(slot) {
      const now = Date.now();
      // Clean dialogue state if not currently in a dialogue scene (to avoid carrying stale history to non-dialogue saves)
      let saveDialogueHistory = dialogueHistory;
      let saveCurrentDialogueStep = currentDialogueStep;
      const currentSceneForSave = story.scenes.find(s => s.id === currentId);
      if (!currentSceneForSave?.isDialogue) {
        saveDialogueHistory = '';
        saveCurrentDialogueStep = 0;
      }
      const data = { sceneId: currentId, variables: {...vars}, items: {...items}, dialogueHistory: saveDialogueHistory, currentDialogueStep: saveCurrentDialogueStep, timestamp: new Date(now).toLocaleString('ru-RU'), timestampMs: now };
      localStorage.setItem(getSlotKey(slot), JSON.stringify(data));
      currentSlot = slot;
      render();
    }

    function quickSave() {
      saveToSlot(currentSlot);
      alert('💾 Сохранено в слот ' + currentSlot);
    }

    function loadSlot(slot) {
      const str = localStorage.getItem(getSlotKey(slot));
      if (!str) return alert('❌ Слот ' + slot + ' пустой');
      const data = JSON.parse(str);
      currentId = data.sceneId;
      // Only restore dialogue state if the loaded scene is actually a dialogue scene.
      // This prevents stale dialogueHistory from previous saves from polluting non-dialogue or wrong context.
      const loadedScene = story.scenes.find(s => s.id === currentId);
      if (loadedScene?.isDialogue) {
        dialogueHistory = data.dialogueHistory || '';
        currentDialogueStep = data.currentDialogueStep || 0;
      } else {
        dialogueHistory = '';
        currentDialogueStep = 0;
      }
      vars = {...data.variables};
      items = {...data.items};
      currentSlot = slot;
      autoSave();
      render();
      alert('✅ Загружен слот ' + slot);
    }

    function getAllSlots() {
      const slots = [];
      for (let i = 1; i <= 4; i++) {
        const str = localStorage.getItem(getSlotKey(i));
        slots.push(str ? JSON.parse(str) : null);
      }
      return slots;
    }

    // === Автосохранение (отдельный слот, не затирает 1-4) ===
    function autoSave() {
      const now = Date.now();
      // Clean dialogue state if not currently in a dialogue scene (to avoid carrying stale history to non-dialogue saves)
      let saveDialogueHistory = dialogueHistory;
      let saveCurrentDialogueStep = currentDialogueStep;
      const currentSceneForSave = story.scenes.find(s => s.id === currentId);
      if (!currentSceneForSave?.isDialogue) {
        saveDialogueHistory = '';
        saveCurrentDialogueStep = 0;
      }
      const data = { sceneId: currentId, variables: {...vars}, items: {...items}, dialogueHistory: saveDialogueHistory, currentDialogueStep: saveCurrentDialogueStep, timestamp: new Date(now).toLocaleString('ru-RU'), timestampMs: now };
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
    }

    function loadAutoSave() {
      const str = localStorage.getItem(AUTO_SAVE_KEY);
      if (!str) return alert('❌ Автосохранение пустое');
      const data = JSON.parse(str);
      currentId = data.sceneId;
      // Only restore dialogue state if the loaded scene is actually a dialogue scene.
      // This prevents stale dialogueHistory from previous saves from polluting non-dialogue or wrong context.
      const loadedScene = story.scenes.find(s => s.id === currentId);
      if (loadedScene?.isDialogue) {
        dialogueHistory = data.dialogueHistory || '';
        currentDialogueStep = data.currentDialogueStep || 0;
      } else {
        dialogueHistory = '';
        currentDialogueStep = 0;
      }
      vars = {...data.variables};
      items = {...data.items};
      render();
      alert('✅ Загружено автосохранение');
    }

    function sceneById(id) {
      return (story.scenes || []).find(s => s.id === id) || null;
    }

    function isEndId(id) {
      return !id || id === 'end' || !sceneById(id);
    }

    function render() {
      if (isEndId(currentId)) {
        const leftover = dialogueHistory
          ? processDisplayText(dialogueHistory, { variables: vars, items: items }, story.characterName)
          : '';
        paintScreen({ ended: true, displayText: leftover, visibleChoices: [] });
        return;
      }
      const scene = sceneById(currentId);

      let displayText = scene.text || '';
      if (scene.isDialogue && dialogueHistory) {
        displayText = dialogueHistory;
      }

      const stateAfterInline = applyInlineSceneEffects(scene.text, { variables: vars, items: items });
      vars = stateAfterInline.variables;
      items = stateAfterInline.items;

      const currentStateForFilter = { variables: vars, items: items };
      const visibleChoices = (scene.choices || []).filter(choice => {
        const condOk = evaluateCondition(choice.condition, currentStateForFilter);
        if (!scene.isDialogue) return condOk;
        const step = choice.npcLineIndex || 0;
        return condOk && step === currentDialogueStep;
      });

      paintScreen({
        ended: visibleChoices.length === 0,
        displayText: processDisplayText(displayText, { variables: vars, items: items }, story.characterName),
        visibleChoices,
      });
    }

    function paintScreen({ ended, displayText, visibleChoices }) {
      let html = \`
        <h1 class="text-4xl mb-8 text-amber-300 font-bold text-center">\${story.title}</h1>

        <!-- Характеристики -->
        <div class="bg-zinc-900/80 p-4 rounded-2xl mb-6 flex gap-6 justify-center text-sm">
          \${Object.entries(vars).filter(([k, v]) => v !== 0).map(([k, v]) => \`
            <div class="text-center">
              <div class="text-xs opacity-60 uppercase">\${k}</div>
              <div class="text-2xl font-bold text-emerald-400">\${v}</div>
            </div>
          \`).join('')}
        </div>

        <!-- Инвентарь -->
        <div class="bg-zinc-900/80 p-4 rounded-2xl mb-8">
          <div class="text-xs opacity-60 uppercase mb-2">Инвентарь</div>
          <div class="flex flex-wrap gap-x-8 gap-y-2">
            \${Object.entries(items).filter(([name, count]) => count !== 0).map(([name, count]) => \`
              <div class="text-center">
                <div class="text-sm text-amber-300">\${name}</div>
                <div class="text-2xl font-bold text-amber-400">\${count}</div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;

      if (displayText) {
        html += \`
        <div class="bg-zinc-900 p-12 rounded-3xl shadow-2xl border border-zinc-700 min-h-[45vh] font-serif text-xl leading-relaxed flex-1 whitespace-pre-wrap">
          \${displayText}
        </div>
        \`;
      }

      if (ended) {
        html += \`
          <div class="mt-10 text-center py-12">
            <h2 class="text-5xl font-bold mb-4 text-amber-300">Конец истории</h2>
            <p class="text-2xl text-zinc-400 max-w-md mx-auto">Эта ветка закончилась.<br>Спасибо за чтение.</p>
            <button onclick="restartGame()" class="mt-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-16 py-6 rounded-3xl text-2xl font-medium transition-all active:scale-95">Начать историю заново</button>
          </div>
        \`;
      } else {
        html += \`<div class="mt-10 grid gap-4" id="choices"></div>\`;
      }

      html += \`
        <div class="mt-8 bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">💾 Сохранения</h3>
            <div class="flex gap-3">
              <button onclick="quickSave()" class="btn-save">Сохранить</button>
              <button onclick="openSaveModal()" class="btn-save">Сохранить в слот...</button>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-3" id="slots"></div>

          <!-- Автосохранение (отдельный слот) -->
          <div class="mt-6 pt-3 border-t border-zinc-700 flex items-center justify-between text-xs">
            <div id="autosave-info">Автосохранение: ...</div>
            <button onclick="loadAutoSave()" class="btn-save" style="padding: 0.35rem 0.9rem; font-size: 0.7rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);">Загрузить автосохранение</button>
          </div>
        </div>
      \`;

      document.getElementById('game').innerHTML = html;

      if (!ended && visibleChoices.length > 0) renderChoices(visibleChoices);
      renderSlots();
      renderAutoSaveInfo();
    }

    function renderChoices(visibleChoices) {
      const container = document.getElementById('choices');
      container.innerHTML = '';
      const currentScene = story.scenes.find(s => s.id === currentId);
      const isDialogue = !!currentScene?.isDialogue;

      visibleChoices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = \`choice w-full bg-zinc-800 hover:bg-blue-600 p-6 rounded-2xl text-left transition text-lg border border-zinc-700\`;
        let displayText = choice.text + (choice.roll ? \` (\${choice.roll})\` : '');
        if (isDialogue) {
          displayText = \`Вы: \${displayText}\`;
        }
        btn.textContent = displayText;
        btn.onclick = () => makeChoice(choice);
        container.appendChild(btn);
      });
    }

    function renderSlots() {
      const container = document.getElementById('slots');
      container.innerHTML = '';
      const slotsData = getAllSlots();
      slotsData.forEach((data, i) => {
        const slotNum = i + 1;
        const btn = document.createElement('button');
        btn.className = \`slot p-5 rounded-2xl border transition text-left \${data ? \`border-emerald-600 bg-emerald-950/50\` : \`border-zinc-700 bg-zinc-950\`}\`;
        btn.innerHTML = \`
          <div class="text-xs opacity-60">Слот \${slotNum}</div>
          \${data ? \`
            <div class="text-sm font-medium text-emerald-400 truncate">\${data.sceneId}</div>
            <div class="text-[10px] opacity-50">\${data.timestamp}</div>
          \` : \`<div class="text-sm text-zinc-500 italic">Пусто</div>\`}
        \`;
        btn.onclick = () => loadSlot(slotNum);
        container.appendChild(btn);
      });
    }

    function renderAutoSaveInfo() {
      const info = document.getElementById('autosave-info');
      if (!info) return;
      const str = localStorage.getItem(AUTO_SAVE_KEY);
      if (str) {
        const data = JSON.parse(str);
        info.innerHTML = \`Автосохранение: <span class="text-emerald-400">\${data.timestamp} — \${data.sceneId}</span>\`;
      } else {
        info.textContent = 'Автосохранение: нет';
      }
    }

    function makeChoice(choice) {
      const stateBefore = { variables: {...vars}, items: {...items} };
      const currentScene = story.scenes.find(s => s.id === currentId);
      const isDialogue = !!currentScene?.isDialogue;

      let effectsToApply = choice.effects;
      let nextId = getDialogueAwareNext(choice, currentId, isDialogue);
      let rollValue;
      let tierLabel = '';

      if (choice.roll) {
        const outcome = evaluateRollOutcome(choice, vars);
        effectsToApply = outcome.effects;
        nextId = outcome.nextId;
        rollValue = outcome.rollValue;
        if (outcome.tier != null) tierLabel = ' (' + outcome.tier + '%)';
        if (isDialogue && (!nextId || nextId === 'end') && !choice.next) {
          nextId = currentId;
        }
      }

      if (isDialogue && !nextId) {
        nextId = currentId;
      }

      if (isDialogue) {
        const currentNpcName = getDialogueNpcNameForStep(currentScene, currentDialogueStep);
        const currentNpcText = currentDialogueStep === 0 ? (currentScene?.text || '') : (currentScene?.npcResponses?.[currentDialogueStep-1]?.text || '');
        dialogueHistory = appendDialogueTurn(dialogueHistory, currentNpcName, currentNpcText, choice.text);

        // Применяем эффекты для проверки условий на следующих репликах НПС
        const postState = applyEffects(effectsToApply, { variables: {...vars}, items: {...items} });

        const thisStep = choice.npcLineIndex || 0;
        currentDialogueStep = getNextDialogueStep(thisStep, currentScene?.npcResponses, postState);

        const newNpcName = getDialogueNpcNameForStep(currentScene, currentDialogueStep);
        const newNpcText = currentDialogueStep === 0 ? '' : (currentScene?.npcResponses?.[currentDialogueStep-1]?.text || '');
        if (newNpcText) {
          dialogueHistory = appendDialogueTurn(dialogueHistory, newNpcName, newNpcText, '');
          // Применяем инлайны из новой реплики НПС сразу (чтобы эффекты были в состоянии на момент показа).
          // Это важно для корректной работы conditional следующих реплик и для того, чтобы после load
          // состояние не десинхронизировалось при повторном рендере.
          const inlineFromNewNpc = applyInlineSceneEffects(newNpcText, { variables: vars, items: items });
          vars = inlineFromNewNpc.variables;
          items = inlineFromNewNpc.items;
        }
      }

      const stateAfter = applyEffects(effectsToApply, stateBefore);
      vars = stateAfter.variables;
      items = stateAfter.items;

      if (choice.roll && rollValue !== undefined) {
        alert('🎲 Бросок: ' + choice.roll + ' → ' + rollValue + tierLabel);
      }

      if (nextId && nextId !== currentId) {
        currentId = nextId;
        if (!isEndId(currentId)) {
          dialogueHistory = '';
          currentDialogueStep = 0;
        }
      } else if (!nextId) {
        currentId = 'end';
      }
      autoSave();
      render();
    }

    function showEnding() {
      currentId = 'end';
      render();
    }

    window.quickSave = quickSave;
    window.openSaveModal = function() {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
      modal.innerHTML = \`
        <div class="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
          <h3 class="text-xl font-semibold mb-6">Сохранить в слот</h3>
          <div class="grid grid-cols-2 gap-4">
            \${Array.from({length:4}, (_,i)=>i+1).map(slot => \`
              <button onclick="saveToSlot(\${slot});this.parentElement.parentElement.parentElement.remove()" class="p-6 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-left">
                Слот \${slot}
              </button>
            \`).join('')}
          </div>
          <button onclick="this.parentElement.parentElement.remove()" class="mt-6 w-full py-3 text-zinc-400 hover:text-white">Отмена</button>
        </div>
      \`;
      document.body.appendChild(modal);
    };

    window.restartGame = function() {
      // Полный сброс к изначальной версии истории (как было при первой загрузке без сохранений).
      // Сбрасываем всё in-memory состояние + очищаем автосохранение,
      // чтобы "Начать заново" действительно возвращало чистый старт.
      // Ручные слоты (1-4) при этом не трогаем — это отдельные "сохранения" игрока.
      currentId = story.startScene;
      if (!story.scenes?.some(s => s.id === currentId)) {
        currentId = story.scenes?.[0]?.id || 'end';
      }
      dialogueHistory = '';
      currentDialogueStep = 0;
      vars = {...story.variables};
      items = {...(story.items || {})};
      currentSlot = 1;

      // Очищаем автосохранение, чтобы при перезагрузке страницы тоже началось с чистого листа
      localStorage.removeItem(AUTO_SAVE_KEY);

      render();
    };

    // Автосохранение в отдельный слот (не currentSlot)
    setInterval(() => { if (currentId) { autoSave(); renderAutoSaveInfo(); } }, 30000);

    function parseRussianOrISOTimestamp(tsStr) {
      if (!tsStr) return NaN;
      // Try DD.MM.YYYY, HH:mm:ss (Russian locale)
      const m = tsStr.match(/^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})$/);
      if (m) {
        const [_, dd, mm, yyyy, hh, min, ss] = m;
        return new Date(yyyy, parseInt(mm)-1, parseInt(dd), parseInt(hh), parseInt(min), parseInt(ss)).getTime();
      }
      // Fallback to native
      const t = new Date(tsStr).getTime();
      return isNaN(t) ? NaN : t;
    }

    // Auto-resume the most recent save (manual slot or autosave, whichever has later timestamp)
    (function autoResumeLatestSave() {
      let latestData = null;
      let latestTimestamp = 0;
      let isAuto = false;
      let loadedSlot = null;

      // Check manual slots 1-4
      for (let i = 1; i <= 4; i++) {
        const str = localStorage.getItem(getSlotKey(i));
        if (str) {
          try {
            const d = JSON.parse(str);
            if (d && (d.timestampMs || d.timestamp)) {
              let t;
              if (d.timestampMs != null) {
                t = d.timestampMs;
              } else {
                t = parseRussianOrISOTimestamp(d.timestamp);
                if (isNaN(t)) {
                  continue;
                }
              }
              if (t > latestTimestamp) {
                latestTimestamp = t;
                latestData = d;
                isAuto = false;
                loadedSlot = i;
              }
            }
          } catch (e) {
            // ignore bad slot data
          }
        }
      }

      // Check autosave
      const autoStr = localStorage.getItem(AUTO_SAVE_KEY);
      if (autoStr) {
        try {
          const ad = JSON.parse(autoStr);
          if (ad && (ad.timestampMs || ad.timestamp)) {
            let t;
            if (ad.timestampMs != null) {
              t = ad.timestampMs;
            } else {
              t = parseRussianOrISOTimestamp(ad.timestamp);
              if (isNaN(t)) {
                // ignore
              }
            }
            if (t > latestTimestamp) {
              latestTimestamp = t;
              latestData = ad;
              isAuto = true;
              loadedSlot = null;
            }
          }
        } catch (e) {
          // ignore bad autosave data
        }
      }

      if (latestData && latestTimestamp > 0) {
        currentId = latestData.sceneId || story.startScene;
        // Only restore dialogue state if the loaded scene is actually a dialogue scene.
        // This prevents stale dialogueHistory from previous saves from polluting non-dialogue or wrong context.
        const loadedScene = story.scenes.find(s => s.id === currentId);
        if (loadedScene?.isDialogue) {
          dialogueHistory = latestData.dialogueHistory || '';
          currentDialogueStep = latestData.currentDialogueStep || 0;
        } else {
          dialogueHistory = '';
          currentDialogueStep = 0;
        }
        vars = {...(latestData.variables || story.variables)};
        items = {...(latestData.items || story.items)};
        if (!isAuto && loadedSlot) {
          currentSlot = loadedSlot;
        }
        // Silent auto-resume (no alert)
        render();
      } else {
        render();
      }
    })();
  </script>
</body>
</html>`;
}