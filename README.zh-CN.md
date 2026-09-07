# GPT Web Image

简体中文 | [English](README.md)

一个通过已连接的 Google Chrome，在 ChatGPT 网页端生成图片的 Codex Skill。它会把每个出图任务交给独立的 `gpt-5.6-luna` 子代理，通过准备锁保护 ChatGPT 跨标签页同步的草稿状态，并将完成的图片导出为本地文件。

## 前置条件

安装此 Skill 前，请先完成以下准备：

1. 安装 **Google Chrome**。
2. 安装并启用 Computer Use 使用的 **Codex Chrome 连接插件/扩展程序**，然后将 Chrome 连接到 Codex。
3. 在 Chrome 中打开 [ChatGPT](https://chatgpt.com/)，登录具备图片生成权限的账号。
4. 确认 Codex 提供 `mcp__cua_repl` 浏览器控制工具和 `gpt-5.6-luna` 协作模型。

如果缺少 Chrome、连接插件或 ChatGPT 登录状态，本 Skill 会直接停止并报告缺失项。图片生成任务执行期间不会安装或排查这些前置条件。

## 安装

将仓库克隆到 Codex Skills 目录：

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/Vieeeeeee/gpt-web-image.git ~/.codex/skills/chatgpt-web-image
```

如果目录已经存在，请进入该目录更新：

```bash
git pull --ff-only
```

重启 Codex 或新建一个任务，让 Codex 重新发现此 Skill。

## 使用方法

选择或提及 `chatgpt-web-image`，然后提供：

- 一段非空的图片提示词；
- 可选的一张或多张本地参考图绝对路径。

示例：

```text
使用 chatgpt-web-image，生成一张电影感产品摄影：一盏半透明橙色台灯放在深色胡桃木书桌上。
```

使用参考图时，请说明哪张图控制原始内容，哪张图控制视觉处理方式。

## 文件说明

- `SKILL.md`：Codex 执行说明、任务编排规则和安全边界。
- `browser-flow.mjs`：浏览器提交、准备锁、等待生成和图片导出辅助程序。

## 运行规则

- 每请求一张成品图，只授权提交一次 ChatGPT 生成请求。
- 每个任务都会使用一个全新的普通 ChatGPT 对话。
- ChatGPT 可能在多个标签页之间同步未发送的草稿，因此提示词准备过程需要串行执行。
- 导出失败时会恢复原有对话继续处理，不会仅为修复下载而重新生成图片。
- 当前界面定位规则适配中文 ChatGPT 网页界面。

## 已验证范围

单参考图任务已经完成实际验证，可通过一次回车提交并自动交付 PNG。零参考图和多参考图的输入处理已经实现，但尚未完成端到端实测；新版多任务准备流程也尚未完成整批回归测试。
