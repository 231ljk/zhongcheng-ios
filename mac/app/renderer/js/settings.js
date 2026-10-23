/* ============================================================
 * 中文程 · 软件设置 (settings.js)
 * ------------------------------------------------------------
 * 统一的软件设置中心：
 *   1. AI 设置：云端渠道选择（内置 OpenAI / DeepSeek / 阿里通义 /
 *      豆包 / Kimi / 智谱等，选择渠道后自动填好接口地址与模型）、
 *      密钥、模型、创造度、Agent 开关。
 *   2. 命令行设置（实验）：按设备真实检测——本设备有什么命令行
 *      就列出什么命令行（Windows→CMD/PowerShell，macOS→终端 zsh，
 *      Linux→bash）；没有命令行的设备（如手机）如实提示不支持。
 *      内置命令行为官方模拟，任何设备可用。
 *   3. 桌面背景：纯色 / 二次元 / 黑客 / 小米风格，多类壁纸切换。
 *   4. 账号登录（预留）：仅第三方——微软/小米/GitHub/腾讯/华为/
 *      OPPO/vivo。
 * 所有设置仅保存在本机浏览器（localStorage），不上传任何内容。
 * ============================================================ */

const 中程AI键 = "中程AI设置";       // 与 ai.js 共用同一个 localStorage 键
const 中程终端键 = "中程终端设置";
const 中程背景键 = "中程背景";

/* ---------- 内置云端渠道表（OpenAI 兼容接口，选择后自动处理地址与模型） ---------- */
const 渠道表 = [
  {
    id: "doubao", 名: "豆包（火山方舟）",
    地址: "https://ark.cn-beijing.volces.com/api/v3",
    模型: ["doubao-seed-1.6", "doubao-seed-1.6-flash", "doubao-1.5-pro-32k"],
    提示: "密钥在火山方舟控制台「API Key 管理」获取"
  },
  {
    id: "deepseek", 名: "DeepSeek",
    地址: "https://api.deepseek.com/v1",
    模型: ["deepseek-chat", "deepseek-reasoner"],
    提示: "密钥在 platform.deepseek.com 获取，deepseek-chat 即可"
  },
  {
    id: "openai", 名: "OpenAI",
    地址: "https://api.openai.com/v1",
    模型: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    提示: "密钥在 platform.openai.com 获取，国内需自备网络环境"
  },
  {
    id: "qwen", 名: "阿里 · 通义千问",
    地址: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    模型: ["qwen-plus", "qwen-turbo", "qwen-max"],
    提示: "密钥在阿里云「百炼」控制台获取"
  },
  {
    id: "kimi", 名: "月之暗面 Kimi",
    地址: "https://api.moonshot.cn/v1",
    模型: ["kimi-k2-0711-preview", "moonshot-v1-8k", "moonshot-v1-32k"],
    提示: "密钥在 platform.moonshot.cn 获取"
  },
  {
    id: "zhipu", 名: "智谱 GLM",
    地址: "https://open.bigmodel.cn/api/paas/v4",
    模型: ["glm-4-flash", "glm-4-air", "glm-4-plus"],
    提示: "密钥在 bigmodel.cn 获取，glm-4-flash 可免费调用"
  },
  {
    id: "custom", 名: "自定义渠道",
    地址: "",
    模型: [],
    提示: "填写任意兼容 OpenAI 接口格式的服务地址"
  }
];

function 取渠道(id) {
  return 渠道表.find(c => c.id === id) || 渠道表[0];
}

/* ---------- 设备命令行真实检测 ----------
 * 本设备有什么命令行就返回什么；没有命令行的设备返回空列表。
 * 不模拟、不编造：检测结果直接来自浏览器真实的平台信息。 */
function 检测设备命令行() {
  const ua = navigator.userAgent || "";
  const 平台 = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  const s = ua + " " + 平台;
  let 系统 = 平台 || "未知系统";
  const 位数 = /Win64|WOW64|x64|x86_64|aarch64|arm64/i.test(s) ? "64 位"
            : /Win32|x86|i686/i.test(s) ? "32 位" : "";

  if (/iPhone|iPad|iPod/i.test(s)) return { 系统: 系统 || "iOS", 位数, 外部: [] };
  if (/Android|HarmonyOS|OpenHarmony/i.test(s)) return { 系统: 系统 || "Android/鸿蒙", 位数, 外部: [] };
  if (/Windows/i.test(s)) {
    const nt = s.match(/Windows NT ([\d.]+)/i);
    return {
      系统: "Windows" + (nt ? " NT " + nt[1] : ""), 位数,
      外部: [
        { id: "cmd", 名: "CMD", 提示符: "C:\\中文程>" },
        { id: "powershell", 名: "PowerShell", 提示符: "PS C:\\中文程>" }
      ]
    };
  }
  if (/Mac/i.test(s)) {
    return { 系统: 系统 || "macOS", 位数, 外部: [{ id: "zsh", 名: "终端 (zsh)", 提示符: "中文程 ~ %" }] };
  }
  if (/Linux/i.test(s)) {
    return { 系统: 系统 || "Linux", 位数, 外部: [{ id: "bash", 名: "终端 (bash)", 提示符: "中文程 ~ $" }] };
  }
  return { 系统, 位数, 外部: [] };
}

/* 构建本设备的完整命令行表：内置（官方模拟，必有）+ 设备真实外部命令行 */
function 构建壳表() {
  const 表 = { builtin: { 名: "内置命令行", 提示符: "中文程 >", 外部: false } };
  for (const 壳 of 检测设备命令行().外部) {
    表[壳.id] = { 名: 壳.名, 提示符: 壳.提示符, 外部: true };
  }
  return 表;
}

/* ---------- 桌面背景表 ----------
 * 纯色类为纯 CSS；图片类为在线生成的风格壁纸（小米类为「小米风格」，
 * 并非小米官方版权图片）。所有分类数量均为真实计数。 */
const 壁纸图 = (prompt) =>
  "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=" +
  encodeURIComponent(prompt) + "&image_size=landscape_16_9";

const 背景表 = [
  {
    类: "纯色类", 项: [
      { id: "bg-default", 名: "深邃蓝（默认）", 类型: "css", 值: "linear-gradient(135deg,#0e1320,#151c2c)" },
      { id: "bg-black", 名: "暗夜黑", 类型: "css", 值: "#05070c" },
      { id: "bg-green", 名: "墨绿", 类型: "css", 值: "linear-gradient(135deg,#081b15,#0f2e25)" },
      { id: "bg-purple", 名: "深紫", 类型: "css", 值: "linear-gradient(135deg,#150d28,#241145)" },
      { id: "bg-navy", 名: "藏青", 类型: "css", 值: "linear-gradient(135deg,#081527,#10263f)" },
      { id: "bg-dawn", 名: "晨曦", 类型: "css", 值: "linear-gradient(135deg,#2b1a3a,#7a3b5e,#e08a5a)" },
      { id: "bg-dusk", 名: "暮色", 类型: "css", 值: "linear-gradient(135deg,#101d42,#3a2b5e,#8a4a6a)" }
    ]
  },
  {
    类: "二次元类", 项: [
      { id: "bg-acg1", 名: "星夜山野", 类型: "img", 值: 壁纸图("beautiful anime style landscape wallpaper, starry night sky over mountains, cherry blossom petals floating in the air, vibrant colors, high quality digital art, no text") },
      { id: "bg-acg2", 名: "暮色都市", 类型: "img", 值: 壁纸图("anime style city skyline at sunset, girl silhouette on rooftop watching warm orange sky and clouds, lofi aesthetic, high quality wallpaper, no text") },
      { id: "bg-acg3", 名: "雨夜霓虹", 类型: "img", 值: 壁纸图("anime style rainy night street with glowing neon signs and reflections on wet road, cozy atmosphere, high quality digital painting wallpaper, no text") }
    ]
  },
  {
    类: "黑客类", 项: [
      { id: "bg-hack1", 名: "代码雨", 类型: "img", 值: 壁纸图("matrix style falling green code rain on pure black background, digital hacker aesthetic, high contrast wallpaper, no text watermark") },
      { id: "bg-hack2", 名: "终端之光", 类型: "img", 值: 壁纸图("dark hacker terminal screen with glowing green text lines and circuit board patterns, cyberpunk atmosphere, wallpaper, no watermark") },
      { id: "bg-hack3", 名: "数据洪流", 类型: "img", 值: 壁纸图("blue digital cyberspace with glowing data streams and network grid lines, dark technology style wallpaper, no text") }
    ]
  },
  {
    类: "小米风格", 项: [
      { id: "bg-mi1", 名: "流光橙蓝", 类型: "img", 值: 壁纸图("abstract flowing silk gradient wallpaper, orange and blue smooth waves, elegant minimal, premium smartphone system wallpaper style, no text") },
      { id: "bg-mi2", 名: "琉璃幻彩", 类型: "img", 值: 壁纸图("abstract colorful frosted glass shapes on dark background, soft gradient glow, premium smartphone wallpaper style, minimal, no text") },
      { id: "bg-mi3", 名: "静澜青碧", 类型: "img", 值: 壁纸图("calm abstract teal and emerald gradient waves, smooth silky curves, premium minimal smartphone wallpaper style, no text") }
    ]
  }
];

function 应用背景(id) {
  const 项 = 背景表.flatMap(c => c.项).find(b => b.id === id) || 背景表[0].项[0];
  document.body.style.background = 项.类型 === "img"
    ? `url("${项.值}") center / cover no-repeat fixed`
    : 项.值;
  document.body.classList.toggle("自定义背景", 项.id !== "bg-default");
  localStorage.setItem(中程背景键, 项.id);
}

function 读背景() {
  return localStorage.getItem(中程背景键) || "bg-default";
}

/* ---------- 设置读写（带默认值与渠道自动补全） ---------- */
function 读AI设置() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(中程AI键)) || {}; } catch (e) { s = {}; }
  s = Object.assign({ 渠道: "doubao", 地址: "", 密钥: "", 模型: "", 温度: 0.6, 允许Agent: false }, s);
  const 渠道 = 取渠道(s.渠道);
  if (!s.地址) s.地址 = 渠道.地址;
  if (!s.模型) s.模型 = 渠道.模型[0] || "doubao-seed-1.6";
  return s;
}

function 读终端设置() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(中程终端键)) || {}; } catch (e) { s = {}; }
  /* 兼容旧版结构 {启用内置, 启用CMD, 启用PS} → 新结构 {启用:{...}} */
  if (!s.启用 || typeof s.启用 !== "object") {
    s.启用 = {
      builtin: s.启用内置 !== false,
      cmd: s.启用CMD !== false,
      powershell: s.启用PS !== false
    };
  }
  if (!s.默认) s.默认 = "builtin";
  return s;
}

/* ================= 设置面板 ================= */
class 软件设置类 {
  constructor() {
    this.变更回调 = null;   // main.js 注入：(类型: "ai"|"终端") => {}
    this.设备 = 检测设备命令行();
    this.壳表 = 构建壳表();
    this.构建();
    应用背景(读背景());   // 启动即恢复上次选择的桌面背景
  }

  构建() {
    const 渠道选项 = 渠道表.map(c => `<option value="${c.id}">${c.名}</option>`).join("");
    document.body.insertAdjacentHTML("beforeend", `
<div id="设置弹窗" class="modal" hidden>
  <div class="modal-box set-box">
    <div class="set-side">
      <div class="set-side-title">软件设置</div>
      <button class="set-nav on" data-stab="ai">AI 设置</button>
      <button class="set-nav" data-stab="term">命令行设置</button>
      <button class="set-nav" data-stab="bg">桌面背景</button>
      <button class="set-nav" data-stab="account">账号登录</button>
      <div class="set-side-tip">全部设置仅保存在本机浏览器</div>
    </div>
    <div class="set-main">

      <!-- ===== AI 设置 ===== -->
      <div class="set-page" data-page="ai">
        <div class="set-title">AI 设置</div>
        <label class="set-label">云端渠道（选择后自动处理接口地址与模型）</label>
        <select id="st渠道">${渠道选项}</select>
        <div class="set-hint" id="st渠道提示"></div>
        <label class="set-label">接口地址</label>
        <input id="st地址" placeholder="https://...">
        <label class="set-label">API 密钥</label>
        <input id="st密钥" type="password" placeholder="粘贴你的 API Key；留空则使用离线教学助手">
        <label class="set-label">模型</label>
        <input id="st模型" list="st模型列表" placeholder="选择或手动输入模型名">
        <datalist id="st模型列表"></datalist>
        <label class="set-label">创造度（0 ~ 2，越大越发散）</label>
        <input id="st温度" type="number" step="0.1" min="0" max="2">
        <label class="set-check"><input id="stAgent" type="checkbox"> <span>允许 AI 以 Agent 方式直接执行命令行（关闭时每次执行前都会询问）</span></label>
        <div class="set-btns">
          <button id="st保存AI" class="primary">保存</button>
          <button id="st测试">测试连接</button>
          <button id="st关闭AI">关闭</button>
        </div>
        <div class="set-hint" id="stAI状态"></div>
      </div>

      <!-- ===== 命令行设置（实验，按设备真实检测） ===== -->
      <div class="set-page" data-page="term" hidden>
        <div class="set-title">命令行设置（实验功能）</div>
        <div class="set-hint" id="st设备信息"></div>
        <div id="st无命令行提示" class="set-nocli" hidden>你好，本设备没有命令行可以让我使用，所以该设备暂时不支持命令行功能。</div>
        <div id="st壳列表"></div>
        <div id="st默认行">
          <label class="set-label">默认命令行</label>
          <select id="st默认终端"></select>
        </div>
        <div class="set-hint">说明：内置命令行是官方模拟命令行，在任何设备都可用；外部命令行直接使用本设备自身的命令行，网页版受浏览器沙箱限制仅作预留，在「中文程桌面版」中可真实执行。</div>
        <div class="set-btns">
          <button id="st保存终端" class="primary">保存</button>
          <button id="st关闭终端">关闭</button>
        </div>
      </div>

      <!-- ===== 桌面背景 ===== -->
      <div class="set-page" data-page="bg" hidden>
        <div class="set-title">桌面背景</div>
        <div class="set-hint">点击任意背景立即切换，自动保存。共 ${背景表.reduce((n, c) => n + c.项.length, 0)} 款。</div>
        <div id="st背景区"></div>
        <div class="set-btns"><button id="st关闭背景">关闭</button></div>
      </div>

      <!-- ===== 账号登录（预留） ===== -->
      <div class="set-page" data-page="account" hidden>
        <div class="set-title">账号登录</div>
        <div class="set-hint">账号功能即将上线。届时仅支持第三方账号一键登录，用于云端同步你的程序、设置与 AI 对话记录，无需注册新账号。</div>
        <div class="set-accounts">
          <button disabled>微软 Microsoft<span class="soon">即将上线</span></button>
          <button disabled>小米<span class="soon">即将上线</span></button>
          <button disabled>GitHub<span class="soon">即将上线</span></button>
          <button disabled>腾讯 QQ / 微信<span class="soon">即将上线</span></button>
          <button disabled>华为<span class="soon">即将上线</span></button>
          <button disabled>OPPO<span class="soon">即将上线</span></button>
          <button disabled>vivo<span class="soon">即将上线</span></button>
        </div>
        <div class="set-btns"><button id="st关闭账号">关闭</button></div>
      </div>

    </div>
  </div>
</div>`);

    const $ = (id) => document.getElementById(id);

    /* 页签切换 */
    this.弹窗 = $("设置弹窗");
    this.弹窗.querySelectorAll(".set-nav").forEach(b => {
      b.onclick = () => this.切页(b.dataset.stab);
    });
    this.弹窗.addEventListener("click", (e) => { if (e.target === this.弹窗) this.弹窗.hidden = true; });

    /* AI 页事件 */
    $("st渠道").onchange = () => this.应用渠道();
    $("st保存AI").onclick = () => this.保存AI();
    $("st关闭AI").onclick = () => { this.弹窗.hidden = true; };
    $("st测试").onclick = () => this.测试连接();

    /* 命令行页事件 */
    $("st保存终端").onclick = () => this.保存终端();
    $("st关闭终端").onclick = () => { this.弹窗.hidden = true; };
    $("st关闭账号").onclick = () => { this.弹窗.hidden = true; };
    $("st关闭背景").onclick = () => { this.弹窗.hidden = true; };

    this.构建背景页();
  }

  切页(页) {
    this.弹窗.querySelectorAll(".set-nav").forEach(b => b.classList.toggle("on", b.dataset.stab === 页));
    this.弹窗.querySelectorAll(".set-page").forEach(p => { p.hidden = p.dataset.page !== 页; });
  }

  打开(页 = "ai") {
    this.弹窗.hidden = false;
    this.切页(页);
    this.填入AI();
    this.填入终端();
    this.刷新背景选中();
  }

  /* ---------- AI 页 ---------- */
  填入AI() {
    const $ = (id) => document.getElementById(id);
    const s = 读AI设置();
    $("st渠道").value = s.渠道;
    this.应用渠道(true);
    $("st地址").value = s.地址 || "";
    $("st密钥").value = s.密钥 || "";
    $("st模型").value = s.模型 || "";
    $("st温度").value = s.温度 ?? 0.6;
    $("stAgent").checked = !!s.允许Agent;
    $("stAI状态").textContent = "";
  }

  应用渠道(保留现有 = false) {
    const $ = (id) => document.getElementById(id);
    const 渠道 = 取渠道($("st渠道").value);
    $("st渠道提示").textContent = 渠道.提示;
    if (!保留现有 || !$("st地址").value) $("st地址").value = 渠道.地址;
    $("st模型列表").innerHTML = 渠道.模型.map(m => `<option value="${m}">`).join("");
    if (!保留现有 || !渠道.模型.includes($("st模型").value)) {
      if (渠道.模型.length) $("st模型").value = 渠道.模型[0];
    }
  }

  保存AI() {
    const $ = (id) => document.getElementById(id);
    const 渠道 = 取渠道($("st渠道").value);
    const s = {
      渠道: 渠道.id,
      地址: $("st地址").value.trim() || 渠道.地址,
      密钥: $("st密钥").value.trim(),
      模型: $("st模型").value.trim() || 渠道.模型[0] || "",
      温度: parseFloat($("st温度").value) || 0.6,
      允许Agent: $("stAgent").checked
    };
    localStorage.setItem(中程AI键, JSON.stringify(s));
    this.弹窗.hidden = true;
    if (this.变更回调) this.变更回调("ai");
  }

  async 测试连接() {
    const $ = (id) => document.getElementById(id);
    const 状态 = $("stAI状态");
    const 地址 = $("st地址").value.trim().replace(/\/+$/, "");
    const 密钥 = $("st密钥").value.trim();
    const 模型 = $("st模型").value.trim();
    if (!地址 || !密钥 || !模型) { 状态.textContent = "请先填好地址、密钥和模型再测试。"; return; }
    状态.textContent = "正在测试连接…";
    try {
      const 响应 = await fetch(地址 + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + 密钥 },
        body: JSON.stringify({ model: 模型, messages: [{ role: "user", content: "只回复：好" }], max_tokens: 8, stream: false })
      });
      if (!响应.ok) throw new Error("HTTP " + 响应.status + " " + (await 响应.text().catch(() => "")).slice(0, 120));
      const json = await 响应.json();
      const 内容 = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      状态.textContent = "✅ 连接成功，模型回复：" + (内容 || "（空）");
    } catch (e) {
      状态.textContent = "❌ 连接失败：" + (e.message || "网络错误");
    }
  }

  /* ---------- 命令行页（按设备真实检测渲染） ---------- */
  填入终端() {
    const $ = (id) => document.getElementById(id);
    const s = 读终端设置();
    const 外部 = this.设备.外部;

    /* 真实设备信息：系统、位数、检测到的外部命令行数量（全部为真实检测值） */
    $("st设备信息").textContent =
      "当前设备：" + this.设备.系统 + (this.设备.位数 ? "（" + this.设备.位数 + "）" : "") +
      (外部.length
        ? " · 检测到 " + 外部.length + " 个外部命令行：" + 外部.map(x => x.名).join("、")
        : " · 未检测到可用的外部命令行");

    /* 无外部命令行的设备：如实提示 */
    $("st无命令行提示").hidden = 外部.length !== 0;

    /* 壳复选列表：内置 + 设备真实外部命令行 */
    const 列表 = $("st壳列表");
    列表.innerHTML = "";
    for (const [id, 壳] of Object.entries(this.壳表)) {
      const label = document.createElement("label");
      label.className = "set-check";
      const ck = document.createElement("input");
      ck.type = "checkbox";
      ck.dataset.shell = id;
      ck.checked = s.启用[id] !== false;
      const 文 = document.createElement("span");
      文.textContent = 壳.名 + (壳.外部 ? "（本设备命令行）" : "（官方模拟，任何设备可用）");
      label.appendChild(ck);
      label.appendChild(文);
      列表.appendChild(label);
    }

    /* 默认命令行下拉 */
    const 默认框 = $("st默认终端");
    默认框.innerHTML = "";
    for (const [id, 壳] of Object.entries(this.壳表)) {
      const op = document.createElement("option");
      op.value = id;
      op.textContent = 壳.名;
      默认框.appendChild(op);
    }
    默认框.value = this.壳表[s.默认] ? s.默认 : "builtin";
  }

  保存终端() {
    const $ = (id) => document.getElementById(id);
    const 启用 = {};
    $("st壳列表").querySelectorAll("input[data-shell]").forEach(ck => {
      启用[ck.dataset.shell] = ck.checked;
    });
    if (!Object.values(启用).some(v => v)) 启用.builtin = true;   // 至少保留一个
    let 默认 = $("st默认终端").value;
    if (!启用[默认]) 默认 = 启用.builtin ? "builtin" : Object.keys(启用).find(k => 启用[k]);
    localStorage.setItem(中程终端键, JSON.stringify({ 启用, 默认 }));
    this.弹窗.hidden = true;
    if (this.变更回调) this.变更回调("终端");
  }

  /* ---------- 桌面背景页 ---------- */
  构建背景页() {
    const 区 = document.getElementById("st背景区");
    区.innerHTML = "";
    for (const 分类 of 背景表) {
      const 题 = document.createElement("div");
      题.className = "set-label";
      题.textContent = 分类.类 + "（" + 分类.项.length + " 款）";
      区.appendChild(题);
      const 格 = document.createElement("div");
      格.className = "bg-grid";
      for (const 项 of 分类.项) {
        const 卡 = document.createElement("div");
        卡.className = "bg-card";
        卡.dataset.bgid = 项.id;
        卡.title = 项.名;
        if (项.类型 === "img") {
          const img = document.createElement("img");
          img.src = 项.值;
          img.loading = "lazy";
          img.alt = 项.名;
          卡.appendChild(img);
        } else {
          卡.style.background = 项.值;
        }
        const 名条 = document.createElement("span");
        名条.className = "bg-name";
        名条.textContent = 项.名;
        卡.appendChild(名条);
        卡.onclick = () => { 应用背景(项.id); this.刷新背景选中(); };
        格.appendChild(卡);
      }
      区.appendChild(格);
    }
  }

  刷新背景选中() {
    const 当前 = 读背景();
    document.querySelectorAll(".bg-card").forEach(c => {
      c.classList.toggle("on", c.dataset.bgid === 当前);
    });
  }
}

/* ---------- 全局入口 ---------- */
window.软件设置 = new 软件设置类();
window.打开软件设置 = (页) => window.软件设置.打开(页);
