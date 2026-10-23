/* ============================================================
 * 中文程 · 主入口 (main.js)
 * ------------------------------------------------------------
 * 装配编辑器 / 文件管理 / AI 助手 / 运行时宿主能力，
 * 负责 运行、停止、方言切换、快捷键、控制台与画布输出。
 * ============================================================ */

(function () {
  "use strict";

  /* ================= DOM ================= */
  const $ = (id) => document.getElementById(id);
  const 控制台区 = $("控制台区");
  const 画布容器 = $("画布容器");
  const 当前文件名 = $("当前文件名");
  const 文件状态 = $("文件状态");
  const 状态行列 = $("状态行列");
  const 状态方言 = $("状态方言");
  const 状态提示 = $("状态提示");

  let 当前文件 = "未命名.zy";
  let 当前解释器 = null;
  let 当前画布 = null;

  /* ================= 编辑器 ================= */
  const 编辑器 = new 中文编辑器($("编辑器容器"), {
    状态回调: (s) => { 状态行列.textContent = `行 ${s.行}，列 ${s.列}（共 ${s.总行} 行）`; }
  });

  /* ================= 控制台 ================= */
  function 控制台输出(文本, 类名) {
    const div = document.createElement("div");
    div.className = "console-line";
    if (类名) div.innerHTML = `<span class="${类名}">${转义(文本)}</span>`;
    else div.textContent = 文本;
    控制台区.appendChild(div);
    控制台区.scrollTop = 控制台区.scrollHeight;
  }

  function 清空控制台() { 控制台区.innerHTML = ""; }

  /* ================= 画布（中文绘图运行时） ================= */
  const 颜色表 = {
    "纯白": "#ffffff", "白色": "#ffffff", "白": "#ffffff",
    "纯黑": "#000000", "黑色": "#000000", "黑": "#000000",
    "浅天蓝": "#87ceeb", "天蓝": "#87ceeb", "浅蓝": "#8ecae6",
    "天蓝2": "#4fc3f7", "深蓝": "#1a237e", "蓝": "#2196f3",
    "金黄": "#ffd700", "金色": "#ffd700", "黄": "#ffeb3b", "浅黄": "#fff59d",
    "草绿": "#8bc34a", "翠绿": "#00c853", "绿": "#4caf50", "深绿": "#1b5e20",
    "浅绿": "#a5d6a7", "砖红": "#c94f3d", "朱红": "#ff4d00", "大红": "#e53935",
    "红": "#f44336", "深红": "#b71c1c", "粉红": "#f48fb1", "粉": "#f8bbd0",
    "深棕": "#5d4037", "棕": "#795548", "浅棕": "#a1887f",
    "橙": "#ff9800", "浅橙": "#ffcc80", "紫": "#9c27b0", "浅紫": "#ce93d8",
    "青": "#00bcd4", "灰": "#9e9e9e", "浅灰": "#bdbdbd", "深灰": "#616161",
    "银": "#c0c0c0", "米白": "#faf0e6", "奶油": "#fff8dc"
  };

  function 取颜色(名) {
    const 文本 = String(名).trim();
    if (颜色表[文本]) return 颜色表[文本];
    if (/^#[0-9a-fA-F]{3,8}$/.test(文本) || /^rgb/.test(文本)) return 文本;
    return "#333333";
  }

  let 画布ctx = null;
  let 填充色 = "#333333";
  let 笔画色 = "#000000";

  function 建画布(宽, 高, 名) {
    画布容器.innerHTML = `<canvas width="${宽}" height="${高}"></canvas><div class="canvas-tag">${转义(名 || "画布")} · ${宽}×${高}</div>`;
    const canvas = 画布容器.querySelector("canvas");
    画布ctx = canvas.getContext("2d");
    画布ctx.fillStyle = "#ffffff";
    画布ctx.fillRect(0, 0, 宽, 高);
    当前画布 = { ctx: 画布ctx, 宽, 高 };
    切页签("画布");
  }

  /* ================= 运行时宿主 ================= */
  const 运行时 = {
    输出: (文本) => 控制台输出(文本, ""),
    读入: (提示) => new Promise((resolve) => 打开输入弹窗(提示, resolve)),
    清屏: () => 清空控制台(),
    等待: (毫秒) => new Promise((r) => setTimeout(r, 毫秒)),

    画布: (宽, 高, 名) => 建画布(宽, 高, 名),
    清空画布: () => {
      if (画布ctx) { 画布ctx.fillStyle = "#ffffff"; 画布ctx.fillRect(0, 0, 当前画布.宽, 当前画布.高); }
    },
    填充色: (色) => { 填充色 = 取颜色(色); },
    笔画色: (色) => { 笔画色 = 取颜色(色); },
    画点: (x, y, r) => {
      if (!画布ctx) return;
      画布ctx.fillStyle = 填充色;
      画布ctx.beginPath();
      画布ctx.arc(x, y, Math.max(0.5, r || 2), 0, Math.PI * 2);
      画布ctx.fill();
    },
    画线: (x1, y1, x2, y2) => {
      if (!画布ctx) return;
      画布ctx.strokeStyle = 笔画色;
      画布ctx.lineWidth = 2;
      画布ctx.beginPath();
      画布ctx.moveTo(x1, y1);
      画布ctx.lineTo(x2, y2);
      画布ctx.stroke();
    },
    画圆: (x, y, r) => {
      if (!画布ctx) return;
      画布ctx.fillStyle = 填充色;
      画布ctx.beginPath();
      画布ctx.arc(x, y, r, 0, Math.PI * 2);
      画布ctx.fill();
    },
    画矩形: (x, y, w, h) => {
      if (!画布ctx) return;
      画布ctx.fillStyle = 填充色;
      画布ctx.fillRect(x, y, w, h);
    },
    画弧: (x, y, r, 起, 止, 顺) => {
      if (!画布ctx) return;
      画布ctx.fillStyle = 填充色;
      画布ctx.beginPath();
      画布ctx.arc(x, y, r, (起 || 0) * Math.PI / 180, (止 || 360) * Math.PI / 180, !顺);
      画布ctx.fill();
    },
    写字: (文本, x, y, 大小) => {
      if (!画布ctx) return;
      画布ctx.fillStyle = 填充色;
      画布ctx.font = (大小 || 14) + "px 'Microsoft YaHei', sans-serif";
      画布ctx.textBaseline = "top";
      画布ctx.fillText(文本, x, y);
    },
    画多边形: (坐标) => {
      if (!画布ctx || !坐标 || 坐标.length < 3) return;
      画布ctx.fillStyle = 填充色;
      画布ctx.beginPath();
      画布ctx.moveTo(坐标[0][0], 坐标[0][1]);
      for (let i = 1; i < 坐标.length; i++) 画布ctx.lineTo(坐标[i][0], 坐标[i][1]);
      画布ctx.closePath();
      画布ctx.fill();
    },

    读文件: (名) => 读用户文件(名),
    写文件: (名, 内容) => { 写用户文件(名, 内容); 渲染文件列表(); }
  };

  /* ================= 输入弹窗 ================= */
  let 输入回调 = null;
  function 打开输入弹窗(提示, resolve) {
    输入回调 = resolve;
    $("输入提示").textContent = 提示 || "请输入：";
    const 框 = $("输入框");
    框.value = "";
    $("输入弹窗").hidden = false;
    框.focus();
  }
  function 关闭输入弹窗() {
    $("输入弹窗").hidden = true;
    if (输入回调) { 输入回调($("输入框").value); 输入回调 = null; }
  }
  $("输入确定").onclick = 关闭输入弹窗;
  $("输入取消").onclick = () => { 关闭输入弹窗(); 停止(); };
  $("输入框").addEventListener("keydown", (e) => { if (e.key === "Enter") 关闭输入弹窗(); });
  $("输入弹窗").addEventListener("click", (e) => { if (e.target === $("输入弹窗")) 关闭输入弹窗(); });

  /* ================= 运行 / 停止 ================= */
  async function 运行() {
    if (当前解释器) return;
    const 源码 = 编辑器.取值();
    if (!源码.trim()) { 状态提示.textContent = "请先写一些代码"; 编辑器.输入区.focus(); return; }

    $("btn运行").disabled = true;
    $("btn停止").disabled = false;
    控制台输出("▶ 运行开始 · " + 当前文件 + " · " + 取方言名(), "c-mark");

    try {
      const ast = 解析源码(源码, 取方言());
      const 解释器实例 = new 解释器(运行时);
      当前解释器 = 解释器实例;
      await 解释器实例.运行(ast);
      控制台输出("✔ 程序运行结束", "c-ok");
      状态提示.textContent = "";
    } catch (e) {
      if (e && e.__返回 !== undefined) {
        控制台输出("✔ 程序运行结束（提前返回）", "c-ok");
      } else if (e instanceof 运行时错误 || e instanceof 语法错误 || e instanceof 词法错误) {
        const 位置 = (e.行 ? `第 ${e.行} 行${e.列 ? "，第 " + e.列 + " 列" : ""}` : "");
        控制台输出(`❌ ${e.message}${位置 ? "（" + 位置 + "）" : ""}`, "c-err");
        if (e.行) 编辑器.跳到行(e.行);
        状态提示.textContent = "出错位置已定位到编辑器";
      } else {
        控制台输出("❌ " + (e.message || String(e)), "c-err");
      }
    } finally {
      当前解释器 = null;
      $("btn运行").disabled = false;
      $("btn停止").disabled = true;
    }
  }

  function 停止() {
    if (当前解释器) {
      当前解释器.停止 = true;
      控制台输出("■ 正在停止程序…", "c-dim");
    }
  }

  /* ================= 文件管理 UI ================= */
  function 渲染文件列表() {
    const 用户区 = $("用户文件列表");
    const 示例区 = $("示例列表");
    // 用户文件
    用户区.innerHTML = "";
    const 用户表 = 读用户文件表();
    const 名字们 = Object.keys(用户表).sort();
    if (名字们.length === 0) {
      用户区.innerHTML = `<li style="color:#5f6d8e;cursor:default">（暂无文件，点＋新建）</li>`;
    }
    for (const 名 of 名字们) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${转义(名)}</span><span class="del" title="删除">✕</span>`;
      li.classList.toggle("on", 名 === 当前文件);
      li.onclick = () => 打开文件(名);
      li.querySelector(".del").onclick = (e) => {
        e.stopPropagation();
        if (confirm(`确定删除「${名}」吗？`)) {
          删用户文件(名);
          if (当前文件 === 名) { 当前文件 = "未命名.zy"; 编辑器.设值(""); 更新文件栏(); }
          渲染文件列表();
        }
      };
      用户区.appendChild(li);
    }
    // 示例
    示例区.innerHTML = "";
    for (const 示例 of 示例表) {
      const li = document.createElement("li");
      const 方言标记 = 示例.方言 === "zh" ? "简" : 示例.方言 === "trad" ? "繁" : "拼";
      li.innerHTML = `<span>${转义(示例.名)}<span class="f-type">${方言标记}</span></span>`;
      li.onclick = () => 打开示例(示例.名);
      示例区.appendChild(li);
    }
  }

  function 保存当前() {
    if (当前文件 === "未命名.zy" || 当前文件 === "新程序.zy") {
      当前文件 = "新程序" + Math.floor(Math.random() * 900 + 100) + ".zy";
    }
    写用户文件(当前文件, 编辑器.取值());
    文件状态.textContent = "已保存到本机";
    更新文件栏();
    渲染文件列表();
    setTimeout(() => { 文件状态.textContent = ""; }, 2500);
  }

  function 打开文件(名) {
    保存当前静默();
    当前文件 = 名;
    const 内容 = 读用户文件(名);
    编辑器.设值(内容 !== null ? 内容 : "");
    更新文件栏();
    渲染文件列表();
  }

  function 保存当前静默() {
    if (当前文件 !== "未命名.zy" && 编辑器.取值().trim()) {
      写用户文件(当前文件, 编辑器.取值());
    }
  }

  function 打开示例(名) {
    const 示例 = 示例表.find(s => s.名 === 名);
    if (!示例) return;
    保存当前静默();
    当前文件 = 示例.文件;
    $("方言选择").value = 示例.方言;
    当前方言 = 示例.方言;
    编辑器.设值(示例.内容);
    编辑器.高亮();
    更新文件栏();
    渲染文件列表();
  }

  function 新建文件() {
    保存当前静默();
    当前文件 = "未命名.zy";
    编辑器.设值("");
    更新文件栏();
    渲染文件列表();
  }

  function 更新文件栏() {
    当前文件名.textContent = 当前文件;
    状态方言.textContent = 取方言名();
    $("状态方言").textContent = 取方言名();
  }

  /* ================= 页签 ================= */
  function 切页签(名) {
    document.querySelectorAll(".ctab").forEach(b => {
      const 开 = b.dataset.tab === 名;
      b.classList.toggle("on", 开);
    });
    $("控制台区").hidden = 名 !== "控制台";
    $("画布区").hidden = 名 !== "画布";
    if ($("命令行区")) $("命令行区").hidden = 名 !== "命令行";
  }
  document.querySelectorAll(".ctab").forEach(b => {
    b.onclick = () => 切页签(b.dataset.tab);
  });

  /* ================= 命令行终端 ================= */
  const 终端 = new 中文终端($("命令行区"), {
    取方言: () => 取方言(),
    宿主: 运行时,
    读文件表: 读用户文件表,
    打开文件: (名) => 打开文件(名),
    运行当前: 运行,
    切页签,
    展开底栏: () => { if (面板收合) 切换收合(); }
  });
  window.中文程终端 = 终端;

  $("清屏按钮").onclick = () => {
    const 当前 = document.querySelector(".ctab.on");
    if (当前 && 当前.dataset.tab === "命令行") 终端.清屏();
    else 清空控制台();
  };

  /* ================= 底栏收回 / 展开（避免挡住界面） ================= */
  const 底栏 = document.querySelector(".console-pane");
  let 面板收合 = localStorage.getItem("中程面板收合") === "1";
  function 应用收合() {
    底栏.classList.toggle("收合", 面板收合);
    $("收回按钮").textContent = 面板收合 ? "▲ 展开" : "▼ 收回";
  }
  function 切换收合() {
    面板收合 = !面板收合;
    localStorage.setItem("中程面板收合", 面板收合 ? "1" : "0");
    应用收合();
  }
  $("收回按钮").onclick = 切换收合;
  应用收合();

  /* ================= 工具栏 ================= */
  $("btn新建").onclick = 新建文件;
  $("btn新建2").onclick = 新建文件;
  $("btn保存").onclick = 保存当前;
  $("btn运行").onclick = 运行;
  $("btn停止").onclick = 停止;
  $("btn导出").onclick = () => 导出文件(当前文件, 编辑器.取值());
  $("btn导入").onclick = () => { $("导入隐藏").click(); };
  // 隐藏文件输入
  const 导入隐藏 = document.createElement("input");
  导入隐藏.type = "file";
  导入隐藏.accept = ".zy,.txt";
  导入隐藏.style.display = "none";
  导入隐藏.id = "导入隐藏";
  document.body.appendChild(导入隐藏);
  导入隐藏.onchange = () => {
    const 文件 = 导入隐藏.files[0];
    if (!文件) return;
    导入文件(文件, (名, 内容) => {
      写用户文件(名, 内容);
      打开文件(名);
    });
    导入隐藏.value = "";
  };

  $("方言选择").onchange = (e) => {
    当前方言 = e.target.value;
    编辑器.高亮();
    更新文件栏();
    状态提示.textContent = "已切换语言：" + 取方言名();
  };

  /* ================= 快捷键 ================= */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); 保存当前(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "r") { e.preventDefault(); 运行(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); 新建文件(); }
  });

  /* ================= AI 助手 ================= */
  const AI = new 中文AI($("AI面板"), {
    取源码: () => 编辑器.取值(),
    取方言名: () => 取方言名(),
    打开示例: (名) => 打开示例(名)
  });

  /* ================= 软件设置 ================= */
  $("btn设置").onclick = () => window.软件设置.打开("ai");
  window.软件设置.变更回调 = (类型) => {
    if (类型 === "ai") {
      AI.设置 = AI.读设置();
      AI.加消息("系统", AI.可用()
        ? "✅ AI 设置已保存，联网助手已就绪（" + 取渠道(AI.设置.渠道).名 + " · " + AI.设置.模型 + "）。"
        : "设置已保存。未配置密钥时使用离线教学助手。");
    }
    if (类型 === "终端") {
      终端.应用设置();
      状态提示.textContent = "命令行设置已更新";
    }
  };

  // 点击 AI 输出的代码块 → 一键插入编辑器
  $("AI面板").addEventListener("click", (e) => {
    const 代码块 = e.target.closest(".ai-code");
    if (!代码块) return;
    编辑器.设值(代码块.textContent.replace(/\n$/, ""));
    切页签("控制台");
    状态提示.textContent = "已将 AI 生成的代码插入编辑器（Ctrl+S 保存）";
  });

  /* ================= 初始化 ================= */
  渲染文件列表();
  打开示例("你好，世界");
  编辑器.高亮();
  更新文件栏();
  编辑器.输入区.focus();
  setTimeout(() => 状态提示.textContent = "欢迎使用「中文程」！选择左侧示例或点击「运行」开始", 400);
})();
