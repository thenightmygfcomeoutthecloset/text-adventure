# 异界卷 · 文字冒险

> 当前版本：v0.6.5「丝滑动效」

纯静态前端文字冒险游戏。AI 叙事引擎由 DeepSeek Chat API 驱动，支持 Supabase 云端存档。

## 快速开始
1. 用浏览器打开 `index.html`
2. 输入 DeepSeek API Key（仅存于本地 localStorage）
3. 选择"游客登录"或注册/登录云端账号
4. 开始冒险

## 技术栈
- DeepSeek Chat API（用户自备 Key）
- Supabase Auth + PostgreSQL（云端同步）
- 纯原生 JS / CSS / HTML，无构建工具
