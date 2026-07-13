# AI Coding

<p align="center">
  <img src="assets/branding/ai-coding-wordmark.png" alt="AI Coding" width="520" />
</p>

AI Coding 是一个桌面端 AI 编程工具管理器。它把多个 AI 编程 App、模型供应商、提示词、MCP、Skills、会话和工作区管理整合到一个界面里，方便你统一切换和维护。

## 界面截图

| 主界面 | 添加供应商 |
| --- | --- |
| ![主界面](assets/screenshots/main-zh.png) | ![添加供应商](assets/screenshots/add-zh.png) |

## 当前支持

- Claude Code
- Claude Desktop
- Codex
- Gemini CLI
- OpenCode
- bincode
- OpenClaw
- Hermes

其中 `bincode` 在这个分支里按 OpenCode 兼容协议接入，并且已经加入了应用切换。

## 这个开源版包含什么

- 暖橙色 + 深色的 Apple 风格界面
- 底部悬浮 Dock 风格导航
- 多 AI 编程工具的供应商切换
- Prompt、Skills、MCP、Sessions、Workspace、Memory、Tools、Settings 等视图
- `bincode` 品牌接入
- 去掉激活码拦截的开源版本

## 开源版说明

这个仓库当前整理的是一个适合公开发布、二次开发、自行构建的开源版本。

- 当前仓库版本已经移除了激活码入口和前后端激活校验依赖。
- 也就是说，这个开源版不需要再输入激活码才可以进入软件。
- 如果你以后要做商业闭源版，可以再单独把授权逻辑接回去。
- 为了兼容历史配置，部分底层配置目录名称暂时仍沿用旧路径，没有强行迁移。

## 本地开发

### 环境要求

- Node.js 20+
- pnpm
- Rust
- Tauri 开发环境

### 启动开发版

```bash
pnpm install
pnpm tauri dev
```

### 打包

```bash
pnpm tauri build
```

## 项目结构

```text
src/          React + TypeScript 前端
src-tauri/    Rust + Tauri 后端
assets/       截图与品牌资源
```

## 发布到 GitHub 时建议这样展示

- 顶部放软件名称和一句简介
- 放 2 张核心截图
- 列出支持的 App
- 给出本地运行和打包命令
- 明确说明这是“开源版，无激活码限制”

这个 `README_ZH.md` 已经可以直接作为你公开仓库的中文说明。

## License

MIT
