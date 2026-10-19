# 世界线收束器

> 在 Web 管理界面上定义**世界观、剧情大纲、人物与人物关系**，由 AI 作为叙事引擎推进世界线 —— 生成下一阶段叙事、更新人物状态、推进世界时间，并沉淀为一部不断生长的编年史。

本地运行、无需登录、UI 全中文、无需构建步骤。

## ✨ 功能特性

- **世界观管理**：创建任意多个虚拟世界，每个世界拥有独立的世界观、人物、大纲与编年史
- **世界线（多线分支）**：每个世界可拥有多条世界线；一键从任意世界线的任意章节创建分支，分支复制该世界线的人物、关系、大纲与所选分支点之前的历史，之后独立演化、互不影响
- **人物与关系**：管理人物卡（身份、描述、存活/状态/位置/能力/备注），并可在人物间建立盟友、宿敌、血亲、恋人、师徒等关系
- **剧情大纲**：按顺序维护大纲节点，推进时 AI 自动流转节点状态（待开始 → 进行中 → 已完成/跳过）
- **AI 推进世界线**：一键推演下一阶段剧情（可附带"导演指令"引导剧情走向），AI 返回叙事、事件、时间推进、人物状态变化、新登场人物与大纲流转，全部自动合并入库
- **编年史时间线**：每次推演的叙事、事件、人物变化、导演指令、AI 警告完整留档，倒序展示
- **数据安全**：JSON 文件原子写入，每次推进前自动快照备份（每个世界保留最近 10 份）
- **兼容多种 AI 服务**：任何 OpenAI 兼容的 `/chat/completions` 接口，如 DeepSeek、GLM、OpenAI、本地 Ollama 等

## 🚀 快速开始

要求：**Node.js 18+**（推荐 20+，本机开发环境为 Node 24）。

### Windows

双击 `start.bat`（首次运行自动 `npm install` 并打开浏览器）。

### 命令行

```bash
npm install
npm start          # 或 npm run dev（文件变更自动重启）
```

打开浏览器访问 **http://localhost:3000**（端口可用环境变量 `PORT` 修改）。

### 配置 AI

1. 进入 **设置** 页，填写 AI 服务参数：

   | 参数 | 说明 | 示例 |
   |---|---|---|
   | baseUrl | OpenAI 兼容接口地址（通常以 `/v1` 结尾） | DeepSeek：`https://api.deepseek.com/v1`；Ollama：`http://localhost:11434/v1` |
   | apiKey | 接口密钥（留空则不发送 Authorization 头，适配本地服务） | — |
   | model | 模型名称 | `deepseek-chat`、`glm-4`、`qwen2.5` |
   | temperature | 采样温度（0~2，默认 0.8） | — |

2. 点击 **测试连通性** 验证（会检查 `/models` 接口、延迟与模型是否存在），通过后保存。

### 创建并推进世界

1. **世界列表** → 新建世界（名称 + 世界观）
2. 在世界详情页添加**人物**、**大纲**（也可为人物建立关系）
3. 点击 **「推进世界线」**，可输入导演指令（如"主角与反派初次交手，主角落败重伤"）
4. 等待 AI 推演完成，查看新叙事；在 **编年史** 中回顾完整时间线

### 世界线与分支

- 世界详情页顶部的**世界线选择器**可切换当前世界线；切换后人物、关系、大纲、章节随之切换
- 在任意章节点击 **「⤴ 在此分支」**，或点击顶部的 **「⤴ 创建分支」**，在可视化**章节节点列表**中点击选择分支点（某一章），即可从该章之后开出一条新世界线
- 分支继承**所选章节结束时的状态**：人物、关系、大纲与局势均回取该章完成时的快照，加上该章之前的历史；之后独立演化、互不影响
- 每次推进都会在章节条目中保存该章完成时的世界线状态快照；在旧版本中生成的历史章节没有快照，从这些章节分支时会回退使用世界线当前最新状态（界面会提示）
- 主线不可删除，有衍生分支的世界线需先删除其分支
- 分支列表见「总览」页的世界线面板（支持从任意世界线继续分支）

> 推进是同步长请求（AI 生成可能超过 5 分钟），服务端已关闭默认 300 秒请求超时；同一世界同一时刻只允许一次推演（并发请求返回 409）。

## 📁 项目结构

```
├── package.json            # 仅依赖 express；scripts: start / dev(node --watch)
├── server.js               # 入口：json(2mb)、/api 路由、静态托管 public/、requestTimeout=0
├── start.bat / start.sh    # 一键启动脚本（自动检查 Node、安装依赖）
├── lib/
│   ├── store.js            # 设置读写、世界文件 CRUD、原子写、推进前备份
│   ├── aiClient.js         # chatCompletion() / testConnection()，AbortController 超时
│   ├── jsonUtils.js        # 提取 JSON（剥代码围栏/截取花括号）、类型矫正
│   └── advance.js          # 推进引擎：组装提示词 → 调 AI → 解析容错 → 合并落库；内存锁防重入
├── routes/
│   ├── worlds.js           # 世界/人物/大纲/人物关系 CRUD + 世界线推进
│   └── settings.js         # 设置读写 + 连通性测试
├── public/
│   ├── index.html          # SPA 外壳（顶栏 + #app）
│   ├── css/style.css       # 深色系全量样式
│   └── js/                 # api.js / ui.js / app.js(hash 路由) / views/*
└── data/                   # 运行时生成：settings.json、worlds/*.json、backups/（勿提交）
```

## 🔌 REST API

错误统一返回 `{ "error": "中文信息" }`；常见状态码：404 不存在 / 400 缺参数 / 409 推进中 / 502 AI 失败（附原始输出摘录）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET / PUT | `/api/settings` | 读取 / 合并保存设置 |
| POST | `/api/settings/test` | 连通性测试（GET /models，返回 ok/延迟/modelExists） |
| GET / POST | `/api/worlds` | 世界列表摘要 / 创建 `{name, worldview?}` |
| GET / PUT / DELETE | `/api/worlds/:id` | 世界详情 / 改名改世界观 / 删除 |
| POST | `/api/worlds/:id/worldlines` | 创建分支世界线 `{name, parentId?, branchFromSeq?}`（复制所选分支点章节结束时刻的人物/关系/大纲状态与分支点前章节；返回 `{worldline, usedSnapshot, fallbackToCurrent}`） |
| PUT / DELETE | `/api/worlds/:id/worldlines/:lid` | 重命名 / 删除分支世界线（主线不可删、有子分支不可删） |
| POST | `/api/worlds/:id/advance` | `{directorNote?, worldlineId?}` 同步长请求，返回 `{entry, worldFile}` |
| POST | `/api/worlds/:id/characters` | 新增人物 |
| PUT / DELETE | `/api/worlds/:id/characters/:cid` | 修改 / 删除人物（手动纠正 AI 结果的入口） |
| POST | `/api/worlds/:id/outline` | 新增大纲节点 |
| PUT / DELETE | `/api/worlds/:id/outline/:nid` | 修改 / 删除大纲节点 |
| POST | `/api/worlds/:id/relationships` | 建立人物关系 |
| PUT / DELETE | `/api/worlds/:id/relationships/:rid` | 修改 / 删除人物关系 |

> 人物 / 大纲 / 关系接口均支持 `?worldline={id}` 指定目标世界线（缺省为主线）；世界线 id 可通过 GET `/api/worlds/:id` 的 `worldlines` 数组获取。
> 编年史不设写接口（不可变，靠推进前备份兜底）。

## 🗄️ 数据存储

- 每个世界一个 JSON 文件：`data/worlds/{worldId}.json`，结构（version 2）：

  ```jsonc
  {
    "version": 2,
    "world": { "id", "name", "worldview", "createdAt", "updatedAt" },
    "worldlines": [
      {
        "id": "l_…", "name": "主线", "parentId": null, "branchFromSeq": null,
        "currentState": { "worldTime", "worldStatus", "outlineCursorId" },
        "characters": [], "relationships": [], "outline": [], "timeline": []
      }
    ]
  }
  ```

- 老版本（v1）文件在首次访问时自动迁移：原顶层 `characters/outline/relationships/timeline/currentState` 收进「主线」世界线
- 每个章节条目（`timeline[]`）带有 `snapshot` 字段，保存该章完成时的人物/关系/大纲/局势状态，供创建分支时回取「节点时刻」的状态
- 全局设置：`data/settings.json`（含 apiKey，**注意不要外泄**，`data/` 已在 `.gitignore` 中排除）
- 备份：每次推进前快照至 `data/backups/`，每个世界保留最近 10 份

## 📄 许可

本项目使用 [GPL-3.0](./LICENSE) 许可证。
