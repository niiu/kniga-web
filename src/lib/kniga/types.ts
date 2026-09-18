export interface Choice {
  /** Stable id for DnD and internal tracking (generated on creation / load) */
  id?: string;
  text: string;
  next: string;
  roll?: string;           // "1d20+strength"
  onSuccess?: string;      // legacy
  onFail?: string;         // legacy
  effects?: string;        // base effects (applied before roll)
  condition?: string;

  /**
   * New multi-tier roll system.
   * Percentages are used to compute dynamic target = ceil(max * percent/100)
   * based on the dice expression's theoretical max (after var substitution).
   * Higher tier = better outcome (higher roll needed).
   * Tier 0 = 0-25% (failure tier if data provided, else base failure).
   */
  rollTiers?: Partial<Record<'0' | '25' | '50' | '85' | '100', {
    next?: string;
    nextText?: string;  // for dialogue: next NPC line on this roll outcome
    effects?: string;   // additional effects when this tier (or better) is achieved
  }>>;

  /**
   * Для диалогов: индекс NPC реплики, к которой относится этот ответ игрока 
   * (0 -- для стартовой реплики, 1 -- для первой в npcResponses и т.д.)
   */
  npcLineIndex?: number;
}

export interface Scene {
  id: string;
  text: string;
  choices: Choice[];
  isDialogue?: boolean;   // В диалоговом режиме ответы по умолчанию возвращают в текущую сцену
  npcName?: string;       // Имя НПС (для отображения в истории диалога, напр. "Стражник: ...")
  npcEmotion?: string;    // Эмоция для стартовой реплики (отображается как Имя(Эмоция): текст)
  npcResponses?: Array<{
    /** Stable id for DnD reordering of NPC responses */
    id?: string;
    text: string;
    condition?: string; // условие показа этой реплики НПС (если пусто -- всегда)
    npcName?: string;   // Имя конкретного НПС для этой реплики (поддержка нескольких НПС в диалоге)
    emotion?: string;   // Эмоция НПС для этой реплики (отображается как Имя(Эмоция): текст)
  }>;
}

export interface Story {
  title: string;
  startScene: string;
  scenes: Scene[];
  variables: Record<string, number>;
  items: Record<string, number>;
  variableOrigins?: Record<string, string>; // var name -> sceneId where it was introduced
  itemOrigins?: Record<string, string>;     // item name -> sceneId where it was introduced
  suggestedVariables: string[];
  suggestedItems: string[];
  suggestedNpcNames: string[];  // Подсказки имён НПС для диалогов (несколько НПС)
  suggestedEmotions: string[];  // Подсказки эмоций для реплик НПС
  characterName?: string;
  characterDescription?: string;
  deletedScenes?: Array<{ scene: Scene; originalIndex: number }>;
  /** Маркер подлинности файла Книги (ставится при экспорте). */
  knigaMarker?: string;
}