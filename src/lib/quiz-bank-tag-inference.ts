function normalizeForTags(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type TagRule = {
  tag: string;
  patterns: RegExp[];
};

const TAG_RULES: TagRule[] = [
  {
    tag: "latinský jazyk",
    patterns: [/\blatin/, /\blatinsk/, /\bterra\b/, /\bsolus\b/, /\bluna\b/, /\bignis\b/],
  },
  { tag: "film", patterns: [/\bfilm\b/, /\bherec\b/, /\bhereck/, /\breziser/, /\boscar/, /\bnetflix/, /\bserial\b/] },
  { tag: "hudba", patterns: [/\bhudb/, /\bpiesen/, /\balbum/, /\bkapela\b/, /\brock\b/, /\bpop\b/, /\brap\b/, /\bhit\b/] },
  { tag: "literatúra", patterns: [/\bknih/, /\broman\b/, /\bbasnik/, /\bspisovatel/, /\bshakespeare/, /\bdrama\b/] },
  { tag: "história", patterns: [/\bhist/, /\brok\b/, /\bstoroc/, /\bvalka\b/, /\bbitka\b/, /\brevoluc/, /\bpanovnik/, /\brepublika\b/] },
  { tag: "geografia", patterns: [/\bkrajina\b/, /\bmesto\b/, /\bhlavne\s+mesto/, /\brieka\b/, /\bhora\b/, /\bkontinent/, /\bocean\b/, /\bmapa\b/] },
  { tag: "európa", patterns: [/\beurop/, /\bnemecko\b/, /\bfrancuz/, /\bpolsko\b/, /\bcesko\b/, /\bslovensko\b/, /\britan/, /\btaliansko\b/] },
  { tag: "slovensko", patterns: [/\bslovens/, /\bbratislav/, /\bkosic/, /\btatry\b/, /\bdunaj\b/, /\btrnav/, /\bmalatinsk/] },
  { tag: "usa", patterns: [/\busa\b/, /\bamerik/, /\bnew\s+york/, /\bwashington\b/, /\bhollywood\b/] },
  { tag: "šport", patterns: [/\bsport/, /\bfutbal/, /\bhokej/, /\bolymp/, /\btitul\b/, /\bliga\b/, /\btenis\b/, /\bformul/, /\bf1\b/, /\bstadion/, /\barena\b/] },
  { tag: "veda", patterns: [/\bveda\b/, /\bvedec/, /\batom\b/, /\bgen\b/, /\bplaneta\b/, /\bvesmir/, /\bgravit/, /\bperiodick/] },
  {
    tag: "astronómia",
    patterns: [/\bplaneta\b/, /\bslnko\b/, /\bmiesiac\b/, /\bvesmir/, /\bgalax/, /\bkometa\b/, /\borbit/, /\bzem\b/, /\bterra\b/],
  },
  { tag: "zvieratá", patterns: [/\bzvier/, /\bssak/, /\bvtak\b/, /\bryb[ay]/, /\blev\b/, /\bslon\b/, /\bpsy\b/, /\bmačka\b/] },
  { tag: "jedlo", patterns: [/\bjedlo\b/, /\bpotravin/, /\bkuch/, /\brecept/, /\bpecen/, /\bnapoj/, /\bvino\b/, /\bpivo\b/] },
  { tag: "technológia", patterns: [/\btechnolog/, /\bsoftver/, /\baplik/, /\binternet/, /\bgoogle\b/, /\bapple\b/, /\btelefon/, /\bcomputer\b/, /\bpc\b/] },
  { tag: "politika", patterns: [/\bpolitik/, /\bvolb/, /\bparlament/, /\bprezident/, /\bminister/, /\beu\b/] },
  { tag: "umenie", patterns: [/\bumen/, /\bobraz\b/, /\bsoch/, /\bgaler/, /\bmuseum/, /\barchitekt/] },
  { tag: "architektúra", patterns: [/\barchitekt/, /\bhrad\b/, /\bkatedr/, /\bmost\b/, /\bveza\b/] },
  { tag: "fyzika", patterns: [/\bfyzik/, /\benergi/, /\bsila\b/, /\brychl/, /\bteplota\b/] },
  { tag: "hry", patterns: [/\bhra\b/, /\bhry\b/, /\bmonopoly\b/, /\bchess\b/, /\bsach\b/, /\bvideo\s+h/] },
];

const META_TAGS = new Set(["vlastné", "vseobecne", "všeobecné"]);

function itemLooksLikeImageQuestion(text: string): boolean {
  return /\bfot(o|ka|ografi)/.test(text) || /\bobraz/.test(text) || /\bpozri\s+na/.test(text);
}

/** Odhadne tagy z textu otázky — ak user nevyplní vlastné. */
export function inferBankQuestionTags(body: string, answer: string, note?: string): string[] {
  const text = normalizeForTags(`${body} ${answer} ${note ?? ""}`);
  const found = new Set<string>();

  for (const rule of TAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      found.add(rule.tag);
    }
  }

  if (itemLooksLikeImageQuestion(text)) {
    found.add("obrázok");
  }

  if (!found.size) {
    found.add("všeobecné");
  }

  return Array.from(found).slice(0, 8);
}

export function resolveCustomQuestionTags(
  userTags: string[] | undefined,
  body: string,
  answer: string,
  note?: string
): string[] {
  const manual = userTags?.map((t) => t.trim().toLowerCase()).filter(Boolean).filter((t) => !META_TAGS.has(t)) ?? [];
  if (manual.length) {
    return Array.from(new Set(manual)).slice(0, 8);
  }
  return inferBankQuestionTags(body, answer, note);
}

/** Pri načítaní zo servera — doplní nové pravidlá, zruší zastarané meta tagy. */
export function refreshStoredCustomQuestionTags(
  storedTags: string[] | undefined,
  body: string,
  answer: string,
  note?: string
): string[] {
  const cleaned = (storedTags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .filter((t) => !META_TAGS.has(t));

  if (!cleaned.length) {
    return inferBankQuestionTags(body, answer, note);
  }

  if (cleaned.length === 1 && cleaned[0] === "všeobecné") {
    return inferBankQuestionTags(body, answer, note);
  }

  const inferred = inferBankQuestionTags(body, answer, note).filter((t) => t !== "všeobecné");
  return Array.from(new Set([...cleaned, ...inferred])).slice(0, 8);
}
