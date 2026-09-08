const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 5173);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "flowtype.db");
const VOCAB_DIR = path.join(ROOT_DIR, "english-vocabulary-master", "json");

const BOOK_FILES = [
  { key: "junior", name: "初中词书", file: "1-初中-顺序.json" },
  { key: "high", name: "高中词书", file: "2-高中-顺序.json" },
  { key: "cet4", name: "四级词书", file: "3-CET4-顺序.json" },
  { key: "cet6", name: "六级词书", file: "4-CET6-顺序.json" },
  { key: "kaoyan", name: "考研词书", file: "5-考研-顺序.json" },
  { key: "toefl", name: "托福词书", file: "6-托福-顺序.json" },
  { key: "sat", name: "SAT词书", file: "7-SAT-顺序.json" }
];

const QUOTES = [
  "学习不是一口气冲刺，而是每天按时出现。",
  "今天多记住一个词，明天就多一种表达能力。",
  "你在训练的不只是词汇量，还有长期专注力。",
  "慢一点没关系，持续才是最强复利。",
  "每一次改错，都是大脑在重建正确路径。",
  "把输入变成输出，单词才会真正属于你。",
  "稳定七天看节奏，稳定三十天看变化。",
  "不追求完美，追求可持续地变强。"
];

const AI_DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const AI_DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const AI_DEFAULT_SYSTEM_PROMPT =
  "你是英语记忆教练。请用简洁中文输出，先给一个形象类比，再给一句记忆口诀，避免冗长解释。";

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, Number(num)));
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(date, days) {
  const ms = Number(days) * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + ms);
}

function getDateInShanghai(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(date);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 180000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function normalizeUsername(raw) {
  return String(raw || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\s]/g, "")
    .toLowerCase()
    .trim();
}

function verifyPassword(password, savedHash) {
  const [salt, originalHash] = String(savedHash || "").split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 180000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizeMeaning(item) {
  const translations = Array.isArray(item.translations) ? item.translations : [];
  if (!translations.length) return "释义待补充";
  return translations
    .map((entry) => {
      const type = (entry.type || "").trim();
      const text = (entry.translation || "").trim();
      if (!text) return "";
      return type ? `${type}. ${text}` : text;
    })
    .filter(Boolean)
    .join("；");
}

function normalizeUsage(item) {
  const phrases = Array.isArray(item.phrases) ? item.phrases : [];
  const first = phrases.find((entry) => (entry?.phrase || "").trim() && (entry?.translation || "").trim());
  if (!first) return "";
  return `${first.phrase.trim()} - ${first.translation.trim()}`;
}

function normalizeExample(item) {
  const sentences = Array.isArray(item.sentences) ? item.sentences : [];
  const first = sentences.find((entry) => (entry?.sentence || "").trim() && (entry?.translation || "").trim());
  if (!first) return "";
  return `${first.sentence.trim()} | ${first.translation.trim()}`;
}

function normalizePhonetic(item) {
  const us = (item.us || "").trim();
  const uk = (item.uk || "").trim();
  if (us && uk) return `US /${us}/ · UK /${uk}/`;
  if (us) return `US /${us}/`;
  if (uk) return `UK /${uk}/`;
  return "";
}

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      source_file TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      phonetic TEXT NOT NULL DEFAULT '',
      usage_text TEXT NOT NULL DEFAULT '',
      example_text TEXT NOT NULL DEFAULT '',
      us_phonetic TEXT NOT NULL DEFAULT '',
      uk_phonetic TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_words_book_word ON words(book_id, word);
    CREATE INDEX IF NOT EXISTS idx_words_book_id ON words(book_id);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_data TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_ai_settings (
      user_id INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      base_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_word_progress (
      user_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'learning',
      attempts INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      skip_count INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5,
      interval_days REAL NOT NULL DEFAULT 0.5,
      last_review_at TEXT,
      next_review_at TEXT,
      last_error_at TEXT,
      PRIMARY KEY(user_id, word_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_progress_user_word ON user_word_progress(user_id, word_id);
    CREATE INDEX IF NOT EXISTS idx_progress_user_next_review ON user_word_progress(user_id, next_review_at);

    CREATE TABLE IF NOT EXISTS user_daily_stats (
      user_id INTEGER NOT NULL,
      stat_date TEXT NOT NULL,
      study_seconds INTEGER NOT NULL DEFAULT 0,
      typed_keys INTEGER NOT NULL DEFAULT 0,
      wrong_keys INTEGER NOT NULL DEFAULT 0,
      attempted_words INTEGER NOT NULL DEFAULT 0,
      completed_words INTEGER NOT NULL DEFAULT 0,
      skipped_words INTEGER NOT NULL DEFAULT 0,
      checked_in INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, stat_date),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON user_daily_stats(user_id, stat_date);
  `);

  return db;
}

function seedBooks(db) {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM books").get();
  if (Number(existing?.count || 0) > 0) return;

  const insertBook = db.prepare("INSERT INTO books (book_key, name, source_file, word_count) VALUES (?, ?, ?, ?)");
  const insertWord = db.prepare(`
    INSERT OR IGNORE INTO words (
      book_id, word, meaning, phonetic, usage_text, example_text, us_phonetic, uk_phonetic
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedTx = db.transaction(() => {
    for (const book of BOOK_FILES) {
      const filePath = path.join(VOCAB_DIR, book.file);
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) continue;

      const valid = entries.filter((item) => (item.word || "").trim());
      const result = insertBook.run(book.key, book.name, book.file, valid.length);
      const bookId = Number(result.lastInsertRowid);

      valid.forEach((item) => {
        insertWord.run(
          bookId,
          item.word.trim(),
          normalizeMeaning(item),
          normalizePhonetic(item),
          normalizeUsage(item),
          normalizeExample(item),
          (item.us || "").trim(),
          (item.uk || "").trim()
        );
      });
    }
  });

  seedTx();
}

function pickQuote(dateText) {
  let hash = 0;
  for (let i = 0; i < dateText.length; i += 1) {
    hash = (hash * 31 + dateText.charCodeAt(i)) % 100000;
  }
  return QUOTES[hash % QUOTES.length];
}

function parseMs(text) {
  if (!text) return 0;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

function computePriority(row, nowMs) {
  const attempts = Number(row.attempts || 0);
  if (!attempts) {
    return 0.62 + Math.random() * 0.08;
  }

  const wrongRate = Number(row.wrong_count || 0) / Math.max(1, attempts);
  const skipRate = Number(row.skip_count || 0) / Math.max(1, attempts);
  const lastReviewMs = parseMs(row.last_review_at);
  const elapsedDays = lastReviewMs ? (nowMs - lastReviewMs) / (24 * 60 * 60 * 1000) : 99;
  const intervalDays = Math.max(0.2, Number(row.interval_days || 0.5));
  const recallProb = Math.exp(-elapsedDays / (intervalDays + 0.5));
  const isDue = parseMs(row.next_review_at) <= nowMs;
  const dueBoost = isDue ? 0.28 : 0;
  const statusBoost = row.status === "mastered" ? -0.05 : 0.08;
  return (1 - recallProb) * 0.42 + wrongRate * 0.32 + skipRate * 0.2 + dueBoost + statusBoost;
}

function normalizeWordPayload(row) {
  return {
    id: Number(row.word_id),
    word: row.word,
    meaning: row.meaning,
    phonetic: row.phonetic,
    usage: row.usage_text,
    example: row.example_text
  };
}

function buildSmartPlan(rows, size) {
  const nowMs = Date.now();
  const due = [];
  const learning = [];
  const mastered = [];
  const fresh = [];

  rows.forEach((row) => {
    const attempts = Number(row.attempts || 0);
    if (!attempts) {
      fresh.push({ row, score: computePriority(row, nowMs) });
      return;
    }
    const item = { row, score: computePriority(row, nowMs) };
    const dueMs = parseMs(row.next_review_at);
    if (dueMs && dueMs <= nowMs) {
      due.push(item);
    } else if (row.status === "mastered") {
      mastered.push(item);
    } else {
      learning.push(item);
    }
  });

  const byScoreDesc = (a, b) => b.score - a.score;
  due.sort(byScoreDesc);
  learning.sort(byScoreDesc);
  mastered.sort(byScoreDesc);
  fresh.sort(byScoreDesc);

  const target = clamp(size || 30, 10, 80);
  const plan = [];
  const used = new Set();
  const pushUnique = (items, count) => {
    for (const item of items) {
      if (plan.length >= target || count <= 0) return count;
      if (used.has(item.row.word_id)) continue;
      used.add(item.row.word_id);
      plan.push(item.row);
      count -= 1;
    }
    return count;
  };

  let remaining = target;
  remaining = pushUnique(due, remaining);

  const freshQuota = Math.max(4, Math.floor(target * 0.35));
  let freshRemaining = Math.min(freshQuota, remaining);
  freshRemaining = pushUnique(fresh, freshRemaining);
  remaining -= (Math.min(freshQuota, remaining) - freshRemaining);

  remaining = pushUnique(learning, remaining);
  remaining = pushUnique(fresh, remaining);
  pushUnique(mastered, remaining);

  return plan.map(normalizeWordPayload);
}

async function generateMnemonicViaOpenAI({ word, meaning, example }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = [
    "你是一位英语记忆教练。",
    `单词: ${word}`,
    `释义: ${meaning || ""}`,
    `例句: ${example || ""}`,
    "请输出两行：",
    "1) 形象类比，20-40 字，中文；",
    "2) 记忆口诀，10-20 字，中文。"
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "请简洁输出，不要额外解释。" },
        { role: "user", content: prompt }
      ],
      max_output_tokens: 220,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return (data.output_text || "").trim() || null;
}

function fallbackMnemonic(word, meaning) {
  return `把 ${word} 想成一个场景标签：看到语境就联想到“${meaning || "该词含义"}”。`;
}

function buildMnemonicPrompt({ word, meaning, example }) {
  return [
    `单词: ${word}`,
    `释义: ${meaning || ""}`,
    `例句: ${example || ""}`,
    "请输出两行：",
    "1) 形象类比，20-40字，中文；",
    "2) 记忆口诀，10-20字，中文。"
  ].join("\n");
}

function extractTextFromResponses(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data?.output)) return "";
  const chunks = [];
  for (const item of data.output) {
    const contentList = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentList) {
      if (typeof content?.text === "string" && content.text.trim()) chunks.push(content.text.trim());
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAICompatibleApi({ baseUrl, apiKey, model, systemPrompt, prompt }) {
  const root = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!root || !apiKey || !model) return null;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };

  const responsesRes = await fetch(`${root}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_output_tokens: 220,
      temperature: 0.7
    })
  });
  if (responsesRes.ok) {
    const data = await responsesRes.json();
    return extractTextFromResponses(data) || null;
  }
  if (![404, 405].includes(Number(responsesRes.status))) {
    const text = await responsesRes.text();
    throw new Error(`AI responses API ${responsesRes.status}: ${text.slice(0, 200)}`);
  }

  const chatRes = await fetch(`${root}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 220,
      temperature: 0.7
    })
  });
  if (!chatRes.ok) {
    const text = await chatRes.text();
    throw new Error(`AI chat API ${chatRes.status}: ${text.slice(0, 200)}`);
  }
  const chatData = await chatRes.json();
  return String(chatData?.choices?.[0]?.message?.content || "").trim() || null;
}

async function generateMnemonicText({ word, meaning, example, userAiSettings }) {
  const prompt = buildMnemonicPrompt({ word, meaning, example });
  const enabled = Number(userAiSettings?.enabled || 0) === 1;

  if (enabled && userAiSettings?.api_key && userAiSettings?.base_url && userAiSettings?.model) {
    const userText = await callOpenAICompatibleApi({
      baseUrl: userAiSettings.base_url,
      apiKey: userAiSettings.api_key,
      model: userAiSettings.model,
      systemPrompt: userAiSettings.system_prompt || AI_DEFAULT_SYSTEM_PROMPT,
      prompt
    });
    if (userText) return { text: userText, source: "user_api" };
  }

  const envKey = process.env.OPENAI_API_KEY || "";
  if (!envKey) return { text: null, source: "fallback" };
  const serverText = await callOpenAICompatibleApi({
    baseUrl: AI_DEFAULT_BASE_URL,
    apiKey: envKey,
    model: AI_DEFAULT_MODEL,
    systemPrompt: AI_DEFAULT_SYSTEM_PROMPT,
    prompt
  });
  return { text: serverText || null, source: serverText ? "server_api" : "fallback" };
}

function fallbackMnemonicText(word, meaning) {
  return `把 ${word} 想成一个画面：看到语境就联想到“${meaning || "该词含义"}”。`;
}

const db = ensureDatabase();
seedBooks(db);

function getUserAiSettings(userId) {
  return db
    .prepare(`
      SELECT user_id, enabled, base_url, api_key, model, system_prompt, updated_at
      FROM user_ai_settings
      WHERE user_id = ?
    `)
    .get(userId);
}

function sanitizeAiSettings(row) {
  if (!row) {
    return {
      enabled: false,
      baseUrl: "",
      model: AI_DEFAULT_MODEL,
      systemPrompt: AI_DEFAULT_SYSTEM_PROMPT,
      hasApiKey: false,
      updatedAt: null
    };
  }
  return {
    enabled: Number(row.enabled || 0) === 1,
    baseUrl: String(row.base_url || ""),
    model: String(row.model || "") || AI_DEFAULT_MODEL,
    systemPrompt: String(row.system_prompt || "") || AI_DEFAULT_SYSTEM_PROMPT,
    hasApiKey: Boolean(String(row.api_key || "").trim()),
    updatedAt: row.updated_at || null
  };
}

function resolveAdaptivePlanSize(userId, bookId, requestedSize) {
  if (requestedSize) return clamp(requestedSize, 10, 80);

  const daily = db
    .prepare(`
      SELECT typed_keys, wrong_keys, study_seconds
      FROM user_daily_stats
      WHERE user_id = ?
      ORDER BY stat_date DESC
      LIMIT 7
    `)
    .all(userId);

  const totalTyped = daily.reduce((sum, row) => sum + Number(row.typed_keys || 0), 0);
  const totalWrong = daily.reduce((sum, row) => sum + Number(row.wrong_keys || 0), 0);
  const studyDays = daily.filter((row) => Number(row.study_seconds || 0) >= 600).length;
  const accuracy = totalTyped + totalWrong > 0 ? totalTyped / (totalTyped + totalWrong) : 0.85;

  const now = nowIso();
  const dueRow = db
    .prepare(`
      SELECT COUNT(*) AS dueCount
      FROM words w
      LEFT JOIN user_word_progress p
        ON p.word_id = w.id
       AND p.user_id = ?
      WHERE w.book_id = ?
        AND p.next_review_at IS NOT NULL
        AND p.next_review_at <= ?
    `)
    .get(userId, bookId, now);
  const dueCount = Number(dueRow?.dueCount || 0);

  let size = 24;
  if (accuracy >= 0.9) size += 6;
  else if (accuracy < 0.7) size -= 6;
  if (studyDays >= 5) size += 4;
  else if (studyDays <= 1) size -= 3;
  size += Math.min(10, Math.floor(dueCount / 20) * 2);
  return clamp(size, 16, 60);
}

const app = express();
app.use(express.json({ limit: "12mb" }));

function issueSession(userId) {
  const token = createToken();
  const createdAt = nowIso();
  const expiresAt = addDays(new Date(), 30).toISOString();
  db.prepare("INSERT INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    createdAt,
    expiresAt
  );
  return token;
}

function sanitizeUserRow(userRow) {
  return {
    id: Number(userRow.id),
    username: userRow.username,
    displayName: userRow.display_name,
    avatarData: userRow.avatar_data || "",
    createdAt: userRow.created_at || ""
  };
}

function requireAuth(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const row = db
    .prepare(`
      SELECT s.token, s.expires_at, u.id, u.username, u.display_name, u.avatar_data, u.created_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `)
    .get(token);

  if (!row) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  if (parseMs(row.expires_at) <= Date.now()) {
    db.prepare("DELETE FROM user_sessions WHERE token = ?").run(token);
    res.status(401).json({ error: "session_expired" });
    return;
  }

  req.authToken = token;
  req.user = sanitizeUserRow(row);
  next();
}

app.post("/api/auth/register", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || username).trim();
  const avatarData = String(req.body?.avatarData || "").trim();
  const usernameValid = /^[a-z0-9_]{3,24}$/.test(username);

  if (!usernameValid) {
    res.status(400).json({ error: "invalid_username", message: "用户名不合法：仅支持 3-24 位英文/数字/下划线。" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "password_too_short", message: "密码至少 6 位。" });
    return;
  }
  if (!displayName || displayName.length > 32) {
    res.status(400).json({ error: "invalid_display_name", message: "显示名不合法：不能为空且不超过 32 字符。" });
    return;
  }
  if (avatarData.length > 2000000) {
    res.status(400).json({ error: "avatar_too_large", message: "头像文件过大，请换一张更小的图片。" });
    return;
  }

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) {
    res.status(409).json({ error: "username_exists", message: "用户名已存在，请更换用户名。" });
    return;
  }

  const passwordHash = hashPassword(password);
  const result = db
    .prepare("INSERT INTO users (username, display_name, password_hash, avatar_data) VALUES (?, ?, ?, ?)")
    .run(username, displayName, passwordHash, avatarData);

  const userId = Number(result.lastInsertRowid);
  const user = db.prepare("SELECT id, username, display_name, avatar_data, created_at FROM users WHERE id = ?").get(userId);
  const token = issueSession(userId);
  res.json({ token, user: sanitizeUserRow(user) });
});

app.post("/api/auth/login", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "invalid_credentials", message: "用户名或密码错误。" });
    return;
  }

  const token = issueSession(Number(user.id));
  res.json({ token, user: sanitizeUserRow(user) });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.put("/api/me/profile", requireAuth, (req, res) => {
  const displayName = String(req.body?.displayName || "").trim();
  const avatarRaw = req.body?.avatarData;
  const avatarData = String(avatarRaw === undefined || avatarRaw === null ? req.user.avatarData : avatarRaw).trim();

  if (!displayName || displayName.length > 32) {
    res.status(400).json({ error: "invalid_display_name", message: "显示名不合法：不能为空且不超过 32 字符。" });
    return;
  }
  if (avatarData.length > 2000000) {
    res.status(400).json({ error: "avatar_too_large", message: "头像文件过大，请换一张更小的图片。" });
    return;
  }

  db.prepare("UPDATE users SET display_name = ?, avatar_data = ? WHERE id = ?")
    .run(displayName, avatarData, req.user.id);

  const user = db
    .prepare("SELECT id, username, display_name, avatar_data, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  res.json({ user: sanitizeUserRow(user) });
});

app.get("/api/me/ai-settings", requireAuth, (req, res) => {
  const row = getUserAiSettings(req.user.id);
  res.json({ settings: sanitizeAiSettings(row) });
});

app.put("/api/me/ai-settings", requireAuth, (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const baseUrl = String(req.body?.baseUrl || "").trim();
  let apiKey = String(req.body?.apiKey || "").trim();
  const model = String(req.body?.model || "").trim();
  const systemPrompt = String(req.body?.systemPrompt || "").trim();
  const existing = getUserAiSettings(req.user.id);

  if (apiKey === "__KEEP__") {
    apiKey = String(existing?.api_key || "");
  }

  if (enabled && (!baseUrl || !apiKey || !model)) {
    res.status(400).json({ error: "invalid_ai_settings", message: "启用自定义 API 时必须填写地址、密钥和模型。" });
    return;
  }
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    res.status(400).json({ error: "invalid_ai_base_url", message: "API 地址必须以 http:// 或 https:// 开头。" });
    return;
  }
  if (apiKey.length > 2048 || model.length > 120 || systemPrompt.length > 3000 || baseUrl.length > 500) {
    res.status(400).json({ error: "invalid_ai_settings", message: "AI 配置长度超限，请精简后重试。" });
    return;
  }

  db.prepare(`
    INSERT INTO user_ai_settings (user_id, enabled, base_url, api_key, model, system_prompt, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id)
    DO UPDATE SET
      enabled = excluded.enabled,
      base_url = excluded.base_url,
      api_key = excluded.api_key,
      model = excluded.model,
      system_prompt = excluded.system_prompt,
      updated_at = datetime('now')
  `).run(
    req.user.id,
    enabled ? 1 : 0,
    baseUrl,
    apiKey,
    model || AI_DEFAULT_MODEL,
    systemPrompt || AI_DEFAULT_SYSTEM_PROMPT
  );

  const row = getUserAiSettings(req.user.id);
  res.json({ ok: true, settings: sanitizeAiSettings(row) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  db.prepare("DELETE FROM user_sessions WHERE token = ?").run(req.authToken);
  res.json({ ok: true });
});

app.get("/api/books", requireAuth, (req, res) => {
  const books = db
    .prepare("SELECT id, book_key AS bookKey, name, word_count AS wordCount FROM books ORDER BY id")
    .all();
  res.json({ books });
});

app.get("/api/books/:bookKey/words", requireAuth, (req, res) => {
  const { bookKey } = req.params;
  const limit = clamp(req.query.limit || 5000, 1, 20000);
  const offset = clamp(req.query.offset || 0, 0, 200000);
  const book = db.prepare("SELECT id, name, word_count AS wordCount FROM books WHERE book_key = ?").get(bookKey);

  if (!book) {
    res.status(404).json({ error: "book_not_found" });
    return;
  }

  const words = db
    .prepare(`
      SELECT id AS word_id, word, meaning, phonetic, usage_text, example_text
      FROM words
      WHERE book_id = ?
      ORDER BY id
      LIMIT ? OFFSET ?
    `)
    .all(book.id, limit, offset)
    .map(normalizeWordPayload);

  res.json({
    book: { key: bookKey, name: book.name, wordCount: Number(book.wordCount) },
    words,
    paging: { limit, offset }
  });
});

app.get("/api/books/:bookKey/progress", requireAuth, (req, res) => {
  const { bookKey } = req.params;
  const book = db.prepare("SELECT id, word_count AS wordCount FROM books WHERE book_key = ?").get(bookKey);
  if (!book) {
    res.status(404).json({ error: "book_not_found" });
    return;
  }

  const now = nowIso();
  const stats = db
    .prepare(`
      SELECT
        SUM(CASE WHEN p.status = 'learning' THEN 1 ELSE 0 END) AS learningCount,
        SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) AS masteredCount,
        SUM(CASE WHEN p.next_review_at IS NOT NULL AND p.next_review_at <= ? THEN 1 ELSE 0 END) AS dueCount,
        MAX(p.last_review_at) AS lastReviewedAt
      FROM words w
      LEFT JOIN user_word_progress p
        ON p.word_id = w.id
       AND p.user_id = ?
      WHERE w.book_id = ?
    `)
    .get(now, req.user.id, book.id);

  const learningCount = Number(stats?.learningCount || 0);
  const masteredCount = Number(stats?.masteredCount || 0);
  const total = Number(book.wordCount || 0);
  const newCount = Math.max(0, total - learningCount - masteredCount);

  res.json({
    bookKey,
    total,
    newCount,
    learningCount,
    masteredCount,
    dueCount: Number(stats?.dueCount || 0),
    lastReviewedAt: stats?.lastReviewedAt || null
  });
});

app.get("/api/books/:bookKey/plan", requireAuth, (req, res) => {
  const { bookKey } = req.params;
  const rawSize = Number(req.query.size || 0);
  const requestedSize = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 0;
  const book = db.prepare("SELECT id, name FROM books WHERE book_key = ?").get(bookKey);
  if (!book) {
    res.status(404).json({ error: "book_not_found" });
    return;
  }

  const rows = db
    .prepare(`
      SELECT
        w.id AS word_id,
        w.word,
        w.meaning,
        w.phonetic,
        w.usage_text,
        w.example_text,
        p.status,
        p.attempts,
        p.correct_count,
        p.wrong_count,
        p.skip_count,
        p.streak,
        p.ease,
        p.interval_days,
        p.last_review_at,
        p.next_review_at
      FROM words w
      LEFT JOIN user_word_progress p
        ON p.word_id = w.id
       AND p.user_id = ?
      WHERE w.book_id = ?
      ORDER BY w.id
    `)
    .all(req.user.id, book.id);

  const adaptiveSize = resolveAdaptivePlanSize(req.user.id, book.id, requestedSize);
  const words = buildSmartPlan(rows, adaptiveSize);
  res.json({
    book: { key: bookKey, name: book.name },
    words,
    size: words.length,
    requestedSize: requestedSize || null,
    adaptiveSize
  });
});

app.post("/api/study/word-result", requireAuth, (req, res) => {
  const bookKey = String(req.body?.bookKey || "").trim();
  const wordId = Number(req.body?.wordId || 0);
  const correct = Boolean(req.body?.correct);
  const skipped = Boolean(req.body?.skipped);
  const wrongCount = Math.max(0, Math.floor(Number(req.body?.wrongCount || 0)));
  const typedCount = Math.max(0, Math.floor(Number(req.body?.typedCount || 0)));

  if (!bookKey || !wordId) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  const word = db
    .prepare(`
      SELECT w.id, b.book_key AS bookKey
      FROM words w
      JOIN books b ON b.id = w.book_id
      WHERE w.id = ?
    `)
    .get(wordId);

  if (!word || word.bookKey !== bookKey) {
    res.status(400).json({ error: "word_book_mismatch" });
    return;
  }

  const existing = db
    .prepare("SELECT * FROM user_word_progress WHERE user_id = ? AND word_id = ?")
    .get(req.user.id, wordId);

  const now = new Date();
  const nowText = now.toISOString();
  const prevAttempts = Number(existing?.attempts || 0);
  const attempts = prevAttempts + 1;
  const prevWrong = Number(existing?.wrong_count || 0);
  const prevSkip = Number(existing?.skip_count || 0);
  const prevCorrect = Number(existing?.correct_count || 0);
  const prevStreak = Number(existing?.streak || 0);
  const prevEase = Number(existing?.ease || 2.5);
  const prevInterval = Number(existing?.interval_days || 0.5);

  const correctCount = prevCorrect + (correct && !skipped ? 1 : 0);
  const nextWrong = prevWrong + wrongCount + (skipped ? 1 : 0);
  const nextSkip = prevSkip + (skipped ? 1 : 0);

  let streak = prevStreak;
  let ease = prevEase;
  let intervalDays = prevInterval;

  if (correct && !skipped) {
    streak += 1;
    ease = clamp(ease + 0.06 - wrongCount * 0.02, 1.3, 3.0);
    if (streak === 1) intervalDays = 0.5;
    else if (streak === 2) intervalDays = 1.5;
    else intervalDays = clamp(intervalDays * ease, 2, 45);
  } else {
    streak = 0;
    ease = clamp(ease - (skipped ? 0.22 : 0.14) - wrongCount * 0.03, 1.3, 3.0);
    intervalDays = skipped ? 0.15 : 0.35;
  }

  const wrongRate = nextWrong / Math.max(1, attempts);
  const status = streak >= 4 && wrongRate < 0.35 ? "mastered" : "learning";
  const nextReviewAt = addDays(now, intervalDays).toISOString();
  const lastErrorAt = wrongCount > 0 || skipped ? nowText : existing?.last_error_at || null;

  db.prepare(`
    INSERT INTO user_word_progress (
      user_id, word_id, status, attempts, correct_count, wrong_count, skip_count,
      streak, ease, interval_days, last_review_at, next_review_at, last_error_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, word_id)
    DO UPDATE SET
      status = excluded.status,
      attempts = excluded.attempts,
      correct_count = excluded.correct_count,
      wrong_count = excluded.wrong_count,
      skip_count = excluded.skip_count,
      streak = excluded.streak,
      ease = excluded.ease,
      interval_days = excluded.interval_days,
      last_review_at = excluded.last_review_at,
      next_review_at = excluded.next_review_at,
      last_error_at = excluded.last_error_at
  `).run(
    req.user.id,
    wordId,
    status,
    attempts,
    correctCount,
    nextWrong,
    nextSkip,
    streak,
    ease,
    intervalDays,
    nowText,
    nextReviewAt,
    lastErrorAt
  );

  const today = getDateInShanghai();
  db.prepare(`
    INSERT INTO user_daily_stats (
      user_id, stat_date, study_seconds, typed_keys, wrong_keys,
      attempted_words, completed_words, skipped_words, checked_in, updated_at
    ) VALUES (?, ?, 0, ?, ?, 1, ?, ?, 0, datetime('now'))
    ON CONFLICT(user_id, stat_date)
    DO UPDATE SET
      typed_keys = typed_keys + excluded.typed_keys,
      wrong_keys = wrong_keys + excluded.wrong_keys,
      attempted_words = attempted_words + 1,
      completed_words = completed_words + excluded.completed_words,
      skipped_words = skipped_words + excluded.skipped_words,
      updated_at = datetime('now')
  `).run(req.user.id, today, typedCount, wrongCount, correct && !skipped ? 1 : 0, skipped ? 1 : 0);

  res.json({
    ok: true,
    progress: {
      status,
      attempts,
      correctCount,
      wrongCount: nextWrong,
      skipCount: nextSkip,
      streak,
      ease,
      intervalDays,
      nextReviewAt
    }
  });
});

app.get("/api/mistakes", requireAuth, (req, res) => {
  const bookKey = String(req.query.bookKey || "all").trim();
  const sort = String(req.query.sort || "score").trim();
  const limit = clamp(req.query.limit || 50, 1, 200);

  const rows = db
    .prepare(`
      SELECT
        b.book_key AS bookKey,
        b.name AS bookName,
        w.id AS word_id,
        w.word,
        w.meaning,
        w.phonetic,
        w.usage_text,
        w.example_text,
        p.status,
        p.attempts,
        p.correct_count,
        p.wrong_count,
        p.skip_count,
        p.last_error_at,
        p.last_review_at
      FROM user_word_progress p
      JOIN words w ON w.id = p.word_id
      JOIN books b ON b.id = w.book_id
      WHERE p.user_id = ?
        AND (p.wrong_count > 0 OR p.skip_count > 0)
    `)
    .all(req.user.id);

  const filtered = rows
    .filter((row) => (bookKey === "all" ? true : row.bookKey === bookKey))
    .map((row) => {
      const attempts = Number(row.attempts || 0);
      const wrong = Number(row.wrong_count || 0);
      const skip = Number(row.skip_count || 0);
      const wrongRate = wrong / Math.max(1, attempts);
      const score = wrong * 2 + skip * 3 + wrongRate * 5;
      return {
        id: Number(row.word_id),
        bookKey: row.bookKey,
        bookName: row.bookName,
        word: row.word,
        meaning: row.meaning,
        phonetic: row.phonetic,
        usage: row.usage_text,
        example: row.example_text,
        status: row.status || "learning",
        attempts,
        wrongCount: wrong,
        skipCount: skip,
        score: Number(score.toFixed(2)),
        lastErrorAt: row.last_error_at || null,
        lastReviewedAt: row.last_review_at || null
      };
    });

  if (sort === "errors") {
    filtered.sort((a, b) => b.wrongCount - a.wrongCount || b.skipCount - a.skipCount);
  } else if (sort === "recent") {
    filtered.sort((a, b) => parseMs(b.lastErrorAt) - parseMs(a.lastErrorAt));
  } else {
    filtered.sort((a, b) => b.score - a.score);
  }

  res.json({ items: filtered.slice(0, limit) });
});

app.get("/api/study/hardest", requireAuth, (req, res) => {
  const bookKey = String(req.query.bookKey || "all").trim();
  const limit = clamp(req.query.limit || 20, 5, 60);

  const rows = db
    .prepare(`
      SELECT
        b.book_key AS bookKey,
        w.id AS word_id,
        w.word,
        w.meaning,
        w.phonetic,
        w.usage_text,
        w.example_text,
        p.attempts,
        p.wrong_count,
        p.skip_count
      FROM user_word_progress p
      JOIN words w ON w.id = p.word_id
      JOIN books b ON b.id = w.book_id
      WHERE p.user_id = ?
        AND (p.wrong_count > 0 OR p.skip_count > 0)
    `)
    .all(req.user.id);

  const list = rows
    .filter((row) => (bookKey === "all" ? true : row.bookKey === bookKey))
    .map((row) => ({
      ...row,
      score: Number(row.wrong_count || 0) * 2 + Number(row.skip_count || 0) * 3
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(normalizeWordPayload);

  res.json({ words: list });
});

app.post("/api/stats/study", requireAuth, (req, res) => {
  const seconds = Math.max(0, Math.floor(Number(req.body?.seconds || 0)));
  if (!seconds) {
    res.json({ ok: true, ignored: true });
    return;
  }

  const today = getDateInShanghai();
  db.prepare(`
    INSERT INTO user_daily_stats (
      user_id, stat_date, study_seconds, typed_keys, wrong_keys,
      attempted_words, completed_words, skipped_words, checked_in, updated_at
    ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, datetime('now'))
    ON CONFLICT(user_id, stat_date)
    DO UPDATE SET
      study_seconds = study_seconds + excluded.study_seconds,
      updated_at = datetime('now')
  `).run(req.user.id, today, seconds);

  const todayRow = db
    .prepare("SELECT study_seconds FROM user_daily_stats WHERE user_id = ? AND stat_date = ?")
    .get(req.user.id, today);
  res.json({ ok: true, todaySeconds: Number(todayRow?.study_seconds || 0) });
});

app.post("/api/stats/checkin", requireAuth, (req, res) => {
  const today = getDateInShanghai();
  db.prepare(`
    INSERT INTO user_daily_stats (
      user_id, stat_date, study_seconds, typed_keys, wrong_keys,
      attempted_words, completed_words, skipped_words, checked_in, updated_at
    ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 1, datetime('now'))
    ON CONFLICT(user_id, stat_date)
    DO UPDATE SET checked_in = 1, updated_at = datetime('now')
  `).run(req.user.id, today);
  res.json({ ok: true, date: today, checkedIn: true });
});

app.get("/api/stats/summary", requireAuth, (req, res) => {
  const today = getDateInShanghai();
  const quote = pickQuote(today);
  const dates = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(getDateInShanghai(d));
  }

  const placeholders = dates.map(() => "?").join(",");
  const rows = db
    .prepare(`
      SELECT
        stat_date,
        study_seconds,
        typed_keys,
        wrong_keys,
        attempted_words,
        skipped_words,
        checked_in
      FROM user_daily_stats
      WHERE user_id = ?
        AND stat_date IN (${placeholders})
    `)
    .all(req.user.id, ...dates);

  const byDate = new Map(rows.map((row) => [row.stat_date, row]));
  const week = dates.map((date) => {
    const row = byDate.get(date);
    const typed = Number(row?.typed_keys || 0);
    const wrong = Number(row?.wrong_keys || 0);
    const attempted = Number(row?.attempted_words || 0);
    const skipped = Number(row?.skipped_words || 0);
    const accuracy = typed + wrong > 0 ? typed / (typed + wrong) : 1;
    const skipRate = attempted > 0 ? skipped / attempted : 0;
    return {
      date,
      seconds: Number(row?.study_seconds || 0),
      accuracy: Number(accuracy.toFixed(4)),
      skipRate: Number(skipRate.toFixed(4)),
      checkedIn: Number(row?.checked_in || 0) === 1
    };
  });

  const todayRow = byDate.get(today);
  res.json({
    today,
    quote,
    todaySeconds: Number(todayRow?.study_seconds || 0),
    checkedIn: Number(todayRow?.checked_in || 0) === 1,
    week
  });
});

app.post("/api/ai/mnemonic", requireAuth, async (req, res) => {
  const word = String(req.body?.word || "").trim();
  const meaning = String(req.body?.meaning || "").trim();
  const example = String(req.body?.example || "").trim();
  if (!word) {
    res.status(400).json({ error: "word_required" });
    return;
  }

  try {
    const userAiSettings = getUserAiSettings(req.user.id);
    const result = await generateMnemonicText({ word, meaning, example, userAiSettings });
    res.json({
      mnemonic: result?.text || fallbackMnemonicText(word, meaning),
      from: result?.source || "fallback"
    });
  } catch (error) {
    res.json({
      mnemonic: fallbackMnemonicText(word, meaning),
      from: "fallback",
      warning: String(error?.message || error)
    });
  }
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({
      error: "payload_too_large",
      message: "上传内容过大，请换一张更小的头像图片后重试。"
    });
    return;
  }
  console.error("Unhandled request error:", err);
  res.status(500).json({ error: "internal_error", message: "服务异常，请稍后重试。" });
});

const STATIC_BLOCKED_PATH_PATTERNS = [
  /^\/data(?:\/|$)/i,
  /^\/node_modules(?:\/|$)/i,
  /^\/output(?:\/|$)/i
];
const STATIC_BLOCKED_EXTENSIONS = /\.(?:db|db-shm|db-wal|sqlite|sqlite3|sql)$/i;

app.use((req, res, next) => {
  const requestPath = String(req.path || "");
  const blockedByPath = STATIC_BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(requestPath));
  const blockedByExtension = STATIC_BLOCKED_EXTENSIONS.test(requestPath);
  if (blockedByPath || blockedByExtension) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  next();
});

app.use(express.static(ROOT_DIR, {
  dotfiles: "deny",
  setHeaders: (res, filePath) => {
    if (/\.html$/i.test(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    } else if (/\.js$/i.test(filePath)) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    } else if (/\.css$/i.test(filePath)) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
    }
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));
app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

const server = app.listen(PORT, () => {
  console.log(`FlowType server is running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the old process or run with PORT=<new_port>.`);
    process.exit(1);
    return;
  }
  console.error("Server startup error:", error);
  process.exit(1);
});

