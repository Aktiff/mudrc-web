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

/** Max tagov z auto-inferencie (user môže mať viac manuálne). */
const MAX_INFERRED_TAGS = 3;

/**
 * Pravidlá od špecifických po všeobecnejšie.
 * Text je už bez diakritiky (normalizeForTags).
 */
const TAG_RULES: TagRule[] = [
  {
    tag: "latinský jazyk",
    // Len explicitné latinské cues — nie holé terra/luna/aqua/mare (iné jazyky, zemepis, mená).
    patterns: [/\blatin/, /\blatinsk/, /\blatinsky\b/, /\blatinske\b/],
  },
  {
    tag: "etymológia",
    patterns: [
      /\betymolog/,
      /\bodvoden[yea]/,
      /\bpovod\s+(slova|nazvu|mena)/,
      /\bz\s+nazvu\b/,
      /\bslovo\s+odvoden/,
      /\bpomenovan/,
      /\bvyznam\s+slova/,
      /\bodkial\s+(pochadza|je)\s+slov/,
    ],
  },
  {
    tag: "slovenčina",
    patterns: [
      /\bslovencin/,
      /\bslovenske\s+slovo/,
      /\bv\s+slovencine/,
      /\bslovensky\s+(vyraz|fraza|idiom|prislovie|uslovie)/,
      // Otázky o význame/pomenovaní v bežnej slovenčine (bez cudzieho jazyka).
      /\bpomenovan.{0,40}\b(slovo|vyraz)/,
      /\bslovo\s+odvoden.{0,60}\b(kmen|nazvu|naroda|narod)/,
    ],
  },
  {
    tag: "jazyk",
    patterns: [
      /\bjazyk/,
      /\bgramatik/,
      /\bpravopis/,
      /\bslovnik/,
      /\bidiom/,
      /\bprislov/,
      /\buslov/,
      /\bfrazeolog/,
      /\bfraza\b/,
      /\bdoho[vw]or/,
      /\bnevie\s+sa\s+dohov/,
      /\bnemozno\s+dohov/,
      /\bvyznam\s+(slova|vyrazu|fraz)/,
      /\bpomenovan/,
      /\bodvoden[yea]/,
      /\bkocovn\w*\s+kmen/,
      /\bprislusnik\w*\s+kmen/,
    ],
  },
  {
    tag: "francúzsko",
    patterns: [/\bfrancuz/, /\bparis\b/, /\beiffel/, /\blouvre\b/, /\bmarseill/, /\blyon\b/, /\bnice\b/],
  },
  {
    tag: "nemecko",
    patterns: [/\bnemeck/, /\bberlin/, /\bmnichov/, /\bhamburg\b/, /\brur\b/, /\bbavorsk/],
  },
  {
    tag: "taliansko",
    patterns: [/\btaliansk/, /\brim\b/, /\brima\b/, /\bmilan/, /\bbenatk/, /\bflorence\b/, /\bflorenc/, /\bvenez/],
  },
  {
    tag: "britsko",
    patterns: [/\bbritan/, /\bangl[iy]/, /\blondon\b/, /\bscotland\b/, /\bskotsk/, /\bwales\b/, /\birsk/],
  },
  {
    tag: "čile",
    patterns: [/\bcile\b/, /\batacam/, /\bsantiago\b/],
  },
  {
    tag: "južná amerika",
    patterns: [
      /\bjuzn\w*\s+amerik/,
      /\blatinsk\w*\s+amerik/,
      /\bbrazil/,
      /\bargentin/,
      /\bperu\b/,
      /\bbolivi/,
      /\bkolumbi/,
      /\bamazonk/,
      /\band[yi]\b/,
      /\batacam/,
    ],
  },
  {
    tag: "afrika",
    patterns: [
      /\bafric/,
      /\begypt/,
      /\bsahar/,
      /\bnil\b/,
      /\bkenya\b/,
      /\bnigeria/,
      /\bsenegal/,
      /\bmarok/,
      /\btunisk/,
      /\bsudanu?\b/,
      /\bethiop/,
      /\bsafari\b/,
      /\bburkina/,
      /\bvolta\b/,
      /\bzimbabw/,
      /\bsouth\s+africa/,
    ],
  },
  {
    tag: "ázia",
    patterns: [
      /\bazia\b/,
      /\bcina\b/,
      /\bjaponsk/,
      /\bindia\b/,
      /\bkorea\b/,
      /\bthajsk/,
      /\bvietnam/,
      /\bindonez/,
      /\bmongol/,
      /\bhimalaj/,
      /\bpeking\b/,
      /\btokio\b/,
    ],
  },
  {
    tag: "planéty",
    patterns: [
      /\bplanet/,
      /\bslnecnej\s+sustav/,
      /\bmercur/,
      /\bvenus\b/,
      /\bmars\b/,
      /\bjupiter/,
      /\bsaturn/,
      /\buran\b/,
      /\bneptun/,
      /\bpluto\b/,
    ],
  },
  {
    tag: "morské",
    patterns: [
      /\bmorsk/,
      /\bocean/,
      /\bchobotnic/,
      /\bvelryb/,
      /\bziab[ae]?r/,
      /\bkrab\b/,
      /\bmeduza/,
      /\bkorall?/,
      /\btunak\b/,
      /\bzralok/,
      /\bdelfin/,
    ],
  },
  {
    tag: "safari",
    patterns: [/\bsafari\b/, /\bziraf/, /\blev\b/, /\blevy\b/, /\bslon/, /\bhroch/, /\bnosoroz/, /\bzebr/, /\bantilop/],
  },
  {
    tag: "film",
    patterns: [
      /\bfilm/,
      /\bherec\b/,
      /\bhereck/,
      /\bherecka\b/,
      /\breziser/,
      /\boscar/,
      /\bnetflix/,
      /\bserial/,
      /\bkino\b/,
      /\bhollywood\b/,
      /\bhollywoodwood\b/,
      /\bfilmov\w*\s+studi/,
      /\bstudi(o|a|ach)\s+(v|vo|hollywood|kaliforn|los\s+angeles)/,
      /\bnatacal/,
      /\bcasablanca\b/,
      /\bpixar\b/,
      /\bdisney\b/,
    ],
  },
  {
    tag: "hudba",
    patterns: [
      /\bhudb/,
      /\bpiesen/,
      /\bpiesn/,
      /\balbum/,
      /\bkapela\b/,
      /\brock\b/,
      /\bpop\s+(hudb|pesnick|hit)/,
      /\brap\b/,
      /\bhudobn\w*\s+hit|\bhit\s+(pies|singl|album)/,
      /\bspev[a]?k/,
      /\binterpret/,
      /\bkoncert/,
      /\bmelodi/,
      /\bskladb/,
    ],
  },
  {
    tag: "literatúra",
    patterns: [
      /\bknih/,
      /\broman\b/,
      /\bbasnik/,
      /\bbasen\b/,
      /\bspisovatel/,
      /\bshakespeare/,
      /\bdrama\b/,
      /\bautor\s+(knih|roman|diel)/,
      /\bpoezi/,
      /\bproza\b/,
      /\bbeletr/,
    ],
  },
  {
    tag: "história",
    patterns: [
      /\bhist/,
      // „rok/roku“ len v časovom/dejinnom kontexte — nie holé „rokov“ (vek, dĺžka).
      /\bv\s+roku\b/,
      /\bdo\s+roku\b/,
      /\bod\s+roku\b/,
      /\bv\s+rokoch\b/,
      /\bv\s+ktorom\s+roku\b/,
      /\broku\s+\d{3,4}\b/,
      /\bstoroc/,
      /\bvalk[ay]/,
      /\bbitk[ay]/,
      /\brevoluc/,
      /\bpanovnik/,
      /\bcisar/,
      /\bkral\b/,
      /\bkralovn/,
      /\brims?k/,
      /\bstredovek/,
      /\bantick/,
      // 4-ciferný rok len s dejinným okolím (nie holé číslo v inej otázke).
      /\b(roku|rokoch|storoc|valk|bitk|revoluc|padol|zalozen|objaven).{0,24}\b\d{4}\b/,
      /\b\d{4}\b.{0,24}(rok|storoc|valk|bitk|revoluc|padol|zalozen|objaven)/,
      /\b(padol|pad)\b.{0,20}\bmur\b/,
      /\bmur\b.{0,20}\b(padol|pad|berlin)/,
      /\bimperi/,
      /\bkocovn/,
      /\bkmen[aey]?\b/,
      /\btatar/,
      /\bmongol/,
      /\bhun\b/,
      /\bhuni\b/,
    ],
  },
  {
    tag: "geografia",
    patterns: [
      /\bkrajina\b/,
      /\bkrajiny\b/,
      /\bstatu?\b/,
      /\bhlavne\s+mesto/,
      /\bmesto\s+(je|bolo|ma|lezi|leziace)/,
      /\briek[ay]/,
      /\bhor[ay]\b/,
      /\bpohorie/,
      /\bkontinent/,
      /\bocean/,
      /\bmapa\b/,
      /\bpust\b/,
      /\bpuste\b/,
      /\bpustou\b/,
      /\bostrov/,
      /\bpolostrov/,
      /\bcasov(ych|e)\s+pas/,
      /\bhranic/,
      /\bpole\s+zemepis/,
      /\bzemepis/,
      /\buzemi/,
    ],
  },
  {
    tag: "európa",
    // Holé „europ“ je OK (Európa/európsky); nie časti iných slov (už \b).
    patterns: [
      /\beurop/,
      /\bnemeck/,
      /\bfrancuz/,
      /\bpolsko\b/,
      /\bpolsk[aey]/,
      /\bcesko\b/,
      /\bcesk[aey]/,
      /\bslovens/,
      /\britan/,
      /\btaliansk/,
      /\bspaniel/,
      /\brakusk/,
      /\bmadarsk/,
      /\bbalkan/,
      /\bscandinav/,
      /\bskandinav/,
      /\bberlin/,
      /\bparis\b/,
      /\blondon\b/,
      /\brim\b/,
    ],
  },
  {
    tag: "slovensko",
    patterns: [
      /\bslovens/,
      /\bbratislav/,
      /\bkosic/,
      /\btatr[yi]/,
      /\bdunaj\b/,
      /\btrnav/,
      /\bmalatinsk/,
      /\bpresov/,
      /\bzilin/,
      /\bnitr[ay]/,
      /\bbansk/,
      /\bpoprad/,
    ],
  },
  {
    tag: "usa",
    // Nie holé „amerika/amerik*“ — Južná/Latinská Amerika ≠ USA.
    patterns: [
      /\busa\b/,
      /\bspojen[ea]\s+stat/,
      /\bstatov?\s+americk/,
      /\bamerick\w*\s+(mesto|stat|prezident|herec|film|hudb)/,
      /\b(mesto|stat|prezident)\w*\s+americk/,
      /\bnew\s+york/,
      /\bwashington\b/,
      /\bcalifornia/,
      /\bkaliforn/,
      /\bhollywood\b/,
      /\btexas\b/,
      /\bchicago\b/,
      /\batlantic\s+city/,
      /\bwall\s+street/,
      /\bpresidents?k/,
      /\bsevern\w*\s+amerik/,
    ],
  },
  {
    tag: "šport",
    patterns: [
      /\bsport/,
      /\bfutbal/,
      /\bhokej/,
      /\bolymp/,
      /\btenis\b/,
      /\bformul/,
      /\bf1\b/,
      /\bstadion/,
      /\barena\b/,
      /\bmajstrovst/,
      /\bms\b/,
      /\bmajstrovst(va|a)?\s+europ|\bme\s+(vo|v)\b/,
      /\bgol\b/,
      /\bzapas/,
      /\bbasketbal/,
      /\bvolejbal/,
      /\bcyklist/,
      /\bmaraton/,
      /\bliga\b/,
    ],
  },
  {
    tag: "astronómia",
    patterns: [
      /\bplanet/,
      /\bslnko\b/,
      /\bslnecnej/,
      /\bmiesiac\b/,
      /\bvesmir/,
      /\bgalax/,
      /\bkometa\b/,
      /\borbit/,
      /\bhviezd/,
      /\bastron/,
      /\bkozm/,
      /\bteleskop/,
      /\bobezn/,
      /\bslnecn\w*\s+sustav|\bsustav[ay]\s+(planet|hviezd)/,
    ],
  },
  {
    tag: "zvieratá",
    patterns: [
      /\bzvier/,
      /\bcicav/,
      /\bssav/,
      /\bvtak/,
      /\bryb[ay]/,
      /\blev\b/,
      /\bslon/,
      /\bpes\b/,
      /\bps[ya]\b/,
      /\bmack/,
      /\bchobotnic/,
      /\bziraf/,
      /\bhad\b/,
      /\bhady\b/,
      /\bpavuk/,
      /\bhmyz/,
      /\bdinosaur/,
      /\bvelryb/,
      /\bmedved/,
      /\bvlk\b/,
      /\bliska\b/,
      /\borel\b/,
      /\bsova\b/,
    ],
  },
  {
    tag: "jedlo",
    patterns: [
      /\bjedlo\b/,
      /\bpotravin/,
      /\bkuch/,
      /\brecept/,
      /\bpecen/,
      /\bnapoj/,
      /\bvino\b/,
      /\bpivo\b/,
      /\bmed\b/,
      /\bsyr\b/,
      /\bchlieb\b/,
      /\bovocie/,
      /\bzelenin/,
      /\bchoclad/,
      /\bkava\b/,
      /\bcaj\b/,
      /\bvaren/,
      /\bgastronom/,
    ],
  },
  {
    tag: "technológia",
    patterns: [
      /\btechnolog/,
      /\bsoftver/,
      /\baplik/,
      /\binternet/,
      /\bgoogle\b/,
      /\bapple\b/,
      /\btelefon/,
      /\bcomputer\b/,
      /\bpc\b/,
      /\bai\b/,
      /\brobot/,
      /\bprogramov/,
      /\bchip\b/,
      /\bsmartfon/,
      /\bmicrosoft/,
      /\bsamsung/,
    ],
  },
  {
    tag: "politika",
    patterns: [
      /\bpolitik/,
      /\bvolb/,
      /\bparlament/,
      /\bprezident/,
      /\bminister/,
      /\beu\b/,
      /\bvlad[ay]/,
      /\bdemokraci/,
      /\bdiplomat/,
      /\bznamy\s+mur/,
      /\bberlin.*mur/,
      /\bmur.*berlin/,
    ],
  },
  {
    tag: "umenie",
    patterns: [/\bumen/, /\bsoch/, /\bgaler/, /\bmuseum/, /\bmuzeum/, /\bmalir/, /\bmalarsk/, /\bpicasso/, /\bvan\s+gogh/],
  },
  {
    tag: "architektúra",
    patterns: [
      /\barchitekt/,
      /\bhrad\b/,
      /\bkatedr/,
      /\bmost\b/,
      /\bveza\b/,
      /\beiffel/,
      /\bpyramid/,
      /\bpalac/,
      /\bstavb/,
      /\bvezi\b/,
    ],
  },
  {
    tag: "fyzika",
    patterns: [
      /\bfyzik/,
      /\benergi/,
      /\bsila\b/,
      /\brychl/,
      /\bteplot/,
      /\btepeln/,
      /\broztaz/,
      /\bgravit/,
      /\batom\b/,
      /\bkvant/,
      /\bnewton/,
      /\beinstein/,
      /\bpressure\b/,
      /\b(krvn\w*\s+tlak|tlak\w*\s+krv)/,
      /\belektr/,
      /\bcentimetr/,
      /\bhoruc.*\b(lete|zime|teplot)|teplot.*\bhoruc/,
    ],
  },
  {
    tag: "chémia",
    patterns: [/\bchemi/, /\bprvok/, /\bperiodick/, /\bmolekul/, /\breakci/, /\bkyselin/, /\bvodik/, /\bkyslik/, /\buhlik/],
  },
  {
    tag: "biológia",
    patterns: [/\bbiolog/, /\bbunk/, /\bdna\b/, /\bgen\b/, /\bgenom/, /\borganizm/, /\bevoluc/, /\bfotosynt/],
  },
  {
    tag: "veda",
    patterns: [/\bveda\b/, /\bvedec/, /\bvyskum/, /\blaborator/, /\bobjav/],
  },
  {
    tag: "hry",
    patterns: [
      /\bhra\b/,
      /\bhry\b/,
      /\bmonopoly\b/,
      /\bchess\b/,
      /\bsach/,
      /\bvideo\s+h/,
      /\bdeskov/,
      /\bkartov/,
      /\bpuzzle\b/,
      /\bkviz\b/,
    ],
  },
  {
    tag: "náboženstvo",
    patterns: [/\bnabozens/, /\bkostol/, /\bcirk[ev]/, /\bbiblie\b/, /\bbibli/, /\bbudhizm/, /\bislam/, /\bkrestan/],
  },
  {
    tag: "mytológia",
    patterns: [/\bmytolog/, /\bzeus\b/, /\bolympus\b/, /\bviking/, /\bnordick/, /\bbajk[ay]/, /\blegend/],
  },
];


/** Konkrétnejšie tagy majú prednosť pri limitoch 2–3. */
const TAG_PRIORITY: Record<string, number> = {
  "latinský jazyk": 5,
  "etymológia": 5,
  "slovenčina": 5,
  "francúzsko": 5,
  "nemecko": 5,
  "taliansko": 5,
  "britsko": 5,
  "čile": 5,
  "planéty": 5,
  "morské": 5,
  "safari": 5,
  "hry": 5,
  "film": 5,
  "hudba": 5,
  "literatúra": 5,
  "jazyk": 4,
  "južná amerika": 4,
  "afrika": 4,
  "ázia": 4,
  "usa": 4,
  "slovensko": 4,
  "šport": 4,
  "astronómia": 4,
  "architektúra": 4,
  "fyzika": 4,
  "chémia": 4,
  "biológia": 4,
  "jedlo": 3,
  "zvieratá": 3,
  "technológia": 3,
  "politika": 3,
  "umenie": 3,
  "náboženstvo": 3,
  "mytológia": 3,
  "história": 2,
  "geografia": 2,
  "európa": 2,
  "veda": 1,
};

const META_TAGS = new Set(["vlastné", "vseobecne", "všeobecné"]);

/** Tagy formátu otázky — samy o sebe nie sú téma; pri retagu ich neblokujú silnejšiu inferenciu. */
const FORMAT_TAGS = new Set(["obrázok", "obrazok"]);

function itemLooksLikeImageQuestion(text: string): boolean {
  return /\bfot(o|ka|ografi)/.test(text) || /\bobraz/.test(text) || /\bpozri\s+na/.test(text);
}

function dedupeTags(tags: string[]): string[] {
  return Array.from(new Set(tags));
}

function isTopicTag(tag: string): boolean {
  return Boolean(tag) && !META_TAGS.has(tag) && !FORMAT_TAGS.has(tag);
}

/** Odhadne tagy z textu otázky — ak user nevyplní vlastné. Preferuje 1–3 konkrétne témy. */
export function inferBankQuestionTags(body: string, answer: string, note?: string): string[] {
  const text = normalizeForTags(`${body} ${answer} ${note ?? ""}`);
  const found: string[] = [];

  for (const rule of TAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      if (!found.includes(rule.tag)) found.push(rule.tag);
    }
  }

  if (itemLooksLikeImageQuestion(text) && !found.includes("obrázok")) {
    found.push("obrázok");
  }

  const topicTags = found
    .filter(isTopicTag)
    .sort((a, b) => (TAG_PRIORITY[b] ?? 0) - (TAG_PRIORITY[a] ?? 0) || found.indexOf(a) - found.indexOf(b))
    .slice(0, MAX_INFERRED_TAGS);
  const formatExtras = found.filter((tag) => FORMAT_TAGS.has(tag));
  const result = dedupeTags([...topicTags, ...formatExtras]);

  if (!result.some(isTopicTag)) {
    return ["všeobecné"];
  }

  return result;
}

export function resolveCustomQuestionTags(
  userTags: string[] | undefined,
  body: string,
  answer: string,
  note?: string
): string[] {
  const manual =
    userTags
      ?.map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .filter((t) => !META_TAGS.has(t)) ?? [];
  if (manual.some(isTopicTag)) {
    return dedupeTags(manual).slice(0, 8);
  }
  return inferBankQuestionTags(body, answer, note);
}

/**
 * Pri načítaní / normalizácii zo servera:
 * - prázdne alebo len meta/generic (všeobecné) → znova odvodí konkrétne tagy
 * - len formátový tag (obrázok) → doplní témy, formát nechá ak sedí
 * - už má konkrétne témy → neprepisuje zámerné multi-tag úpravy usera
 */
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

  const topicTags = cleaned.filter(isTopicTag);
  const formatTags = cleaned.filter((t) => FORMAT_TAGS.has(t));

  if (!topicTags.length) {
    const inferred = inferBankQuestionTags(body, answer, note);
    if (!formatTags.length) return inferred;

    const inferredTopics = inferred.filter(isTopicTag);
    const keepFormat = formatTags.filter((tag) => inferred.includes(tag) || tag === "obrázok");
    const merged = dedupeTags([...inferredTopics, ...keepFormat]);
    return merged.some(isTopicTag) ? merged.slice(0, 8) : inferred;
  }

  return dedupeTags(cleaned).slice(0, 8);
}
