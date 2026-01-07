// AP1 Lernquiz (statisch, GitHub Pages geeignet)

const els = {
  bankInfo: document.getElementById("bankInfo"),

  mode: document.getElementById("mode"),
  count: document.getElementById("count"),
  startBtn: document.getElementById("startBtn"),

  chapterSel: document.getElementById("chapterSel"),
  topicSel: document.getElementById("topicSel"),
  qSearch: document.getElementById("qSearch"),
  shuffleQ: document.getElementById("shuffleQ"),
  shuffleA: document.getElementById("shuffleA"),
  selectAllTopicsBtn: document.getElementById("selectAllTopicsBtn"),
  clearTopicsBtn: document.getElementById("clearTopicsBtn"),
  selectionInfo: document.getElementById("selectionInfo"),
  localStats: document.getElementById("localStats"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),

  redoWrongBtn: document.getElementById("redoWrongBtn"),
  clearWrongBtn: document.getElementById("clearWrongBtn"),

  welcome: document.getElementById("welcome"),
  quiz: document.getElementById("quiz"),
  result: document.getElementById("result"),

  progress: document.getElementById("progress"),
  meta: document.getElementById("meta"),
  score: document.getElementById("score"),
  question: document.getElementById("question"),
  answers: document.getElementById("answers"),
  explain: document.getElementById("explain"),
  feedback: document.getElementById("feedback"),
  nextBtn: document.getElementById("nextBtn"),
  skipBtn: document.getElementById("skipBtn"),

  summary: document.getElementById("summary"),
  topicBreakdown: document.getElementById("topicBreakdown"),
  restartBtn: document.getElementById("restartBtn"),
  reviewWrongBtn: document.getElementById("reviewWrongBtn"),
};

const LS_KEY = "ap1quiz_stats_v1";
const LS_WRONG = "ap1quiz_wrong_v1";

let bank = [];
let filtered = [];
let run = [];
let idx = 0;
let locked = false;

// per-run
let score = 0;
let correct = 0;
let answered = 0;

// exam mode bookkeeping
let examAnswers = []; // {qid, chosen, correct}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniq(arr) { return [...new Set(arr)]; }

function loadStats() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function saveStats(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

function loadWrong() {
  try { return JSON.parse(localStorage.getItem(LS_WRONG) || "[]"); } catch { return []; }
}
function saveWrong(list) { localStorage.setItem(LS_WRONG, JSON.stringify(list)); }

function updateLocalStatsLabel() {
  const s = loadStats();
  const total = Object.values(s).reduce((acc, v) => acc + (v.seen || 0), 0);
  const ok = Object.values(s).reduce((acc, v) => acc + (v.correct || 0), 0);
  els.localStats.textContent = total ? `${ok}/${total} richtig` : "–";
}

function chapterTitle(ch) {
  const found = bank.find(q => q.chapter === ch);
  return found ? found.chapterTitle : `Kapitel ${ch}`;
}

function applyParamsToUI() {
  const url = new URL(location.href);
  const mode = url.searchParams.get("mode");
  const n = url.searchParams.get("n");
  const ch = url.searchParams.get("ch");
  const topics = url.searchParams.get("topics");
  const q = url.searchParams.get("q");
  const sq = url.searchParams.get("sq");
  const sa = url.searchParams.get("sa");

  if (mode) els.mode.value = mode;
  if (n) els.count.value = n;
  if (q) els.qSearch.value = q;
  if (sq) els.shuffleQ.checked = sq === "1";
  if (sa) els.shuffleA.checked = sa === "1";

  if (ch) els.chapterSel.value = ch;

  if (topics) {
    const set = new Set(topics.split(","));
    for (const opt of els.topicSel.options) opt.selected = set.has(opt.value);
  }
}

function writeUIToParams() {
  const url = new URL(location.href);
  url.searchParams.set("mode", els.mode.value);
  url.searchParams.set("n", String(els.count.value || 25));
  url.searchParams.set("ch", els.chapterSel.value);

  const selectedTopics = [...els.topicSel.selectedOptions].map(o => o.value);
  if (selectedTopics.length) url.searchParams.set("topics", selectedTopics.join(","));
  else url.searchParams.delete("topics");

  const q = els.qSearch.value.trim();
  if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");

  url.searchParams.set("sq", els.shuffleQ.checked ? "1" : "0");
  url.searchParams.set("sa", els.shuffleA.checked ? "1" : "0");

  history.replaceState({}, "", url.toString());
}

function buildFilterLists() {
  // chapters
  const chapters = uniq(bank.map(q => q.chapter)).sort((a,b)=>a-b);
  els.chapterSel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Alle Kapitel";
  els.chapterSel.appendChild(optAll);
  for (const ch of chapters) {
    const o = document.createElement("option");
    o.value = String(ch);
    o.textContent = `${ch}. ${chapterTitle(ch)}`;
    els.chapterSel.appendChild(o);
  }

  // topics depend on chapter selection
  refreshTopics();
}

function refreshTopics() {
  const chVal = els.chapterSel.value;
  let qs = bank;
  if (chVal !== "all") {
    const ch = Number(chVal);
    qs = bank.filter(q => q.chapter === ch);
  }
  const topicPairs = uniq(qs.map(q => `${q.topicId}|||${q.topicTitle}`))
    .map(s => {
      const [id, title] = s.split("|||");
      return { id, title };
    })
    .sort((a,b)=>a.id.localeCompare(b.id, "de"));

  const prev = new Set([...els.topicSel.selectedOptions].map(o => o.value));
  els.topicSel.innerHTML = "";
  for (const t of topicPairs) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = `${t.id} ${t.title}`;
    o.selected = prev.has(t.id);
    els.topicSel.appendChild(o);
  }
}

function currentSelection() {
  const chVal = els.chapterSel.value;
  const topicSel = [...els.topicSel.selectedOptions].map(o => o.value);
  const q = els.qSearch.value.trim().toLowerCase();

  let qs = bank;

  if (chVal !== "all") qs = qs.filter(x => x.chapter === Number(chVal));
  if (topicSel.length) qs = qs.filter(x => topicSel.includes(x.topicId));
  if (q) qs = qs.filter(x => (x.question + " " + (x.explanation||"") + " " + x.topicTitle).toLowerCase().includes(q));

  return qs;
}

function updateSelectionInfo() {
  const qs = currentSelection();
  els.selectionInfo.textContent = `${qs.length} Fragen`;
}

function buildRun(fromQuestions) {
  let qs = [...fromQuestions];
  const n = Math.max(5, Math.min(200, Number(els.count.value || 25)));

  if (els.shuffleQ.checked) qs = shuffle(qs);
  qs = qs.slice(0, Math.min(n, qs.length));

  // shuffle answers if requested
  if (els.shuffleA.checked) {
    qs = qs.map(q => {
      const answers = shuffle(q.answers);
      return { ...q, answers };
    });
  }

  return qs;
}

function setView(which) {
  els.welcome.style.display = which === "welcome" ? "" : "none";
  els.quiz.style.display = which === "quiz" ? "" : "none";
  els.result.style.display = which === "result" ? "" : "none";
}

function renderQuestion() {
  locked = false;
  els.nextBtn.disabled = true;
  els.feedback.textContent = "";
  els.explain.style.display = "none";
  els.explain.textContent = "";

  const q = run[idx];
  els.progress.textContent = `Frage ${idx + 1}/${run.length}`;
  els.meta.textContent = `${q.chapter}. ${q.chapterTitle} · ${q.topicId} ${q.topicTitle}` + (q.source?.page ? ` · Quelle: S.${q.source.page}` : "");
  els.question.textContent = q.question;

  els.answers.innerHTML = "";
  q.answers.forEach(a => {
    const btn = document.createElement("button");
    btn.className = "btnChoice";
    btn.textContent = a;
    btn.onclick = () => choose(a, btn);
    els.answers.appendChild(btn);
  });
}

function markStats(q, isCorrect) {
  const s = loadStats();
  const key = `${q.topicId}`;
  s[key] = s[key] || { seen: 0, correct: 0, topicTitle: q.topicTitle, chapter: q.chapter };
  s[key].seen += 1;
  if (isCorrect) s[key].correct += 1;
  saveStats(s);
  updateLocalStatsLabel();
}

function addWrong(qid) {
  const list = loadWrong();
  if (!list.includes(qid)) list.push(qid);
  saveWrong(list);
}

function choose(answer, btn) {
  if (locked) return;
  locked = true;

  const q = run[idx];
  const buttons = [...els.answers.querySelectorAll("button")];
  buttons.forEach(b => b.disabled = true);

  const isCorrect = answer === q.correct;

  if (els.mode.value === "learn") {
    if (isCorrect) {
      btn.classList.add("ok");
      els.feedback.textContent = "✅ Richtig!";
      score += 1;
      correct += 1;
    } else {
      btn.classList.add("bad");
      els.feedback.textContent = `❌ Falsch. Richtig wäre: ${q.correct}`;
      const rightBtn = buttons.find(b => b.textContent === q.correct);
      if (rightBtn) rightBtn.classList.add("ok");
      addWrong(q.id);
    }
    answered += 1;
    markStats(q, isCorrect);
    if (q.explanation) {
      els.explain.style.display = "";
      els.explain.textContent = q.explanation;
    }
    els.score.textContent = String(score);
  } else {
    // exam mode: no immediate evaluation
    btn.classList.add("ok"); // just highlight selection
    els.feedback.textContent = "Antwort gespeichert.";
    examAnswers.push({ qid: q.id, chosen: answer, correct: q.correct, topicId: q.topicId, topicTitle: q.topicTitle });
    answered += 1;
  }

  els.nextBtn.disabled = false;
}

function skip() {
  if (locked) return;
  locked = true;
  els.feedback.textContent = "Übersprungen.";
  const buttons = [...els.answers.querySelectorAll("button")];
  buttons.forEach(b => b.disabled = true);

  if (els.mode.value === "learn") {
    const q = run[idx];
    addWrong(q.id);
    markStats(q, false);
    const rightBtn = buttons.find(b => b.textContent === q.correct);
    if (rightBtn) rightBtn.classList.add("ok");
    if (q.explanation) {
      els.explain.style.display = "";
      els.explain.textContent = q.explanation;
    }
  }
  els.nextBtn.disabled = false;
}

function next() {
  if (idx < run.length - 1) {
    idx += 1;
    renderQuestion();
  } else {
    finish();
  }
}

function topicBreakdownHTML(examComputed) {
  // examComputed: {byTopic: {topicId: {title, correct, total}}}
  const by = examComputed.byTopic;
  const items = Object.entries(by).sort((a,b)=>a[0].localeCompare(b[0],"de"));
  const rows = items.map(([tid, v]) => {
    const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
    return `<div class="row" style="justify-content:space-between">
      <div><strong>${tid}</strong> <span class="muted">${v.title}</span></div>
      <div class="pill">${v.correct}/${v.total} · ${pct}%</div>
    </div>`;
  }).join("");
  return rows || `<div class="muted">Keine Daten.</div>`;
}

function finish() {
  setView("result");

  if (els.mode.value === "learn") {
    const pct = run.length ? Math.round((correct / run.length) * 100) : 0;
    els.summary.textContent = `Du hast ${correct} von ${run.length} richtig (${pct}%).`;
    // simple breakdown from local stats for the topics in run
    const byTopic = {};
    for (const q of run) {
      byTopic[q.topicId] = byTopic[q.topicId] || { title: q.topicTitle, correct: 0, total: 0 };
      byTopic[q.topicId].total += 1;
    }
    // We only know per-run correct by tracking wrong list is not per topic; keep it simple
    els.topicBreakdown.innerHTML = `<div class="muted">Tipp: Detaillierte Quote pro Thema findest du links unter „Verlauf“ (lokal gespeichert).</div>`;
  } else {
    // compute results
    let ok = 0;
    const byTopic = {};
    for (const a of examAnswers) {
      const isCorrect = a.chosen === a.correct;
      if (isCorrect) ok += 1;
      byTopic[a.topicId] = byTopic[a.topicId] || { title: a.topicTitle, correct: 0, total: 0 };
      byTopic[a.topicId].total += 1;
      if (isCorrect) byTopic[a.topicId].correct += 1;
      // persist stats + wrong list
      const q = bank.find(x => x.id === a.qid);
      if (q) markStats(q, isCorrect);
      if (!isCorrect) addWrong(a.qid);
    }
    const pct = run.length ? Math.round((ok / run.length) * 100) : 0;
    els.summary.textContent = `Du hast ${ok} von ${run.length} richtig (${pct}%).`;
    els.topicBreakdown.innerHTML = topicBreakdownHTML({ byTopic });
  }
}

function start(fromQuestions) {
  writeUIToParams();

  filtered = fromQuestions || currentSelection();
  if (!filtered.length) {
    alert("Keine Fragen in der aktuellen Auswahl. Bitte Filter anpassen.");
    return;
  }

  run = buildRun(filtered);
  idx = 0;
  score = 0;
  correct = 0;
  answered = 0;
  examAnswers = [];

  els.score.textContent = "0";
  setView("quiz");
  renderQuestion();
}

function redoWrong() {
  const wrong = loadWrong();
  const qs = bank.filter(q => wrong.includes(q.id));
  if (!qs.length) {
    alert("Keine falschen Fragen gespeichert.");
    return;
  }
  start(qs);
}

function resetStats() {
  localStorage.removeItem(LS_KEY);
  updateLocalStatsLabel();
  alert("Statistik gelöscht (nur lokal).");
}

function clearWrong() {
  localStorage.removeItem(LS_WRONG);
  alert("Review-Liste geleert (nur lokal).");
}

function selectAllTopics() {
  for (const opt of els.topicSel.options) opt.selected = true;
  updateSelectionInfo();
  writeUIToParams();
}

function clearTopics() {
  for (const opt of els.topicSel.options) opt.selected = false;
  updateSelectionInfo();
  writeUIToParams();
}

async function copyLink() {
  writeUIToParams();
  await navigator.clipboard.writeText(location.href);
  els.bankInfo.textContent = "Link kopiert ✅";
  setTimeout(()=> els.bankInfo.textContent = `Fragenbank: ${bank.length}`, 1400);
}

async function init() {
  const res = await fetch("questions.json", { cache: "no-store" });
  bank = await res.json();

  els.bankInfo.textContent = `Fragenbank: ${bank.length}`;

  buildFilterLists();
  applyParamsToUI();
  refreshTopics();
  updateSelectionInfo();
  updateLocalStatsLabel();

  // listeners
  els.chapterSel.onchange = () => { refreshTopics(); updateSelectionInfo(); writeUIToParams(); };
  els.topicSel.onchange = () => { updateSelectionInfo(); writeUIToParams(); };
  els.qSearch.oninput = () => { updateSelectionInfo(); writeUIToParams(); };
  els.shuffleQ.onchange = () => writeUIToParams();
  els.shuffleA.onchange = () => writeUIToParams();
  els.mode.onchange = () => writeUIToParams();
  els.count.onchange = () => writeUIToParams();

  els.selectAllTopicsBtn.onclick = selectAllTopics;
  els.clearTopicsBtn.onclick = clearTopics;

  els.startBtn.onclick = () => start();
  els.nextBtn.onclick = next;
  els.skipBtn.onclick = skip;

  els.restartBtn.onclick = () => start();
  els.reviewWrongBtn.onclick = redoWrong;

  els.redoWrongBtn.onclick = redoWrong;
  els.clearWrongBtn.onclick = clearWrong;

  els.copyLinkBtn.onclick = copyLink;
  els.resetStatsBtn.onclick = resetStats;
}

init().catch(err => {
  console.error(err);
  els.bankInfo.textContent = "Fehler beim Laden (questions.json?)";
});
