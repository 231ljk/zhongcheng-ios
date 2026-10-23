/* ============================================================
 * 中文程 · 代码编辑器 (editor.js)
 * ------------------------------------------------------------
 * 完全自研的轻量中文代码编辑器：
 *   - 双层结构：底层 <pre> 渲染语法高亮，上层 <textarea> 接收输入
 *   - 中文语法高亮（复用自研词法分析器，含注释）
 *   - 行号、自动缩进、Tab 缩进
 *   - 智能补全（关键词 / 中文内建函数 / 用户变量）
 *   - 光标行列状态
 * ============================================================ */

class 中文编辑器 {
  constructor(容器, 选项) {
    this.容器 = 容器;
    this.选项 = 选项 || {};
    this.方言 = 选项.方言 || "zh";

    this.容器.innerHTML = `
      <div class="editor-shell">
        <div class="editor-gutter"></div>
        <div class="editor-body">
          <pre class="editor-highlight" aria-hidden="true"></pre>
          <textarea class="editor-input" wrap="off" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
        </div>
      </div>
      <div class="editor-complete" hidden></div>
    `;

    this.壳 = this.容器.querySelector(".editor-shell");
    this.行号栏 = this.容器.querySelector(".editor-gutter");
    this.高亮层 = this.容器.querySelector(".editor-highlight");
    this.输入区 = this.容器.querySelector(".editor-input");
    this.补全层 = this.容器.querySelector(".editor-complete");

    this.补全候选 = [];
    this.补全选中 = -1;
    this.补全起点 = -1;
    this.高亮定时器 = null;

    this.绑定事件();
  }

  绑定事件() {
    const ta = this.输入区;

    ta.addEventListener("input", () => {
      this.排程高亮();
      this.同步滚动();
      this.更新行号栏();
      this.触发补全();
    });

    ta.addEventListener("scroll", () => this.同步滚动());
    ta.addEventListener("keydown", (e) => this.处理按键(e));
    ta.addEventListener("keyup", () => {
      this.更新状态栏();
      this.更新补全高亮();
    });
    ta.addEventListener("click", () => {
      this.更新状态栏();
      this.补全层.hidden = true;
    });

    // 全局快捷键（运行时由 main 注册）
  }

  /* ---------- 内容 ---------- */
  取值() { return this.输入区.value; }
  设值(文本) {
    this.输入区.value = 文本;
    this.高亮();
    this.更新行号栏();
    this.同步滚动();
    this.输入区.focus();
  }

  /* ---------- 滚动与行号 ---------- */
  同步滚动() {
    this.高亮层.scrollTop = this.输入区.scrollTop;
    this.高亮层.scrollLeft = this.输入区.scrollLeft;
    this.行号栏.scrollTop = this.输入区.scrollTop;
  }

  更新行号栏() {
    const 行数 = this.输入区.value.split("\n").length;
    let html = "";
    for (let i = 1; i <= 行数; i++) html += i + "\n";
    this.行号栏.textContent = html;
  }

  /* ---------- 语法高亮 ---------- */
  排程高亮() {
    clearTimeout(this.高亮定时器);
    this.高亮定时器 = setTimeout(() => this.高亮(), 120);
  }

  高亮() {
    const 源码 = this.输入区.value;
    if (!源码) { this.高亮层.textContent = ""; return; }
    try {
      this.高亮层.innerHTML = 着色(源码, 取方言());
    } catch (e) {
      this.高亮层.textContent = 源码;
    }
  }

  /* ---------- 编辑行为 ---------- */
  处理按键(e) {
    const ta = this.输入区;
    /* 补全选择 */
    if (!this.补全层.hidden) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.补全选中 = (this.补全选中 + 1) % this.补全候选.length; this.更新补全高亮(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.补全选中 = (this.补全选中 - 1 + this.补全候选.length) % this.补全候选.length; this.更新补全高亮(); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        if (this.补全选中 >= 0) {
          e.preventDefault();
          this.接受补全();
          return;
        }
      }
      if (e.key === "Escape") { this.补全层.hidden = true; return; }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const 开始 = ta.selectionStart;
      const 行首 = ta.value.lastIndexOf("\n", 开始 - 1) + 1;
      const 前导 = ta.value.slice(行首, 开始).match(/^[ \t]*/)[0];
      // 若上一行以 { 结尾，缩进加深
      const 上一行 = ta.value.slice(行首, 开始);
      let 额外 = "";
      if (/\{\s*$/.test(上一行)) 额外 = "    ";
      const 插入 = "\n" + 前导 + 额外;
      ta.setRangeText(插入, 开始, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
      return;
    }
  }

  /* ---------- 智能补全 ---------- */
  取候选词() {
    const 方言 = 取方言();
    const 词 = new Set();
    for (const k of Object.keys(方言.词表)) 词.add(k);
    for (const k of Object.keys(方言.内建函数)) 词.add(k);
    // 用户源码中出现的标识符
    try {
      const 词法 = new 词法分析器(this.输入区.value, 方言);
      for (const t of 词法.分析(true)) {
        if (t.类型 === "IDENT") 词.add(t.值);
      }
    } catch (e) { /* 忽略 */ }
    return [...词].sort((a, b) => a.length - b.length);
  }

  触发补全() {
    const ta = this.输入区;
    const 光标 = ta.selectionStart;
    // 提取光标前的"词片段"
    const 前文 = ta.value.slice(0, 光标);
    const 匹配 = 前文.match(/[\u4e00-\u9fff\u3400-\u4dbfa-zA-Z_]+$/);
    if (!匹配 || 匹配[0].length < 1) {
      this.补全层.hidden = true;
      return;
    }
    const 片段 = 匹配[0];
    const 候选 = this.取候选词().filter(w => w.startsWith(片段) && w !== 片段);
    if (候选.length === 0) { this.补全层.hidden = true; return; }
    this.补全候选 = 候选.slice(0, 12);
    this.补全选中 = 0;
    this.补全起点 = 光标 - 片段.length;
    this.渲染补全(ta);
  }

  渲染补全(ta) {
    const 行高 = 20;
    const 行号 = ta.value.slice(0, ta.selectionStart).split("\n").length - 1;
    const 行首 = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    const 列 = ta.selectionStart - 行首;
    const 顶部 = 行号 * 行高 + 行高 - ta.scrollTop;
    const 左侧 = 列 * 8 + 8 - ta.scrollLeft;
    this.补全层.style.top = 顶部 + "px";
    this.补全层.style.left = 左侧 + "px";
    this.补全层.innerHTML = this.补全候选.map((w, i) =>
      `<div class="cc-item${i === this.补全选中 ? " cc-on" : ""}" data-i="${i}">${w}</div>`
    ).join("");
    this.补全层.hidden = false;
  }

  更新补全高亮() {
    if (this.补全层.hidden) return;
    const 项 = this.补全层.querySelectorAll(".cc-item");
    for (let i = 0; i < 项.length; i++) 项[i].classList.toggle("cc-on", i === this.补全选中);
  }

  接受补全() {
    const ta = this.输入区;
    const 词 = this.补全候选[this.补全选中];
    if (!词) return;
    ta.setRangeText(词, this.补全起点, ta.selectionStart, "end");
    this.补全层.hidden = true;
    this.高亮();
    this.更新状态栏();
  }

  /* ---------- 状态栏 ---------- */
  更新状态栏() {
    const fn = this.选项.状态回调;
    if (!fn) return;
    const ta = this.输入区;
    const 前文 = ta.value.slice(0, ta.selectionStart);
    const 行 = 前文.split("\n").length;
    const 行首 = 前文.lastIndexOf("\n") + 1;
    const 列 = ta.selectionStart - 行首 + 1;
    const 总行 = ta.value.split("\n").length;
    fn({ 行, 列, 总行 });
  }

  /* 跳到指定行（用于错误定位） */
  跳到行(n) {
    const ta = this.输入区;
    const 行们 = ta.value.split("\n");
    let 偏移 = 0;
    for (let i = 0; i < Math.min(n - 1, 行们.length); i++) 偏移 += 行们[i].length + 1;
    ta.focus();
    ta.setSelectionRange(偏移, 偏移);
    const 行高 = 20;
    ta.scrollTop = Math.max(0, (n - 1) * 行高 - 60);
    this.同步滚动();
    this.更新状态栏();
  }
}

/* ---------- 着色工具 ---------- */
const 关键词类型 = new Set([
  "VAR", "IF", "ELSE_IF", "ELSE", "WHILE", "FOR", "FUNC", "RETURN",
  "TRUE", "FALSE", "NULL", "AND", "OR", "NOT", "CLASS", "NEW", "PROP",
  "METHOD", "THIS", "FROM", "TO", "IN", "ASGN", "WRITE", "READ", "CLS", "WAIT"
]);

function 转义(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* 着色：复用自研词法分析器得到 token 流，再按源码原文区间拼装 HTML。
 * 字符串 token 需还原引号原文，故逐个计算 token 在源码中的偏移。 */
function 着色(源码, 方言) {
  const 词法 = new 词法分析器(源码, 方言);
  const tokens = 词法.分析(true);
  const 内建 = new Set(Object.keys(方言.内建函数));

  const 带位置 = [];
  let 偏移 = 0;
  for (const t of tokens) {
    let 长度;
    if (t.类型 === "NUMBER") 长度 = String(t.值).length;
    else if (t.类型 === "STRING") 长度 = 引号串长度(源码.slice(偏移));
    else 长度 = (t.值 === null || t.值 === undefined) ? 0 : String(t.值).length;
    t.偏移 = 偏移;
    t.原文长度 = 长度;
    偏移 += 长度;
    带位置.push(t);
  }

  let html = "";
  let 上次 = 0;
  for (const t of 带位置) {
    if (t.类型 === "EOF") break;
    if (t.偏移 < 上次) continue;
    const 原文 = 源码.slice(t.偏移, Math.min(t.偏移 + t.原文长度, 源码.length));
    let 类 = "";
    if (t.类型 === "COMMENT") 类 = "tk-comment";
    else if (关键词类型.has(t.类型)) 类 = "tk-keyword";
    else if (t.类型 === "NUMBER") 类 = "tk-number";
    else if (t.类型 === "STRING") 类 = "tk-string";
    else if (t.类型 === "IDENT") 类 = 内建.has(t.值) ? "tk-func" : "tk-ident";
    else 类 = "tk-op";
    html += 转义(源码.slice(上次, t.偏移));
    html += 类 ? `<span class="${类}">` + 转义(原文) + "</span>" : 转义(原文);
    上次 = t.偏移 + t.原文长度;
  }
  const 剩余 = 源码.slice(上次);
  if (剩余) html += 转义(剩余);
  return html;
}

/* 计算源码片段起始处引号字符串的实际长度（含引号与转义） */
function 引号串长度(片段) {
  const 引号 = 片段[0];
  if (引号 !== '"' && 引号 !== "'") return 0;
  let i = 1;
  while (i < 片段.length) {
    if (片段[i] === "\\") { i += 2; continue; }
    if (片段[i] === 引号) return i + 1;
    i++;
  }
  return 片段.length;
}
