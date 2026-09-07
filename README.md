# GPT Web Image

[简体中文](README.zh-CN.md) | English

A Codex Skill that generates images through ChatGPT Web in connected Google Chrome. It delegates each requested output to an isolated `gpt-5.6-luna` subagent, protects ChatGPT's synchronized draft state with a preparation lock, and exports completed images to local files.

## Prerequisites

Before installing this Skill, set up all of the following:

1. Install **Google Chrome**.
2. Install and enable the **Codex Chrome connection plugin/extension** used by Computer Use, then connect Chrome to Codex.
3. Open [ChatGPT](https://chatgpt.com/) in Chrome and sign in to an account with image generation access.
4. Make sure Codex provides the `mcp__cua_repl` browser-control tool and the `gpt-5.6-luna` collaboration model.

The Skill intentionally stops when Chrome, the connection plugin, or the ChatGPT login is missing. It does not install or troubleshoot those prerequisites during an image-generation job.

## Install

Clone the repository into the Codex Skills directory:

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/Vieeeeeee/gpt-web-image.git ~/.codex/skills/chatgpt-web-image
```

If the directory already exists, update it from inside that directory:

```bash
git pull --ff-only
```

Restart Codex or open a new task so the Skill can be discovered.

## Use

Select or mention `chatgpt-web-image`, then provide:

- a non-empty image prompt;
- optionally, one or more absolute local image paths as references.

Example:

```text
Use chatgpt-web-image to create a cinematic product photograph of a translucent orange lamp on a dark walnut desk.
```

When reference images are supplied, state which image controls source content and which controls visual treatment.

## Files

- `SKILL.md` — Codex instructions, orchestration rules, and safety boundaries.
- `browser-flow.mjs` — browser submission, locking, generation waiting, and image-export helper.

## Operational notes

- One requested output authorizes one ChatGPT submission.
- Fresh, ordinary ChatGPT conversations are used for every job.
- Prompt preparation is serialized because ChatGPT can synchronize unsent drafts across tabs.
- Export recovery resumes the existing conversation and never regenerates merely to repair a download.
- The current UI locators target a Chinese-language ChatGPT interface.

## Verified scope

A one-reference run has completed successfully with automatic PNG delivery. Zero-reference and multiple-reference input handling is implemented but has not yet been live-tested end to end. The revised multi-job preparation flow has not yet passed a full batch retest.
