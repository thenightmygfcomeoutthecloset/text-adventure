# 🔍 异界卷 · 全面代码审阅报告

> 审阅范围：[index.html](file:///E:/claude%20code%20library/index.html)（266行）、[样式.css](file:///E:/claude%20code%20library/%E6%A0%B7%E5%BC%8F.css)（1929行）、[游戏.js](file:///E:/claude%20code%20library/%E6%B8%B8%E6%88%8F.js)（3595行）、[数据.js](file:///E:/claude%20code%20library/%E6%95%B0%E6%8D%AE.js)（490行）

---

## 一、🗑️ 删除冗余代码

### 1.1 已删除的 HTML 元素残留的 CSS（确认死代码）

| 优先级 | 文件 | 行号 | 问题 | 建议 |
|--------|------|------|------|------|
| 🔴 | 样式.css | L1706–1711 | `#action-bar` 在 `@media 480px` 中仍有样式 | **删除** — `#action-bar` 已从 HTML 移除 |
| 🔴 | 样式.css | L1819 | `#action-bar` 在 `@media 360px` 中仍有样式 | **删除** |
| 🔴 | 样式.css | L1843–1845 | `#action-bar button span` 在 `@media landscape` 中 | **删除** |

### 1.2 未使用的 CSS 变量（7 个）

在 `:root` 中定义但全文无任何引用：

| 变量名 | 行号 | 说明 |
|--------|------|------|
| `--accent-a10` | L16 | 从未被引用 |
| `--accent-a14` | L18 | 从未被引用 |
| `--accent-a15` | L19 | 从未被引用 |
| `--accent-a20` | L20 | 从未被引用 |
| `--accent-a22` | L21 | 应被引用但 L746 反而硬编码了 `rgba(139,117,40,0.22)` |
| `--accent-a28` | L22 | 应被引用但 L1340 反而硬编码了 `rgba(139,117,40,0.28)` |
| `--accent-br10` | L24 | 从未被引用 |
| `--accent-br25` | L25 | 从未被引用 |

> [!TIP]
> L746 和 L1340 的硬编码值应改用对应的 CSS 变量 `var(--accent-a22)` 和 `var(--accent-a28)`，然后将确实无用的变量清理掉。

### 1.3 过时的 CSS 属性

| 行号 | 属性 | 说明 |
|------|------|------|
| L1072 | `-webkit-overflow-scrolling: touch` | iOS 12+ 已原生支持，可安全删除 |

### 1.4 JS 中的冗余代码

| 行号 | 问题 | 建议 |
|------|------|------|
| L1082 | `document.getElementById('command-input').focus()` **连续调用了两次** | 删除重复行（复制粘贴遗留 Bug） |
| L338 `_startAuthCooldown` | 接受 `onTick` 回调参数，但**所有调用者（L370、L389）都没有传参** | 删除无用的 `onTick` 分支 |

### 1.5 重复的 HTML 标记

| 位置 | 问题 |
|------|------|
| L83 `#tab-common` 和 L132 `#tab-common-world` | 两处各自包含完全相同的"穿越小说"和"自定义"世界卡片 HTML，属于内容级重复 |

### 1.6 版本分裂问题

| 文件 | 问题 |
|------|------|
| 根目录 `index.html` | v0.7.4 ✅ 最新 |
| `存档/2026-05-11_文字冒险游戏/index.html` | v0.7.2 ❌ 过时 |
| `存档/.../README.md` | 仍写着 v0.7.2 |
| `存档/.../CLAUDE.md` | 无 v0.7.3、v0.7.4 更新日志 |

> [!WARNING]
> 根目录和子目录存在两套不同步的代码副本。建议只保留根目录作为真正的开发源，子目录仅作为历史存档或直接删除。

---

## 二、🎮 核心玩法升级建议

### 2.1 高价值新功能

| 优先级 | 功能 | 说明 |
|--------|------|------|
| ⭐⭐⭐ | **「重新生成」按钮** | AI 回复质量不佳时，一键重新生成（类似 ChatGPT 的 Regenerate），无需重复输入指令 |
| ⭐⭐⭐ | **「回退一步」** | 撤销上一个操作。每次发送指令前快照状态，允许回滚。这是文字冒险游戏的刚需 |
| ⭐⭐⭐ | **物品「使用」按钮** | 当前物品栏仅展示不可交互。加入"使用"按钮，点击后自动将指令填入输入框（如"使用 回血药水"） |
| ⭐⭐ | **回合计数器显示** | 当前回合数虽在保存数据中被计算，但游戏 UI 中不可见。在顶部属性栏加入轮次显示 |
| ⭐⭐ | **地点历史 / 简易地图** | 当前位置仅是一个文本标签。记录玩家探索过的所有地点，展示一个简易的足迹地图 |
| ⭐⭐ | **音效系统** | 目前只有成就达成时有音效。为掷骰、场景切换、角色死亡等关键时刻加入音效，会极大增强沉浸感 |
| ⭐ | **属性消耗机制** | MP、精力、理智值目前仅由 AI 被动更新。可以在客户端为某些行动类型设定消耗规则，让数值系统更有游戏性 |
| ⭐ | **剧情推进助力** | 当玩家在同一剧情阶段停留超过 N 轮时，自动在系统提示词中加入"推动剧情发展"的指引 |

### 2.2 现有逻辑优化

| 问题 | 说明 | 建议 |
|------|------|------|
| **自动保存频率过高** | 每次发送指令后都自动保存（L2152），对云端用户有一定 API 开销 | 改为每 3–5 轮保存一次，或仅在重要事件后触发 |
| **系统提示词每轮重建** | `buildSystemPrompt()` 每轮都完整重新拼接，约 2000+ 字符 | 增加缓存机制，仅在状态变更时重建 |
| **历史记录全量重渲染** | `renderFullHistory()` 每次 `innerHTML = ''` 后重建全部 DOM | 考虑增量更新或虚拟滚动 |
| **建议请求逻辑重复** | `requestSuggestions()` 和 `requestMoreSuggestions()` 几乎是同一段代码的复制粘贴 | 合并为一个函数，传参区分 |
| **云端/本地存档逻辑重复** | "先尝试云端，再降级本地" 的逻辑在代码中出现了 5 次 | 提取为统一的 `loadFromBestSource(slot)` 工具函数 |
| **UI 禁用/启用模式重复** | 发送时禁用输入框 + 按钮的代码在多处重复 | 提取为 `setInputEnabled(bool)` |

---

## 三、🎨 UI 优化

### 3.1 内联样式清理（22 处）

HTML 中存在 **22 个 `style="..."` 内联样式**，违反了项目自身 CLAUDE.md 中"CSS 变量优先"的规则。

最严重的一处（L146）：

```html
<!-- 10 个属性全塞在 style 里，完全应该写成 CSS 类 -->
<textarea id="novel-preview" style="width:100%;background:var(--bg-input);
border:1px solid var(--border);color:var(--text);padding:12px 16px;
font-size:13px;font-family:var(--font-narrative);border-radius:var(--radius);
resize:vertical;min-height:100px;margin-top:8px">
```

> [!IMPORTANT]
> 建议为所有内联样式创建对应的 CSS 类。特别是 `#destiny-tag`（L206）、`#novel-preview`（L146）、`.api-hint`（L26）等高频元素。

### 3.2 补充缺失的 Meta 标签

```html
<!-- 当前缺少以下全部标签 -->
<meta name="viewport" content="..., viewport-fit=cover">  <!-- 刘海屏适配必需 -->
<meta name="description" content="异界卷 - AI驱动的自由文字冒险游戏">
<meta name="theme-color" content="#0d0c14">
<link rel="icon" href="favicon.ico">
<meta property="og:title" content="异界卷 · 文字冒险">
<meta property="og:description" content="AI驱动的自由文字冒险">
```

> [!NOTE]
> 当前的 `viewport` 标签缺少 `viewport-fit=cover`，这是 `env(safe-area-inset-*)` CSS 工作的前提条件。这意味着 v0.7.0 加入的刘海屏安全区适配可能根本没有生效！

### 3.3 CSS 动画性能问题

| 行号 | 动画 | 问题 | 建议 |
|------|------|------|------|
| L1912 | `@keyframes achShine` | 动画属性使用了 `left`，触发布局重排 | 改用 `transform: translateX()` |
| L313 | `animation: modalIn 0.25s ease` | **`@keyframes modalIn` 根本没有被定义！** 这个动画引用是空的 | 要么删除引用，要么补充定义 |
| 全文 | 11 个 `@keyframes` 动画 | 无 `prefers-reduced-motion` 媒体查询 | 添加减少动画偏好支持 |

### 3.4 CSS 选择器优化

| 行号 | 选择器 | 问题 |
|------|--------|------|
| L1788 | `#narrative-area [style*="display:flex"][style*="gap:12px"]` | **极其危险**——通过匹配 inline style 字符串来选择元素。浏览器需逐一检查所有后代元素的 style 属性。应改用专属 CSS 类 |
| L527 | `.genre-card.selected { position: relative }` | `position: relative` 在 L508 的 `.genre-card` 上已声明，此处冗余 |

### 3.5 `backdrop-filter` 性能注意

全文使用了 **9 次** `backdrop-filter: blur()`。在低端手机上同时显示多个模糊层会导致明显卡顿。建议在不可见的元素上用 JS 动态移除 `backdrop-filter`。

---

## 四、🐛 Bug 修复 & 安全加固

### 4.1 确认 Bug

| 优先级 | 位置 | Bug 描述 |
|--------|------|----------|
| 🔴 **严重** | 游戏.js L3536–3540 | API 密钥从 `localStorage` 读取时**未经解密**直接赋给 `state.apiKey`。用户会在输入框中看到加密后的乱码，首次 API 调用必定 401 失败。异步解密函数 `_loadApiKey()` 在别处被调用，但 `DOMContentLoaded` 时直接读了原始密文 |
| 🔴 **严重** | 样式.css L313 | `animation: modalIn 0.25s ease` 引用了一个**不存在**的 `@keyframes modalIn`，登录弹窗动画静默失败 |
| 🟡 中等 | 游戏.js L1082 | `.focus()` 被调用了两次（复制粘贴 Bug） |
| 🟡 中等 | 游戏.js L313–321 | `getElementById('login-modal')` 无空值检查，若元素不存在会抛异常 |
| 🟡 中等 | 游戏.js L941 | `_loadApiKey().then(...)` 无 `.catch()` 处理，解密失败时静默吞错 |

### 4.2 安全风险

| 优先级 | 位置 | 风险 | 说明 |
|--------|------|------|------|
| 🟡 | L591–592 | Supabase Anon Key 明文暴露 | 这是 publishable key，只要数据库 RLS 策略配置正确就可接受 |
| 🟡 | L2017–2039 | 提示词注入防御基于正则 | 有经验的攻击者可绕过。但对于个人项目足够 |
| 🟢 | XSS 防护 | `escapeHtml()` 使用一致 | ✅ 所有用户输入都被正确转义，未发现 XSS 漏洞 |

### 4.3 全局变量污染

游戏.js 中约有 **100+ 个函数**和 **20+ 个变量**直接暴露在全局作用域中，没有使用 IIFE 或 ES Module 封装。所有 HTML 的 `onclick` 处理器都依赖这些全局函数——如果 JS 加载失败，页面上所有按钮会静默失效。

> [!TIP]
> 长期建议：将整个代码包裹在一个 IIFE 中，只把需要被 HTML `onclick` 调用的函数显式挂载到 `window` 上。或者更好地，全面迁移到 `addEventListener` 模式。

---

## 📊 总结：优先级排序

### 🔴 立即修复（影响功能正确性）

| # | 问题 | 工作量 |
|---|------|--------|
| 1 | API 密钥解密 Bug（L3536–3540） | 5 分钟 |
| 2 | 补充缺失的 `@keyframes modalIn` | 5 分钟 |
| 3 | 删除 `#action-bar` 死代码（3 处 media query） | 3 分钟 |
| 4 | 修复 `.focus()` 重复调用（L1082） | 1 分钟 |

### 🟠 短期改善（提升体验质量）

| # | 问题 | 工作量 |
|---|------|--------|
| 5 | 清理 22 处内联样式 | 30 分钟 |
| 6 | 清理 7 个未使用 CSS 变量 + 2 处硬编码 | 10 分钟 |
| 7 | 补充 viewport-fit=cover 和 meta 标签 | 10 分钟 |
| 8 | 修复 `achShine` 动画使用 `left` 的性能问题 | 5 分钟 |
| 9 | 加入 `prefers-reduced-motion` 支持 | 10 分钟 |
| 10 | 修复脆弱的 `[style*=...]` 属性选择器（L1788） | 5 分钟 |
| 11 | 同步子目录版本或清理存档副本 | 15 分钟 |

### 🟢 长期优化（架构 & 玩法升级）

| # | 问题 | 工作量 |
|---|------|--------|
| 12 | 新增「重新生成」按钮 | 1–2 小时 |
| 13 | 新增「回退一步」功能 | 2–3 小时 |
| 14 | 物品栏加入「使用」交互 | 1–2 小时 |
| 15 | 提取重复的云端/本地存档逻辑 | 1 小时 |
| 16 | 提取 `setInputEnabled()` 工具函数 | 30 分钟 |
| 17 | 合并 `requestSuggestions` 和 `requestMoreSuggestions` | 30 分钟 |
| 18 | 系统提示词缓存机制 | 1 小时 |
| 19 | 历史记录增量渲染 / 虚拟滚动 | 3–4 小时 |
| 20 | IIFE / Module 封装全局变量 | 2–3 小时 |
| 21 | 音效系统（骰子、场景切换、死亡） | 2–3 小时 |
| 22 | 地点足迹地图 | 3–4 小时 |
