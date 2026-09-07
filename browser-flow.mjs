// Run with the existing cua_repl Tab; no credentials or private HTTP calls.
export async function prepareAndSend(tab, {prompt, files = []}, state) {
  if ((await tab.url())?.includes('temporary-chat=true')) throw new Error('Use ordinary new chat, not temporary chat');
  if (state.dispatch !== 'NOT_SENT') throw new Error('Do not resubmit this run');
  if (!prompt?.trim()) throw new Error('Empty prompt');
  const box = tab.playwright.getByRole('textbox', {name:'与 ChatGPT 聊天', exact:true});
  const draft = (await box.innerText()).trim();
  if (draft && draft !== '问问 ChatGPT') throw new Error('Existing draft; use a fresh conversation');
  if (await tab.playwright.getByRole('heading', {name:'你说：',exact:true}).count()) throw new Error('Existing conversation; open a new one');
  if (files.length) {
    await tab.playwright.getByRole('button',{name:'添加文件等',exact:true}).click();
    const menu = await tab.playwright.domSnapshot();
    if (!menu.includes('添加照片和文件')) throw new Error('Upload UI changed');
    const pending = tab.playwright.waitForEvent('filechooser',{timeoutMs:10000});
    await tab.playwright.getByText('添加照片和文件',{exact:true}).click();
    const chooser = await pending;
    if (files.length > 1 && !chooser.isMultiple()) throw new Error('Multiple upload unavailable');
    await chooser.setFiles(files);
    for (const path of files) {
      const name = path.split('/').pop();
      await tab.playwright.getByRole('group',{name,exact:true}).waitFor({state:'visible',timeoutMs:15000});
    }
  }
  await box.fill(prompt);
  if ((await box.innerText()) !== prompt) throw new Error('Prompt mismatch');
  const send = tab.playwright.getByRole('button',{name:'发送提示词',exact:true});
  if (!await send.isEnabled()) throw new Error('Upload or composer not ready');
  await tab.playwright.waitForTimeout(2000);
  return sendWithEnter(tab, prompt, state);
}

export async function sendWithEnter(tab, prompt, state) {
  if (state.dispatch !== 'NOT_SENT') throw new Error('Do not resubmit this run');
  const p = tab.playwright;
  const box = p.getByRole('textbox',{name:'与 ChatGPT 聊天',exact:true});
  const send = p.getByRole('button',{name:'发送提示词',exact:true});
  for (let attempt = 0; attempt < 2; attempt++) {
    // Recheck immediately before each keypress. Missing/uncertain state stops.
    const generating = await p.getByRole('button',{name:'停止回答',exact:true}).isVisible();
    const userTurn = await p.getByRole('heading',{name:'你说：',exact:true}).count() > 0;
    if (generating || userTurn) { state.dispatch = 'SENT'; break; }
    if ((await box.innerText()) !== prompt || !await send.isVisible() || !await send.isEnabled()) {
      if (attempt === 0) throw new Error('Composer changed before submission');
      break;
    }
    state.dispatch = 'UNKNOWN'; // Persist before pressing, including timeouts.
    state.enterAttempts = attempt + 1;
    await box.press('Enter');
    await p.waitForTimeout(2000);
    const sent = await p.getByRole('heading',{name:'你说：',exact:true}).count() > 0;
    const stopped = await p.getByRole('button',{name:'停止回答',exact:true}).isVisible();
    if (sent || stopped) { state.dispatch = 'SENT'; break; }
    // Only an unchanged, enabled draft can reach a second Enter. Exceptions,
    // cleared drafts, navigation/reset and ambiguous outcomes never retry.
  }
  state.url = await tab.url();
  return {dispatch:state.dispatch,enterAttempts:state.enterAttempts ?? 0,url:state.url};
}

export async function inspect(tab) {
  const p = tab.playwright;
  return {
    generating:await p.getByRole('button',{name:'停止回答',exact:true}).isVisible(),
    userTurn:await p.getByRole('heading',{name:'你说：',exact:true}).count() > 0,
    images:await p.getByRole('img',{name:/^已生成图片：/}).evaluateAll(es=>es.map(e=>({alt:e.getAttribute('alt'),src:e.getAttribute('src')})))
  };
}

export async function collect(tab) {
  const status = await inspect(tab);
  if (status.generating || !status.images.length) return {status:'pending'};
  const cap = await tab.capabilities.get('pageAssets');
  const inventory = await cap.list();
  const urls = new Set(status.images.map(i=>i.src));
  // Signed query strings can rotate while the underlying generated file is same.
  const fileKey = value => {
    try {
      const u = new URL(value);
      return u.origin === 'https://chatgpt.com' && u.pathname === '/backend-api/estuary/content' && u.searchParams.get('id')
        ? u.origin + u.pathname + '?id=' + u.searchParams.get('id') : null;
    } catch { return null; }
  };
  const keys = new Set([...urls].map(fileKey).filter(Boolean));
  const ids = inventory.assets.filter(a=>a.kind==='image' && (urls.has(a.url) || keys.has(fileKey(a.url)))).map(a=>a.id);
  if (!ids.length) return {status:'image-visible-export-unavailable'};
  const result = await cap.bundle({inventoryId:inventory.id,assetIds:ids});
  return {status:result.failures.length?'partial':'saved',paths:result.assets.map(a=>a.path),url:await tab.url()};
}

// Browser-side condition waits avoid repeated model turns and full-page reads.
// Each call yields within 55s; pending means resume THIS generation, never resend.
export async function waitAndCollect(tab, {timeoutMs = 55000, outputDir} = {}) {
  const deadline = Date.now() + Math.min(55000, Math.max(1, timeoutMs));
  const remaining = () => Math.max(1, deadline - Date.now());
  try {
    await tab.playwright.getByRole('img',{name:/^已生成图片：/}).first()
      .waitFor({state:'visible',timeoutMs:remaining()});
    await tab.playwright.getByRole('button',{name:'停止回答',exact:true})
      .waitFor({state:'hidden',timeoutMs:remaining()});
  } catch (error) {
    if (!/timeout|timed out/i.test(String(error))) throw error;
    await tab.markHandoff();
    return {status:'pending',url:await tab.url()};
  }
  let result = await collect(tab);
  const stillLoading = r => ['pending','image-visible-export-unavailable'].includes(r.status)
    || (r.status === 'partial' && !r.paths?.length);
  while (stillLoading(result) && remaining() > 2000) {
    // Generation controls can finish before image resources enter the inventory.
    // Poll internally; do not spend model turns repeatedly calling collect.
    await tab.playwright.waitForTimeout(2000);
    result = await collect(tab);
  }
  if (stillLoading(result)) {
    await tab.markHandoff();
    return {...result,status:'pending',reason:result.status,url:await tab.url()};
  }
  if (outputDir && result.paths?.length) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    if (!path.isAbsolute(outputDir)) throw new Error('Use an absolute output directory');
    await fs.mkdir(outputDir,{recursive:true});
    const paths = [];
    for (const [index, source] of result.paths.entries()) {
      const bytes = await fs.readFile(source);
      const ext = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
        : bytes[0] === 255 && bytes[1] === 216 ? 'jpg'
        : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'webp' : null;
      if (!ext) throw new Error('Export did not contain a supported image');
      const destination = path.join(outputDir,`web-image-${Date.now()}-${index}.${ext}`);
      await fs.copyFile(source,destination,fs.constants.COPYFILE_EXCL);
      paths.push(destination);
    }
    result.paths = paths;
  }
  return result;
}

// ChatGPT synchronizes unsent drafts across tabs. Parent grants this shared
// filesystem lease BEFORE a child opens its fresh tab; only preparation is serial.
export async function acquirePreparation(lockDir, owner) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  if (!path.isAbsolute(lockDir) || !owner) throw new Error('Absolute lock path and unique owner required');
  await fs.mkdir(path.dirname(lockDir),{recursive:true});
  try { await fs.mkdir(lockDir); }
  catch (e) { if (e.code === 'EEXIST') return {status:'busy'}; throw e; }
  await fs.writeFile(path.join(lockDir,'owner'),owner);
  return {status:'acquired'};
}

export async function releasePreparation(lockDir, owner, state) {
  if (!['SENT','NOT_SENT'].includes(state.dispatch)) return {status:'held-unknown-dispatch'};
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  if ((await fs.readFile(path.join(lockDir,'owner'),'utf8')) !== owner) throw new Error('Lease owner mismatch');
  await fs.unlink(path.join(lockDir,'owner'));
  await fs.rmdir(lockDir);
  return {status:'released'};
}
