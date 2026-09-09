# FlowType

FlowType 现已升级为“账号 + 智能学习计划 + 趋势统计”的背词应用。

## 已实现

- 用户注册/登录（用户名、密码、昵称、头像）
- 智能学习计划（基于错题率 + 遗忘曲线 + 到期复习）
- 单词掌握状态（新词 / 学习中 / 已掌握）和最近复习时间
- 错题本增强（按词书筛选、按综合难度/错误次数/最近错误排序）
- 最近 20 词专项训练
- 首页 7 天趋势图（时长、正确率、跳过率）
- 每日打卡 + 今日日期 + 励志语录
- 学习时长记录（今日 + 近 7 天）
- “我不会”侧栏：发音、释义、用法、例句、AI 比喻

## 启动

```powershell
cd D:\Flowtype\Flowtype
npm install
npm start
```

访问地址：
`http://localhost:5173`

## 可选环境变量

- `OPENAI_API_KEY`：启用 AI 比喻接口
- `OPENAI_MODEL`：默认 `gpt-4.1-mini`
- `PORT`：默认 `5173`


## Security Update (2026-03-21)

- Audit result: avatar leakage risk existed. The previous `express.static(ROOT_DIR)` exposed the whole project directory, so `/data/flowtype.db` could be downloaded directly. The SQLite table `users.avatar_data` stores avatar base64 data.
- Fixed: `server.js` now blocks static access to `data/`, `node_modules/`, `output/` and blocks DB-like files (`.db/.db-wal/.db-shm/.sqlite/.sqlite3/.sql`), with `dotfiles: "deny"` enabled.
- Impact scope: if the service was exposed to LAN/public network before this fix, historical DB download risk existed. If you only used `localhost`, the practical risk was lower.
- Recommended follow-up actions:
  1. Ask users to re-upload avatars (treat old avatars as potentially exposed).
  2. Rebuild `data/flowtype.db` after backup, or at least clean historical `users.avatar_data` values.
  3. Rotate sessions (clear `user_sessions`) and restart the service.
