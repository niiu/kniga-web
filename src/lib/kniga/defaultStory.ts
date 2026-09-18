import type { Story } from "./types.ts";

export const DEFAULT_START_SCENE = "scene1";

export const defaultStory: Story = {
  title: "Моя первая интерактивная книга",
  startScene: DEFAULT_START_SCENE,
  scenes: [
    {
      id: "scene1",
      text: "Ты стоишь на опушке тёмного леса. Ветер шепчет твоё имя...",
      choices: [
        {
          id: "scene1-c1",
          text: "Попытаться тихо проскользнуть мимо (бросок)",
          next: "scene2",
          roll: "1d20+strength",
          rollTiers: {
            "0": { next: "", effects: "" },
            "25": { next: "scene2", effects: "health:-2" },
            "50": { next: "scene2", effects: "" },
            "85": { next: "scene3", effects: "gold:5" },
            "100": { next: "scene3", effects: "gold:10,addItem:Трофей:1" },
          },
        },
      ],
    },
    {
      id: "scene2",
      text: "Ты едва избежал опасности...",
      choices: [],
    },
    {
      id: "scene3",
      text: "Удача была на твоей стороне!",
      choices: [],
    },
    {
      id: "dialog1",
      text: "Стражник смотрит на тебя подозрительно.\n— Ты кто такой? Что тебе здесь нужно?",
      isDialogue: true,
      npcName: "Стражник",
      choices: [
        { id: "dialog1-a1", text: "Я просто прохожий.", next: "" },
        {
          id: "dialog1-a2",
          text: "Мне нужно пройти. (убедить)",
          next: "",
          roll: "1d20+strength",
          rollTiers: {
            "0": { next: "", effects: "" },
            "25": { next: "" },
            "50": { next: "dialog_success" },
            "85": { next: "dialog_success" },
            "100": { next: "dialog_success" },
          },
        },
        { id: "dialog1-a3", text: "А тебе какое дело? (грубость)", next: "", effects: "health:-10" },
        {
          id: "dialog1-a4",
          text: "Я ищу вора, который украл мой кошелёк. (скрытый ответ)",
          next: "",
          condition: "gold < 5",
        },
        { id: "dialog1-a5", text: "Уйти молча.", next: "" },
        { id: "dialog1-a6", text: "Хорошо, я подожду.", next: "", npcLineIndex: 1 },
        { id: "dialog1-a7", text: "Извини, я просто пошутил.", next: "dialog_success", npcLineIndex: 1 },
      ],
      npcResponses: [
        {
          id: "dialog1-r1",
          text: "Стражник прищуривается и подходит ближе:\n— Не похоже на правду. Говори толком.",
          condition: "",
          npcName: "Стражник",
        },
        {
          id: "dialog1-r2",
          text: "Второй стражник (подходя сзади):\n— А я тут как раз ищу кого-нибудь для разговора.",
          condition: "",
          npcName: "Второй стражник",
        },
      ],
    },
    {
      id: "dialog_success",
      text: "Стражник кивает и пропускает тебя.",
      choices: [],
    },
    {
      id: "dialog_thief",
      text: "Стражник хмурится: — Мы уже ищем этого негодяя. Проходи.",
      choices: [],
    },
  ],
  variables: { health: 100, gold: 10, strength: 5 },
  items: { Факел: 1, Кинжал: 1 },
  variableOrigins: {},
  itemOrigins: {},
  suggestedVariables: ["health", "gold", "strength"],
  suggestedItems: ["Факел", "Кинжал", "Трофей"],
  suggestedNpcNames: ["Стражник", "Второй стражник"],
  suggestedEmotions: ["злой", "радостный", "грустный", "спокойный", "испуганный", "насмешливый"],
  characterName: "",
  characterDescription: "",
  deletedScenes: [],
};
