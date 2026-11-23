/**
 * Jednoduchá kontrola inferencie tagov (bez test runnera v package.json).
 * Spusti: node scripts/check-tag-inference.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const runner = path.join(root, "scripts/.run-tag-inference-checks.ts");

fs.writeFileSync(
  runner,
  `
import {
  inferBankQuestionTags,
  refreshStoredCustomQuestionTags,
  resolveCustomQuestionTags,
} from "../src/lib/quiz-bank-tag-inference";

const samples = [
  {
    body: "Ktorá krajina má na svete najviac časových pásiem?",
    answer: "Francúzsko",
    expectAny: ["geografia"],
    expectPrefer: ["francúzsko", "európa"],
  },
  {
    body: "Kde sa v skutočnosti natáčal film Casablanca (1942)?",
    answer: "Vo filmových štúdiách v Kalifornii",
    expectAny: ["film"],
    expectPrefer: ["usa", "história"],
  },
  {
    body: "Koľko sŕdc má chobotnica?",
    answer: "Tri",
    expectAny: ["zvieratá", "morské"],
  },
  {
    body: "Ktorá planéta Slnečnej sústavy sa otáča prakticky na boku?",
    answer: "Urán",
    expectAny: ["astronómia", "planéty"],
  },
  {
    body: "Ktoré suchozemské zviera má z cicavcov najvyšší krvný tlak?",
    answer: "Žirafa",
    expectAny: ["zvieratá"],
    expectPrefer: ["safari"],
  },
  {
    body: "Ktorá bežná potravina sa prakticky nikdy nepokazí, ak je uzavretá?",
    answer: "Med",
    expectAny: ["jedlo"],
  },
  {
    body: "Ktorý kontinent nemá na svojom území klasickú púšť?",
    answer: "Európa",
    expectAny: ["geografia", "európa"],
  },
  {
    body: "V ktorom roku padol Berlínsky múr?",
    answer: "1989",
    expectAny: ["história"],
    expectPrefer: ["európa", "politika", "nemecko"],
  },
  {
    body: "Z ulíc ktorého amerického mesta sú prevzaté názvy na klasickom slovenskom Monopoly?",
    answer: "Atlantic City",
    expectAny: ["hry", "usa"],
  },
  {
    body: "O približne koľko centimetrov môže byť Eiffelova veža v horúcom lete vyššia než v zime?",
    answer: "Približne 15 cm",
    expectAny: ["architektúra", "francúzsko"],
    expectPrefer: ["fyzika"],
  },
  {
    body: "Ako sa dnes volá krajina, ktorá do roku 1984 niesla názov Horná Volta?",
    answer: "Burkina Faso",
    expectAny: ["história", "afrika"],
    expectPrefer: ["geografia"],
  },
  {
    body: "Na území ktorého štátu Južnej Ameriky sa nachádza púšť Atacama? Vďaka niektorým oblastiam je najsuchšou nepolárnou púšťou sveta.",
    answer: "Čile",
    expectAny: ["geografia"],
    expectPrefer: ["čile", "južná amerika"],
    expectNone: ["usa", "európa"],
  },
  {
    body: "Ktorý kontinent leží na južnej pologuli a zahŕňa Brazíliu aj Argentínu?",
    answer: "Južná Amerika",
    expectAny: ["južná amerika", "geografia"],
    expectNone: ["usa"],
  },
  {
    body: "Čo znamená latinské slovo terra?",
    answer: "Zem",
    expectAny: ["latinský jazyk"],
    expectNone: ["usa", "geografia"],
  },
  {
    body: "Koľko rokov má dospelý slon africký približne?",
    answer: "Okolo 60–70",
    expectAny: ["zvieratá"],
    expectPrefer: ["safari", "afrika"],
    expectNone: ["história", "usa"],
  },
  {
    body: "Ktoré more omýva východné pobrežie Talianska?",
    answer: "Jadranské more",
    expectAny: ["taliansko"],
    expectPrefer: ["geografia", "európa", "morské"],
    expectNone: ["latinský jazyk", "usa"],
  },
  {
    body: "Na pomenovanie človeka s ktorým sa nemožno dohovoriť sa používa slovo odvodené z názvu príslušníka kočovného kmeňa: ...",
    answer: "Tatár",
    expectAny: ["etymológia", "jazyk"],
    expectPrefer: ["slovenčina", "história"],
    expectNone: ["usa", "geografia", "film"],
  },
  {
    body: "Čomu hovoria lekári hematóm?",
    answer: "Krvný výron",
    expectAny: ["medicína"],
    expectPrefer: ["anatómia", "zdravie"],
    expectNone: ["všeobecné", "usa", "fyzika", "geografia"],
  },
  {
    body: "Ako sa volá zápal slepého čreva?",
    answer: "Apendicitída",
    expectAny: ["medicína"],
    expectNone: ["všeobecné", "usa"],
  },
  {
    body: "Ktorá značka má logo s tromi pruhmi?",
    answer: "Adidas",
    expectAny: ["značky"],
    expectNone: ["všeobecné", "usa"],
  },
  {
    body: "Koľko percent je jedna polovica?",
    answer: "50 %",
    expectAny: ["matematika"],
    expectNone: ["všeobecné", "usa"],
  },
] as const;

let failed = 0;

for (const sample of samples) {
  const tags = inferBankQuestionTags(sample.body, sample.answer);
  const hasAny = sample.expectAny.every((t) => tags.includes(t));
  const preferHit = !("expectPrefer" in sample) || sample.expectPrefer.some((t) => tags.includes(t));
  const noneHit =
    !("expectNone" in sample) || sample.expectNone.every((t) => !tags.includes(t));
  const onlyGeneral = tags.length === 1 && tags[0] === "všeobecné";
  const ok =
    hasAny && preferHit && noneHit && !onlyGeneral && tags.filter((t) => t !== "obrázok").length <= 3;
  if (!ok) {
    failed += 1;
    console.error("FAIL", {
      body: sample.body,
      tags,
      expectAny: sample.expectAny,
      expectNone: "expectNone" in sample ? sample.expectNone : undefined,
    });
  } else {
    console.log("OK ", tags.join(", "), "←", sample.body.slice(0, 60));
  }
}

const refreshCases: Array<{
  name: string;
  stored: string[];
  body: string;
  answer: string;
  check: (tags: string[]) => boolean;
}> = [
  {
    name: "empty → infer",
    stored: [],
    body: "Koľko sŕdc má chobotnica?",
    answer: "Tri",
    check: (tags) => tags.includes("zvieratá") || tags.includes("morské"),
  },
  {
    name: "only všeobecné → infer",
    stored: ["všeobecné"],
    body: "Ktorá planéta Slnečnej sústavy je najväčšia?",
    answer: "Jupiter",
    check: (tags) => tags.includes("astronómia") || tags.includes("planéty"),
  },
  {
    name: "keep specific multi-tags",
    stored: ["história", "európa", "politika"],
    body: "V ktorom roku padol Berlínsky múr?",
    answer: "1989",
    check: (tags) => tags.join() === "história,európa,politika",
  },
  {
    name: "only obrázok → add topics",
    stored: ["obrázok"],
    body: "Pozri na foto: ktoré mesto je hlavné mesto Francúzska?",
    answer: "Paríž",
    check: (tags) => tags.some((t) => t !== "obrázok" && t !== "všeobecné"),
  },
  {
    name: "hematóm všeobecné → medicína",
    stored: ["všeobecné"],
    body: "Čomu hovoria lekári hematóm?",
    answer: "Krvný výron",
    check: (tags) => tags.includes("medicína") && !tags.includes("všeobecné"),
  },
];

for (const c of refreshCases) {
  const tags = refreshStoredCustomQuestionTags(c.stored, c.body, c.answer);
  if (!c.check(tags)) {
    failed += 1;
    console.error("FAIL refresh", c.name, tags);
  } else {
    console.log("OK  refresh:", c.name, "→", tags.join(", "));
  }
}

const manual = resolveCustomQuestionTags(["história", "všeobecné"], "x", "y");
if (manual.join() !== "história") {
  failed += 1;
  console.error("FAIL resolve strips meta", manual);
} else {
  console.log("OK  resolve strips meta →", manual.join(", "));
}

if (failed) {
  console.error("\\n" + failed + " check(s) failed");
  process.exit(1);
}
console.log("\\nAll tag-inference checks passed.");
`,
  "utf8"
);

const result = spawnSync("npx", ["--yes", "tsx", runner], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
  env: process.env,
});

fs.unlinkSync(runner);
process.exit(result.status ?? 1);
