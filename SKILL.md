---
name: chatgpt-web-image
description: Generate images in ChatGPT Web via a Luna subagent and connected Chrome, with a required prompt and zero or more reference images; return files inline. Use when the user chooses webpage generation or this skill.
---

# ChatGPT Web Image

## Prerequisites

- Google Chrome is installed.
- The Codex Chrome connection plugin/extension is installed, enabled, and connected to Chrome.
- `https://chatgpt.com/` is logged in and image generation is available for the account.

If Chrome, the connection plugin, or the ChatGPT login is unavailable, stop and report the missing prerequisite. Do not switch browsers or attempt installation during a generation job.

## Parent: isolated jobs

- Input: nonempty `prompt`; optional `files` array of absolute image paths (default `[]`, supporting zero, one or many). Multiple input images belong to ONE job unless the user requests separate outputs. Preserve source/style-reference roles. Do not invent attachments, variants or batch size.
- Per requested output, spawn a standard collaboration subagent with `model:"gpt-5.6-luna"`, `reasoning_effort:"medium"`, `fork_turns:"none"`. Give only prompt, files, unique absolute outputDir, this skill path, job ID, shared lockDir and one-submission authorization. No conversation history or irrelevant context. Child does not delegate again. If unavailable, report; do not silently switch models.
- Batch up to available slots, reserving the parent. Give preparation permission to ONE job at a time: ChatGPT synchronizes unsent drafts across tabs. Grant the next only after SENT and lease release. Generation/export then run concurrently. Each job owns its tab, bindings and output directory. Queue remaining jobs.
- Use one shared absolute `work/web-image-preparation.lock` directory for this workspace and unique owner IDs. Never remove another owner's lease or overwrite a draft.
- Return images inline as they finish; label batch outputs by job. Resume pending work with the SAME child and conversation. Do not create separate user-facing Codex tasks or repeat child checks.

## Child: execute the helper

Use `mcp__cua_repl` with connected Chrome, following current runtime docs. Read upload docs only when files exist, and pageAssets docs for export. Import without reading helper source unless debugging:

```js
var {pathToFileURL} = await import('node:url');
var helperURL = pathToFileURL(`${process.env.HOME}/.codex/skills/chatgpt-web-image/browser-flow.mjs`);
helperURL.search = 'v=stable-enter-20260907';
var flow = await import(helperURL.href);
var run = {dispatch:'NOT_SENT'};
```

1. After parent grants preparation, call `flow.acquirePreparation(lockDir, owner)`. If busy, report waiting; do not open/fill ChatGPT. Once acquired, create a NEW ordinary conversation at `https://chatgpt.com/`, including for revisions. Never use temporary chat or invented URL parameters. Stop on existing drafts, missing Chrome or login; no workaround/installation troubleshooting.
2. Observe composer once. Call `flow.prepareAndSend(tab, {prompt, files}, run)` once. Omit files or pass `[]` for text-only generation; upload all provided images for multi-reference generation. The helper verifies draft/attachments/prompt, waits 2s, then sends via Enter. It may supplement with one Enter after 2s ONLY if the full draft is unchanged, Send remains enabled, and no submitted turn/generation appeared. Never manually double-send or bypass these checks.
3. On SENT, call `flow.releasePreparation(lockDir, owner, run)` and immediately notify parent to release the next job. NOT_SENT failures may release; UNKNOWN holds the lease until recovered. Never restart submission in SENT/UNKNOWN.
4. Call `flow.waitAndCollect(tab, {outputDir})`, tool timeout 60000ms. It waits up to 55s on completion/resources, matches generated-image assets, validates image file type and saves locally. If pending, repeat this call on the SAME tab, up to six bounded waits. No fixed initial sleep, screenshots, visual review, creative rewriting or regeneration. Return whatever was generated.
5. Return saved paths/status/URL immediately. For unfinished/export-failed results, markHandoff before EVERY turn return. If the tab disappears, reopen the recorded conversation URL and recover that result. Never regenerate to repair a download. Report unresolved state after bounded recovery.

## Keep it lean and reliable

Prefer a slightly longer successful run over premature failure. Let the helper perform functional checks; do not duplicate them, dump sidebars/history or read other skills. No Pro consultation, image_gen or alternate route. Parent embeds absolute local image paths without inspecting quality. Do not promise quota savings or fixed latency.

Verified: one-reference Luna run completed with one Enter and automatic PNG delivery. Zero/multiple references are supported by the helper's input handling but not yet live-tested; revised batch preparation has not passed a full batch retest.
