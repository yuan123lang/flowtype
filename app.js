const WORD_BANK = window.WORD_BANK || [];

const LEVEL_SIZE = 8;
const STORAGE_KEY = "flowtype_progress_v2";

const EXTRA_INFO = {
  hesitate: { usage: "hesitate to do sth; without hesitation", example: "In the interview, she did not hesitate to explain her research method clearly." },
  allocate: { usage: "allocate A to B; allocate time/resources/funds", example: "The university decided to allocate more funds to language training this semester." },
  interpret: { usage: "interpret sth as sth; interpret data/results", example: "Students must interpret the chart before choosing the best answer in the test." },
  constrain: { usage: "constrain sb/sth to; be constrained by", example: "Limited class time may constrain students from practicing enough writing tasks." },
  fluctuate: { usage: "fluctuate between A and B; prices/levels fluctuate", example: "The unemployment rate tended to fluctuate slightly over the ten-year period." },
  deteriorate: { usage: "deteriorate rapidly/gradually; conditions deteriorate", example: "Without regular review, vocabulary retention may deteriorate within a few weeks." },
  plausible: { usage: "a plausible explanation/argument/reason", example: "The author offers a plausible explanation for the decline in reading habits." },
  coherent: { usage: "a coherent argument/account; remain coherent", example: "A high-scoring essay should present a coherent structure from start to finish." },
  subtle: { usage: "a subtle difference/change/hint", example: "The passage draws a subtle distinction between habit and deliberate practice." },
  inevitable: { usage: "it is inevitable that; seem inevitable", example: "Given the trend, it seems inevitable that online testing will become more common." },
  compile: { usage: "compile data/list/report", example: "Researchers compiled the survey data before writing the final conclusion." },
  retain: { usage: "retain information/memory/control", example: "Spaced repetition helps learners retain new words for a longer period." },
  adjacent: { usage: "adjacent to; in adjacent areas", example: "The chart compares reading scores in two adjacent regions of the country." },
  notion: { usage: "the notion of; challenge/support a notion", example: "The article challenges the notion that talent matters more than effort." },
  comprise: { usage: "comprise A, B and C; be comprised of", example: "The final exam may comprise listening, reading, writing and translation sections." },
  rigorous: { usage: "rigorous analysis/method/training", example: "The study followed a rigorous method to ensure reliable academic findings." },
  transient: { usage: "transient effect/state/feeling", example: "The writer argues that motivation is often transient without clear goals." },
  intrinsic: { usage: "intrinsic motivation/value/quality", example: "Intrinsic motivation usually leads to more stable long-term learning behavior." },
  facilitate: { usage: "facilitate communication/learning/process", example: "Visual notes can facilitate comprehension in long academic passages." },
  derive: { usage: "derive A from B; derive benefit/insight", example: "Students can derive the main idea from topic sentences in each paragraph." },
  profound: { usage: "a profound impact/effect/change", example: "Regular feedback has a profound impact on writing performance in exams." },
  deviate: { usage: "deviate from a plan/path/rule", example: "Candidates should not deviate from the task requirement in timed essays." },
  convention: { usage: "by convention; social/cultural convention", example: "By convention, formal emails in English begin with a polite opening line." },
  meticulous: { usage: "meticulous planning/record/attention", example: "Meticulous planning is essential for completing all sections within exam time." },
  intact: { usage: "remain intact; keep sth intact", example: "The key message remained intact after the text was summarized by students." },
  attribute: { usage: "attribute A to B; be attributed to", example: "The improvement was attributed to daily review and error-focused practice." },
  perspective: { usage: "a perspective on; from a perspective", example: "The second paragraph presents a different perspective on bilingual education." },
  subsequent: { usage: "subsequent to; in subsequent years", example: "Subsequent studies confirmed the trend reported in the original paper." },
  empirical: { usage: "empirical evidence/research/data", example: "The claim is supported by empirical evidence collected from classroom tests." },
  sustain: { usage: "sustain growth/progress/attention", example: "Short daily sessions are easier to sustain than irregular long study marathons." }
};

const words = WORD_BANK.map((w) => ({ ...w }));
const wordsById = new Map(words.map((w) => [w.id, w]));
const TOTAL_LEVELS = Math.max(1, Math.ceil(words.length / LEVEL_SIZE));

const ui = {
  homeScreen: document.getElementById("homeScreen"),
  gameScreen: document.getElementById("gameScreen"),
  treeLeaves: document.getElementById("treeLeaves"),
  levelInfo: document.getElementById("levelInfo"),
  leafInfo: document.getElementById("leafInfo"),
  mistakeInfo: document.getElementById("mistakeInfo"),
  mistakeList: document.getElementById("mistakeList"),
  startLevelBtn: document.getElementById("startLevelBtn"),
  startReviewBtn: document.getElementById("startReviewBtn"),
  toggleSoundBtn: document.getElementById("toggleSoundBtn"),

  typingCard: document.getElementById("typingCard"),
  backHomeBtn: document.getElementById("backHomeBtn"),
  modeBadge: document.getElementById("modeBadge"),
  phonetic: document.getElementById("phonetic"),
  meaning: document.getElementById("meaning"),
  wordDisplay: document.getElementById("wordDisplay"),
  progress: document.getElementById("progress"),
  liveWpm: document.getElementById("liveWpm"),
  liveAcc: document.getElementById("liveAcc"),
  skipBtn: document.getElementById("skipBtn"),

  detailPanel: document.getElementById("detailPanel"),
  detailWord: document.getElementById("detailWord"),
  detailPhonetic: document.getElementById("detailPhonetic"),
  detailMeaning: document.getElementById("detailMeaning"),
  detailUsage: document.getElementById("detailUsage"),
  detailExample: document.getElementById("detailExample"),
  detailSpeakBtn: document.getElementById("detailSpeakBtn"),
  detailNextBtn: document.getElementById("detailNextBtn"),

  resultPanel: document.getElementById("resultPanel"),
  resultTitle: document.getElementById("resultTitle"),
  resultText: document.getElementById("resultText"),
  nextActionBtn: document.getElementById("nextActionBtn"),
  toHomeBtn: document.getElementById("toHomeBtn")
};

const state = {
  profile: loadProfile(),
  soundEnabled: true,
  mode: "idle",
  pool: [],
  queue: [],
  completedWords: 0,
  skippedWords: 0,
  currentWord: null,
  charIndex: 0,
  currentWordErrors: 0,
  roundCorrectKeys: 0,
  roundWrongKeys: 0,
  roundStart: Date.now(),
  wordStart: Date.now(),
  flashError: false,
  gameFinished: false,
  showingDetail: false,
  speaking: false
};

let audioCtx = null;
let speechSynthesisRef = null;
let preferredVoice = null;
let voicesBound = false;

function defaultProfile() {
  return {
    completedLevels: 0,
    leaves: 0,
    mistakes: {}
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    return {
      completedLevels: Number(parsed.completedLevels || 0),
      leaves: Number(parsed.leaves || 0),
      mistakes: parsed.mistakes || {}
    };
  } catch {
    return defaultProfile();
  }
}

function saveProfile() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
}

function switchScreen(screen) {
  ui.homeScreen.classList.toggle("active", screen === "home");
  ui.gameScreen.classList.toggle("active", screen === "game");
}

function uniqueMistakeCount() {
  return Object.keys(state.profile.mistakes).length;
}

function totalMistakeCount() {
  return Object.values(state.profile.mistakes).reduce((a, b) => a + Number(b || 0), 0);
}

function renderTree() {
  const count = Math.max(0, state.profile.leaves);
  ui.treeLeaves.innerHTML = "";

  for (let i = 0; i < count; i += 1) {
    const leaf = document.createElement("span");
    leaf.className = "leaf";
    const x = ((i * 37) % 180) + 12;
    const y = ((i * 53) % 100) + 8;
    const r = ((i * 19) % 70) - 35;
    leaf.style.left = `${x}px`;
    leaf.style.top = `${y}px`;
    leaf.style.transform = `rotate(${r}deg)`;
    ui.treeLeaves.appendChild(leaf);
  }
}

function renderMistakeList() {
  const entries = Object.entries(state.profile.mistakes)
    .map(([id, n]) => ({ word: wordsById.get(id), count: Number(n || 0) }))
    .filter((e) => e.word)
    .sort((a, b) => b.count - a.count);

  ui.mistakeList.innerHTML = "";
  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "当前无错题";
    ui.mistakeList.appendChild(li);
    return;
  }

  entries.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.word.word} (${item.word.meaning}) x${item.count}`;
    ui.mistakeList.appendChild(li);
  });
}

function renderHome() {
  ui.levelInfo.textContent = `关卡 ${Math.min(state.profile.completedLevels, TOTAL_LEVELS)} / ${TOTAL_LEVELS}`;
  ui.leafInfo.textContent = `叶子 ${state.profile.leaves}`;
  ui.mistakeInfo.textContent = `错题 ${totalMistakeCount()}`;
  ui.startReviewBtn.disabled = uniqueMistakeCount() === 0;
  ui.startLevelBtn.disabled = state.profile.completedLevels >= TOTAL_LEVELS;
  renderTree();
  renderMistakeList();
}

function applyTimeTheme() {
  const hour = new Date().getHours();
  const root = document.documentElement;
  if (hour >= 6 && hour < 17) {
    root.style.setProperty("--bg-a", "#eef9ff");
    root.style.setProperty("--bg-b", "#e8edf9");
  } else if (hour >= 17 && hour < 20) {
    root.style.setProperty("--bg-a", "#fff7ed");
    root.style.setProperty("--bg-b", "#fee2e2");
  } else {
    root.style.setProperty("--bg-a", "#e0f2fe");
    root.style.setProperty("--bg-b", "#dbeafe");
  }
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
}

function playTone(freq, duration = 0.07, type = "sine", gainValue = 0.04) {
  if (!state.soundEnabled) return;
  ensureAudioContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function playCorrectSound() {
  playTone(760, 0.05, "triangle", 0.03);
}

function playWrongSound() {
  playTone(180, 0.09, "sawtooth", 0.05);
}

function playLevelUpSound() {
  playTone(520, 0.08, "sine", 0.04);
  setTimeout(() => playTone(760, 0.1, "sine", 0.04), 80);
}

function getWordExtra(wordObj) {
  return EXTRA_INFO[wordObj.word] || {
    usage: `常见用法: ${wordObj.word} + 常见搭配（结合上下文记忆）`,
    example: `The passage uses ${wordObj.word} in an academic context.`
  };
}

function scoreVoice(voice) {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 0;

  if (name.includes("en-us")) score += 6;
  if (name.includes("en-gb")) score += 4;
  if (name.includes("english")) score += 3;
  if (name.includes("natural") || name.includes("neural") || name.includes("enhanced")) score += 8;
  if (name.includes("microsoft") || name.includes("google") || name.includes("samantha")) score += 4;
  if (voice.default) score += 2;

  return score;
}

function syncPreferredVoice() {
  if (!speechSynthesisRef) return;

  const voices = speechSynthesisRef.getVoices().filter((voice) => {
    const lang = (voice.lang || "").toLowerCase();
    const name = (voice.name || "").toLowerCase();
    return lang.startsWith("en") || name.includes("english");
  });

  preferredVoice = voices.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
  updateSpeechButton();
}

function initSpeech() {
  if (!("speechSynthesis" in window)) {
    updateSpeechButton();
    return;
  }

  speechSynthesisRef = window.speechSynthesis;
  syncPreferredVoice();

  if (voicesBound) return;
  voicesBound = true;

  if (typeof speechSynthesisRef.addEventListener === "function") {
    speechSynthesisRef.addEventListener("voiceschanged", syncPreferredVoice);
  } else {
    speechSynthesisRef.onvoiceschanged = syncPreferredVoice;
  }
}

function updateSpeechButton() {
  if (!ui.detailSpeakBtn) return;

  if (!speechSynthesisRef) {
    ui.detailSpeakBtn.disabled = true;
    ui.detailSpeakBtn.textContent = "无发音";
    return;
  }

  ui.detailSpeakBtn.disabled = state.speaking;
  ui.detailSpeakBtn.textContent = state.speaking ? "播放中..." : "发音 + 例句";
}

function stopSpeech() {
  if (!speechSynthesisRef) return;
  speechSynthesisRef.cancel();
  state.speaking = false;
  updateSpeechButton();
}

function createUtterance(text, options = {}) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.lang || preferredVoice?.lang || "en-US";
  utterance.rate = options.rate ?? 0.86;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  return utterance;
}

function speakWord(word, example = "") {
  initSpeech();
  if (!speechSynthesisRef) return;

  stopSpeech();
  state.speaking = true;
  updateSpeechButton();

  const queue = [
    createUtterance(word, { rate: 0.8, pitch: 0.96 }),
    createUtterance(word, { rate: 0.66, pitch: 1.02 })
  ];

  if (example) {
    queue.push(createUtterance(example, { rate: 0.88, pitch: 1 }));
  }

  let index = 0;

  const playNext = () => {
    if (index >= queue.length) {
      state.speaking = false;
      updateSpeechButton();
      return;
    }

    const utterance = queue[index];
    index += 1;

    utterance.onend = () => {
      window.setTimeout(playNext, index === 1 ? 120 : 180);
    };

    utterance.onerror = () => {
      state.speaking = false;
      updateSpeechButton();
    };

    speechSynthesisRef.speak(utterance);
  };

  playNext();
}

function calcWpm() {
  const mins = Math.max((Date.now() - state.roundStart) / 60000, 1 / 60000);
  return Math.round((state.roundCorrectKeys / 5) / mins);
}

function calcAccuracy() {
  const total = state.roundCorrectKeys + state.roundWrongKeys;
  if (!total) return 100;
  return Math.round((state.roundCorrectKeys / total) * 100);
}

function pickNextWord() {
  if (!state.queue.length) return null;
  const maxWeight = Math.max(...state.queue.map((w) => w.weight));
  const candidates = state.queue.filter((w) => w.weight === maxWeight);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function removeWordFromQueue(wordId) {
  state.queue = state.queue.filter((w) => w.id !== wordId);
}

function maskSlots(word, typedCount, flashError) {
  ui.wordDisplay.innerHTML = "";
  for (let i = 0; i < word.length; i += 1) {
    const span = document.createElement("span");
    span.className = "slot";

    if (i < typedCount) {
      span.textContent = word[i];
      span.classList.add("typed");
    } else {
      span.textContent = "_";
      if (i === typedCount) span.classList.add("current");
      if (i === typedCount && flashError) span.classList.add("error");
    }

    ui.wordDisplay.appendChild(span);
  }
}

function renderCurrentWord() {
  if (!state.currentWord) return;
  ui.phonetic.textContent = state.currentWord.phonetic;
  ui.meaning.textContent = state.currentWord.meaning;
  maskSlots(state.currentWord.word, state.charIndex, state.flashError);
}

function renderLiveStats() {
  const total = state.pool.length;
  ui.progress.textContent = `${state.completedWords} / ${total}`;
  ui.liveWpm.textContent = `WPM ${calcWpm()}`;
  ui.liveAcc.textContent = `Accuracy ${calcAccuracy()}%`;
}

function openResult(title, text, nextLabel) {
  state.gameFinished = true;
  ui.resultTitle.textContent = title;
  ui.resultText.textContent = text;
  ui.nextActionBtn.textContent = nextLabel;
  ui.resultPanel.classList.add("show");
  ui.resultPanel.setAttribute("aria-hidden", "false");
}

function closeResult() {
  state.gameFinished = false;
  ui.resultPanel.classList.remove("show");
  ui.resultPanel.setAttribute("aria-hidden", "true");
}

function showDetailPanel(wordObj) {
  const extra = getWordExtra(wordObj);

  state.showingDetail = true;
  ui.detailWord.textContent = wordObj.word;
  ui.detailPhonetic.textContent = `发音: ${wordObj.phonetic}`;
  ui.detailMeaning.textContent = `意思: ${wordObj.meaning}`;
  ui.detailUsage.textContent = `用法: ${extra.usage}`;
  ui.detailExample.textContent = `考试例句: ${extra.example}`;

  ui.detailPanel.classList.add("show");
  ui.detailPanel.setAttribute("aria-hidden", "false");
  updateSpeechButton();
  window.setTimeout(() => {
    if (state.showingDetail && state.currentWord?.id === wordObj.id) {
      speakWord(wordObj.word, extra.example);
    }
  }, 120);
}

function hideDetailPanel() {
  state.showingDetail = false;
  stopSpeech();
  ui.detailPanel.classList.remove("show");
  ui.detailPanel.setAttribute("aria-hidden", "true");
}

function markMistake(wordId) {
  const current = Number(state.profile.mistakes[wordId] || 0);
  state.profile.mistakes[wordId] = current + 1;
}

function relieveMistake(wordId) {
  const current = Number(state.profile.mistakes[wordId] || 0);
  if (current <= 1) {
    delete state.profile.mistakes[wordId];
  } else {
    state.profile.mistakes[wordId] = current - 1;
  }
}

function shakeGameCard() {
  ui.typingCard.classList.remove("shake");
  void ui.typingCard.offsetWidth;
  ui.typingCard.classList.add("shake");
}

function nextWordOrFinish() {
  state.currentWord = pickNextWord();

  if (!state.currentWord) {
    const summary = `WPM ${calcWpm()} · Accuracy ${calcAccuracy()}% · 跳过 ${state.skippedWords} 词`;
    if (state.mode === "level") {
      state.profile.completedLevels += 1;
      state.profile.leaves += 8;
      saveProfile();
      playLevelUpSound();
      openResult("本关完成", `${summary}。小树长出新叶子。`, "下一关");
    } else {
      saveProfile();
      openResult("复习完成", `${summary}。错题本已更新。`, "返回首页");
    }
    return;
  }

  state.charIndex = 0;
  state.currentWordErrors = 0;
  state.wordStart = Date.now();
  state.flashError = false;
  renderCurrentWord();
  renderLiveStats();
}

function startSession(mode, wordPool) {
  stopSpeech();
  state.mode = mode;
  state.pool = wordPool.map((w) => ({ ...w }));
  state.queue = state.pool.map((w) => ({ ...w }));
  state.completedWords = 0;
  state.skippedWords = 0;
  state.roundCorrectKeys = 0;
  state.roundWrongKeys = 0;
  state.roundStart = Date.now();
  state.gameFinished = false;
  state.showingDetail = false;
  closeResult();
  hideDetailPanel();

  if (mode === "level") {
    ui.modeBadge.textContent = `闯关模式 · 第 ${state.profile.completedLevels + 1} 关`;
  } else {
    ui.modeBadge.textContent = "错题复习";
  }

  switchScreen("game");
  nextWordOrFinish();
}

function startNextLevel() {
  if (state.profile.completedLevels >= TOTAL_LEVELS) return;
  const start = state.profile.completedLevels * LEVEL_SIZE;
  const pool = words.slice(start, start + LEVEL_SIZE);
  startSession("level", pool);
}

function startReview() {
  const ids = Object.keys(state.profile.mistakes);
  const pool = ids.map((id) => wordsById.get(id)).filter(Boolean);
  if (!pool.length) return;
  startSession("review", pool);
}

function handleBackspace() {
  if (state.charIndex > 0) {
    state.charIndex -= 1;
    renderCurrentWord();
  }
}

function finishCurrentWord(options = {}) {
  const { skipped = false } = options;
  const solvedWord = state.currentWord;
  const spentSec = (Date.now() - state.wordStart) / 1000;

  solvedWord.weight += (state.currentWordErrors * 2) + (spentSec > 5 ? 1 : 0);

  if (skipped) {
    state.skippedWords += 1;
  }

  if (state.mode === "review" && state.currentWordErrors === 0 && !skipped) {
    relieveMistake(solvedWord.id);
  }

  removeWordFromQueue(solvedWord.id);
  state.completedWords += 1;

  if (skipped) {
    nextWordOrFinish();
  } else {
    showDetailPanel(solvedWord);
  }
}

function handleSkipWord() {
  if (!state.currentWord || state.gameFinished || state.showingDetail) return;
  markMistake(state.currentWord.id);
  state.roundWrongKeys += 1;
  state.currentWordErrors += 1;
  playWrongSound();
  finishCurrentWord({ skipped: true });
  renderLiveStats();
}

function onKeyDown(event) {
  if (!ui.gameScreen.classList.contains("active")) return;
  if (!state.currentWord || state.gameFinished || state.showingDetail) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    handleBackspace();
    return;
  }

  if (!/^[a-zA-Z]$/.test(event.key)) return;
  event.preventDefault();

  const input = event.key.toLowerCase();
  const expected = state.currentWord.word[state.charIndex].toLowerCase();

  if (input === expected) {
    state.charIndex += 1;
    state.roundCorrectKeys += 1;
    playCorrectSound();
    renderCurrentWord();

    if (state.charIndex >= state.currentWord.word.length) {
      finishCurrentWord({ skipped: false });
    }
  } else {
    state.roundWrongKeys += 1;
    state.currentWordErrors += 1;
    markMistake(state.currentWord.id);
    playWrongSound();
    state.flashError = true;
    shakeGameCard();
    renderCurrentWord();
    setTimeout(() => {
      state.flashError = false;
      renderCurrentWord();
    }, 130);
  }

  renderLiveStats();
}

function bindEvents() {
  ui.startLevelBtn.addEventListener("click", () => {
    ensureAudioContext();
    startNextLevel();
  });

  ui.startReviewBtn.addEventListener("click", () => {
    ensureAudioContext();
    startReview();
  });

  ui.skipBtn.addEventListener("click", () => {
    ensureAudioContext();
    handleSkipWord();
  });

  ui.backHomeBtn.addEventListener("click", () => {
    stopSpeech();
    saveProfile();
    renderHome();
    switchScreen("home");
  });

  ui.toHomeBtn.addEventListener("click", () => {
    stopSpeech();
    saveProfile();
    renderHome();
    switchScreen("home");
  });

  ui.nextActionBtn.addEventListener("click", () => {
    if (state.mode === "review") {
      saveProfile();
      renderHome();
      switchScreen("home");
      return;
    }

    if (state.profile.completedLevels >= TOTAL_LEVELS) {
      saveProfile();
      renderHome();
      switchScreen("home");
      return;
    }

    startNextLevel();
  });

  ui.detailNextBtn.addEventListener("click", () => {
    if (!state.showingDetail) return;
    hideDetailPanel();
    nextWordOrFinish();
  });

  ui.detailSpeakBtn.addEventListener("click", () => {
    const wordObj = state.currentWord;
    if (!wordObj && !ui.detailWord.textContent) return;
    const word = ui.detailWord.textContent || wordObj.word;
    const example = wordObj ? getWordExtra(wordObj).example : "";
    speakWord(word, example);
  });

  ui.toggleSoundBtn.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    ui.toggleSoundBtn.textContent = `音效: ${state.soundEnabled ? "开" : "关"}`;
  });

  window.addEventListener("keydown", onKeyDown);
}

function init() {
  applyTimeTheme();
  initSpeech();
  bindEvents();
  renderHome();
  switchScreen("home");
}

init();
