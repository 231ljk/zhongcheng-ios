/* ============================================================
 * 中文程 · 命令行 (terminal.js)
 * ------------------------------------------------------------
 * 命令行按设备真实能力提供（不模拟、不编造）：
 *   1. 内置命令行（官方模拟）：任何设备可用——可直接运行中文程代码、
 *      管理程序文件、查看版本时间，也是 AI Agent 的执行入口。
 *   2. 外部命令行：直接使用本设备自身的命令行——
 *      Windows 有 CMD / PowerShell，macOS 有 终端(zsh)，Linux 有 bash；
 *      手机等没有命令行的设备则如实不提供。
 *      网页版受浏览器沙箱限制仅作界面预留，桌面版通过
 *      window.中文程桌面桥 真实执行。
 * 面板支持收回（见 main.js 的「收回」按钮），避免挡住界面。
 * ============================================================ */

class 中文终端 {
  /**
   * 选项: { 取方言, 宿主(运行时宿主，输出/清屏将被替换为终端), 读文件表, 打开文件, 运行当前, 切页签, 展开底栏 }
   */
  constructor(容器, 选项) {
    this.容器 = 容器;
    this.选项 = 选项 || {};
    this.壳表 = 构建壳表();          // settings.js：内置 + 本设备真实外部命令行
    this.设置 = 读终端设置();
    this.当前壳 = this.设置.默认;
    this.外部提示过 = {};
    this.构建();
  }

  /* ---------- 界面 ---------- */
  构建() {
    this.容器.innerHTML = `
      <div class="term-shells"></div>
      <div class="term-out"></div>
      <div class="term-in">
        <span class="term-prompt"></span>
        <input class="term-field" spellcheck="false" autocomplete="off" placeholder="输入命令，Enter 执行；输入「帮助」查看可用命令">
        <button class="term-run">执行</button>
      </div>`;
    this.壳栏 = this.容器.querySelector(".term-shells");
    this.输出区 = this.容器.querySelector(".term-out");
    this.提示符 = this.容器.querySelector(".term-prompt");
    this.输入框 = this.容器.querySelector(".term-field");

    const 提交 = () => this.执行输入();
    this.容器.querySelector(".term-run").onclick = 提交;
    this.输入框.addEventListener("keydown", (e) => { if (e.key === "Enter") 提交(); });

    this.应用设置();
    this.打印("中文程命令行已就绪 · 输入「帮助」查看可用命令", "dim");
  }

  应用设置() {
    this.设置 = 读终端设置();
    const 启用 = Object.keys(this.壳表).filter(id => this.设置.启用[id] !== false);
    if (!启用.length) 启用.push("builtin");
    if (!启用.includes(this.当前壳)) {
      this.当前壳 = 启用.includes(this.设置.默认) ? this.设置.默认 : 启用[0];
    }

    this.壳栏.innerHTML = "";
    for (const id of 启用) {
      const b = document.createElement("button");
      b.className = "term-shell" + (id === this.当前壳 ? " on" : "");
      b.textContent = this.壳表[id].名;
      b.onclick = () => this.切壳(id);
      this.壳栏.appendChild(b);
    }
    this.提示符.textContent = this.壳表[this.当前壳].提示符;
  }

  切壳(id) {
    this.当前壳 = id;
    this.应用设置();   // 切换图标本身已表明当前壳，不再额外提示
    this.输入框.focus();
  }

  /* ---------- 输出 ---------- */
  打印(文本, 类名) {
    const div = document.createElement("div");
    div.className = "term-line" + (类名 ? " t-" + 类名 : "");
    div.textContent = 文本;
    this.输出区.appendChild(div);
    this.输出区.scrollTop = this.输出区.scrollHeight;
  }

  清屏() { this.输出区.innerHTML = ""; }

  /* ---------- 执行入口（用户输入 / AI Agent 共用） ---------- */
  async 执行输入() {
    const 命令 = this.输入框.value.trim();
    if (!命令) return;
    this.输入框.value = "";
    await this.执行(命令);
  }

  /** 公开给 AI Agent：window.中文程终端.执行(命令, shell?) */
  async 执行(命令, shell, 来自Agent = false) {
    if (shell && this.壳表[shell] && shell !== this.当前壳 && this.设置.启用[shell] !== false) {
      this.切壳(shell);
    }
    if (this.选项.展开底栏) this.选项.展开底栏();
    if (this.选项.切页签) this.选项.切页签("命令行");
    this.打印((来自Agent ? "🤖 " : "") + this.壳表[this.当前壳].提示符 + " " + 命令, "echo");
    try {
      if (this.当前壳 === "builtin") await this.内置执行(命令.trim());
      else await this.外部执行(this.当前壳, 命令);
    } catch (e) {
      this.打印("❌ " + (e.message || String(e)), "err");
    }
  }

  /** 公开给 AI Agent：window.中文程终端.Agent执行(命令, shell?) */
  async Agent执行(命令, shell) {
    await this.执行(命令, shell, true);
  }

  /* ---------- 内置命令行 ---------- */
  async 内置执行(净) {
    if (!净) return;
    const 空格 = 净.search(/\s/);
    const 头 = (空格 === -1 ? 净 : 净.slice(0, 空格)).toLowerCase();
    const 参 = 空格 === -1 ? "" : 净.slice(空格 + 1).trim();

    switch (头) {
      case "帮助": case "help": case "？": case "?":
        this.打印(
`可用命令：
  帮助 / help          显示本帮助
  清屏 / cls           清空命令行输出
  版本 / ver           显示中文程版本
  时间 / time          显示当前时间
  运行 / run           运行编辑器中的当前程序
  文件 / dir           列出「我的程序」中的文件
  打开 <文件名>         在编辑器中打开指定文件
  写 <文本> / echo     原样输出一段文本
  算 <表达式>           计算并输出结果，如：算 1+2*3
  其他任意内容          当作中文程代码直接执行，如：写("你好")`, "dim");
        return;
      case "清屏": case "cls": case "clear": this.清屏(); return;
      case "版本": case "ver": this.打印("中文程 v1.15.0 · 内置命令行（网页版）", "ok"); return;
      case "时间": case "time": this.打印(new Date().toLocaleString("zh-CN", { hour12: false })); return;
      case "运行": case "run":
        this.打印("▶ 已触发运行（程序输出见「控制台」页签）", "dim");
        if (this.选项.切页签) this.选项.切页签("控制台");
        if (this.选项.运行当前) this.选项.运行当前();
        return;
      case "文件": case "dir": case "ls": {
        const 表 = this.选项.读文件表 ? this.选项.读文件表() : {};
        const 名字们 = Object.keys(表).sort();
        this.打印(名字们.length ? 名字们.join("    ") : "（暂无文件）");
        return;
      }
      case "打开": case "open": {
        if (!参) { this.打印("用法：打开 <文件名>", "err"); return; }
        const 表 = this.选项.读文件表 ? this.选项.读文件表() : {};
        if (表[参] === undefined) { this.打印("找不到文件「" + 参 + "」，输入「文件」查看列表", "err"); return; }
        this.选项.打开文件(参);
        this.打印("已在编辑器中打开「" + 参 + "」", "ok");
        return;
      }
      case "写": case "echo": this.打印(参); return;
      case "算": {
        if (!参) { this.打印("用法：算 <表达式>", "err"); return; }
        await this.运行中文程("写(" + 参 + ")");
        return;
      }
      default:
        await this.运行中文程(净);   // 其他内容当作中文程代码直接执行
    }
  }

  /* 在终端里运行一小段中文程代码，输出回显到终端 */
  async 运行中文程(源码) {
    if (typeof 解析源码 !== "function" || typeof 解释器 !== "function") {
      this.打印("语言内核尚未加载完成", "err"); return;
    }
    const 宿主 = Object.assign({}, this.选项.宿主, {
      输出: (t) => this.打印(String(t)),
      清屏: () => this.清屏()
    });
    try {
      const ast = 解析源码(源码, this.选项.取方言 ? this.选项.取方言() : 取方言());
      await new 解释器(宿主).运行(ast);
    } catch (e) {
      if (e && e.__返回 !== undefined) return;   // 顶层返回视为正常结束
      throw e;
    }
  }

  /* ---------- 外部命令行（CMD / PowerShell） ---------- */
  async 外部执行(shell, 命令) {
    // 桌面版（Electron）注入的桥接接口：window.中文程桌面桥.执行命令(shell, 命令) => Promise<string>
    const 桥 = window.中文程桌面桥;
    if (桥 && typeof 桥.执行命令 === "function") {
      try {
        const 输出 = await 桥.执行命令(shell, 命令);
        if (输出) this.打印(String(输出).replace(/\n$/, ""));
      } catch (e) {
        this.打印("❌ " + (e.message || String(e)), "err");
      }
      return;
    }
    if (!this.外部提示过[shell]) {
      this.外部提示过[shell] = true;
      this.打印(
`⚠ 网页版运行在浏览器沙箱中，无法真实执行系统命令。
「${this.壳表[shell].名}」终端已完成对接：在「中文程桌面版」中同样的命令会直接执行并回显结果。
现在可在「内置命令行」中运行中文程代码（输入「帮助」查看）。`, "err");
    } else {
      this.打印("（网页版不可用；此命令在中文程桌面版中可真实执行）", "dim");
    }
  }
}
