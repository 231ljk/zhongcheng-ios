/* 中文程桌面版 · 预加载桥（安全上下文，只暴露白名单 API） */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zc", {
  runCode: (code) => ipcRenderer.invoke("runCode", code),
  aiAsk: (q) => ipcRenderer.invoke("aiAsk", q),
  onAiStatus: (cb) => ipcRenderer.on("ai-status", (_e, m) => cb(m)),
  openExternal: (url) => ipcRenderer.invoke("openExternal", url),
});
