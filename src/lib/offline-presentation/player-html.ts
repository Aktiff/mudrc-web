/** Self-contained offline presentation player (index.html). */
export function buildOfflinePlayerHtml(): string {
  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MUDRC — offline prezentácia</title>
<style>
@font-face{font-family:BebasNeue;src:url("fonts/bebas-neue-latin-ext.woff2") format("woff2");font-weight:400;font-display:swap;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:BebasNeue;src:url("fonts/bebas-neue-latin.woff2") format("woff2");font-weight:400;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Poppins;src:url("fonts/poppins-400-latin-ext.woff2") format("woff2");font-weight:400;font-display:swap;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Poppins;src:url("fonts/poppins-400-latin.woff2") format("woff2");font-weight:400;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Poppins;src:url("fonts/poppins-600-latin-ext.woff2") format("woff2");font-weight:600;font-display:swap;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Poppins;src:url("fonts/poppins-600-latin.woff2") format("woff2");font-weight:600;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Poppins;src:url("fonts/poppins-700-latin-ext.woff2") format("woff2");font-weight:700;font-display:swap;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Poppins;src:url("fonts/poppins-700-latin.woff2") format("woff2");font-weight:700;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#030303;color:#fff;font-family:Poppins,system-ui,sans-serif;overflow:hidden;user-select:none}
button,select{font:inherit}
.fd{font-family:BebasNeue,Impact,sans-serif;letter-spacing:.04em}
#boot,#start,#stageRoot{position:fixed;inset:0;z-index:1}
#boot{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7)}
#start{display:none;align-items:center;justify-content:center;padding:1.5rem;background:#060606}
#start .card{position:relative;width:100%;max-width:28rem;display:flex;flex-direction:column;gap:1.25rem}
#start h1{font-family:BebasNeue,Impact,sans-serif;font-size:2.5rem;margin:0;letter-spacing:.06em}
#start .eyebrow{color:rgba(240,200,0,.7);font-size:.75rem;text-transform:uppercase;letter-spacing:.3em;margin:0 0 .75rem}
#start p.hint{color:rgba(255,255,255,.55);font-size:.875rem;margin:0}
#start label.lbl{font-size:.875rem;color:rgba(255,255,255,.7)}
#start select,#start button.primary{width:100%;border-radius:.75rem;padding:.85rem 1rem}
#start select{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff}
#start button.primary{background:#f0c800;color:#000;font-weight:700;border:0;cursor:pointer}
#start button.primary:hover{background:#ffd54f}
#start a.back{text-align:center;color:rgba(255,255,255,.5);font-size:.875rem;text-decoration:none}
.backdrop{position:absolute;inset:0;pointer-events:none}
.backdrop .b1{position:absolute;inset:0;background:#060606}
.backdrop .b2{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 35%,rgba(240,200,0,.09),transparent 70%)}
.backdrop .b3{position:absolute;inset:0;background:radial-gradient(ellipse 120% 80% at 50% 100%,rgba(0,0,0,.85),transparent 60%)}
.backdrop .b4{position:absolute;inset:0;opacity:.04;background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);background-size:48px 48px}
#stageRoot{display:none;align-items:center;justify-content:center;background:#030303}
#stage{position:relative;display:flex;flex-direction:column;color:#fff;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.06)}
#slideLayer{position:relative;z-index:2;flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}
#slideInner{width:100%;height:100%;max-height:100%;min-height:0;box-sizing:border-box;padding:max(1.25rem,2.4vmin) max(1.25rem,2.8vmin);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
.badge,.timer{position:absolute;z-index:5;pointer-events:none;top:1.1rem}
.badge{left:1.1rem;background:#f0c800;color:#000;border-radius:1rem;min-width:4.5rem;height:4.5rem;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 40px rgba(240,200,0,.45);ring:2px solid rgba(240,200,0,.4)}
.badge span{font-family:BebasNeue,Impact,sans-serif;font-size:2.4rem;line-height:1}
.timer{right:1.1rem;min-width:4.5rem;height:4.5rem;padding:0 1rem;border-radius:1rem;background:rgba(0,0,0,.8);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.timer.handin{min-width:9rem;height:6rem;border-color:#f0c800}
.timer.handin.urgent{border-color:#ef4444;background:rgba(69,10,10,.9)}
.timer span{font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:2rem;line-height:1;font-variant-numeric:tabular-nums}
.timer.handin span{font-size:3.2rem}
.fsbtn{position:absolute;top:1rem;right:1rem;z-index:80;pointer-events:auto;padding:.65rem;border-radius:999px;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.2);color:#fff;cursor:pointer}
.qtext{font-weight:600;text-align:center;color:#fff;white-space:pre-wrap;text-wrap:pretty;max-width:100%;padding:.1em .5rem;filter:drop-shadow(0 4px 24px rgba(0,0,0,.85));line-height:1.45}
.options{display:grid;grid-template-columns:1fr;gap:1.4rem;width:100%;max-width:100%}
@media(min-width:640px){.options{grid-template-columns:1fr 1fr;gap:1.8rem}}
.opt{display:flex;align-items:center;gap:1.4rem;width:100%;border-radius:1rem;border:3px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);padding:1.2rem 1.6rem;box-shadow:0 12px 48px rgba(0,0,0,.45)}
.opt.ok{border-color:#f0c800;background:linear-gradient(135deg,#f0c800,#e6b800);color:#000}
.opt .ltr{font-family:BebasNeue,Impact,sans-serif;font-size:clamp(2.5rem,6vmin,5.5rem);color:#f0c800;width:4.5rem;flex-shrink:0}
.opt.ok .ltr{color:rgba(0,0,0,.7)}
.opt .txt{flex:1;min-width:0;font-weight:600;font-size:clamp(1.6rem,4.5vmin,4rem);line-height:1.45;text-align:left}
.answer{width:100%;border-radius:1rem;padding:1.2rem 1.8rem;background:linear-gradient(135deg,#f0c800,#e6b800);color:#000;text-align:center;font-weight:700;font-size:clamp(1.8rem,5vmin,4.5rem);line-height:1.45;box-shadow:0 20px 60px rgba(240,200,0,.25);white-space:pre-line}
.match{display:grid;grid-template-columns:1fr 1fr;gap:1rem;width:100%}
.match .col{display:flex;flex-direction:column;gap:.75rem;min-width:0}
.match .card{display:flex;align-items:center;gap:.75rem;border-radius:1rem;border:3px solid rgba(255,255,255,.35);background:rgba(255,255,255,.14);padding:.85rem 1.1rem}
.match .mark{font-family:BebasNeue,Impact,sans-serif;color:#f0c800;font-size:clamp(1.4rem,3.5vmin,3rem);width:2.5rem;flex-shrink:0}
.match .body{flex:1;min-width:0;font-weight:600;font-size:clamp(1.1rem,2.8vmin,2.4rem);line-height:1.25;text-align:left;word-break:break-word}
.media{width:100%;max-width:42rem;max-height:min(46vh,440px);border-radius:.75rem;border:1px solid rgba(255,255,255,.1);background:#000;object-fit:contain}
.media.audio{max-height:none;border:0;background:transparent}
.imgwrap{min-height:0;height:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:.35rem}
.imgwrap img{max-width:calc(100% - 4px);max-height:calc(100% - 4px);width:auto;height:auto;object-fit:contain;border-radius:1rem;box-shadow:0 24px 80px rgba(0,0,0,.6)}
.centerHuge{text-align:center;width:100%;padding:0 2rem}
.centerHuge .t{font-family:BebasNeue,Impact,sans-serif;font-size:clamp(3.5rem,12vw,10rem);line-height:1;margin:0}
.centerHuge .s{font-size:clamp(1.1rem,3vw,2rem);color:rgba(255,255,255,.65);margin-top:1.5rem;font-weight:500}
.rulesbox{width:100%;max-width:none;display:flex;flex-direction:column;justify-content:center;gap:.4em;padding:2vh 2vw}
.rulesbox .venue{color:rgba(240,200,0,.7);text-align:center;font-size:.72em}
.rulesbox .heading{color:#f0c800;text-align:center;font-weight:600;font-family:BebasNeue,Impact,sans-serif;font-size:.85em}
.rulesbox ul{list-style:none;margin:0;padding:.45em .7em;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:.28em}
.rulesbox li{display:flex;align-items:baseline;gap:.45em;color:rgba(255,255,255,.95);line-height:1.35}
.rulesbox .n{color:#f0c800;font-family:BebasNeue,Impact,sans-serif;width:1.4em;text-align:right;flex-shrink:0}
#modal{display:none;position:fixed;inset:0;z-index:30;align-items:center;justify-content:center;padding:1.25rem;background:rgba(0,0,0,.7);backdrop-filter:blur(4px)}
#modal .panel{width:100%;max-width:32rem;max-height:min(90vh,760px);overflow:hidden;border-radius:1rem;border:1px solid rgba(255,255,255,.15);background:#121212;padding:1.5rem;display:flex;flex-direction:column;gap:1rem}
#modal .list{overflow:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:.5rem}
#modal label.row{display:flex;gap:.75rem;align-items:flex-start;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);padding:.75rem;cursor:pointer}
#modal label.row.on{border-color:rgba(240,200,0,.6);background:rgba(240,200,0,.1)}
#modal .actions{display:flex;gap:.75rem}
#modal .actions button{flex:1;border-radius:.75rem;padding:.85rem;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.85)}
#modal .actions button.go{background:#f0c800;color:#000;font-weight:700;border:0}
.soundOnly{width:100%;max-width:36rem}
.soundOnly button{width:100%;height:3rem;border-radius:.75rem;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.25);color:#fff;font-weight:600;cursor:pointer}
.stack{width:100%;max-width:100%;min-height:0;max-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;overflow:visible}
.stack.imgFocus{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:.6rem;height:100%;overflow:hidden}
.promo{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1.25rem;padding:2vw}
.promo .bar{width:6rem;height:.25rem;border-radius:999px;background:#f0c800}
.promo .title{font-family:BebasNeue,Impact,sans-serif;color:#f0c800;font-size:clamp(2rem,5vw,4.5rem);margin:0;line-height:1.1}
.promo img{max-width:min(70vw,720px);max-height:min(42vh,480px);object-fit:contain}
.promo .text{font-weight:600;white-space:pre-line;font-size:clamp(1.35rem,3.2vw,2.75rem);max-width:min(92vw,1100px);margin:0}
.corr .gold{font-family:BebasNeue,Impact,sans-serif;color:#f0c800;font-size:clamp(3rem,10vw,6rem);margin:0 0 1.5rem}
.corr .sub{font-size:clamp(1.5rem,4vw,3rem);color:rgba(255,255,255,.7);font-weight:600;margin:0 0 1rem}
.corr li{font-weight:600;font-size:clamp(1.5rem,3.8vw,4rem);line-height:1.15;margin:.6rem 0;list-style:none}
</style>
</head>
<body>
<div id="boot">Načítavam offline prezentáciu…</div>
<div id="start">
  <div class="backdrop"><div class="b1"></div><div class="b2"></div><div class="b3"></div><div class="b4"></div></div>
  <div class="card">
    <div>
      <p class="eyebrow">Projekcia kvízu · offline</p>
      <h1 id="quizTitle" class="fd"></h1>
      <p class="hint">Podnik je voliteľný — ak ho vyberieš, prvý slide zobrazí jeho pravidlá. Balík beží bez internetu.</p>
    </div>
    <div>
      <label class="lbl">Podnik</label>
      <select id="eventSelect"></select>
    </div>
    <div id="rulesTermWrap" style="display:none">
      <label class="lbl">Pravidlá na prvom slide</label>
      <select id="rulesTerm"></select>
    </div>
    <div>
      <label class="lbl">Formát obrazovky</label>
      <select id="aspectSelect">
        <option value="tv-16:9">TV 16 : 9 — Pre televízor</option>
        <option value="viewport">Celá obrazovka — Notebook / PC</option>
        <option value="16:9">16 : 9</option>
        <option value="18:9">18 : 9</option>
        <option value="16:10">16 : 10</option>
        <option value="4:3">4 : 3</option>
      </select>
    </div>
    <button type="button" class="primary" id="btnStart">Spustiť projekciu</button>
  </div>
</div>
<div id="modal">
  <div class="panel" id="modalPanel">
    <div>
      <p class="eyebrow" style="color:rgba(240,200,0,.8);font-size:.75rem;letter-spacing:.25em;text-transform:uppercase;margin:0 0 .5rem">Pred projekciou</p>
      <h2 class="fd" style="font-size:1.75rem;margin:0">Najbližšie kvízy</h2>
      <p class="hint" style="margin-top:.5rem">Zaklikni podniky (max 4). Zobrazia sa na slide Opravovanie.</p>
    </div>
    <div class="list" id="nextList"></div>
    <div class="actions">
      <button type="button" id="btnCancelNext">Zrušiť</button>
      <button type="button" class="go" id="btnConfirmNext">Spustiť projekciu</button>
    </div>
  </div>
</div>
<div id="stageRoot">
  <div id="stage">
    <div class="backdrop"><div class="b1"></div><div class="b2"></div><div class="b3"></div><div class="b4"></div></div>
    <button type="button" class="fsbtn" id="btnFs" title="Zväčšiť">⛶</button>
    <div class="badge" id="qBadge" style="display:none"><span id="qBadgeNum"></span></div>
    <div class="timer" id="timer" style="display:none"><span id="timerText">0</span></div>
    <div id="slideLayer"><div id="slideInner"></div></div>
  </div>
</div>
<script src="data.js"></script>
<script>
(function () {
  var data = window.__MUDRC_OFFLINE__;
  var boot = document.getElementById("boot");
  if (!data || !data.quiz) {
    boot.textContent = "Chýba data.js — rozbaľ celý ZIP a otvor index.html z toho istého priečinka.";
    return;
  }

  var OPTION_LETTERS = ["A","B","C","D","E","F"];
  var roundLabels = {1:"15 otázok",2:"15 otázok",3:"15 otázok",4:"15 otázok"};
  var MAX_NEXT = 4;
  var NBSP = "\\u00A0";

  function fixSk(text) {
    if (!text) return "";
    return String(text).replace(/\\\\n/g, "\\n");
  }

  function displayQuestionNumber(q) {
    if (typeof q.order === "number" && q.order >= 0) return q.order + 1;
    if (q.kind === "music") return 5 + q.questionNumber;
    return q.questionNumber;
  }

  function compareQuizQuestions(a, b) {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    var ao = typeof a.order === "number" ? a.order : null;
    var bo = typeof b.order === "number" ? b.order : null;
    if (ao !== null && bo !== null) {
      if (ao !== bo) return ao - bo;
      return String(a.id || "").localeCompare(String(b.id || ""));
    }
    var am = a.kind === "music" ? 1 : 0;
    var bm = b.kind === "music" ? 1 : 0;
    if (am !== bm) return am - bm;
    if (a.questionNumber !== b.questionNumber) return a.questionNumber - b.questionNumber;
    return String(a.id || "").localeCompare(String(b.id || ""));
  }

  function parseEmbeddedOptions(body) {
    var lines = String(body || "").split("\\n");
    var options = [];
    var splitIndex = lines.length;
    var re = /^[A-F]\\)\\s*(.+)$/i;
    for (var i = lines.length - 1; i >= 0; i--) {
      var line = lines[i].trim();
      if (!line) { if (options.length) splitIndex = i; continue; }
      var m = line.match(re);
      if (m) { options.unshift(m[1].trim()); splitIndex = i; }
      else break;
    }
    if (options.length < 2) return { questionText: String(body || "").trim(), options: [] };
    return { questionText: lines.slice(0, splitIndex).join("\\n").trim(), options: options };
  }

  function getQuestionOptions(q) {
    if (q.options && q.options.length) return q.options.filter(function (o) { return typeof o === "string" && o.trim(); });
    return parseEmbeddedOptions(q.body).options;
  }

  function getQuestionBodyText(q) {
    var body = typeof q.body === "string" ? q.body : "";
    if (q.options && q.options.length) return body.trim();
    var parsed = parseEmbeddedOptions(body);
    return parsed.options.length ? parsed.questionText : body.trim();
  }

  function findCorrectOptionIndexes(options, answer) {
    var lines = String(answer || "").split(/\\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return [];
    var out = [];
    lines.forEach(function (line) {
      var letter = line.match(/^([A-F])\\)?\\s*/i);
      var text = letter ? line.slice(letter[0].length).trim() : line;
      var idx = -1;
      if (letter) {
        idx = OPTION_LETTERS.indexOf(letter[1].toUpperCase());
        if (idx >= options.length) idx = -1;
      }
      if (idx < 0) {
        idx = options.findIndex(function (o) { return o.trim().toLowerCase() === text.toLowerCase(); });
      }
      if (idx >= 0 && out.indexOf(idx) < 0) out.push(idx);
    });
    return out;
  }

  function matchLetter(i) { return String.fromCharCode(65 + i); }

  function visibleRuleTexts(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function (item) {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        if (item.hidden === true) return "";
        return String(item.text || "").trim();
      }
      return "";
    }).filter(Boolean);
  }

  function promoVisible(p) {
    return Boolean((p.title || "").trim() || (p.text || "").trim() || (p.imageUrl || "").trim());
  }

  function videoClipSeconds(q) {
    var s = q.videoQuestionSeconds;
    if (typeof s !== "number" || !isFinite(s) || s <= 0) return undefined;
    return s;
  }

  function buildSlides(questions, promos) {
    var slides = [{ type: "rules" }];
    var sorted = questions.slice().sort(compareQuizQuestions);
    var rounds = Array.from(new Set(sorted.map(function (q) { return q.roundNumber; }))).filter(function (r) { return r >= 1; }).sort(function (a, b) { return a - b; });
    rounds.forEach(function (round) {
      var rq = sorted.filter(function (q) { return q.roundNumber === round; });
      if (!rq.length) return;
      slides.push({ type: "round", roundNumber: round, title: round + ". kolo", subtitle: roundLabels[round] || "" });
      rq.forEach(function (question) {
        if (question.imageUrl && question.imageBeforeQuestion) slides.push({ type: "image_slide", question: question, media: "image" });
        if (question.videoUrl && question.videoBeforeQuestion) slides.push({ type: "image_slide", question: question, media: "video", playUntilSeconds: videoClipSeconds(question), audioOnly: question.videoQuestionAudioOnly === true });
        slides.push({ type: "question_phase", question: question });
        if (question.imageUrl && question.imageOnNextSlide) slides.push({ type: "image_slide", question: question, media: "image" });
        if (question.videoUrl && question.videoOnNextSlide) slides.push({ type: "image_slide", question: question, media: "video", playUntilSeconds: videoClipSeconds(question), audioOnly: question.videoQuestionAudioOnly === true });
      });
      slides.push({ type: "correction", roundNumber: round });
      slides.push({ type: "answers_intro", roundNumber: round, title: "Správne odpovede — Kolo " + round });
      rq.forEach(function (question) {
        if (question.imageUrl && question.imageBeforeAnswer) slides.push({ type: "image_slide", question: question, media: "image" });
        if (question.videoUrl && question.videoBeforeAnswer) slides.push({ type: "image_slide", question: question, media: "video" });
        slides.push({ type: "answer_phase", question: question });
        if (question.imageUrl && question.imageAfterAnswer) slides.push({ type: "image_slide", question: question, media: "image" });
        if (question.videoUrl && question.videoAfterAnswer) slides.push({ type: "image_slide", question: question, media: "video" });
      });
      (promos || []).filter(function (p) { return promoVisible(p) && p.afterRound === round; }).forEach(function (promo) {
        slides.push({ type: "promo", promo: promo });
      });
    });
    (promos || []).filter(function (p) { return promoVisible(p) && (p.afterRound === 0 || rounds.indexOf(p.afterRound) < 0); }).forEach(function (promo) {
      slides.push({ type: "promo", promo: promo });
    });
    slides.push({ type: "scores", title: "Vyhodnotenie", body: "" });
    return slides;
  }

  function isLastRoundQuestionSlide(slides, index) {
    var slide = slides[index];
    if (!slide || slide.type !== "question_phase") return false;
    var round = slide.question.roundNumber;
    for (var i = index + 1; i < slides.length; i++) {
      var next = slides[i];
      if (next.type === "question_phase") return next.question.roundNumber !== round;
      if (next.type === "correction" || next.type === "answers_intro" || next.type === "round" || next.type === "scores" || next.type === "promo" || next.type === "rules") return true;
    }
    return true;
  }

  function showImageInPhase(q, phase) {
    if (!q.imageUrl) return false;
    if (phase === "question") return !!q.imageDuringQuestion;
    return !!(q.imageDuringQuestion || q.imageOnAnswerSlide);
  }
  function showVideoInPhase(q, phase) {
    if (!q.videoUrl) return false;
    if (phase === "question") return !!q.videoDuringQuestion;
    return !!q.videoOnAnswerSlide;
  }

  function parseSkDateTime(date, time) {
    var m = String(date || "").match(/^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})$/);
    if (!m) return null;
    var tm = String(time || "19:00").match(/^(\\d{1,2}):(\\d{2})$/);
    var hh = tm ? Number(tm[1]) : 19;
    var mm = tm ? Number(tm[2]) : 0;
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), hh, mm, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function addDays(dateStr, days) {
    var d = parseSkDateTime(dateStr, "12:00");
    if (!d) return null;
    d.setDate(d.getDate() + days);
    return String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear();
  }

  function quizIntervalDays(event) { return event && event.weeklyQuiz === true ? 7 : 14; }

  function formatSkWeekday(dateStr) {
    var d = parseSkDateTime(dateStr, "12:00");
    if (!d) return "";
    return ["nedeľa","pondelok","utorok","streda","štvrtok","piatok","sobota"][d.getDay()] || "";
  }

  function formatEventDateLabel(date) {
    var w = formatSkWeekday(date);
    return w ? w + " - " + date : date;
  }

  function formatNextQuizLine(venue, at, city) {
    var day = String(at.getDate()).padStart(2,"0") + "." + String(at.getMonth()+1).padStart(2,"0") + ".";
    var time = String(at.getHours()).padStart(2,"0") + ":" + String(at.getMinutes()).padStart(2,"0");
    var w = ["nedeľa","pondelok","utorok","streda","štvrtok","piatok","sobota"][at.getDay()];
    return venue + (city ? " · " + city : "") + " — " + w + " " + day + " " + time;
  }

  function nextQuizMomentForEvent(event, isHome) {
    if (isHome) {
      var nextDate = addDays(event.date, quizIntervalDays(event));
      if (!nextDate) return null;
      return parseSkDateTime(nextDate, event.time || "19:00");
    }
    return parseSkDateTime(event.date, event.time || "19:00");
  }

  function upcomingFutureQuizzes(event) {
    return (event.futureQuizzes || []).slice().sort(function (a, b) {
      var da = parseSkDateTime(a.date, a.time || "12:00");
      var db = parseSkDateTime(b.date, b.time || "12:00");
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
  }

  function findFutureQuiz(event, date) {
    return (event.futureQuizzes || []).find(function (q) { return q.date === date || q.id === date; }) || null;
  }

  function findHomeQuizEvent(events, slug) {
    return events.find(function (e) { return e.slug === slug; }) || null;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function questionTextStyle(text, withImage, imageWithOptions, matchQuestion) {
    var len = text.length;
    var lh = 1.45;
    function clamp(a,b,c){ return "clamp("+a+","+b+","+c+")"; }
    if (withImage) {
      if (imageWithOptions) {
        if (len > 100) return "font-size:"+clamp("2.25rem","4.8vmin","4.5rem")+";line-height:"+lh;
        if (len > 60) return "font-size:"+clamp("2.5rem","5.2vmin","5rem")+";line-height:"+lh;
        if (len > 30) return "font-size:"+clamp("2.75rem","5.8vmin","5.75rem")+";line-height:"+lh;
        return "font-size:"+clamp("3rem","6vmin","6.25rem")+";line-height:"+lh;
      }
      if (len > 100) return "font-size:"+clamp("2.75rem","6vmin","5.5rem")+";line-height:"+lh;
      if (len > 60) return "font-size:"+clamp("3.25rem","7vmin","6.5rem")+";line-height:"+lh;
      if (len > 30) return "font-size:"+clamp("3.75rem","8vmin","7.5rem")+";line-height:"+lh;
      return "font-size:"+clamp("4rem","8.5vmin","8.5rem")+";line-height:"+lh;
    }
    if (matchQuestion) {
      if (len > 100) return "font-size:"+clamp("2.35rem","5vmin","5.25rem")+";line-height:"+lh;
      if (len > 60) return "font-size:"+clamp("2.55rem","5.4vmin","5.75rem")+";line-height:"+lh;
      return "font-size:"+clamp("2.75rem","5.8vmin","6.25rem")+";line-height:"+lh;
    }
    if (len > 140) return "font-size:"+clamp("3rem","6.5vmin","7rem")+";line-height:"+lh;
    if (len > 100) return "font-size:"+clamp("3.25rem","7vmin","7.75rem")+";line-height:"+lh;
    if (len > 70) return "font-size:"+clamp("3.5rem","7.5vmin","8.5rem")+";line-height:"+lh;
    if (len > 45) return "font-size:"+clamp("3.75rem","8vmin","9.25rem")+";line-height:"+lh;
    return "font-size:"+clamp("4rem","8.5vmin","10rem")+";line-height:"+lh;
  }

  function stageStyle(mode) {
    if (mode === "viewport") return { width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" };
    var ratio = { "16:9":[16,9], "tv-16:9":[16,9], "18:9":[18,9], "16:10":[16,10], "4:3":[4,3] }[mode] || [16,9];
    var w = ratio[0], h = ratio[1];
    return {
      aspectRatio: w + " / " + h,
      width: "min(100vw, calc(100vh * " + w + " / " + h + "))",
      height: "min(100vh, calc(100vw * " + h + " / " + w + "))",
      maxWidth: "100%",
      maxHeight: "100%"
    };
  }

  var quiz = data.quiz;
  var events = Array.isArray(data.events) ? data.events : [];
  var slides = buildSlides(quiz.questions || [], quiz.promos || []);
  var state = {
    started: false,
    index: 0,
    eventSlug: "",
    rulesTerm: "",
    aspect: "tv-16:9",
    nextLines: [],
    selectedNext: [],
    homeNext: "",
    handIn: null,
    handInLeft: null,
    slideElapsed: 0,
    mediaEl: null
  };
  var gongCtx = null;
  var gongPlayed = false;
  var slideTimerId = null;
  var handInTimerId = null;

  document.getElementById("quizTitle").textContent = quiz.title || "Kvíz";
  var eventSelect = document.getElementById("eventSelect");
  eventSelect.innerHTML = '<option value="">— Bez podniku (generické pravidlá) —</option>' +
    events.map(function (e) {
      return '<option value="'+esc(e.slug)+'">'+esc(e.venue)+" · "+esc(e.city)+"</option>";
    }).join("");

  function refreshRulesTerm() {
    var wrap = document.getElementById("rulesTermWrap");
    var sel = document.getElementById("rulesTerm");
    var ev = events.find(function (e) { return e.slug === state.eventSlug; });
    var future = ev ? upcomingFutureQuizzes(ev) : [];
    if (!ev || !future.length) {
      wrap.style.display = "none";
      state.rulesTerm = "";
      return;
    }
    wrap.style.display = "block";
    sel.innerHTML = '<option value="">'+esc(formatEventDateLabel(ev.date))+" · "+esc(ev.quizType || "Kvíz")+"</option>" +
      future.map(function (q) {
        return '<option value="'+esc(q.date)+'">'+esc(formatEventDateLabel(q.date))+" · "+esc(q.quizType || "")+"</option>";
      }).join("");
    sel.value = state.rulesTerm;
  }

  eventSelect.addEventListener("change", function () {
    state.eventSlug = eventSelect.value;
    state.rulesTerm = "";
    refreshRulesTerm();
  });
  document.getElementById("rulesTerm").addEventListener("change", function (e) {
    state.rulesTerm = e.target.value;
  });
  document.getElementById("aspectSelect").addEventListener("change", function (e) {
    state.aspect = e.target.value;
  });

  function prepareGong() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!gongCtx) gongCtx = new Ctx();
      gongCtx.resume();
    } catch (e) {}
  }

  function playGong() {
    prepareGong();
    if (!gongCtx) return;
    var now = gongCtx.currentTime;
    var master = gongCtx.createGain();
    master.gain.setValueAtTime(0.85, now);
    master.connect(gongCtx.destination);
    [{f:196,g:0.7,d:2.6},{f:294,g:0.38,d:1.9},{f:392,g:0.22,d:1.4},{f:523,g:0.12,d:1.0}].forEach(function (p) {
      var osc = gongCtx.createOscillator();
      var gain = gongCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(p.f, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(p.g, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
      osc.connect(gain); gain.connect(master);
      osc.start(now); osc.stop(now + p.d + 0.05);
    });
  }

  function openNextModal() {
    var home = findHomeQuizEvent(events, state.eventSlug);
    state.homeNext = home ? home.slug : "";
    state.selectedNext = home ? [home.slug] : [];
    var list = document.getElementById("nextList");
    var active = events.filter(function (e) { return e.active !== false && (e.venue || "").trim(); });
    var homeEv = active.find(function (e) { return e.slug === state.homeNext; });
    var rest = active.filter(function (e) { return e.slug !== state.homeNext; }).sort(function (a,b) {
      return a.city.localeCompare(b.city, "sk") || a.venue.localeCompare(b.venue, "sk");
    });
    var choices = homeEv ? [homeEv].concat(rest) : rest;
    function render() {
      list.innerHTML = choices.map(function (event) {
        var checked = state.selectedNext.indexOf(event.slug) >= 0;
        var order = state.selectedNext.indexOf(event.slug);
        var full = !checked && state.selectedNext.length >= MAX_NEXT;
        var at = nextQuizMomentForEvent(event, event.slug === state.homeNext);
        var line = at ? formatNextQuizLine(event.venue, at, event.city) : event.venue;
        return '<label class="row'+(checked?" on":"")+(full?" style=\\"opacity:.4\\"":"")+'">' +
          '<input type="checkbox" data-slug="'+esc(event.slug)+'"'+(checked?" checked":"")+(full?" disabled":"")+' />' +
          '<span><strong>'+esc(event.venue)+'</strong> <span style="color:rgba(255,255,255,.45)">'+esc(event.city)+'</span>' +
          (checked ? ' <span style="display:inline-flex;align-items:center;justify-content:center;min-width:1.25rem;height:1.25rem;border-radius:999px;background:#f0c800;color:#000;font-size:.75rem;font-weight:700">'+(order+1)+'</span>' : '') +
          '<br/><span style="color:rgba(255,255,255,.7)">'+esc(line)+'</span></span></label>';
      }).join("");
      list.querySelectorAll("input[type=checkbox]").forEach(function (input) {
        input.addEventListener("change", function () {
          var slug = input.getAttribute("data-slug");
          if (input.checked) {
            if (state.selectedNext.length >= MAX_NEXT) { input.checked = false; return; }
            state.selectedNext.push(slug);
          } else {
            state.selectedNext = state.selectedNext.filter(function (s) { return s !== slug; });
          }
          render();
        });
      });
    }
    render();
    document.getElementById("modal").style.display = "flex";
  }

  document.getElementById("btnStart").addEventListener("click", openNextModal);
  document.getElementById("btnCancelNext").addEventListener("click", function () {
    document.getElementById("modal").style.display = "none";
  });
  document.getElementById("modal").addEventListener("click", function (e) {
    if (e.target === document.getElementById("modal")) document.getElementById("modal").style.display = "none";
  });
  document.getElementById("btnConfirmNext").addEventListener("click", function () {
    var entries = state.selectedNext.map(function (slug) {
      var event = events.find(function (e) { return e.slug === slug; });
      if (!event) return null;
      var at = nextQuizMomentForEvent(event, slug === state.homeNext);
      if (!at) return null;
      return { venue: event.venue, city: event.city, at: at };
    }).filter(Boolean).sort(function (a,b) { return a.at.getTime() - b.at.getTime(); });
    state.nextLines = entries.map(function (e) { return formatNextQuizLine(e.venue, e.at, e.city); });
    document.getElementById("modal").style.display = "none";
    startPresentation();
  });

  function currentRules() {
    var selected = events.find(function (e) { return e.slug === state.eventSlug; });
    var extra = selected && state.rulesTerm ? findFutureQuiz(selected, state.rulesTerm) : null;
    var eventRules = visibleRuleTexts(extra && Array.isArray(extra.rules) ? extra.rules : selected && selected.rules);
    var specialRules = extra
      ? visibleRuleTexts(extra.specialRules)
      : selected && selected.thematic
        ? visibleRuleTexts(selected.specialRules)
        : [];
    var venueName = selected
      ? (extra ? selected.venue + " · " + (extra.quizType || "") : selected.venue + " · " + selected.city)
      : "";
    return { eventRules: eventRules, specialRules: specialRules, venueName: venueName };
  }

  function renderOptions(options, highlight) {
    if (!options.length) return "";
    var set = {};
    (highlight || []).forEach(function (i) { set[i] = true; });
    return '<div class="options">' + options.map(function (option, index) {
      return '<div class="opt'+(set[index]?" ok":"")+'"><span class="ltr">'+OPTION_LETTERS[index]+')</span><p class="txt">'+esc(option)+'</p></div>';
    }).join("") + "</div>";
  }

  function renderMatch(left, right) {
    return '<div class="match"><div class="col">' +
      left.map(function (item, i) {
        return '<div class="card"><span class="mark">'+(i+1)+'</span><p class="body">'+esc(item)+'</p></div>';
      }).join("") +
      '</div><div class="col">' +
      right.map(function (item, i) {
        return '<div class="card"><span class="mark">'+matchLetter(i)+'</span><p class="body">'+esc(item)+'</p></div>';
      }).join("") +
      "</div></div>";
  }

  function mediaHtml(tag, src, extraClass, attrs) {
    if (!src) return "";
    return "<"+tag+' class="media '+(extraClass||"")+'" src="'+esc(src)+'" controls playsinline preload="auto" '+(attrs||"")+'></'+tag+">";
  }

  function renderQuestionContent(question, phase) {
    var showImage = showImageInPhase(question, phase);
    var showVideo = showVideoInPhase(question, phase);
    var qtext = getQuestionBodyText(question) || "Otázka";
    var options = getQuestionOptions(question);
    var correct = (question.isOrderQuestion || question.isMatchQuestion || phase !== "answer")
      ? []
      : findCorrectOptionIndexes(options, question.answer);
    var imageHero = showImage && options.length === 0;
    var imageWithOptions = showImage && options.length > 0;
    var imageFocused = imageHero || imageWithOptions;
    var audio = question.audioUrl
      ? mediaHtml("audio", question.audioUrl, "audio", 'data-role="presentation-audio"')
      : "";
    var video = "";
    if (showVideo && question.videoUrl) {
      if (phase === "question" && question.videoQuestionAudioOnly === true) {
        video = '<div class="soundOnly" data-stop="1"><video src="'+esc(question.videoUrl)+'" playsinline preload="auto" style="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none" data-role="presentation-audio" data-until="'+(videoClipSeconds(question)||"")+'"></video>' +
          '<button type="button" data-sound-toggle="1">Pustiť ukážku</button></div>';
      } else {
        var until = phase === "question" ? videoClipSeconds(question) : undefined;
        video = mediaHtml("video", question.videoUrl, "", 'data-stop="1" data-role="presentation-audio"'+(until ? ' data-until="'+until+'"' : ""));
      }
    }
    var qBlock = '<p class="qtext" style="'+questionTextStyle(qtext, imageFocused, imageWithOptions, question.isMatchQuestion === true)+'">'+esc(qtext)+"</p>";
    var img = showImage && question.imageUrl
      ? '<div class="imgwrap"><img src="'+esc(question.imageUrl)+'" alt="" draggable="false" /></div>'
      : "";
    var footer = '<div style="width:100%;display:flex;flex-direction:column;gap:1rem">';
    if (question.isMatchQuestion) footer += renderMatch(options, question.matchRight || []);
    else if (options.length) footer += renderOptions(options, correct);
    if (phase === "answer") {
      var ans = (question.answer || "").trim();
      if (!ans && question.musicArtist && question.musicTitle) ans = question.musicArtist + " — " + question.musicTitle;
      if (options.length && !correct.length && ans) footer += '<div class="answer">'+esc(ans)+"</div>";
      if (!options.length) footer += '<div class="answer">'+esc(ans || "—")+"</div>";
    }
    footer += "</div>";
    if (imageFocused) {
      return '<div class="stack imgFocus"><div style="display:flex;flex-direction:column;align-items:center;gap:.75rem">'+audio+video+qBlock+"</div>"+img+footer+"</div>";
    }
    return '<div class="stack">'+audio+video+qBlock+img+footer+"</div>";
  }

  function renderSlide(slide) {
    var rules = currentRules();
    if (slide.type === "rules") {
      var list = rules.eventRules.length ? rules.eventRules : ["Pravidlá nastav v admin → Udalosť → Pravidlá."];
      var html = '<div class="rulesbox" id="rulesFit" style="font-size:42px">';
      if (rules.venueName) html += '<p class="venue">'+esc(rules.venueName)+"</p>";
      if (rules.specialRules.length) {
        html += '<p class="heading">Špeciálne pravidlá</p><ul>' +
          rules.specialRules.map(function (r, i) {
            return '<li><span class="n">'+(i+1)+'</span><span>'+esc(r)+"</span></li>";
          }).join("") + "</ul>";
      }
      html += '<p class="heading">Pravidlá</p><ul>' +
        list.map(function (r, i) {
          return '<li><span class="n">'+(i+1)+'</span><span>'+esc(r)+"</span></li>";
        }).join("") + "</ul></div>";
      return html;
    }
    if (slide.type === "round") {
      return '<div class="centerHuge"><p class="t fd">'+esc(slide.title)+"</p>" +
        (slide.subtitle ? '<p class="s">'+esc(slide.subtitle)+"</p>" : "") + "</div>";
    }
    if (slide.type === "correction") {
      var lines = state.nextLines || [];
      return '<div class="corr centerHuge"><p class="gold">Opravovanie</p>' +
        (lines.length
          ? '<p class="sub">'+(lines.length === 1 ? "Najbližší kvíz:" : "Najbližšie kvízy:")+"</p><ul style='padding:0;margin:0'>" +
            lines.map(function (l) { return "<li>"+esc(l)+"</li>"; }).join("") + "</ul>"
          : "") + "</div>";
    }
    if (slide.type === "answers_intro") {
      return '<div class="centerHuge"><div style="width:6rem;height:.25rem;margin:0 auto 2rem;border-radius:999px;background:#f0c800"></div><p class="t fd" style="font-size:clamp(2.5rem,8vw,6rem)">'+esc(slide.title)+"</p></div>";
    }
    if (slide.type === "promo") {
      var p = slide.promo;
      return '<div class="promo"><div class="bar"></div>' +
        (p.title && p.title.trim() ? '<p class="title">'+esc(p.title.trim())+"</p>" : "") +
        (p.imageUrl ? '<img src="'+esc(p.imageUrl)+'" alt="" />' : "") +
        (p.text && p.text.trim() ? '<p class="text">'+esc(p.text.trim())+"</p>" : "") +
        "</div>";
    }
    if (slide.type === "scores") {
      return '<div class="centerHuge"><p class="t fd" style="font-size:clamp(3rem,10vw,6rem)">'+esc(slide.title)+"</p></div>";
    }
    if (slide.type === "question_phase") return renderQuestionContent(slide.question, "question");
    if (slide.type === "answer_phase") return renderQuestionContent(slide.question, "answer");
    if (slide.type === "image_slide") {
      var q = slide.question;
      if (slide.media === "video") {
        if (slide.audioOnly) {
          return '<div class="soundOnly" data-stop="1"><video src="'+esc(q.videoUrl)+'" playsinline preload="auto" style="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none" data-role="presentation-audio" data-until="'+(slide.playUntilSeconds||"")+'"></video><button type="button" data-sound-toggle="1">Pustiť ukážku</button></div>';
        }
        return '<div data-stop="1" style="width:100%;max-width:48rem;display:flex;align-items:center;justify-content:center">'+
          mediaHtml("video", q.videoUrl, "", 'data-role="presentation-audio"'+(slide.playUntilSeconds ? ' data-until="'+slide.playUntilSeconds+'"' : ""))+
          "</div>";
      }
      if (!q.imageUrl) return "";
      return '<div class="imgwrap"><img src="'+esc(q.imageUrl)+'" alt="" draggable="false" /></div>';
    }
    return "";
  }

  function fitRules() {
    var box = document.getElementById("rulesFit");
    var viewport = document.getElementById("slideInner");
    if (!box || !viewport) return;
    var lo = 18, hi = 64, best = lo;
    for (var i = 0; i < 12; i++) {
      var mid = (lo + hi) / 2;
      box.style.fontSize = mid + "px";
      if (box.scrollHeight > viewport.clientHeight + 1 || box.scrollWidth > viewport.clientWidth + 1) hi = mid;
      else { best = mid; lo = mid; }
    }
    box.style.fontSize = best + "px";
  }

  function bindMedia() {
    state.mediaEl = document.querySelector('[data-role="presentation-audio"]');
    document.querySelectorAll("[data-until]").forEach(function (el) {
      var until = Number(el.getAttribute("data-until"));
      if (!until) return;
      el.addEventListener("timeupdate", function () {
        if (el.currentTime >= until - 0.05) {
          el.pause();
          el.currentTime = until;
        }
      });
    });
    document.querySelectorAll("[data-sound-toggle]").forEach(function (btn) {
      var video = btn.parentElement.querySelector("video");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!video) return;
        if (video.paused) {
          var until = Number(video.getAttribute("data-until"));
          if (until && video.currentTime >= until - 0.12) video.currentTime = 0;
          video.play().catch(function(){});
          btn.textContent = "Pozastaviť ukážku";
        } else {
          video.pause();
          btn.textContent = "Pustiť ukážku";
        }
      });
    });
    document.querySelectorAll("[data-stop]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.stopPropagation(); });
      el.addEventListener("contextmenu", function (e) { e.stopPropagation(); });
    });
  }

  function updateChrome() {
    var slide = slides[state.index];
    var showBadge = slide && (slide.type === "question_phase" || slide.type === "image_slide" || slide.type === "answer_phase");
    var badge = document.getElementById("qBadge");
    var timer = document.getElementById("timer");
    if (showBadge) {
      badge.style.display = "flex";
      document.getElementById("qBadgeNum").textContent = String(displayQuestionNumber(slide.question));
    } else badge.style.display = "none";

    if (state.started && slide && slide.type !== "rules") {
      timer.style.display = "flex";
      var hand = state.handIn && state.handIn.index === state.index ? state.handInLeft : null;
      timer.className = "timer" + (hand != null ? (hand <= 10 ? " handin urgent" : " handin") : "");
      document.getElementById("timerText").textContent = hand != null
        ? Math.floor(hand / 60) + ":" + String(hand % 60).padStart(2, "0")
        : String(state.slideElapsed);
    } else timer.style.display = "none";
  }

  function paint() {
    var slide = slides[state.index];
    document.getElementById("slideInner").innerHTML = slide ? renderSlide(slide) : "";
    bindMedia();
    updateChrome();
    if (slide && slide.type === "rules") requestAnimationFrame(fitRules);
  }

  function resetSlideTimer() {
    if (slideTimerId) clearInterval(slideTimerId);
    state.slideElapsed = 0;
    var slide = slides[state.index];
    if (!state.started || !slide || slide.type === "rules") return;
    var startedAt = Date.now();
    slideTimerId = setInterval(function () {
      state.slideElapsed = Math.floor((Date.now() - startedAt) / 1000);
      updateChrome();
    }, 1000);
  }

  function clearHandIn() {
    state.handIn = null;
    state.handInLeft = null;
    gongPlayed = false;
    if (handInTimerId) clearInterval(handInTimerId);
    handInTimerId = null;
  }

  function startHandInWatch() {
    if (handInTimerId) clearInterval(handInTimerId);
    handInTimerId = setInterval(function () {
      if (!state.handIn || state.handIn.index !== state.index) return;
      var left = Math.max(0, Math.ceil((state.handIn.endsAt - Date.now()) / 1000));
      state.handInLeft = left;
      if (left === 0 && !gongPlayed) {
        gongPlayed = true;
        playGong();
      }
      updateChrome();
    }, 200);
  }

  function goNext() {
    state.index = Math.min(slides.length - 1, state.index + 1);
    clearHandIn();
    paint();
    resetSlideTimer();
  }
  function goPrev() {
    state.index = Math.max(0, state.index - 1);
    clearHandIn();
    paint();
    resetSlideTimer();
  }

  var HAND_IN_MS = 90000;
  var HAND_IN_SKIP_MIN_ELAPSED_MS = 400;

  function advance() {
    if (isLastRoundQuestionSlide(slides, state.index)) {
      if (!state.handIn || state.handIn.index !== state.index) {
        prepareGong();
        state.handIn = { index: state.index, endsAt: Date.now() + HAND_IN_MS };
        state.handInLeft = 90;
        gongPlayed = false;
        startHandInWatch();
        updateChrome();
        return;
      }
      if (Date.now() < state.handIn.endsAt) return;
    }
    goNext();
  }

  /** Dvojklik počas bežiaceho 90s odovzdania → gong + ďalší slide. */
  function skipHandIn() {
    if (!state.handIn || state.handIn.index !== state.index) return;
    var remaining = state.handIn.endsAt - Date.now();
    if (remaining <= 0) {
      goNext();
      return;
    }
    if (remaining > HAND_IN_MS - HAND_IN_SKIP_MIN_ELAPSED_MS) return;
    if (!gongPlayed) {
      gongPlayed = true;
      playGong();
    }
    goNext();
  }

  function applyStageBox() {
    var style = stageStyle(state.aspect);
    var stage = document.getElementById("stage");
    stage.style.width = style.width;
    stage.style.height = style.height;
    stage.style.maxWidth = style.maxWidth;
    stage.style.maxHeight = style.maxHeight;
    stage.style.aspectRatio = style.aspectRatio || "";
  }

  function startPresentation() {
    state.started = true;
    state.index = 0;
    document.getElementById("start").style.display = "none";
    document.getElementById("stageRoot").style.display = "flex";
    applyStageBox();
    paint();
    resetSlideTimer();
  }

  document.getElementById("slideLayer").addEventListener("click", function (e) {
    if (e.button !== 0) return;
    advance();
  });
  document.getElementById("slideLayer").addEventListener("dblclick", function (e) {
    if (e.button !== 0) return;
    skipHandIn();
  });
  document.getElementById("stage").addEventListener("contextmenu", function (e) {
    e.preventDefault();
    goPrev();
  });
  document.getElementById("btnFs").addEventListener("click", function (e) {
    e.stopPropagation();
    var root = document.getElementById("stageRoot");
    if (!document.fullscreenElement) root.requestFullscreen().catch(function(){});
    else document.exitFullscreen().catch(function(){});
  });
  window.addEventListener("keydown", function (e) {
    if (!state.started) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); advance(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      document.getElementById("btnFs").click();
    }
  });
  window.addEventListener("resize", function () {
    if (state.started) applyStageBox();
    fitRules();
  });

  boot.style.display = "none";
  document.getElementById("start").style.display = "flex";
  if (!slides.length) {
    document.getElementById("start").innerHTML = '<p style="position:relative;z-index:2">Žiadne otázky v tomto kvíze.</p>';
  }
})();
</script>
</body>
</html>`;
}
