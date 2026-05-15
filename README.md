# 异界卷 · 文字冒险

自由文字冒险游戏，基于 DeepSeek API 驱动。扮演你创造的角色，在数十个世界中自由探索。

## 玩法

1. 输入 DeepSeek API 密钥
2. 选择频段（男频/女频）→ 选择世界 → 创建角色
3. 自由输入你想做的事，AI 实时叙事并推进剧情

## 特性

- **30+ 世界模板**：奇幻仙侠、科幻、武侠、宫斗、霸总、无限流、克苏鲁……
- **穿越小说**：上传 .txt 小说，AI 解析世界观后穿入书中
- **自定义世界**：自由书写世界观，或让 AI 随机生成
- **命格系统**：影响命运走向
- **云端存档**：支持邮箱注册登录，存档跨设备同步
- **游客模式**：无需注册，一键开玩

## 账号类型

| 类型 | 存档位置 | 跨设备同步 | 说明 |
|------|---------|-----------|------|
| 游客 | localStorage | 否 | 无需注册，一键开玩 |
| 本地账号 | localStorage | 否 | 本地密码保护，不跨设备 |
| 云端账号 | localStorage + Supabase | 是 | 邮箱注册，存档跨设备同步 |

## 技术栈

纯静态前端，部署于 GitHub Pages。

- **AI 引擎**：DeepSeek Chat API
- **后端服务**：Supabase Auth（认证） + Supabase Database（PostgreSQL）
- **数据存储**：localStorage（本地） + Supabase game_saves 表（云端）

## Supabase 配置

1. 创建 [Supabase](https://supabase.com) 项目
2. 在 SQL Editor 中执行 `supabase/schema.sql`
3. 将 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 填入 `游戏.js`

## 本地运行

直接用浏览器打开 `index.html`，或启动任意静态服务器：

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 项目结构

```
index.html   — 主页面（标题屏、世界选择、角色创建、游戏界面）
游戏.js      — 核心逻辑（身份系统、AI交互、存档系统、云端同步）
数据.js      — 静态数据（世界定义、成就系统、命格列表）
样式.css     — 全局样式
管理.html    — 后台管理面板
supabase/    — 数据库 schema（schema.sql）
```

## 云端存档测试

1. 设备 A：登录云端账号 → 开始游戏 → 保存
2. 设备 B：打开游戏 → 登录同一账号 → 标题页应出现「继续未完成的冒险」和「读取存档」
3. 点击「继续」从云端恢复自动存档，或打开存档管理读取手动存档

## 部署

推送到 `master` 分支，GitHub Pages 自动部署。
