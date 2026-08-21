export type QuizBankQuestion = {
  id: string;
  body: string;
  answer: string;
  options: [string, string, string, string, string, string];
  correctIndex: number;
  /** Obtiažnosť 1–10 pre tím cca 5 hráčov */
  difficulty: number;
  /** Overená poznámka / prečo je to tak */
  note: string;
};

/** Všeobecný pub kvíz — overené fakty, vhodné pre tím ~5 hráčov. */
export const PUB_QUIZ_BANK: QuizBankQuestion[] = [
  {
    id: "bank-01",
    body: "Ktorá krajina má na svete najviac časových pásiem?",
    answer: "Francúzsko",
    options: ["Rusko", "USA", "Čína", "Francúzsko", "Kanada", "Austrália"],
    correctIndex: 3,
    difficulty: 8,
    note: "Väčšina tipuje Rusko (11 pásiem), ale Francúzsko má 12 — vďaka metropole plus zámorským územiam od Tahiti po Réunion. Klasická pub pasca.",
  },
  {
    id: "bank-02",
    body: "Kde sa v skutočnosti natáčal film Casablanca (1942)?",
    answer: "Vo filmových štúdiách v Kalifornii",
    options: [
      "V Casablance v Maroku",
      "V Paríži",
      "Vo filmových štúdiách v Kalifornii",
      "V Lisabone",
      "V Tangere",
      "V Ríme",
    ],
    correctIndex: 2,
    difficulty: 7,
    note: "Názov láká na Maroko, ale celý film vznikol vo Warner Bros v Burbanku pri Los Angeles. Letisko v záverečných scénach bolo tiež len kulisa vo štúdiu.",
  },
  {
    id: "bank-03",
    body: "Koľko sŕdc má chobotnica?",
    answer: "Tri",
    options: ["Jedno", "Dve", "Tri", "Štyri", "Päť", "Šesť"],
    correctIndex: 2,
    difficulty: 4,
    note: "Dve srdcia pumpujú krv do žiaber, tretie do zvyšku tela. Krv chobotnice je modrá vďaka medi namiesto železa v hemoglobíne.",
  },
  {
    id: "bank-04",
    body: "Ktorá planéta Slnečnej sústavy sa otáča prakticky „na boku“ (os takmer v rovine obežnej dráhy)?",
    answer: "Urán",
    options: ["Mars", "Saturn", "Jupiter", "Urán", "Neptún", "Venuša"],
    correctIndex: 3,
    difficulty: 5,
    note: "Urán má sklon osi okolo 98°, takže sa valí po obežnej dráhe. Pravdepodobne ho v minulosti silno naklonila kolízia s protoplanetárneym teleso.",
  },
  {
    id: "bank-05",
    body: "Ktoré suchozemské zviera má z cicavcov najvyšší krvný tlak (potrebný na dopravu krvi do mozgu)?",
    answer: "Žirafa",
    options: ["Slon", "Lev", "Kôň", "Žirafa", "Hroch", "Panda"],
    correctIndex: 3,
    difficulty: 7,
    note: "Systolický tlak u žirafy pri srdci môže presiahnuť 300 mm Hg. Má aj špeciálne chlopne vo vene krknej, aby pri sklonení hlavy nepreplavilo mozog.",
  },
  {
    id: "bank-06",
    body: "Ktorá bežná potravina sa vďaka nízkej vlhkosti a kyslosti prakticky nikdy nepokazí, ak je uzavretá?",
    answer: "Med",
    options: ["Chlieb", "Maslo", "Med", "Syrová nátierka", "Džem", "Olivy"],
    correctIndex: 2,
    difficulty: 5,
    note: "V egyptských hrobkách našli stále jedlý med tisícročia starý. Enzýmy a nízka aktivita vody bránia rastu baktérii — netreba chladničku.",
  },
  {
    id: "bank-07",
    body: "Ktorý kontinent nemá na svojom území klasickú púšť (suchú horúcu)?",
    answer: "Európa",
    options: ["Afrika", "Ázia", "Austrália", "Európa", "Južná Amerika", "Severná Amerika"],
    correctIndex: 3,
    difficulty: 6,
    note: "Antarktída je polárna púšť, ale horúcu púšť v zmysle Sahary na Európe nemáme. Aj preto je to obľúbená pub otázka s háčikom okolo Antarktídy.",
  },
  {
    id: "bank-08",
    body: "V ktorom roku padol Berlínsky múr?",
    answer: "1989",
    options: ["1987", "1988", "1989", "1990", "1991", "1985"],
    correctIndex: 2,
    difficulty: 3,
    note: "9. november 1989 — po tlačenici na tlačovej konferencii sa hranice otvorili ešte v ten večer. Zjednotenie Nemecka prišlo až v roku 1990.",
  },
  {
    id: "bank-09",
    body: "Z ulíc ktorého amerického mesta sú prevzaté názvy na klasickom slovenskom Monopoly?",
    answer: "Atlantic City",
    options: ["New York", "Las Vegas", "Atlantic City", "Chicago", "Boston", "Miami"],
    correctIndex: 2,
    difficulty: 6,
    note: "Charles Darrow predával hru s názvami z Atlantic City v New Jersey. Nie Wall Street ani Vegas — prekvapí aj hráčov, čo Monopoly poznajú celý život.",
  },
  {
    id: "bank-10",
    body: "O približne koľko centimetrov môže byť Eiffelova veža v horúcom lete vyššia než v zime (tepelná rozťažnosť)?",
    answer: "Približne 15 cm",
    options: ["2 cm", "5 cm", "Približne 15 cm", "30 cm", "50 cm", "1 meter"],
    correctIndex: 2,
    difficulty: 7,
    note: "Kov sa pri teple roztiahne — pri 300 m výške to dá zhruba 15 cm. Veža sa teda doslova „nafúkne“ slnkom; v noci zase mierne klesne.",
  },
];

export function formatBankQuestionBody(item: QuizBankQuestion): string {
  const letters = ["A", "B", "C", "D", "E", "F"] as const;
  const optionsBlock = item.options
    .map((option, index) => `${letters[index]}) ${option}`)
    .join("\n");
  return `${item.body}\n\n${optionsBlock}`;
}

export function formatBankQuestionClipboard(item: QuizBankQuestion): string {
  const letters = ["A", "B", "C", "D", "E", "F"] as const;
  const correctLetter = letters[item.correctIndex];
  return [
    formatBankQuestionBody(item),
    "",
    `Správna odpoveď: ${correctLetter}) ${item.answer}`,
    `Obtiažnosť (tím 5): ${item.difficulty}/10`,
    "",
    `Poznámka: ${item.note}`,
  ].join("\n");
}
