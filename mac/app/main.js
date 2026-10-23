/* ============================================================
 * 中文程 · 桌面版 主进程 (main.js)
 * ------------------------------------------------------------
 * - 窗口 + 中文程内核运行 + AI（大模型优先/知识库/工具协议）
 * - 硬性要求：一切网页操作（微软账号登录、文档、网页链接）
 *   一律 shell.openExternal 唤起系统默认外置浏览器，
 *   绝不使用内置浏览器（保证微软账号登录态可识别）
 * - host 接口与扩展 createHost 逐一对齐（print/phoneDial/uiCreate…）
 * ============================================================ */
"use strict";
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

/* ---------- 内核装载（与扩展 loadKernel 同法：共享 sandbox） ---------- */
const vm = require("vm");
const kernel = {};
(function loadKernel() {
  const sandbox = {
    console, setTimeout, clearTimeout, Math, JSON, Date, Number, String,
    Array, Object, Boolean, parseInt, parseFloat, isNaN, isFinite,
    Promise, RegExp, Error, TypeError, RangeError,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ["dialects.js", "lexer.js", "parser.js", "interpreter.js", "stdlib.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "core", "kernel", file), "utf8"), sandbox, { filename: file });
  }
  kernel.parseSource = vm.runInContext("parseSource", sandbox);
  kernel.Interpreter = vm.runInContext("Interpreter", sandbox);
  kernel.RuntimeError = vm.runInContext("RuntimeError", sandbox);
  kernel.SyntaxError = vm.runInContext("SyntaxError", sandbox);
  kernel.LexerError = vm.runInContext("LexerError", sandbox);
  kernel.DIALECTS = vm.runInContext("DIALECTS", sandbox);
  kernel.setDialect = (name) => vm.runInContext(`currentDialect = "${name}"`, sandbox);
  kernel.getDialectName = () => vm.runInContext("getDialectName()", sandbox);
})();
const localAi = require("./core/localai.js");
const docs = require("./core/docs.js");

/* ---------- 模型解析：必须在 require llm.js 之前定好路径 ----------
 * 查找顺序：安装包内置 resources/models → 开发机 A:\MIMO → core/models。
 * 命中最大的可用 GGUF 后写入环境变量（llm.js 顶层读取）。
 * 目录可能含 junction/符号链接，Node 对其 isDirectory()=false，须加 isSymbolicLink()。 */
const MODEL_DIRS = [
  process.resourcesPath ? path.join(process.resourcesPath, "models") : null,
  "A:\\MIMO",
  path.join(__dirname, "core", "models"),
].filter(Boolean);

function isUsableGguf(file) {
  try {
    if (!file || String(file).toLowerCase().indexOf(".gguf") !== String(file).length - 5) return false;
    const st = fs.statSync(file);
    if (!st.isFile() || st.size < 100 * 1024 * 1024) return false;
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.toString("latin1") === "GGUF";
  } catch (e) { return false; }
}
function findLargestGguf(dir, depth) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  let best = null;
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isFile() && ent.name.toLowerCase().endsWith(".gguf")) {
      if (isUsableGguf(full)) {
        const size = fs.statSync(full).size;
        if (!best || size > best.size) best = { full, size };
      }
    } else if ((ent.isDirectory() || ent.isSymbolicLink()) && depth > 0 && ent.name !== ".cache" && ent.name !== "node_modules") {
      const sub = findLargestGguf(full, depth - 1);
      if (sub && (!best || sub.size > best.size)) best = sub;
    }
  }
  return best;
}
(function resolveModel() {
  for (const dir of MODEL_DIRS) {
    const found = findLargestGguf(dir, 2);
    if (found) { process.env.ZHONGCHENG_MODEL_PATH = found.full; return; }
  }
})();
const llm = require("./core/llm.js");

/* ---------- 输出通道（渲染层） ---------- */
let win = null;
function send(ch, data) { if (win) win.webContents.send(ch, data); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820,
    title: "中文程 · 桌面版",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("closed", () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { app.quit(); });

/* 外置浏览器：渲染层请求打开任何网页都走系统默认浏览器 */
ipcMain.handle("openExternal", async (_e, url) => {
  if (/^https?:\/\//i.test(String(url))) await shell.openExternal(String(url));
});

/* ---------- 命令行面板：外部命令行（CMD/PowerShell）真实执行 ----------
 * 与 host.execCommand 共用同一套安全护栏；危险命令直接拒绝。 */
ipcMain.handle("execShellCommand", async (_e, shellName, cmd) => {
  const C = String(cmd).toLowerCase();
  const hit = DANGEROUS.find((d) => C.includes(d));
  if (hit) {
    return "⛔ 安全护栏：命令被拒绝执行（含破坏性操作「" + hit + "」）。中文程禁止用于破坏电脑的行为。";
  }
  const isPs = String(shellName).toLowerCase().indexOf("powershell") !== -1;
  const spawnArgs = isPs
    ? ["powershell.exe", ["-NoProfile", "-Command", String(cmd)]]
    : ["cmd.exe", ["/c", String(cmd)]];
  return await new Promise((resolve) => {
    cp.execFile(spawnArgs[0], spawnArgs[1], { encoding: "utf8", timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        let out = String(stdout || "");
        if (stderr) out += (out ? "\n" : "") + String(stderr);
        if (err && !out) out = "命令失败：" + err.message;
        resolve(out.replace(/\r\n/g, "\n").replace(/\n+$/, "") || "(命令已执行，无输出)");
      });
  });
});

/* ---------- 真实网络（桌面版网络能力：httpGet/httpPost） ---------- */
const http = require("http");
const https = require("https");
function httpRequest(url, method, body, headers) {
  return new Promise((resolve) => {
    try {
      const u = new URL(String(url));
      const mod = u.protocol === "https:" ? https : http;
      const opts = { method, timeout: 15000 };
      if (headers && typeof headers === "object" && !Array.isArray(headers)) opts.headers = headers;
      const req = mod.request(u, opts, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (data.length < 2000000) data += c; });
        res.on("end", () => resolve(data));
      });
      req.on("timeout", () => { req.destroy(new Error("请求超时（15 秒）")); });
      req.on("error", (e) => resolve("请求失败：" + e.message));
      if (body) req.write(body);
      req.end();
    } catch (e) { resolve("请求失败：" + e.message); }
  });
}

/* ---------- 安全护栏（易语言之鉴：中文编程不能成为病毒温床） ---------- */
const cp = require("child_process");
const DANGEROUS = ["format ", "format/", "mkfs", "del /f", "del /q /s", "del /s", "rd /s", "rmdir /s",
  "erase /", "vssadmin", "bcdedit", "reg delete", "reg add hklm",
  "shutdown", "cipher /w", "diskpart", "wevtutil cl", "schtasks /create /sc onstart",
  "rm -rf /", "chmod -r 000", ":(){ :|:&", "mv /*", "> /dev/sda"];

/* ---------- 宿主工厂：与扩展 createHost（extension.js L429-556）逐一对齐 ----------
 * push(文本) 由调用方提供（运行输出面板 / AI 工具运行缓冲）。 */
function createHost(push) {
  return {
    print: (s) => push(s),
    input: async () => "",
    clear: () => {},
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0))),

    /* 画布：桌面版先以文字回显，原生画布窗口在后续版本接入 */
    canvas: (w, h, title) => push("🖼️ 画布已创建：" + (title || "画布") + "（" + Number(w) + "×" + Number(h) + "）"),
    clearCanvas: () => {}, fillColor: () => {}, strokeColor: () => {},
    drawPoint: () => {}, drawLine: () => {}, drawCircle: () => {}, drawRect: () => {},
    drawArc: () => {}, drawText: () => {}, drawPolygon: () => {},

    readFile: (name) => {
      try {
        const p = String(name);
        return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      } catch (e) { return null; }
    },
    writeFile: (name, content) => {
      try { fs.writeFileSync(String(name), String(content), "utf8"); } catch (e) {}
    },
    execCommand: (cmd) => {
      const C = String(cmd).toLowerCase();
      const hit = DANGEROUS.find((d) => C.includes(d));
      if (hit) {
        push("⛔ 安全护栏：命令被拒绝执行（含破坏性操作「" + hit + "」）。中文程禁止用于破坏电脑的行为。");
        return "";
      }
      try {
        const out = cp.execSync(String(cmd), { encoding: "utf8", timeout: 30000, windowsHide: true });
        return String(out === undefined || out === null ? "" : out).replace(/\r\n/g, "\n").replace(/\n+$/, "");
      } catch (e) { return "命令失败：" + e.message; }
    },
    getEnv: (name) => (process.env[String(name)] === undefined ? "" : String(process.env[String(name)])),

    showPopup: (text) => { if (win) dialog.showMessageBox(win, { message: String(text), buttons: ["好"] }); },
    openExternal: (target) => {
      const t = String(target);
      if (/^https?:\/\//i.test(t)) { shell.openExternal(t); }
      else { push("🔗 已忽略非网页链接：" + t); }
    },
    httpGet: (url, headers) => httpRequest(url, "GET", null, headers),
    httpPost: (url, data, headers) => httpRequest(url, "POST", String(data), headers),

    /* 电话/短信：电脑上自动模拟；打包成手机应用后为真实能力 */
    phoneDial: async (num) => {
      push("📞【模拟通话】正在拨打 " + String(num) + " …（打包成手机应用后，将直接使用手机打电话）");
      await new Promise((r) => setTimeout(r, 300));
      return null;
    },
    phoneHangup: async () => { push("📞【模拟】通话已挂断"); return null; },
    smsSend: async (num, text) => {
      push("💬【模拟短信】收件人 " + String(num) + "：" + String(text) + "（打包成手机应用后，将通过手机短信真实发送）");
      return null;
    },

    /* 视频/音乐：电脑上在系统默认播放器/浏览器真实播放 */
    videoPlay: async (url) => {
      push("🎬 视频播放：" + String(url));
      try { if (/^https?:\/\//i.test(String(url))) shell.openExternal(String(url)); } catch (e) {}
      return null;
    },
    videoClose: async () => null,
    audioPlay: async (url) => {
      push("🎵 音乐播放：" + String(url));
      try { if (/^https?:\/\//i.test(String(url))) shell.openExternal(String(url)); } catch (e) {}
      return null;
    },
    audioStop: async () => null,

    /* 界面模块：桌面版用系统对话框真实交互 */
    uiCreate: async (title) => { push("🖥️ 界面已创建：" + String(title)); return null; },
    uiTitle: async (t) => { push("🖥️ 界面标题：" + String(t)); return null; },
    uiText: async (t) => { if (win) dialog.showMessageBox(win, { message: String(t), buttons: ["好"] }); return null; },
    uiButton: async (label, onClick) => {
      if (win) {
        const r = await dialog.showMessageBox(win, { message: "按钮：" + String(label), buttons: ["点击", "取消"] });
        if (r.response === 0 && onClick) await onClick();
      } else if (onClick) { await onClick(); }
      return null;
    },
    uiInput: async (hint, onDone) => {
      push("⌨️ 输入框（" + String(hint) + "）：桌面版输入对话框后续版本提供");
      if (onDone) await onDone("");
      return null;
    },
    uiClear: async () => null,

    /* IoT 设备能力：TCP/MQTT 后续版本接入真实连接 */
    tcpConnect: () => { push("（桌面版 TCP 连接后续版本接入）"); return {}; },
    tcpSend: () => {}, tcpRecv: async () => "", devClose: () => {},
    mqttConnect: () => { push("（桌面版 MQTT 连接后续版本接入）"); return {}; },
    mqttPublish: () => {}, mqttSubscribe: () => ({}), mqttClose: () => {},
    waitIdle: async () => {},
    httpServerStart: (port) => { push("🌐 HTTP 服务（端口 " + String(port) + "）：桌面版后续版本接入"); return {}; },
    httpServerOn: () => {}, httpServerClose: () => {},

    /* 画布交互按钮：弹出系统按钮组，等待用户点击，返回所点按钮文字 */
    chooseButtons: async (labels) => {
      const arr = (labels || []).map(String);
      if (!win || !arr.length) return arr[0] || "";
      const r = await dialog.showMessageBox(win, { message: "请选择：", buttons: arr });
      return arr[r.response];
    },
    currentDir: () => __dirname,
  };
}

/* ---------- 运行中文程代码 ---------- */
ipcMain.handle("runCode", async (_e, code) => {
  const out = [];
  const push = (s) => { if (out.length < 400) out.push(String(s)); };
  try {
    kernel.setDialect("zh");
    const ast = kernel.parseSource(String(code), kernel.DIALECTS.zh);
    const host = createHost(push);
    const interp = new kernel.Interpreter(host);
    await Promise.race([
      interp.run(ast).then(() => host.waitIdle()),
      new Promise((_, rej) => setTimeout(() => rej(new Error("运行超时（20 秒），程序可能含「永远」循环")), 20000)),
    ]);
    push("✔ 程序运行结束");
  } catch (e) {
    push("❌ " + (e && e.message ? e.message : String(e)));
  }
  return out.join("\n");
});

/* ---------- AI 问答（大模型优先 + 知识库 + 工具协议） ---------- */
let aiHistory = [];
const AI_SYSTEM = "你是中文程（一门全中文编程语言）的官方 AI 助手。回答必须使用中文程语法（设/令/如果/永远/对于/函数/类 等），代码块用 ```中文程 标注。严禁输出 Python/JavaScript 等其他语言代码。";

async function chatOnce(messages) {
  return llm.chat(messages, (m) => send("ai-status", m));
}

async function runAiTool(name, arg) {
  const knowledge = docs.knowledgeText();
  if (name === "查文档") {
    const key = String(arg).trim().slice(0, 20);
    const idx = knowledge.indexOf(key);
    if (idx < 0) return "知识库未直接命中「" + key + "」，请换关键词";
    send("ai-status", "📖 正在查文档「" + key + "」");
    return "【知识库片段】\n" + knowledge.slice(Math.max(0, idx - 150), idx + 700);
  }
  if (name === "查模板") {
    send("ai-status", "📋 正在查模板「" + String(arg).trim().slice(0, 20) + "」");
    return "【内置完整程序模板】\n" + localAi.answer(String(arg), "").slice(0, 4000);
  }
  if (name === "运行中文程") {
    send("ai-status", "⚙️ 正在实机运行代码…");
    const out = [];
    const push = (s) => { if (out.length < 60) out.push(String(s)); };
    try {
      kernel.setDialect("zh");
      const ast = kernel.parseSource(String(arg).replace(/```(?:中文程|zh)?\s*\n|```/g, ""), kernel.DIALECTS.zh);
      const host = createHost(push);
      const interp = new kernel.Interpreter(host);
      await Promise.race([
        interp.run(ast).then(() => host.waitIdle()),
        new Promise((_, rej) => setTimeout(() => rej(new Error("运行超时 15 秒")), 15000)),
      ]);
      return "【运行输出】\n" + (out.join("\n").trim() || "(无输出，程序正常结束)");
    } catch (e) {
      return "【运行结果】失败：" + (e && e.message ? e.message : String(e)) + "\n请根据错误修正代码后再次运行验证。";
    }
  }
  return "未知工具：" + name;
}

ipcMain.handle("aiAsk", async (_e, question) => {
  const knowledge = docs.knowledgeText();
  const TOOL_PROTO = "\n\n【工具能力】需要时单独输出一行：\n【工具】查文档：关键词\n【工具】查模板：需求描述\n【工具】运行中文程：```（中文程代码）```\n系统执行后回传结果，你继续完成回答。不确定语法先查文档；要完整系统先查模板；写完代码运行验证。最终回答必须给完整可运行的中文程代码。";
  const messages = [{ role: "system", content: AI_SYSTEM + "\n\n【知识库】\n" + knowledge.slice(0, 3500) + TOOL_PROTO }]
    .concat(aiHistory.slice(-8)).concat([{ role: "user", content: question }]);
  send("ai-status", "🧠 大模型已接入知识库与工具，思考中…");
  let final = null;
  for (let round = 0; round < 3; round++) {
    let text = null;
    try { text = await chatOnce(messages); } catch (e) { text = null; }
    if (!text) break;
    const m = text.match(/【工具】([^：:]+)[：:]\s*([\s\S]*)/);
    if (!m) { final = text; break; }
    const result = await runAiTool(m[1].trim(), m[2].trim());
    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: "【工具结果】\n" + result + "\n\n请基于以上结果继续，给出最终完整回答。" });
  }
  if (!final) final = localAi.answer(question, knowledge);
  aiHistory.push({ role: "user", content: question });
  aiHistory.push({ role: "assistant", content: final });
  return final;
});
