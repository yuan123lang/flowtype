const TOKEN_KEY = "flowtype_auth_token_v1";
const BOOK_KEY_STORE = "flowtype_selected_book_v1";
const MAX_WORD_WEIGHT = 12;
const REPEAT_COOLDOWN_TURNS = 2;
const SKIP_WEIGHT_PENALTY = 3;
const DEFAULT_AVATAR_DATA = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23dbe7de'/%3E%3Ccircle cx='60' cy='46' r='22' fill='%2391a79a'/%3E%3Crect x='28' y='74' width='64' height='28' rx='14' fill='%2391a79a'/%3E%3C/svg%3E";
const API_BASE = (() => {
  const sameOriginHttp = /^https?:$/i.test(window.location.protocol);
  if (sameOriginHttp && window.location.port === "5173") return "";
  return "http://127.0.0.1:5173";
})();

const ui = {
  authScreen: document.getElementById("authScreen"),
  homeScreen: document.getElementById("homeScreen"),
  gameScreen: document.getElementById("gameScreen"),

  showLoginBtn: document.getElementById("showLoginBtn"),
  showRegisterBtn: document.getElementById("showRegisterBtn"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  registerUsername: document.getElementById("registerUsername"),
  registerDisplayName: document.getElementById("registerDisplayName"),
  registerPassword: document.getElementById("registerPassword"),
  registerAvatar: document.getElementById("registerAvatar"),
  avatarPreview: document.getElementById("avatarPreview"),
  authMessage: document.getElementById("authMessage"),

  userAvatar: document.getElementById("userAvatar"),
  userName: document.getElementById("userName"),
  todayDate: document.getElementById("todayDate"),
  todayQuote: document.getElementById("todayQuote"),
  openProfileBtn: document.getElementById("openProfileBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  profileModal: document.getElementById("profileModal"),
  profileBackdrop: document.getElementById("profileBackdrop"),
  closeProfileBtn: document.getElementById("closeProfileBtn"),
  profileCancelBtn: document.getElementById("profileCancelBtn"),
  profileSaveBtn: document.getElementById("profileSaveBtn"),
  profileAvatarInput: document.getElementById("profileAvatarInput"),
  profileAvatarPreview: document.getElementById("profileAvatarPreview"),
  profileDisplayNameInput: document.getElementById("profileDisplayNameInput"),
  profileMessage: document.getElementById("profileMessage"),
  profileUsername: document.getElementById("profileUsername"),
  profileCreatedAt: document.getElementById("profileCreatedAt"),
  profileBookName: document.getElementById("profileBookName"),
  profileTodayMinutes: document.getElementById("profileTodayMinutes"),
  profileWeekMinutes: document.getElementById("profileWeekMinutes"),
  profileMasteredDue: document.getElementById("profileMasteredDue"),
  profileAiStatus: document.getElementById("profileAiStatus"),
  profileApiEnabled: document.getElementById("profileApiEnabled"),
  profileApiBaseUrlInput: document.getElementById("profileApiBaseUrlInput"),
  profileApiModelInput: document.getElementById("profileApiModelInput"),
  profileApiKeyInput: document.getElementById("profileApiKeyInput"),
  profileApiSystemPromptInput: document.getElementById("profileApiSystemPromptInput"),

  bookSelect: document.getElementById("bookSelect"),
  startSmartBtn: document.getElementById("startSmartBtn"),
  startHardestBtn: document.getElementById("startHardestBtn"),
  checkinBtn: document.getElementById("checkinBtn"),
  todayDuration: document.getElementById("todayDuration"),
  weekDuration: document.getElementById("weekDuration"),
  dueCount: document.getElementById("dueCount"),
  checkinStatus: document.getElementById("checkinStatus"),

  newCount: document.getElementById("newCount"),
  learningCount: document.getElementById("learningCount"),
  masteredCount: document.getElementById("masteredCount"),
  lastReviewAt: document.getElementById("lastReviewAt"),

  trendMinutes: document.getElementById("trendMinutes"),
  trendAccuracy: document.getElementById("trendAccuracy"),
  trendSkipRate: document.getElementById("trendSkipRate"),

  mistakeBookFilter: document.getElementById("mistakeBookFilter"),
  mistakeSortFilter: document.getElementById("mistakeSortFilter"),
  refreshMistakesBtn: document.getElementById("refreshMistakesBtn"),
  mistakeList: document.getElementById("mistakeList"),

  backHomeBtn: document.getElementById("backHomeBtn"),
  modeBadge: document.getElementById("modeBadge"),
  progress: document.getElementById("progress"),
  liveWpm: document.getElementById("liveWpm"),
  liveAcc: document.getElementById("liveAcc"),
  phonetic: document.getElementById("phonetic"),
  meaning: document.getElementById("meaning"),
  wordDisplay: document.getElementById("wordDisplay"),
  skipBtn: document.getElementById("skipBtn"),
  endSessionBtn: document.getElementById("endSessionBtn"),

  insightWord: document.getElementById("insightWord"),
  insightPhonetic: document.getElementById("insightPhonetic"),
  insightMeaning: document.getElementById("insightMeaning"),
  insightUsage: document.getElementById("insightUsage"),
  insightExample: document.getElementById("insightExample"),
  insightMnemonic: document.getElementById("insightMnemonic"),
  insightSpeakBtn: document.getElementById("insightSpeakBtn"),

  resultPanel: document.getElementById("resultPanel"),
  resultTitle: document.getElementById("resultTitle"),
  resultText: document.getElementById("resultText"),
  resultHomeBtn: document.getElementById("resultHomeBtn")
};

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: null,
  books: [],
  selectedBookKey: localStorage.getItem(BOOK_KEY_STORE) || "",
  summary: null,
  progress: null,
  mistakes: [],

  soundEnabled: true,
  sessionMode: "",
  queue: [],
  pool: [],
  currentWord: null,
  charIndex: 0,
  currentWrong: 0,
  currentMissed: false,
  roundCorrectKeys: 0,
  roundWrongKeys: 0,
  roundStartMs: 0,
  wordStartMs: 0,
  completedWords: 0,
  skippedWords: 0,
  gameFinished: false,
  isAdvancing: false,

  insightWord: null,
  insightReqId: 0,
  speaking: false,
  preferredVoice: null,

  studyTimerStart: 0,
  studyReportedSeconds: 0,
  studyTicking: false,
  studyIntervalId: null,

  profileDraftAvatarData: "",
  aiSettings: null
};

let audioCtx = null;
let speechSynthesisRef = null;

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, Number(num)));
}

function formatDateText(dateText) {
  if (!dateText) return "--";
  const [y, m, d] = String(dateText).split("-");
  if (!y || !m || !d) return String(dateText);
  return `${y}年${m}月${d}日`;
}

function formatTimeText(seconds) {
  const sec = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(sec / 60);
  const hours = Math.floor(mins / 60);
  const remain = mins % 60;
  return hours > 0 ? `${hours}小时${remain}分钟` : `${mins}分钟`;
}

function showScreen(name) {
  ui.authScreen.classList.toggle("active", name === "auth");
  ui.homeScreen.classList.toggle("active", name === "home");
  ui.gameScreen.classList.toggle("active", name === "game");
}

function setAuthMessage(text, isError = true) {
  ui.authMessage.textContent = text || "";
  ui.authMessage.style.color = isError ? "#b05b34" : "#1e7a4b";
}

function setProfileMessage(text, isError = true) {
  if (!ui.profileMessage) return;
  ui.profileMessage.textContent = text || "";
  ui.profileMessage.style.color = isError ? "#b05b34" : "#1e7a4b";
}

function mapAuthError(errorCode, fallback = "") {
  const map = {
    invalid_username: "用户名不合法：仅支持 3-24 位英文/数字/下划线。",
    password_too_short: "密码太短：至少 6 位。",
    invalid_display_name: "显示名不合法：不能为空且不超过 32 字符。",
    avatar_too_large: "头像过大，请换一张更小的图片。",
    username_exists: "用户名已被占用，请更换用户名。",
    invalid_credentials: "用户名或密码错误。",
    session_expired: "登录已过期，请重新登录。",
    unauthorized: "未登录或登录状态失效。",
    payload_too_large: "上传内容过大，请换一张更小的头像图片。",
    invalid_ai_settings: "AI 配置不合法，请检查地址、密钥和模型。",
    invalid_ai_base_url: "AI 地址不合法：必须以 http:// 或 https:// 开头。",
    "413": "上传内容过大，请换一张更小的头像图片。"
  };
  return map[String(errorCode || "")] || fallback || "操作失败，请稍后重试。";
}

function toReadableError(error) {
  const raw = String(error?.message || "");
  if (!raw) return "操作失败，请稍后重试。";
  if (raw === "network_unreachable" || /failed to fetch/i.test(raw)) {
    return "无法连接后端服务，请先在 G:\\Flowtype 执行 npm start。";
  }
  return mapAuthError(raw, raw);
}

function normalizeUsername(raw) {
  return String(raw || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\s]/g, "")
    .toLowerCase()
    .trim();
}

function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (!username) return { ok: false, message: "用户名不能为空。" };
  if (username.length < 3 || username.length > 24) {
    return { ok: false, message: "用户名长度需为 3-24 位。" };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    const bad = [...username].find((ch) => !/[a-z0-9_]/.test(ch));
    if (bad) {
      const code = `U+${bad.codePointAt(0).toString(16).toUpperCase()}`;
      const badLabel = /\s/.test(bad) ? "空白字符" : bad;
      return {
        ok: false,
        message: `用户名包含非法字符 "${badLabel}" (${code})，仅支持英文/数字/下划线。`
      };
    }
    return { ok: false, message: "用户名包含非法字符（仅支持英文/数字/下划线）。" };
  }
  return { ok: true, username };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_file_failed"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.src = dataUrl;
  });
}

async function compressAvatarToDataUrl(file) {
  const raw = await readFileAsDataURL(file);
  const img = await loadImageFromDataUrl(raw);
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", 0.82);
}

function authHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return headers;
}

async function request(url, options = {}) {
  const { headers: customHeaders = {}, ...restOptions } = options;
  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      ...restOptions,
      headers: authHeaders(customHeaders)
    });
  } catch {
    throw new Error("network_unreachable");
  }

  if (res.status === 401) {
    logoutLocal();
    throw new Error("登录已失效，请重新登录。");
  }
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      message = `${res.status}`;
    }
    throw new Error(message);
  }
  return res.json();
}

function logoutLocal() {
  state.token = "";
  state.user = null;
  state.profileDraftAvatarData = "";
  localStorage.removeItem(TOKEN_KEY);
  stopStudyTicker();
  closeProfileModal();
  showScreen("auth");
}

function saveToken(token) {
  state.token = token;
  localStorage.setItem(TOKEN_KEY, token);
}

function ensureAudioContext() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) audioCtx = new AC();
}

function playTone(freq, duration = 0.06, type = "triangle", gainValue = 0.03) {
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

function scoreVoice(voice) {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 0;
  if (name.includes("en-us")) score += 5;
  if (name.includes("english")) score += 3;
  if (name.includes("natural") || name.includes("neural")) score += 5;
  if (voice.default) score += 2;
  return score;
}

function initSpeech() {
  if (!("speechSynthesis" in window)) return;
  speechSynthesisRef = window.speechSynthesis;
  const sync = () => {
    const voices = speechSynthesisRef.getVoices().filter((voice) => {
      const name = `${voice.name} ${voice.lang}`.toLowerCase();
      return name.includes("english") || String(voice.lang || "").toLowerCase().startsWith("en");
    });
    state.preferredVoice = voices.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
  };
  sync();
  speechSynthesisRef.addEventListener("voiceschanged", sync);
}

function createUtterance(text, options = {}) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = options.lang || state.preferredVoice?.lang || "en-US";
  utter.rate = options.rate ?? 0.88;
  utter.pitch = options.pitch ?? 1;
  if (state.preferredVoice) utter.voice = state.preferredVoice;
  return utter;
}

function speakWord(word, example = "") {
  if (!speechSynthesisRef || !word) return;
  speechSynthesisRef.cancel();
  state.speaking = true;
  ui.insightSpeakBtn.disabled = true;

  const queue = [
    createUtterance(word, { rate: 0.8, pitch: 0.95 }),
    createUtterance(word, { rate: 0.65, pitch: 1.02 })
  ];
  if (example) queue.push(createUtterance(example, { rate: 0.9 }));

  let idx = 0;
  const next = () => {
    if (idx >= queue.length) {
      state.speaking = false;
      ui.insightSpeakBtn.disabled = !state.insightWord;
      return;
    }
    const utter = queue[idx];
    idx += 1;
    utter.onend = () => setTimeout(next, 120);
    utter.onerror = () => {
      state.speaking = false;
      ui.insightSpeakBtn.disabled = !state.insightWord;
    };
    speechSynthesisRef.speak(utter);
  };
  next();
}

function renderBooks() {
  ui.bookSelect.innerHTML = "";
  ui.mistakeBookFilter.innerHTML = `<option value="all">全部</option>`;

  state.books.forEach((book) => {
    const opt = document.createElement("option");
    opt.value = book.bookKey;
    opt.textContent = book.name;
    opt.selected = book.bookKey === state.selectedBookKey;
    ui.bookSelect.appendChild(opt);

    const mOpt = document.createElement("option");
    mOpt.value = book.bookKey;
    mOpt.textContent = book.name;
    ui.mistakeBookFilter.appendChild(mOpt);
  });
  renderProfileSummary();
}

function renderSparkline(el, points, formatter, invert = false) {
  el.innerHTML = "";
  const safePoints = points.length ? points : Array.from({ length: 7 }).map(() => ({ date: "--/--", value: 0 }));
  const max = Math.max(...safePoints.map((item) => Number(item.value || 0)), 1);

  safePoints.forEach((item) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    const bar = document.createElement("i");
    const raw = Number(item.value || 0);
    const percent = clamp(raw / max, 0.08, 1);
    bar.style.height = `${Math.round(percent * 58 + 10)}px`;
    if (invert) {
      const green = Math.round((1 - raw) * 100);
      bar.style.background = `linear-gradient(180deg, hsl(${green} 46% 56%), hsl(${green} 50% 36%))`;
    }
    const label = document.createElement("b");
    label.textContent = formatter(raw);
    col.title = `${item.date} ${label.textContent}`;
    col.appendChild(bar);
    col.appendChild(label);
    el.appendChild(col);
  });
}

function renderSummary() {
  if (!state.summary) return;
  ui.todayDate.textContent = formatDateText(state.summary.today);
  ui.todayQuote.textContent = state.summary.quote || "保持节奏。";
  ui.todayDuration.textContent = formatTimeText(state.summary.todaySeconds || 0);
  const week = Array.isArray(state.summary.week) ? state.summary.week : [];
  const weekTotal = week.reduce((sum, day) => sum + Number(day.seconds || 0), 0);
  ui.weekDuration.textContent = formatTimeText(weekTotal);
  ui.checkinStatus.textContent = state.summary.checkedIn ? "已打卡" : "未打卡";
  ui.checkinBtn.disabled = Boolean(state.summary.checkedIn);
  ui.checkinBtn.textContent = state.summary.checkedIn ? "今日已打卡" : "今日打卡";

  const minutePoints = week.map((day) => ({
    date: String(day.date || "").slice(5).replace("-", "/"),
    value: Math.round(Number(day.seconds || 0) / 60)
  }));
  const accPoints = week.map((day) => ({
    date: String(day.date || "").slice(5).replace("-", "/"),
    value: Math.round(Number(day.accuracy || 0) * 100)
  }));
  const skipPoints = week.map((day) => ({
    date: String(day.date || "").slice(5).replace("-", "/"),
    value: Math.round(Number(day.skipRate || 0) * 100)
  }));

  renderSparkline(ui.trendMinutes, minutePoints, (v) => `${v}m`);
  renderSparkline(ui.trendAccuracy, accPoints, (v) => `${v}%`);
  renderSparkline(ui.trendSkipRate, skipPoints, (v) => `${v}%`, true);
  renderProfileSummary();
}

function renderProgress() {
  if (!state.progress) return;
  ui.newCount.textContent = String(state.progress.newCount || 0);
  ui.learningCount.textContent = String(state.progress.learningCount || 0);
  ui.masteredCount.textContent = String(state.progress.masteredCount || 0);
  ui.dueCount.textContent = String(state.progress.dueCount || 0);
  ui.lastReviewAt.textContent = state.progress.lastReviewedAt
    ? formatDateText(String(state.progress.lastReviewedAt).slice(0, 10))
    : "-";
  renderProfileSummary();
}

function renderMistakes() {
  ui.mistakeList.innerHTML = "";
  if (!state.mistakes.length) {
    const li = document.createElement("li");
    li.textContent = "当前没有错题。";
    ui.mistakeList.appendChild(li);
    return;
  }

  state.mistakes.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <p class="mistake-word-line">
        <span>${item.word}</span>
        <span>难度 ${item.score}</span>
      </p>
      <p class="mistake-meta">${item.bookName} · 错误 ${item.wrongCount} · 跳过 ${item.skipCount}</p>
      <p class="mistake-meta">${item.meaning}</p>
    `;
    ui.mistakeList.appendChild(li);
  });
}

async function loadBooks() {
  const data = await request("/api/books");
  state.books = Array.isArray(data.books) ? data.books : [];
  if (!state.books.length) throw new Error("没有可用词书");
  const exists = state.books.some((book) => book.bookKey === state.selectedBookKey);
  state.selectedBookKey = exists ? state.selectedBookKey : state.books[0].bookKey;
  localStorage.setItem(BOOK_KEY_STORE, state.selectedBookKey);
}

async function loadSummary() {
  state.summary = await request("/api/stats/summary");
}

async function loadProgress() {
  state.progress = await request(`/api/books/${encodeURIComponent(state.selectedBookKey)}/progress`);
}

async function loadAiSettings() {
  const data = await request("/api/me/ai-settings");
  state.aiSettings = data?.settings || null;
}

async function loadMistakes() {
  const bookKey = ui.mistakeBookFilter.value || "all";
  const sort = ui.mistakeSortFilter.value || "score";
  const data = await request(`/api/mistakes?bookKey=${encodeURIComponent(bookKey)}&sort=${encodeURIComponent(sort)}&limit=60`);
  state.mistakes = Array.isArray(data.items) ? data.items : [];
}

function renderUser() {
  if (!state.user) return;
  ui.userName.textContent = state.user.displayName || state.user.username;
  ui.userAvatar.src = state.user.avatarData || DEFAULT_AVATAR_DATA;
  if (ui.profileAvatarPreview) {
    ui.profileAvatarPreview.src = state.user.avatarData || DEFAULT_AVATAR_DATA;
  }
  if (ui.profileDisplayNameInput && ui.profileModal && !ui.profileModal.classList.contains("hidden")) {
    ui.profileDisplayNameInput.value = state.user.displayName || state.user.username || "";
  }
  renderProfileSummary();
}

function renderProfileSummary() {
  if (!state.user) return;
  if (ui.profileUsername) ui.profileUsername.textContent = state.user.username || "-";
  if (ui.profileCreatedAt) {
    const createdAt = state.user.createdAt ? String(state.user.createdAt).slice(0, 10) : "";
    ui.profileCreatedAt.textContent = createdAt ? formatDateText(createdAt) : "-";
  }
  if (ui.profileBookName) {
    const currentBook = state.books.find((book) => book.bookKey === state.selectedBookKey);
    ui.profileBookName.textContent = currentBook?.name || "-";
  }
  if (ui.profileTodayMinutes) {
    ui.profileTodayMinutes.textContent = formatTimeText(state.summary?.todaySeconds || 0);
  }
  if (ui.profileWeekMinutes) {
    const week = Array.isArray(state.summary?.week) ? state.summary.week : [];
    const weekTotal = week.reduce((sum, day) => sum + Number(day.seconds || 0), 0);
    ui.profileWeekMinutes.textContent = formatTimeText(weekTotal);
  }
  if (ui.profileMasteredDue) {
    const mastered = Number(state.progress?.masteredCount || 0);
    const due = Number(state.progress?.dueCount || 0);
    ui.profileMasteredDue.textContent = `${mastered} / ${due}`;
  }
  if (ui.profileAiStatus) {
    const enabled = Boolean(state.aiSettings?.enabled);
    const hasApiKey = Boolean(state.aiSettings?.hasApiKey);
    ui.profileAiStatus.textContent = enabled && hasApiKey ? "已启用" : "未启用";
  }
}

function fillAiSettingsForm() {
  const settings = state.aiSettings || {};
  if (ui.profileApiEnabled) ui.profileApiEnabled.checked = Boolean(settings.enabled);
  if (ui.profileApiBaseUrlInput) ui.profileApiBaseUrlInput.value = String(settings.baseUrl || "");
  if (ui.profileApiModelInput) ui.profileApiModelInput.value = String(settings.model || "gpt-4.1-mini");
  if (ui.profileApiKeyInput) ui.profileApiKeyInput.value = "";
  if (ui.profileApiSystemPromptInput) {
    ui.profileApiSystemPromptInput.value = String(
      settings.systemPrompt || "你是英语记忆教练。请用简洁中文输出，先给一个形象类比，再给一句记忆口诀，避免冗长解释。"
    );
  }
  syncAiFormEnabled();
}

function syncAiFormEnabled() {
  const enabled = Boolean(ui.profileApiEnabled?.checked);
  const targets = [
    ui.profileApiBaseUrlInput,
    ui.profileApiModelInput,
    ui.profileApiKeyInput,
    ui.profileApiSystemPromptInput
  ];
  targets.forEach((el) => {
    if (el) el.disabled = !enabled;
  });
}

function readAiSettingsFromForm() {
  const enabled = Boolean(ui.profileApiEnabled?.checked);
  const baseUrl = String(ui.profileApiBaseUrlInput?.value || "").trim();
  const model = String(ui.profileApiModelInput?.value || "").trim();
  const apiKeyInput = String(ui.profileApiKeyInput?.value || "").trim();
  const currentHasKey = Boolean(state.aiSettings?.hasApiKey);
  const apiKey = apiKeyInput || (currentHasKey ? "__KEEP__" : "");
  const systemPrompt = String(ui.profileApiSystemPromptInput?.value || "").trim();
  return { enabled, baseUrl, model, apiKey, systemPrompt };
}

function validateAiSettingsPayload(payload) {
  if (!payload.enabled) return null;
  if (!payload.baseUrl || !/^https?:\/\//i.test(payload.baseUrl)) {
    return "启用自定义 API 时，地址必须以 http:// 或 https:// 开头。";
  }
  if (!payload.model) return "启用自定义 API 时必须填写模型名称。";
  if (!payload.apiKey || payload.apiKey === "__KEEP__" && !state.aiSettings?.hasApiKey) {
    return "启用自定义 API 时必须填写 API Key。";
  }
  return null;
}

function openProfileModal() {
  if (!state.user || !ui.profileModal) return;
  document.body.classList.add("modal-open");
  state.profileDraftAvatarData = state.user.avatarData || "";
  if (ui.profileDisplayNameInput) {
    ui.profileDisplayNameInput.value = state.user.displayName || state.user.username || "";
  }
  if (ui.profileAvatarPreview) {
    ui.profileAvatarPreview.src = state.user.avatarData || DEFAULT_AVATAR_DATA;
    ui.profileAvatarPreview.dataset.image = state.user.avatarData || "";
  }
  fillAiSettingsForm();
  if (ui.profileAvatarInput) ui.profileAvatarInput.value = "";
  setProfileMessage("");
  renderProfileSummary();
  ui.profileModal.classList.remove("hidden");
  ui.profileModal.setAttribute("aria-hidden", "false");
}

function closeProfileModal() {
  if (!ui.profileModal) return;
  ui.profileModal.classList.add("hidden");
  ui.profileModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (ui.profileAvatarInput) ui.profileAvatarInput.value = "";
  setProfileMessage("");
}

async function onProfileAvatarChange() {
  const file = ui.profileAvatarInput?.files?.[0];
  if (!file) return;
  try {
    const result = await compressAvatarToDataUrl(file);
    state.profileDraftAvatarData = result;
    if (ui.profileAvatarPreview) {
      ui.profileAvatarPreview.src = result || DEFAULT_AVATAR_DATA;
      ui.profileAvatarPreview.dataset.image = result;
    }
    if (result.length > 2000000) {
      setProfileMessage("头像依然过大，请换一张更小的图片。");
    } else {
      setProfileMessage("");
    }
  } catch {
    setProfileMessage("头像处理失败，请更换图片后重试。");
  }
}

async function onProfileSave() {
  if (!state.user) return;
  const displayName = String(ui.profileDisplayNameInput?.value || "").trim();
  if (!displayName || displayName.length > 32) {
    setProfileMessage("显示名不合法：不能为空且不超过 32 字符。");
    return;
  }

  const avatarData = String(state.profileDraftAvatarData || state.user.avatarData || "");
  if (avatarData.length > 2000000) {
    setProfileMessage("头像过大，请换一张更小的图片。");
    return;
  }

  const aiPayload = readAiSettingsFromForm();
  const aiError = validateAiSettingsPayload(aiPayload);
  if (aiError) {
    setProfileMessage(aiError);
    return;
  }

  ui.profileSaveBtn.disabled = true;
  setProfileMessage("正在保存...", false);
  try {
    const profileRes = await request("/api/me/profile", {
      method: "PUT",
      body: JSON.stringify({ displayName, avatarData })
    });
    const aiRes = await request("/api/me/ai-settings", {
      method: "PUT",
      body: JSON.stringify(aiPayload)
    });
    state.user = profileRes.user;
    state.aiSettings = aiRes?.settings || state.aiSettings;
    renderUser();
    renderProfileSummary();
    if (ui.profileApiKeyInput) ui.profileApiKeyInput.value = "";
    setProfileMessage("保存成功。", false);
  } catch (error) {
    const reason = toReadableError(error);
    setProfileMessage(`保存失败：${reason}`);
  } finally {
    ui.profileSaveBtn.disabled = false;
  }
}
async function refreshHomeData() {
  await Promise.all([loadSummary(), loadProgress(), loadMistakes()]);
  renderSummary();
  renderProgress();
  renderMistakes();
}

async function bootstrapAfterLogin() {
  const me = await request("/api/me");
  state.user = me.user;
  renderUser();
  await Promise.all([loadBooks(), loadAiSettings()]);
  renderBooks();
  await refreshHomeData();
  showScreen("home");
}

function startStudyTicker() {
  if (state.studyTicking) return;
  state.studyTicking = true;
  state.studyTimerStart = Date.now();
  state.studyReportedSeconds = 0;
  state.studyIntervalId = setInterval(() => {
    flushStudySeconds();
  }, 30000);
}

function stopStudyTicker() {
  if (!state.studyTicking) return;
  const pending = Math.max(0, Math.floor((Date.now() - state.studyTimerStart) / 1000) - state.studyReportedSeconds);
  state.studyTicking = false;
  if (state.studyIntervalId) {
    clearInterval(state.studyIntervalId);
    state.studyIntervalId = null;
  }
  state.studyTimerStart = 0;
  state.studyReportedSeconds = 0;
  if (pending > 0 && state.token) {
    request("/api/stats/study", { method: "POST", body: JSON.stringify({ seconds: pending }) }).catch(() => {});
  }
}

async function flushStudySeconds() {
  if (!state.studyTicking || !state.token) return;
  const elapsed = Math.floor((Date.now() - state.studyTimerStart) / 1000);
  const pending = Math.max(0, elapsed - state.studyReportedSeconds);
  if (!pending) return;
  await request("/api/stats/study", { method: "POST", body: JSON.stringify({ seconds: pending }) });
  state.studyReportedSeconds += pending;
}

function calcWpm() {
  const mins = Math.max((Date.now() - state.roundStartMs) / 60000, 1 / 60000);
  return Math.round((state.roundCorrectKeys / 5) / mins);
}

function calcAccuracy() {
  const total = state.roundCorrectKeys + state.roundWrongKeys;
  if (!total) return 100;
  return Math.round((state.roundCorrectKeys / total) * 100);
}

function renderLiveStats() {
  ui.progress.textContent = `${state.completedWords} / ${state.pool.length}`;
  ui.liveWpm.textContent = `WPM ${calcWpm()}`;
  ui.liveAcc.textContent = `Accuracy ${calcAccuracy()}%`;
}

function maskSlots(word, typedCount, isError) {
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
      if (i === typedCount && isError) span.classList.add("error");
    }
    ui.wordDisplay.appendChild(span);
  }
}

function renderCurrentWord() {
  if (!state.currentWord) return;
  ui.phonetic.textContent = state.currentWord.phonetic || "";
  ui.meaning.textContent = state.currentWord.meaning || "";
  maskSlots(state.currentWord.word, state.charIndex, false);
}

function clearInsightPanel() {
  state.insightWord = null;
  ui.insightWord.textContent = "-";
  ui.insightPhonetic.textContent = "发音: -";
  ui.insightMeaning.textContent = "释义: -";
  ui.insightUsage.textContent = "用法: -";
  ui.insightExample.textContent = "例句: -";
  ui.insightMnemonic.textContent = "AI 比喻: 点击“我不会”后自动生成";
  ui.insightSpeakBtn.disabled = true;
}

async function createMnemonic(wordObj) {
  const reqId = state.insightReqId + 1;
  state.insightReqId = reqId;
  ui.insightMnemonic.textContent = "AI 比喻: 生成中...";
  try {
    const data = await request("/api/ai/mnemonic", {
      method: "POST",
      body: JSON.stringify({
        word: wordObj.word,
        meaning: wordObj.meaning,
        example: wordObj.example
      })
    });
    if (reqId !== state.insightReqId) return;
    const sourceTag = data?.from === "user_api"
      ? "（自定义API）"
      : data?.from === "server_api"
        ? "（系统API）"
        : "";
    ui.insightMnemonic.textContent = `AI 比喻${sourceTag}: ${data.mnemonic || "暂无"}`;
  } catch {
    if (reqId !== state.insightReqId) return;
    ui.insightMnemonic.textContent = "AI 比喻: 生成失败，请先结合释义与例句记忆。";
  }
}

function showInsight(wordObj) {
  state.insightWord = wordObj;
  ui.insightWord.textContent = wordObj.word || "-";
  ui.insightPhonetic.textContent = `发音: ${wordObj.phonetic || "-"}`;
  ui.insightMeaning.textContent = `释义: ${wordObj.meaning || "-"}`;
  ui.insightUsage.textContent = `用法: ${wordObj.usage || "暂无"}`;
  ui.insightExample.textContent = `例句: ${wordObj.example || "暂无"}`;
  ui.insightSpeakBtn.disabled = false;
  createMnemonic(wordObj);
}

function createSessionWord(word) {
  return {
    ...word,
    weight: 0,
    attempts: 0,
    cooldown: 0
  };
}

function pickNextWord() {
  if (!state.queue.length) return null;
  state.queue.forEach((word) => {
    if (word.cooldown > 0) word.cooldown -= 1;
  });
  const ready = state.queue.filter((word) => word.cooldown <= 0);
  const candidates = ready.length ? ready : state.queue;
  const maxWeight = Math.max(...candidates.map((word) => Number(word.weight || 0)));
  const heavy = candidates.filter((word) => Number(word.weight || 0) === maxWeight);
  return heavy[Math.floor(Math.random() * heavy.length)];
}

function removeFromQueue(wordId) {
  state.queue = state.queue.filter((word) => Number(word.id) !== Number(wordId));
}

function openResult(title, text) {
  state.gameFinished = true;
  stopStudyTicker();
  ui.resultTitle.textContent = title;
  ui.resultText.textContent = text;
  ui.resultPanel.classList.add("show");
  ui.resultPanel.setAttribute("aria-hidden", "false");
}

function closeResult() {
  ui.resultPanel.classList.remove("show");
  ui.resultPanel.setAttribute("aria-hidden", "true");
  state.gameFinished = false;
}

async function pushWordResult(wordObj, { correct, skipped, wrongCount, typedCount }) {
  await request("/api/study/word-result", {
    method: "POST",
    body: JSON.stringify({
      bookKey: state.selectedBookKey,
      wordId: wordObj.id,
      correct,
      skipped,
      wrongCount,
      typedCount
    })
  });
}

async function nextWordOrFinish() {
  state.currentWord = pickNextWord();
  if (!state.currentWord) {
    const text = `WPM ${calcWpm()} · Accuracy ${calcAccuracy()}% · 跳过 ${state.skippedWords} 词`;
    openResult("本次学习完成", text);
    await flushStudySeconds().catch(() => {});
    await refreshHomeData().catch(() => {});
    return;
  }
  state.charIndex = 0;
  state.currentWrong = 0;
  state.currentMissed = false;
  state.wordStartMs = Date.now();
  renderCurrentWord();
  renderLiveStats();
}

async function completeCurrentWord({ skipped = false }) {
  if (!state.currentWord || state.isAdvancing) return;
  state.isAdvancing = true;
  const wordObj = state.currentWord;
  const clean = !skipped && state.currentWrong === 0;
  const typedCount = wordObj.word.length;
  const wrongCount = state.currentWrong;
  wordObj.attempts += 1;
  wordObj.cooldown = REPEAT_COOLDOWN_TURNS;

  if (skipped) {
    state.skippedWords += 1;
    wordObj.weight = Math.min(MAX_WORD_WEIGHT, Number(wordObj.weight || 0) + SKIP_WEIGHT_PENALTY + wrongCount);
  } else if (clean) {
    wordObj.weight = Math.max(0, Number(wordObj.weight || 0) - 1);
    removeFromQueue(wordObj.id);
    state.completedWords += 1;
  } else {
    wordObj.weight = Math.min(MAX_WORD_WEIGHT, Number(wordObj.weight || 0) + wrongCount);
  }

  try {
    await pushWordResult(wordObj, {
      correct: !skipped,
      skipped,
      wrongCount,
      typedCount
    }).catch(() => {});

    await nextWordOrFinish();
  } finally {
    state.isAdvancing = false;
  }
}

function startSession(mode, words) {
  closeResult();
  clearInsightPanel();
  state.sessionMode = mode;
  state.pool = words.map(createSessionWord);
  state.queue = [...state.pool];
  state.currentWord = null;
  state.roundCorrectKeys = 0;
  state.roundWrongKeys = 0;
  state.roundStartMs = Date.now();
  state.completedWords = 0;
  state.skippedWords = 0;
  state.gameFinished = false;
  state.isAdvancing = false;
  ui.modeBadge.textContent = mode;

  startStudyTicker();
  showScreen("game");
  nextWordOrFinish();
}

async function startSmartSession() {
  const data = await request(`/api/books/${encodeURIComponent(state.selectedBookKey)}/plan`);
  const words = Array.isArray(data.words) ? data.words : [];
  if (!words.length) {
    alert("当前词书没有可学习单词。");
    return;
  }
  const adaptiveSize = Number(data.adaptiveSize || words.length || 0);
  const mode = adaptiveSize > 0 ? `智能学习 · ${adaptiveSize}词` : "智能学习";
  startSession(mode, words);
}

async function startHardestSession() {
  const data = await request(`/api/study/hardest?bookKey=${encodeURIComponent(state.selectedBookKey)}&limit=20`);
  const words = Array.isArray(data.words) ? data.words : [];
  if (!words.length) {
    alert("当前还没有可用错题。");
    return;
  }
  startSession("最难20词", words);
}

function handleSkipWord() {
  if (!state.currentWord || state.gameFinished || state.isAdvancing) return;
  state.roundWrongKeys += 1;
  state.currentWrong += 1;
  playTone(170, 0.1, "sawtooth", 0.05);
  showInsight(state.currentWord);
  completeCurrentWord({ skipped: true });
  renderLiveStats();
}

function handleKeyDown(event) {
  if (!ui.gameScreen.classList.contains("active")) return;
  if (!state.currentWord || state.gameFinished || state.isAdvancing) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    if (state.charIndex > 0) {
      state.charIndex -= 1;
      renderCurrentWord();
    }
    return;
  }
  if (!/^[a-zA-Z]$/.test(event.key)) return;

  event.preventDefault();
  const input = event.key.toLowerCase();
  const expected = state.currentWord.word[state.charIndex].toLowerCase();
  if (input === expected) {
    state.charIndex += 1;
    state.roundCorrectKeys += 1;
    playTone(760, 0.05, "triangle", 0.03);
    renderCurrentWord();
    if (state.charIndex >= state.currentWord.word.length) {
      completeCurrentWord({ skipped: false });
    }
  } else {
    state.roundWrongKeys += 1;
    state.currentWrong += 1;
    playTone(170, 0.08, "sawtooth", 0.05);
    maskSlots(state.currentWord.word, state.charIndex, true);
    setTimeout(() => renderCurrentWord(), 120);
  }
  renderLiveStats();
}

async function backToHome() {
  if (speechSynthesisRef) speechSynthesisRef.cancel();
  await flushStudySeconds().catch(() => {});
  stopStudyTicker();
  await refreshHomeData().catch(() => {});
  showScreen("home");
}

async function onRegisterSubmit(event) {
  event.preventDefault();
  const usernameCheck = validateUsername(ui.registerUsername.value);
  if (!usernameCheck.ok) {
    setAuthMessage(`注册失败：${usernameCheck.message}`);
    return;
  }
  const username = usernameCheck.username;
  const displayName = ui.registerDisplayName.value.trim();
  const password = ui.registerPassword.value;
  const avatarData = ui.avatarPreview.dataset.image || "";
  if (avatarData.length > 2000000) {
    setAuthMessage("注册失败：头像过大，请换一张更小的图片。");
    return;
  }

  try {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, displayName, password, avatarData }),
      headers: { Authorization: "" }
    });
    saveToken(data.token);
    setAuthMessage("注册成功，正在进入首页...", false);
    await bootstrapAfterLogin();
  } catch (error) {
    const reason = toReadableError(error);
    setAuthMessage(`注册失败：${reason}`);
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  const usernameCheck = validateUsername(ui.loginUsername.value);
  if (!usernameCheck.ok) {
    setAuthMessage(`登录失败：${usernameCheck.message}`);
    return;
  }
  const username = usernameCheck.username;
  const password = ui.loginPassword.value;
  try {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: { Authorization: "" }
    });
    saveToken(data.token);
    setAuthMessage("登录成功。", false);
    await bootstrapAfterLogin();
  } catch (error) {
    const reason = toReadableError(error);
    setAuthMessage(`登录失败：${reason}`);
  }
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  ui.loginForm.classList.toggle("hidden", !isLogin);
  ui.registerForm.classList.toggle("hidden", isLogin);
  ui.showLoginBtn.classList.toggle("active", isLogin);
  ui.showRegisterBtn.classList.toggle("active", !isLogin);
  setAuthMessage("");
}

function bindEvents() {
  ui.showLoginBtn.addEventListener("click", () => switchAuthTab("login"));
  ui.showRegisterBtn.addEventListener("click", () => switchAuthTab("register"));
  ui.loginForm.addEventListener("submit", onLoginSubmit);
  ui.registerForm.addEventListener("submit", onRegisterSubmit);

  ui.registerAvatar.addEventListener("change", () => {
    const file = ui.registerAvatar.files?.[0];
    if (!file) return;
    compressAvatarToDataUrl(file)
      .then((result) => {
        ui.avatarPreview.src = result;
        ui.avatarPreview.dataset.image = result;
        if (result.length > 2000000) {
          setAuthMessage("头像依然过大，请换一张更小的图片。");
        } else {
          setAuthMessage("");
        }
      })
      .catch(() => {
        setAuthMessage("头像处理失败，请更换图片后重试。");
      });
  });

  ui.logoutBtn.addEventListener("click", async () => {
    await request("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    logoutLocal();
  });

  ui.openProfileBtn.addEventListener("click", () => {
    openProfileModal();
  });
  ui.closeProfileBtn.addEventListener("click", () => {
    closeProfileModal();
  });
  ui.profileCancelBtn.addEventListener("click", () => {
    closeProfileModal();
  });
  ui.profileBackdrop.addEventListener("click", () => {
    closeProfileModal();
  });
  ui.profileAvatarInput.addEventListener("change", () => {
    onProfileAvatarChange();
  });
  ui.profileApiEnabled.addEventListener("change", () => {
    syncAiFormEnabled();
  });
  ui.profileSaveBtn.addEventListener("click", () => {
    onProfileSave();
  });

  ui.bookSelect.addEventListener("change", async () => {
    state.selectedBookKey = ui.bookSelect.value;
    localStorage.setItem(BOOK_KEY_STORE, state.selectedBookKey);
    await refreshHomeData().catch(() => {});
  });

  ui.checkinBtn.addEventListener("click", async () => {
    await request("/api/stats/checkin", { method: "POST", body: "{}" }).catch(() => {});
    await refreshHomeData().catch(() => {});
  });

  ui.startSmartBtn.addEventListener("click", () => {
    startSmartSession().catch((error) => alert(`鍚姩澶辫触: ${error.message}`));
  });
  ui.startHardestBtn.addEventListener("click", () => {
    startHardestSession().catch((error) => alert(`鍚姩澶辫触: ${error.message}`));
  });

  ui.mistakeBookFilter.addEventListener("change", () => {
    loadMistakes().then(renderMistakes).catch(() => {});
  });
  ui.mistakeSortFilter.addEventListener("change", () => {
    loadMistakes().then(renderMistakes).catch(() => {});
  });
  ui.refreshMistakesBtn.addEventListener("click", () => {
    loadMistakes().then(renderMistakes).catch(() => {});
  });

  ui.backHomeBtn.addEventListener("click", () => {
    backToHome();
  });
  ui.resultHomeBtn.addEventListener("click", () => {
    backToHome();
  });
  ui.endSessionBtn.addEventListener("click", () => {
    openResult("已结束本次学习", `WPM ${calcWpm()} · Accuracy ${calcAccuracy()}%`);
    flushStudySeconds().catch(() => {});
  });
  ui.skipBtn.addEventListener("click", () => handleSkipWord());
  ui.insightSpeakBtn.addEventListener("click", () => {
    if (!state.insightWord) return;
    speakWord(state.insightWord.word, state.insightWord.example || "");
  });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.profileModal && !ui.profileModal.classList.contains("hidden")) {
      closeProfileModal();
    }
  });
}

async function init() {
  bindEvents();
  initSpeech();
  clearInsightPanel();
  showScreen("auth");

  if (!state.token) return;
  try {
    await bootstrapAfterLogin();
  } catch {
    logoutLocal();
  }
}

init();

