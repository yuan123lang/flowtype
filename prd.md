# 产品需求文档 (PRD)：FlowType (心流打字记忆机)

## 1. 项目概述 (Project Overview)

**FlowType** 是一款面向大众的英语词汇记忆 Web 应用。它结合了“严格打字验证”、“动态权重调度算法”以及“大模型情境联想提示”。产品旨在通过心流般的打字体验（现代极简 UI、Glassmorphism 风格）消除背单词的枯燥感，并通过算法与 AI 辅助，实现肌肉记忆与认知记忆的双重强化。核心词库为 CET-6 高频词汇。

## 2. 核心数据结构 (Data Models)

系统需要维护的核心词汇对象结构如下：

JavaScript

```
interface WordItem {
  id: string;
  word: string;       // 英文单词，例如 "hesitate"
  phonetic: string;   // 音标，例如 "/ˈhezɪteɪt/"
  meaning: string;    // 中文释义，例如 "v. 犹豫，踌躇"
  weight: number;     // 调度权重（初始为 0，越大越优先出现）
  errorCount: number; // 历史拼写错误次数
}
```

## 3. 核心机制与算法 (Core Mechanics & Algorithms)

### 3.1 严格打字状态机 (Strict Typing Engine)

- **输入拦截**：监听用户键盘输入，只处理字母键和 `Backspace`。
- **双指针验证**：使用 `wordIndex` 和 `charIndex` 追踪当前进度。
- **防错机制（严格模式）**：当用户输入的字母与当前 `word[charIndex]` 不匹配时，`charIndex` **不前进**。触发错误反馈，并将该词的 `errorCount` + 1。用户必须输入正确的字母才能继续。

### 3.2 动态权重调度算法 (Dynamic Priority Queue)

- 摒弃随机抽词，采用基于优先级的调度策略。

- **权重计算公式**：每次单词拼写完成后，根据该词的表现更新权重。

  $W_{new} = W_{old} + (\text{errorCount} \times 2) + (\text{timeSpent} > 5s ? 1 : 0)$

- **调度逻辑**：系统维护一个待选词列队，每次优先弹出 $W$ 值（权重）最高的单词给用户拼写，实现类似艾宾浩斯遗忘曲线的“错词复习”机制。

## 4. 核心功能模块 (Key Features)

### 4.1 心流打字区 (Flow Typing Interface)

- **界面展示**：大面积留白的毛玻璃面板。中央大字号显示当前英文单词（未输入的字母半透明），上方悬浮显示音标和中文释义。
- **视觉反馈**：
  - **正确**：字母如水波纹般平滑亮起（柔和的品牌色，如青蓝色）。
  - **错误**：字母颜色变淡或显示柔和的警告色（如淡橙色），并伴随极轻微的水平抖动动画（ CSS `transform: translateX`）。

### 4.2 AI 伴读提示 (AI "Companion" Hint)

- **触发条件**：当某个单词连续输入错误 $\ge 3$ 次，或在一个单词上停留超过 $5$ 秒未完成时，界面右侧平滑滑出一个 `[需要灵感?]` 按钮。
- **功能交互**：用户点击后，前端将当前单词通过 API 发送给 LLM。
- **Prompt 设定**：“你是一个幽默、有生活气息的英语伴读。用户正在背单词 '{word}'，释义是 '{meaning}'。请用一句极具生活画面感的中文联想句或谐音梗帮他记住，不超过 30 个字，语气要像朋友一样自然。”
- **展现形式**：以打字机特效（Typewriter Effect）在主界面下方展示 AI 返回的提示语。

### 4.3 极简结算台 (Minimalist Stats)

- 每完成一组（如 20 个单词）弹出的诊断面板。
- **展示指标**：WPM（每分钟字数）、拼写准确率（Accuracy）、本轮的“顽固词汇”（`errorCount` 最高的 Top 3 单词）。
- **交互**：提供“进入下一组”或“复习顽固词汇”的选项。

## 5. UI/UX 规范 (Design Guidelines)

- **设计风格**：Glassmorphism（毛玻璃效果）、Zen（禅意留白）。
- **色彩主题**：
  - 背景：动态柔和渐变（如 `#F8FAFC` 过渡到 `#E2E8F0`，或随时间变化的朝霞/晚霞色）。
  - 主文本：深灰色 `#1E293B`。
  - 正确高亮：青蓝色 `#0EA5E9` 或 翠绿色 `#10B981`。
- **排版字体**：英文字体强制使用优雅的等宽字体（如 `JetBrains Mono` 或 `Fira Code`），中文字体使用系统默认的无衬线黑体。
- **动画过渡**：全面使用 Framer Motion 或 CSS transition 实现柔和的淡入淡出和位移，拒绝生硬的 DOM 切换。