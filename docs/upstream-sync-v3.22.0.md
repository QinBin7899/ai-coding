# AI Coding 3.22.0 上游增量同步台账

> 2026-09-08 核查记录：原固定范围已逐项处置，并额外纳入最新正式版中的八项修复或预设变更。前端、Rust、桌面包及原生搜索验证通过；交付记录见文末。

## 核查依据

- 固定基础：[CC Switch v3.20.1](https://github.com/farion1231/cc-switch/tree/v3.20.1)。
- Claude 原计划固定终点：[`38cfafdc199604b132be5eafe3f5384d85124a81`](https://github.com/farion1231/cc-switch/commit/38cfafdc199604b132be5eafe3f5384d85124a81)。[此范围](https://github.com/farion1231/cc-switch/compare/v3.20.1...38cfafdc199604b132be5eafe3f5384d85124a81)由 GitHub Compare API 确认有 32 个提交。
- 2026-09-08 在线复核：最新正式版为 [CC Switch v3.20.2](https://github.com/farion1231/cc-switch/releases/tag/v3.20.2)，2026-09-07 14:25:28 UTC 发布；main 和 release 终点为 [`f3b18df12007d0fd79fd8ad8d310880664015197`](https://github.com/farion1231/cc-switch/commit/f3b18df12007d0fd79fd8ad8d310880664015197)。
- 固定终点之后还有 [22 个提交](https://github.com/farion1231/cc-switch/compare/38cfafdc199604b132be5eafe3f5384d85124a81...f3b18df12007d0fd79fd8ad8d310880664015197)：20 项功能/修复和 2 项发版记录。上游发布说明所写的 52 项功能提交不等于本地已同步数。
- 本次采用三方源码对照和小范围移植，保留已有未提交定制。没有对项目执行整包 merge、rebase 或覆盖式替换。

## 原固定范围：32 项处置

“保留本地差异”也是明确处置，不应被描述成与上游全部行为相同。

| 提交 | 内容 | 处置与对应行为 |
| --- | --- | --- |
| [d8065cc](https://github.com/farion1231/cc-switch/commit/d8065cc628fcd373d00c4363d718095f19e78c9e) | fix(proxy): preserve mid-conversation system messages for prefix cache (#6941) | **已存在，保留本地实现**；会话中途 system 保留原顺序；首段 system 合并，保护前缀缓存。 |
| [c88b00f](https://github.com/farion1231/cc-switch/commit/c88b00faf6c6132b86de1e42d73917a37c071ebd) | fix(codex): neutralize managed-OAuth official-auth fallback flag | **已存在，保留本地实现**；代理注入 OAuth 的有效快照中和 requires_openai_auth；排除官方 Codex OAuth。 |
| [c08040e](https://github.com/farion1231/cc-switch/commit/c08040e926bd355c423ccd410eb59a63f447a38f) | fix(codex): declare xhigh reasoning tier for grok-4.5 xAI presets | **保留本地差异**；本地 Grok 4.5 保留 low/medium/high 三档；不采用上游 xhigh 声明。 |
| [b7da894](https://github.com/farion1231/cc-switch/commit/b7da894b3dc9f83c3a17688814261a4bc0141302) | fix(codex): sanitize xAI native Responses for Grok | **已存在，保留本地实现**；xAI 原生 Responses schema 清理。 |
| [914c8bb](https://github.com/farion1231/cc-switch/commit/914c8bb5af48f422e952f528303fc6bcc0baa034) | fix(codex): rewrite Grok agent_message input items | **已存在，保留最终净效果**；将不兼容 agent_message 改写为普通消息。 |
| [0a9a437](https://github.com/farion1231/cc-switch/commit/0a9a43785c99303e0af73168f9c324623a308481) | refactor(codex): simplify xAI agent_message rewrite | **已存在，采用最终净效果**；agent_message 简化重构，不重复中间版本。 |
| [dfc9b06](https://github.com/farion1231/cc-switch/commit/dfc9b066dd14851623af71a14d0cfa95f436dc8e) | fix(codex): remap grok unknown models for subagents | **已存在**；未知 Codex 子代理角色模型映射到供应商 Grok 模型。 |
| [bf325b2](https://github.com/farion1231/cc-switch/commit/bf325b256fd65878670baf135c2617802c2049ff) | refactor(codex): thin xAI native request gate | **本地实现取代**；保留精确 api.x.ai 主机匹配，比上游 substring gate 更严格。 |
| [527b56f](https://github.com/farion1231/cc-switch/commit/527b56f8b2246c7d6c8a873d15bdc8727339b65c) | fix(ci): clear clippy dead_code and question_mark | **按现有实现处理**；吸收相关未使用代码/简化修复；cargo check、fmt、Clippy 已通过。 |
| [9e11005](https://github.com/farion1231/cc-switch/commit/9e1100534b6c0fd413e56f415ea3017cc200a7cf) | fix(codex): address xAI native Responses review findings | **已存在**；xAI schema 与 SSE 整数参数兼容最终实现；纳入本轮 Rust 回归验证。 |
| [d05a11c](https://github.com/farion1231/cc-switch/commit/d05a11cc218dfc2fa16685610db2b57826a70409) | refactor(codex): drop unused namespace SSE restore helpers | **已存在**；采用最终 namespace/SSE helpers，无需保留废弃中间函数。 |
| [054673e](https://github.com/farion1231/cc-switch/commit/054673e0b8cca7d8bd8c67658f2c28e63b2855e0) | fix(codex): reject 2^64 in whole-float integer rewrite | **已存在**；拒绝把 2^64 浮点边界转换成错误的 u64 整数。 |
| [b45b2bd](https://github.com/farion1231/cc-switch/commit/b45b2bd1c9874ae44d2216ba9ef2e9c3d235bed2) | feat(presets): add Tencent Token Plan presets across six apps (#7011) | **本轮补齐**；六种 Tencent Token Plan × 六应用；保留已有 Tencent Hunyuan。 |
| [21fda0e](https://github.com/farion1231/cc-switch/commit/21fda0ea01dd6df5bf610d30924bb6ee5f74dc9c) | test(codex): align grok-4.5 reasoning tier expectations with 4-tier presets | **保留本地差异**；Grok 4.5 测试保持本地三档策略，不改成上游四档预期。 |
| [273c9cc](https://github.com/farion1231/cc-switch/commit/273c9cc24fd091f8aa2f49d6d683d6c1a736e430) | fix(codex): mark glm-5.3 as text-only (#6851) | **已存在**；GLM-5.3 作为确认纯文本模型；源码与固定快照一致。 |
| [6d25f34](https://github.com/farion1231/cc-switch/commit/6d25f34eaf710f96e41e906834cafcbe330e9414) | feat(presets): add QwenCloud presets across seven apps (#6214) | **本轮补齐**；三种 QwenCloud × 七应用，及 Pi 模型目录能力。 |
| [92a9b4a](https://github.com/farion1231/cc-switch/commit/92a9b4a91d758d32c15490d50f1979425e39ace4) | fix(usage): compact trend token axis labels (#7016) | **已存在**；用量趋势 token 轴按地区显示紧凑数字。 |
| [e4b03a3](https://github.com/farion1231/cc-switch/commit/e4b03a38c7412069294437a749d9e136d29e6a89) | fix(usage): stop deferring resumed Codex rollouts on filename/meta ID mismatch (#6905) | **已存在**；Codex 恢复双 UUID rollout；逻辑会话身份与物理请求去重分开。 |
| [cbbf727](https://github.com/farion1231/cc-switch/commit/cbbf727914cb819add12dd783e7d25e70861a14a) | feat(presets): add AICodeWith presets across eight apps | **本轮补齐**；AICodeWith × 八应用和图标。 |
| [68d71cc](https://github.com/farion1231/cc-switch/commit/68d71cc6392045dd309f322ac3eebb82a7000434) | feat(presets): add 9527CODE presets across nine apps | **功能纳入，推广省略**；9527CODE × 九应用；本次新增预设不引入返利参数、合作伙伴徽章及推广文字。 |
| [4f62f67](https://github.com/farion1231/cc-switch/commit/4f62f676bd248ae3b33dae1bde37009b0c551c34) | fix(presets): let the 9527CODE icon follow the theme | **已存在**；9527CODE SVG 使用 currentColor，预设不固定 iconColor。 |
| [b1250dc](https://github.com/farion1231/cc-switch/commit/b1250dc7ace164efc1f6fbdd9353cac3db2df2f2) | fix(tools): read Hermes latest version from GitHub Releases instead of PyPI | **已存在**；Hermes 优先 GitHub release 名称语义版本；拒绝日历 tag 误判。 |
| [460aa8c](https://github.com/farion1231/cc-switch/commit/460aa8c73dcb2edac567b8902afa540761696d59) | fix(pricing): seed Claude Fable 5.1 / Mythos 5.1 and restore Sonnet 5 to the $2/$10 standard price (#7051) | **已存在**；Fable/Mythos 5.1 定价、Sonnet 5 旧 seed 值守卫修复，保留自定义价。 |
| [c58a25b](https://github.com/farion1231/cc-switch/commit/c58a25b2ae583710f24ce8867e48340bda619f7d) | fix(a11y): add accessible names to GUI controls (#7049) | **已存在**；九处控件可访问名称；保留 AI Coding 布局与品牌。 |
| [92d5291](https://github.com/farion1231/cc-switch/commit/92d529168560bdec4ca1b429b50a203c5fc8a87e) | fix(codex): reject duplicate managed accounts (#7061) | **已存在**；锁内拒绝相同 workspace 和稳定用户身份的重复 OAuth 账号。 |
| [bc4ed66](https://github.com/farion1231/cc-switch/commit/bc4ed66d3abe587b16338ef19853c7ee76b88ed7) | fix(codex): backfill supports_parallel_tool_calls in catalog template (#6666) | **已存在**；catalog 补 supports_parallel_tool_calls 必填字段。 |
| [e47b5fc](https://github.com/farion1231/cc-switch/commit/e47b5fca151e2211425a98f1fa4187514cc06de5) | fix(codex): point Zhipu GLM presets at the official Responses endpoint (#6957) | **已存在**；智谱官方 Responses 端点、主机标签边界及旧卡 profile 回退。 |
| [db41d70](https://github.com/farion1231/cc-switch/commit/db41d701879592b8eca938cbe5c5ac28dd732b9f) | fix(codex): move $ref siblings into allOf for Moonshot/Kimi chat upstreams (#6863) | **已存在**；仅 Moonshot/Kimi Chat 路径将 $ref 兄弟字段移入 allOf。 |
| [5a04034](https://github.com/farion1231/cc-switch/commit/5a04034816e63e034d5ba9031eb10cec2190e8d1) | fix(codex): disable supports_search_tool for DeepSeek catalog models (#6653) | **已存在；修正旧测试**；DeepSeek catalog supports_search_tool=false；修正遗留 true 断言，Rust 回归已通过。 |
| [db34612](https://github.com/farion1231/cc-switch/commit/db34612807244643d85ccedf9704c965facc4cba) | fix(codex): align OAuth client identity for GPT-6 (#7132) | **已存在**；Codex OAuth 生成和模型发现共用 0.153.4 客户端身份。 |
| [741e802](https://github.com/farion1231/cc-switch/commit/741e802f1da287c182e81b479bd12ef6fa8c1fd9) | feat(pricing): add GLM-5.3 to built-in model pricing table (#6591) | **已存在**；增加 GLM-5.3 内置模型定价。 |
| [38cfafd](https://github.com/farion1231/cc-switch/commit/38cfafdc199604b132be5eafe3f5384d85124a81) | fix(claude): expose Opus 5 and Sonnet 5 in takeover mode (#5882) | **已存在**；Claude 接管模式开放 Opus 5 / Sonnet 5。 |

## 最新正式版额外范围：22 项处置

实际纳入 5f3ea4d、1b34d32、3c1d3c9、12296ae、75be16c、2510a4e、bd1265d、648d89c 八项，其中 75be16c 的文案已存在，本轮补上回归覆盖。其余条目本次未合并；这表示本次交付的范围边界，不表示它们无法与 AI Coding 兼容。

| 提交 | 内容 | 当前处置 |
| --- | --- | --- |
| [b5f9fd0](https://github.com/farion1231/cc-switch/commit/b5f9fd0d044ae478ed9e62ae9b00d2fc94506dec) | fix(codex): resolve input_modalities for unknown models in vendor catalog (#6750) | **本次未纳入**；未知厂商 catalog 型号输入模态修复留待后续独立验证，现有显式配置策略不改。 |
| [291946d](https://github.com/farion1231/cc-switch/commit/291946d5148123d756201e49a33275a5389cb348) | feat(pricing): add GPT-6 Astra pricing (#7162) | **本次未纳入**；GPT-6 Astra 新增定价行留待下一次定价同步验证。 |
| [872ec77](https://github.com/farion1231/cc-switch/commit/872ec775b854ee0e9d015b530e38b1c186eea425) | fix(proxy): enable parallel tool calls for Codex OAuth (#7024) | **本次未纳入**；并行工具默认值与显式 disable_parallel_tool_use 映射留待独立代理回归。 |
| [66ae644](https://github.com/farion1231/cc-switch/commit/66ae6446144a763302a6e399ac89e8abcc129021) | feat(pricing): add GLM-5.3 Flash pricing (#7163) | **本次未纳入**；GLM-5.3 Flash 新增定价行留待下一次定价同步验证。 |
| [5f3ea4d](https://github.com/farion1231/cc-switch/commit/5f3ea4d6eabe38881d2c79a7a8983e1e662007cc) | feat(provider): extend PPIO presets for Pi (#6870) | **已纳入**；Pi PPIO 预设与 Claude modelsUrl；本次新增预设不引入返利参数，不迁移已存供应商。 |
| [9692ff5](https://github.com/farion1231/cc-switch/commit/9692ff5e22327f0d2340d24271cf897f9d64fafd) | feat(pricing): add Gemini 3.8 Flash pricing (#7164) | **本次未纳入**；Gemini 3.8 Flash 新增定价行留待下一次定价同步验证。 |
| [17be909](https://github.com/farion1231/cc-switch/commit/17be909256268591ae35272b034628d4749d44f0) | fix(codex): proxy image generations endpoint (#7036) | **本次未纳入**；Images generations 路由留待与 edits 路由一起完成独立端点回归。 |
| [1b34d32](https://github.com/farion1231/cc-switch/commit/1b34d3225b8f5bdc3bdcfee02b322ddf7e53f4e0) | feat(pi): add Tencent TokenHub and Token Plan presets (#7159) | **已纳入**；Pi Tencent TokenHub / Token Plan 预设和 12 条目录能力；仅在预设目录中移除已除名 minimax-m2.5，不改用户已有卡。 |
| [3e2562a](https://github.com/farion1231/cc-switch/commit/3e2562a4b2036c2f736860e5377b73130930df38) | fix(usage): widen pricing model source select to fit localized labels | **本次未纳入**；价格来源下拉框宽度调整留待后续界面验证。 |
| [3c1d3c9](https://github.com/farion1231/cc-switch/commit/3c1d3c94ac005b80e0f03dc0382fe10ba11b311e) | fix(tests): isolate LOCALAPPDATA so tests stop writing the real Claude Desktop config | **已纳入**；Windows 集成测试的 LOCALAPPDATA 隔离到测试目录。 |
| [12296ae](https://github.com/farion1231/cc-switch/commit/12296aeb4d91ab477fa3817e246fdf237211c1cb) | fix(proxy): stop mask_url panicking on multi-byte UTF-8 near the truncation boundary | **已纳入**；mask_url 多字节 UTF-8 截断不再 panic，含回归测试。 |
| [75be16c](https://github.com/farion1231/cc-switch/commit/75be16cbf659c72116a39ceadb6ba0c2c7df4539) | fix(i18n): add the missing pi.form.providerKeyDuplicate and common.collapse keys | **已存在，本轮增加覆盖**；四语言 common.collapse 与 pi.form.providerKeyDuplicate 文案已在本地，补 locale 回归断言。 |
| [2510a4e](https://github.com/farion1231/cc-switch/commit/2510a4e2ab084dcbac9e348ca02b07fdf7a70647) | fix(claude): exclude workflow journal.jsonl from session list | **已纳入**；Claude 列表排除工作流 journal.jsonl，真实会话与 agent 文件行为有回归覆盖。 |
| [e3b5a62](https://github.com/farion1231/cc-switch/commit/e3b5a628278ff25de002eee11cd700bdef879230) | docs: fix the locales path in the README directory trees (#6100) | **按本地文档独立维护**；上游 README 目录树路径纠错，不整页覆盖 AI Coding 文档。 |
| [bd1265d](https://github.com/farion1231/cc-switch/commit/bd1265d2abdce53f24f8dfe80ce119217bd43331) | fix(updater): show the real reason when an update check fails (#6482) | **已纳入**；检查更新失败时展示真实错误原因，并覆盖字符串与 Error 形态。 |
| [2cd4006](https://github.com/farion1231/cc-switch/commit/2cd4006456e1f596e10431e1b516cf1262aa6233) | fix(codex): stamp requires_openai_auth on takeover writes to match the live login state | **本次未纳入**；live auth store / 登录状态与 takeover 标志联动留待独立认证兼容验证。 |
| [ccc140a](https://github.com/farion1231/cc-switch/commit/ccc140a2c02886609c3edf743f1af5675be8a872) | feat(pricing): refresh seed for September 2026 vendor price changes | **本次未纳入**；九月整组价格刷新留待单独核对 seed 修复链及自定义价保护。 |
| [648d89c](https://github.com/farion1231/cc-switch/commit/648d89cd7bec94bb59e97517436dd4fcfe2d944d) | fix(provider): pin models URL for JieKou and Novita Claude presets | **已纳入**；JieKou / Novita Claude modelsUrl 指向正确的 OpenAI models 地址。 |
| [e724270](https://github.com/farion1231/cc-switch/commit/e724270dbbee32bc3f58c84c40c6d0112573214d) | fix(codex): proxy image edits endpoint | **本次未纳入**；Images edits 路由与 generations 增量留待一同验证。 |
| [389dd96](https://github.com/farion1231/cc-switch/commit/389dd96cb8567f41d05ba4aaebce8a73dc524040) | feat(provider): add SoleAPI sponsor presets across all nine apps | **本次未纳入**；SoleAPI 新供应商留待后续预设同步；本次不引入赞助 banner、partner 字段和返利信息。 |
| [b625443](https://github.com/farion1231/cc-switch/commit/b6254432a93e80dab10a517b589d09ca111cf31b) | chore(release): v3.20.2 | **不直接采用上游版本号**；AI Coding 使用独立 3.22.0 版本；不改为 CC Switch 3.20.2。 |
| [f3b18df](https://github.com/farion1231/cc-switch/commit/f3b18df12007d0fd79fd8ad8d310880664015197) | docs(release): add v3.20.2 release notes | **作为核查来源**；上游 release notes 保留引用；AI Coding 说明按实际纳入范围独立编写。 |

## 预设覆盖与定制保护

原固定范围补齐 Tencent Token Plan 六种产品（Claude、Claude Desktop、Codex、Hermes、OpenClaw、OpenCode）；QwenCloud 三种产品（前述六应用与 Pi）；AICodeWith（除 Grok Build 以外的八应用）；9527CODE（九应用）。另追加最新正式版的 Pi Tencent TokenHub / Token Plan 和 PPIO 预设，补模型目录和 modelsUrl 修复，并仅从预设目录移除上游已除名的 Tencent minimax-m2.5 条目。按应用协议分别保留 Responses、Chat Completions 与 Anthropic 端点。此处是预设目录新增，不自动改写用户已经保存的供应商卡。

AI Coding 的名称、暖橙主题、Dock、Bincode 应用、会话置顶/归档/导出、跨工具记忆同步、搜索与实时同步均沿用。`~/.zhongguoai`、`ai-coding.db`、`com.aicoding.desktop`、本地存储键及 AI Coding 更新源按本地身份维护。Grok Build/Pi 默认隐藏；已有代理状态探测死锁修复、隐藏应用回退修复不回滚。9527CODE 图标跟随主题。本次新增预设不引入返利参数或推广徽章；既有预设中的 UTM 追踪链接保持原样，不借本次更新做无关修改。

## 验证与交付记录

- 交接时：源代码和安装版本均为 3.21.0；源代码中已有搜索修复，尚未装入用户正在运行的版本。
- 本轮修正 DeepSeek 的旧断言并补上必要回归；Rust 测试合计 **2917 通过、5 忽略**。
- 前端完整测试：**137 个文件、1101 项测试全部通过**；`format:check`、`typecheck` 及生产 renderer build 通过。
- `cargo check`、`cargo fmt --check`、Clippy：通过；Tauri 3.22.0 macOS arm64 DMG 构建通过，签名、版本、bundle ID、只读挂载和复制后二进制散列校验通过。
- 已安装并从 `/Applications/AI Coding.app` 重新启动 3.22.0；桌面保留新 DMG。原生界面验证精准模式可选、正文短语可检索、关闭后重开保留模式，既有供应商记录核对一致。
- 源码与安装包随 `v3.22.0` 仓库版本分发；安装包 SHA256：`269720dc376f71a792d7c1383cff583931013a48f670b22782c2767087fd6e07`。

安装包在仓库 `downloads/`，下载入口已更新；上游未纳入项保留以上明确记录。
