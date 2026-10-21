/* ============================================================
 * 中文程 · 本地大模型封装 (llm.js)
 * ------------------------------------------------------------
 * 用 node-llama-cpp 加载本地 GGUF 模型：
 *  - 默认内置 Qwen2.5-0.5B-Instruct（随扩展分发，开箱即用）
 *  - 用户可在设置 zhongcheng.ai.localModelPath 指定自己的 GGUF
 *    （填 .gguf 文件路径，或装了 .gguf 的文件夹路径都行，
 *     例如小米 MiMo-7B-RL 的 Q4_K_M 量化版）
 * 完全离线推理。
 * ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");

let llama = null;
let model = null;
let context = null;
let loading = null;   // 进行中的加载 Promise（多个提问排队共用一次加载）
let loadError = null;
let queue = Promise.resolve();   // 推理串行队列：CPU 小模型并发会互相抢资源

const DEFAULT_MODEL_PATH = path.join(__dirname, "models", "qwen2.5-0.5b-instruct-q4.gguf");
const GGUF_MIN_SIZE = 100 * 1024 * 1024;   // 小于 100MB 的 .gguf 视为无效/没下完
const BIG_MODEL_SIZE = 3 * 1024 * 1024 * 1024;  // ≥3GB 按大模型调参（7B 级）

/* 初始化移至下方函数定义之后（见「默认模型选择」） */

/* 判断一个文件是不是「能用的 GGUF」：扩展名 + 大小 + 文件头魔数 GGUF。
   能拦住三种常见坑：safetensors 原始权重、下载到一半的残文件、404 错误页。 */
function isUsableGguf(file) {
  try {
    if (!file || String(file).toLowerCase().indexOf(".gguf") !== String(file).length - 5) return false;
    const st = fs.statSync(file);
    if (!st.isFile() || st.size < GGUF_MIN_SIZE) return false;
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.toString("latin1") === "GGUF";
  } catch (e) {
    return false;
  }
}

/* GGUF 分片（llama.cpp split 格式：名字 -00001-of-00003.gguf）：
   加载时只传首片，node-llama-cpp 自动加载其余分片 */
const SPLIT_RE = /^(.*?)-(\d{5})-of-(\d{5})\.gguf$/i;

/* 分片过滤：同一组分片只保留 00001 首片，避免 findGgufInDir 误选中段 */
function keepFirstShards(files) {
  const seen = new Set();
  const out = [];
  for (const f of files) {
    const m = SPLIT_RE.exec(f.full);
    if (!m) { out.push(f); continue; }
    const key = m[1].toLowerCase();
    if (m[2] === "00001") { seen.add(key); out.push(f); }
    else if (!seen.has(key)) { seen.add(key); if (m[2] === "00001") out.push(f); }
  }
  return out;
}

/* 模型真实总大小（分片模型 = 全部分片之和），用于 7B 级调参判定 */
function realModelSize(file) {
  let total = 0;
  try { total += fs.statSync(file).size; } catch (e) { return 0; }
  const m = SPLIT_RE.exec(file);
  if (m) {
    try {
      const dir = path.dirname(file);
      const base = path.basename(m[1]).toLowerCase();
      for (const name of fs.readdirSync(dir)) {
        if (name.toLowerCase().startsWith(base) && SPLIT_RE.test(name) && name !== path.basename(file)) {
          try { total += fs.statSync(path.join(dir, name)).size; } catch (e) {}
        }
      }
    } catch (e) {}
  }
  return total;
}

/* 在文件夹里（含两层子目录）找最大的可用 .gguf；找不到返回 null */
function findGgufInDir(dir, depth) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  const files = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isFile() && ent.name.toLowerCase().endsWith(".gguf")) {
      try { if (isUsableGguf(full)) files.push({ full, size: fs.statSync(full).size }); } catch (e) {}
    } else if ((ent.isDirectory() || ent.isSymbolicLink()) && depth > 0 && ent.name !== ".cache" && ent.name !== "node_modules") {
      const sub = findGgufInDir(full, depth - 1);
      if (sub) files.push(sub);
    }
  }
  if (!files.length) return null;
  files.sort((a, b) => b.size - a.size);
  return keepFirstShards(files)[0] || null;
}

/* 默认模型选择：在扩展自带 models/ 目录（含子目录，如 MiMo/）里挑最大的可用 .gguf——
   大模型优先；内置 0.5B 永远存在，作为低配电脑兜底（大模型加载失败时自动切回它）。
   环境变量 ZHONGCHENG_MODEL_PATH 可覆盖 */
let modelPath = process.env.ZHONGCHENG_MODEL_PATH && isUsableGguf(process.env.ZHONGCHENG_MODEL_PATH)
  ? process.env.ZHONGCHENG_MODEL_PATH
  : (findGgufInDir(path.join(__dirname, "models"), 2) || { full: DEFAULT_MODEL_PATH }).full;

/* 解析用户在设置里填的路径：可能是 .gguf 文件、文件夹、还可能首尾带引号。
   返回 {file} 或 {error: "notfound"|"notgguf"} */
function resolveModelInput(p) {
  const raw = String(p || "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (!raw) return { error: "notfound" };
  let st;
  try { st = fs.statSync(raw); } catch (e) { return { error: "notfound" }; }
  if (st.isFile()) {
    return isUsableGguf(raw) ? { file: path.resolve(raw) } : { error: "notgguf" };
  }
  if (st.isDirectory()) {
    const found = findGgufInDir(raw, 2);
    return found ? { file: found.full } : { error: "notgguf" };
  }
  return { error: "notfound" };
}

/* 切换本地模型。p 可填 .gguf 文件或含 .gguf 的文件夹；切换后释放旧模型下次提问重载。
   返回 {ok:true,file,isDefault} 或 {ok:false,error}：
   error=notfound（路径不存在）/ notgguf（没有可用 GGUF，常见于下成 safetensors）/ busy（正在加载） */
function setModelPath(p) {
  const input = String(p || "").trim();
  if (!input) return { ok: false, error: "notfound" };
  const r = resolveModelInput(input);
  if (r.error) return { ok: false, error: r.error };
  if (r.file === modelPath) return { ok: true, file: r.file, same: true, isDefault: r.file === DEFAULT_MODEL_PATH };
  if (loading) return { ok: false, error: "busy" };
  modelPath = r.file;
  model = null;
  context = null;
  loadError = null;
  return { ok: true, file: r.file, isDefault: r.file === DEFAULT_MODEL_PATH };
}
function getModelPath() { return modelPath; }

/* 建立上下文：7B 级大模型用更少序列省内存、开 flashAttention（不支持就回落）。
   8192 窗口是为推理型模型预留：它们思维链+最终答复可能占 3-4K token。 */
async function createContextFor(model) {
  let isBig = false;
  try { isBig = realModelSize(modelPath) >= BIG_MODEL_SIZE; } catch (e) {}
  const opts = { contextSize: isBig ? 8192 : 4096, sequences: isBig ? 2 : 8 };
  if (isBig) {
    try {
      const ctx = await model.createContext(Object.assign({}, opts, { flashAttention: true }));
      return ctx;
    } catch (e) { /* 老推理库不支持 FA，回落普通模式 */ }
  }
  return model.createContext(opts);
}

/* 懒加载：第一次用时才初始化（避免拖慢扩展启动），并发提问共用同一次加载。
   自定义大模型加载失败时自动切回内置 0.5B，保证 AI 永远能用。 */
async function ensureLoaded(onProgress) {
  if (context) return true;
  if (loadError && modelPath === DEFAULT_MODEL_PATH) return false;
  if (loading) return loading;
  loading = (async () => {
    try {
      const isBig = (() => { try { return realModelSize(modelPath) >= BIG_MODEL_SIZE; } catch (e) { return false; } })();
      if (onProgress) onProgress(isBig
        ? "正在加载大模型（" + path.basename(modelPath) + "，约 4.4GB，CPU 首次加载约 1-3 分钟，请耐心等）…"
        : "正在加载本地大模型（" + path.basename(modelPath) + "，首次约 1 分钟）…");
      const { getLlama } = await import("node-llama-cpp");
      /* 纯 CPU 推理：随扩展分发的只有 CPU 推理库；且大模型（7B 4.4GB）在
         4GB 显存的笔记本显卡上会因显存不足加载失败。gpu:false + gpuLayers:0
         保证任何机器行为一致，绝不走 Vulkan/CUDA。 */
      if (!llama) llama = await getLlama({ gpu: false });
      model = await llama.loadModel({ modelPath, gpuLayers: 0 });
      context = await createContextFor(model);
      loadError = null;
      if (onProgress) onProgress("本地大模型已就绪（" + path.basename(modelPath) + " · 完全离线" + (isBig ? "，CPU 推理回复会慢一些" : "") + "）");
      return true;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      /* 自定义模型加载失败（内存不足/文件损坏/架构不支持）：自动回落内置模型 */
      if (modelPath !== DEFAULT_MODEL_PATH) {
        const bad = modelPath;
        modelPath = DEFAULT_MODEL_PATH;
        model = null;
        context = null;
        if (onProgress) onProgress("自定义模型加载失败（" + path.basename(bad) + "：" + msg + "），已自动切回内置 Qwen2.5-0.5B");
        loading = null;
        return ensureLoaded(onProgress);
      }
      loadError = msg;
      if (onProgress) onProgress("本地大模型加载失败：" + loadError);
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/* 把消息数组拼成 ChatML 纯文本（Qwen/MiMo 系通用对话格式） */
function buildChatML(sysText, turns) {
  let s = "";
  if (sysText) s += "<|im_start|>system\n" + sysText + "<|im_end|>\n";
  for (const m of turns) {
    if (m.role === "user") s += "<|im_start|>user\n" + String(m.content) + "<|im_end|>\n";
    else s += "<|im_start|>assistant\n" + String(m.content) + "<|im_end|>\n";
  }
  return s + "<|im_start|>assistant\n";
}

/* 超长时从最旧的对话轮次开始丢弃（system 永远保留），保证不超上下文窗口 */
function fitTurns(sysText, turns, reserveTokens, ctxSize) {
  const budget = ctxSize - reserveTokens - 16;
  for (let n = turns.length; n >= 1; n--) {
    const slice = turns.slice(turns.length - n);
    let tokens = 0;
    try { tokens = model.tokenize(buildChatML(sysText, slice)).length; } catch (e) { return slice; }
    if (tokens <= budget) return slice;
  }
  return turns.slice(-1);
}

/* 取最终答案：推理型模型（如 MiMo-7B-RL）会先输出一段思维链
   （实测形如  ...答案），只把最终答复给用户看。
   非推理模型没有这些标记，原样返回。 */
function extractFinalAnswer(text) {
  /* 截掉对话边界标记及之后内容：<|im_end|> 正常结束；<|im_start|> 是模型答完后
     自己续演下一轮（MiMo 实测有此行为），都不能展示给用户 */
  let t = String(text)
    .replace(/<\|im_start\|>[\s\S]*$/, "")
    .replace(/<\|im_end\|>[\s\S]*$/, "").trim();
  const end = t.indexOf("</think>");
  if (end >= 0) {
    t = t.slice(end + "</think>".length);
    /* 去掉残留的思维链起始标签（含带属性的变体） */
    t = t.replace(/<think(?:\s[^>]*)?>\s*/g, "").trim();
    return { answer: t, thoughtFinished: true };
  }
  /* 直到输出结束都没出现思维链结束标记：可能还没思考完就被截断 */
  if (/<think(?:\s[^>]*)?>/.test(t)) return { answer: "", thoughtFinished: false };
  /* 两个标记都没有：非推理模型的正常输出，原样返回 */
  return { answer: t, thoughtFinished: true };
}

/* 自定义（非内置）模型走 ChatML 手写对话。
   背景：第三方 GGUF（如 MiMo-7B-RL-nomtp）未内嵌 node-llama-cpp 能识别的
   chat 模板，LlamaChatSession 会回空串；直接按 ChatML 拼 prompt +
   stopStrings 在 <|im_end|> 截断，Qwen/MiMo 系模型都适用。 */
async function chatWithChatML(messages, maxTokens, isBig) {
  const { LlamaCompletion } = await import("node-llama-cpp");
  const ctxSize = isBig ? 8192 : 4096;
  let sysText = messages.filter((m) => m.role === "system").map((m) => String(m.content)).join("\n\n");
  /* 推理型大模型：引导它缩短思维链，把 token 预算留给最终答复 */
  if (isBig) sysText += "\n（要求：思考过程请尽量简短，尽快给出最终答复。）";
  const allTurns = messages.filter((m) => m.role !== "system");
  const turns = fitTurns(sysText, allTurns, maxTokens, ctxSize);
  const seq = context.getSequence();
  let comp = null;
  try {
    comp = new LlamaCompletion({ contextSequence: seq });
    const meta = await comp.generateCompletionWithMeta(buildChatML(sysText, turns), {
      maxTokens,
      temperature: 0.7,
      topP: 0.9,
      customStopTriggers: ["<|im_end|>", "<|im_start|>"],
    });
    const result = extractFinalAnswer(String(meta.response || ""));
    /* 因 token 上限被截断、且模型还没结束思考（没等到最终答复）：
       返回 null，上层会即时回落内置模板库，绝不让用户干等几分钟只看到思考片段 */
    if (!result.thoughtFinished && meta.metadata && meta.metadata.stopReason === "maxTokens") {
      if (onProgressRef.cb) onProgressRef.cb("大模型本次思考时间过长未输出结果，已改用内置知识库快速回答");
      return null;
    }
    return result.answer;
  } finally {
    if (comp && comp.dispose) { try { comp.dispose(); } catch (e) {} }
    if (seq && seq.dispose) { try { seq.dispose(); } catch (e) {} }
  }
}
/* 简单的进度回调中转（chatWithChatML 不直接收 onProgress，由 chat 设置） */
const onProgressRef = { cb: null };

/* 推理：messages = [{role: system|user|assistant, content}, ...]，返回完整回复文本。
 * 全局串行：同一时刻只跑一次推理，避免 CPU 模型并发抢占与 sequence 耗尽。 */
function chat(messages, onProgress) {
  const run = async () => {
    const ok = await ensureLoaded(onProgress);
    if (!ok) return null;
    let isBig = false;
    try { isBig = realModelSize(modelPath) >= BIG_MODEL_SIZE; } catch (e) {}
    try {
      const maxTokens = isBig ? 4096 : 1024;
      /* 自定义模型走 ChatML 手写对话；内置 Qwen2.5-0.5B 走官方会话封装 */
      if (modelPath !== DEFAULT_MODEL_PATH) {
        onProgressRef.cb = onProgress || null;
        return await chatWithChatML(messages, maxTokens, isBig);
      }

      const { LlamaChatSession } = await import("node-llama-cpp");
      let session = null;
      try {
        const sysMsg = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || undefined;
        const turns = messages.filter((m) => m.role !== "system").slice(-12);
        const history = turns.slice(0, -1).map((m) => m.role === "user"
          ? { type: "user", text: String(m.content) }
          : { type: "model", response: [String(m.content)] });
        const last = turns[turns.length - 1];
        const question = last && last.role === "user" ? String(last.content) : "";

        session = new LlamaChatSession({
          contextSequence: context.getSequence(),
          systemPrompt: sysMsg,
          chatHistory: history,
        });
        const reply = await session.prompt(question, { maxTokens, temperature: 0.7, topP: 0.9 });
        return String(reply || "").trim();
      } finally {
        if (session) { try { session.dispose(); } catch (e) {} }
      }
    } catch (e) {
      /* 推理错误不写 loadError：模型/上下文仍是好的，下次提问继续可用 */
      const msg = e && e.message ? e.message : String(e);
      if (onProgress) onProgress("本地大模型本次推理出错：" + msg);
      return null;
    }
  };
  /* 串行化：后一个提问等前一个彻底跑完（含序列释放）再开始 */
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

/* 状态查询 */
function status() {
  const name = path.basename(modelPath, ".gguf");
  if (context) return { ok: true, text: "本地大模型 " + name + " 已就绪（完全离线）" };
  if (loading) return { ok: false, text: "本地大模型加载中…" };
  if (loadError) return { ok: false, text: "本地大模型加载失败：" + loadError };
  return { ok: false, text: "本地大模型未加载（首次提问自动加载）" };
}

module.exports = { chat, status, ensureLoaded, setModelPath, getModelPath, resolveModelInput };
