/* ============================================================
 * 中文程 · AI 辅助 (ai.js)
 * ------------------------------------------------------------
 * 内置 AI 编程助手，两种模式：
 *   1. 联网模式：接入豆包大模型（火山方舟，OpenAI 兼容接口），
 *      支持 对话 / 生成代码 / 解释代码 / 修复错误，流式输出。
 *   2. 离线模式：不联网也能用的规则教学助手 + 内置模板库。
 * 所有设置仅保存在本机浏览器（localStorage），不上传任何内容。
 * ============================================================ */

const AI存储键 = "中程AI设置";

class 中文AI {
  constructor(面板, 选项) {
    this.面板 = 面板;
    this.选项 = 选项 || {};   // { 取源码, 插入代码, 取方言名 }
    this.历史 = [];
    this.设置 = this.读设置();
    this.构建界面();
  }

  读设置() {
    // 设置统一由软件设置面板（settings.js）管理，这里直接读取合并渠道默认值后的结果
    if (typeof 读AI设置 === "function") return 读AI设置();
    try {
      return JSON.parse(localStorage.getItem(AI存储键)) || { 地址: "", 密钥: "", 模型: "doubao-seed-1.6", 温度: 0.6 };
    } catch (e) { return { 地址: "", 密钥: "", 模型: "doubao-seed-1.6", 温度: 0.6 }; }
  }

  可用() { return this.设置.地址 && this.设置.密钥 && this.设置.模型; }

  /* ---------- 界面 ---------- */
  构建界面() {
    this.面板.innerHTML = `
      <div class="ai-head">
        <span class="ai-title">AI 编程助手</span>
        <span class="ai-head-btns">
          <button class="ai-exp" title="导出对话记录">⤓</button>
          <button class="ai-gear" title="AI 设置（已合并到软件设置）">⚙</button>
        </span>
      </div>
      <div class="ai-tools">
        <button data-act="对话">对话</button>
        <button data-act="生成">生成代码</button>
        <button data-act="解释">解释代码</button>
        <button data-act="修复">修复错误</button>
      </div>
      <div class="ai-msgs"></div>
      <div class="ai-input">
        <textarea placeholder="向 AI 助手提问，例如：帮我写一个猜数字游戏…（Enter 发送，Shift+Enter 换行）"></textarea>
        <button class="ai-send">发送</button>
      </div>
    `;

    this.消息区 = this.面板.querySelector(".ai-msgs");
    this.输入框 = this.面板.querySelector(".ai-input textarea");

    /* 事件 */
    this.面板.querySelector(".ai-gear").onclick = () => {
      if (window.打开软件设置) window.打开软件设置("ai");
    };
    this.面板.querySelector(".ai-exp").onclick = () => this.导出对话();

    this.面板.querySelectorAll(".ai-tools button").forEach(b => {
      b.onclick = () => {
        const 操作 = b.dataset.act;
        if (操作 === "对话") this.输入框.focus();
        else if (操作 === "生成") this.生成代码();
        else if (操作 === "解释") this.解释代码();
        else if (操作 === "修复") this.修复错误();
      };
    });

    this.面板.querySelector(".ai-send").onclick = () => this.发送();
    this.输入框.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.发送(); }
    });
  }

  /* ---------- 导出对话 ---------- */
  导出对话() {
    const 行们 = this.消息区.querySelectorAll(".ai-msg");
    if (!行们.length) { this.加消息("系统", "还没有对话可以导出。"); return; }
    const 时间戳 = new Date();
    const 补零 = (n) => String(n).padStart(2, "0");
    const 名 = `中文程AI对话-${时间戳.getFullYear()}${补零(时间戳.getMonth() + 1)}${补零(时间戳.getDate())}-${补零(时间戳.getHours())}${补零(时间戳.getMinutes())}.md`;
    let md = `# 中文程 AI 对话记录\n\n导出时间：${时间戳.toLocaleString("zh-CN", { hour12: false })}\n渠道：${(typeof 取渠道 === "function" ? 取渠道(this.设置.渠道).名 : this.设置.渠道) || "未配置"} · 模型：${this.设置.模型 || "（离线助手）"}\n\n---\n\n`;
    行们.forEach(行 => {
      const 体 = 行.querySelector(".ai-msg-body");
      if (!体) return;
      const 角色 = 行.classList.contains("ai-user") ? "用户" : 行.classList.contains("ai-sys") ? "系统" : "助手";
      md += `**${角色}**：\n\n${体.innerText.trim()}\n\n`;
    });
    导出文件(名, md);
    this.加消息("系统", "📤 对话记录已导出为「" + 名 + "」。");
  }

  /* ---------- 消息渲染 ---------- */
  加消息(角色, 内容, 流式 = false) {
    const 行 = document.createElement("div");
    行.className = "ai-msg ai-" + (角色 === "用户" ? "user" : 角色 === "系统" ? "sys" : "bot");
    const 内容盒 = document.createElement("div");
    内容盒.className = "ai-msg-body";
    if (角色 === "用户") 内容盒.textContent = 内容;
    else 内容盒.innerHTML = this.渲染内容(内容);
    行.appendChild(内容盒);
    this.消息区.appendChild(行);
    this.消息区.scrollTop = this.消息区.scrollHeight;
    return 内容盒;
  }

  渲染内容(文本) {
    // 简单转义并支持代码块与换行
    let s = 文本.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = s.replace(/```([\s\S]*?)```/g, (m, 代码) =>
      `<pre class="ai-code">${转义(代码)}</pre>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return s.replace(/\n/g, "<br>");
  }

  打字输出(内容盒, 全文) {
    内容盒.innerHTML = this.渲染内容(全文);
    this.消息区.scrollTop = this.消息区.scrollHeight;
  }

  /* ---------- 发送（对话模式） ---------- */
  async 发送() {
    const 文本 = this.输入框.value.trim();
    if (!文本) return;
    this.输入框.value = "";
    this.加消息("用户", 文本);
    if (!this.可用()) { this.离线教学(文本); return; }
    await this.请求AI([...this.历史, { role: "user", content: 文本 }], true, (全文) => {
      this.历史 = [{ role: "user", content: 文本 }, { role: "assistant", content: 全文 }];
    });
  }

  /* ---------- 快捷功能 ---------- */
  生成代码() {
    const 需求 = window.prompt("描述你想生成的程序需求（例如：打印九九乘法表）：", "打印九九乘法表");
    if (需求 === null) return;
    this.加消息("用户", "【生成代码】" + 需求);
    if (!this.可用()) { this.离线模板(需求); return; }
    this.请求AI([{ role: "user", content: `请用「${this.选项.取方言名()}」语言写一个完整程序：${需求}。只输出代码，代码放在代码块中，并简要说明功能。` }], false);
  }

  解释代码() {
    const 选中 = window.getSelection() && window.getSelection().toString().trim();
    const 源码 = 选中 || this.选项.取源码();
    if (!源码) { this.加消息("系统", "编辑器里还没有代码可以解释。"); return; }
    this.加消息("用户", "【解释代码】\n" + 源码.slice(0, 300) + (源码.length > 300 ? "…" : ""));
    if (!this.可用()) { this.离线讲解(源码); return; }
    this.请求AI([{ role: "user", content: `请用中文逐段解释这段「${this.选项.取方言名()}」代码做了什么，讲清楚每一步：\n\`\`\`\n${源码}\n\`\`\`` }], false);
  }

  修复错误() {
    const 源码 = this.选项.取源码();
    if (!源码) { this.加消息("系统", "编辑器里还没有代码。"); return; }
    this.加消息("用户", "【修复错误】正在检查当前代码中的问题…");
    if (!this.可用()) {
      // 离线：尝试用真实解析器诊断
      const 诊断 = this.离线诊断(源码);
      this.加消息("助手", 诊断);
      return;
    }
    this.请求AI([{ role: "user", content: `请审查这段「${this.选项.取方言名()}」代码中的错误并给出修正后的完整代码（放在代码块中）：\n\`\`\`\n${源码}\n\`\`\`` }], false);
  }

  /* ---------- 联网请求 ---------- */
  系统提示词() {
    return `你是「中文程」中文编程软件内置的 AI 编程助手。「中文程」是一种完全自主开发的中文编程语言，语法示例：
# 注释
写("你好，世界")              # 输出
设 x = 10                    # 定义变量
如果 x > 5 { 写("大") } 否则 { 写("小") }
对于 i 从 1 到 10 { 写(i) }   # 数字循环
对于 i 在 [1,2,3] { 写(i) }   # 遍历列表
函数 平方(数) { 返回 数 * 数 } # 定义函数
类 动物 { 属性 名字 = "猫"; 方法 叫() { 写(本.名字) } }
写(平方(6))                  # 调用函数
列表用 [1,2,3]，字典用 {键: 值}，逻辑值用 真/假，空值用 空。
标准库：长度 类型 转文本 转数字 取整 绝对值 随机数 当前时间 包含 替换 分割 追加 删除 排序 反转 画布 画圆 画线 画矩形 填充色 笔画色 读入 等待 清屏 等。
请始终使用这种中文语法回答问题，代码放在 \`\`\` 代码块中。回答用简体中文，简洁清晰。

【Agent 能力】你已接入用户的命令行。当你认为需要帮用户运行程序、管理文件或执行操作时，把命令单独放在一个代码块中并注明类型：
- 内置命令行命令用 \`\`\`命令行 开头（如：运行、文件、打开 xxx.zy、算 1+2）
- Windows 系统命令用 \`\`\`cmd 或 \`\`\`powershell 开头（仅桌面版可真实执行）
用户确认后命令会在底部「命令行」页签中执行并回显结果。`;
  }

  async 请求AI(messages, 记历史, 完成回调) {
    const 盒 = this.加消息("助手", "思考中…");
    const 完整消息 = [{ role: "system", content: this.系统提示词() }].concat(messages);
    try {
      const 地址 = (this.设置.地址 || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
      const 响应 = await fetch(地址 + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + this.设置.密钥
        },
        body: JSON.stringify({
          model: this.设置.模型,
          messages: 完整消息,
          temperature: this.设置.温度,
          stream: true
        })
      });
      if (!响应.ok) {
        const 错误 = await 响应.text().catch(() => "");
        throw new Error("请求失败（" + 响应.status + "）" + 错误.slice(0, 200));
      }
      const 全文 = await this.读取流(响应, 盒);
      this.挂接命令(盒, 全文);
      if (完成回调) 完成回调(全文);
    } catch (e) {
      盒.innerHTML = `<span class="ai-err">❌ ${转义(e.message || "网络错误")}</span><br>请检查 软件设置（⚙）→ AI 设置 中的渠道、密钥和模型。`;
    }
  }

  /* ---------- Agent：识别 AI 回复中的命令行代码块，提供一键执行 ---------- */
  挂接命令(盒, 全文) {
    if (!全文) return;
    const 块们 = [...全文.matchAll(/```(命令行|终端|cmd|powershell|shell)\s*\n([\s\S]*?)```/gi)];
    if (!块们.length) return;
    for (const m of 块们) {
      const 类型 = m[1].toLowerCase();
      const shell = 类型 === "cmd" ? "cmd" : (类型 === "powershell" || 类型 === "shell") ? "powershell" : "builtin";
      const 壳名 = shell === "builtin" ? "内置命令行" : shell === "cmd" ? "CMD" : "PowerShell";
      const 命令 = m[2].trim();
      if (!命令) continue;
      const bar = document.createElement("div");
      bar.className = "ai-cmdbar";
      const btn = document.createElement("button");
      btn.textContent = "▶ 在「" + 壳名 + "」中执行";
      btn.title = 命令;
      btn.onclick = () => {
        if (!this.设置.允许Agent && !confirm(`AI 请求在「${壳名}」中执行以下命令：\n\n${命令}\n\n是否允许？\n（在软件设置 → AI 设置中开启「允许 Agent 直接执行」可不再询问）`)) return;
        if (window.中文程终端) window.中文程终端.Agent执行(命令, shell);
        else this.加消息("系统", "命令行尚未初始化。");
      };
      bar.appendChild(btn);
      盒.appendChild(bar);
    }
  }

  async 读取流(响应, 盒) {
    const 阅读器 = 响应.body.getReader();
    const 解码器 = new TextDecoder();
    let 缓冲 = "";
    let 全文 = "";
    while (true) {
      const { done, value } = await 阅读器.read();
      if (done) break;
      缓冲 += 解码器.decode(value, { stream: true });
      const 行们 = 缓冲.split("\n");
      缓冲 = 行们.pop();
      for (const 行 of 行们) {
        const 净 = 行.trim();
        if (!净.startsWith("data:")) continue;
        const 数据 = 净.slice(5).trim();
        if (数据 === "[DONE]") continue;
        try {
          const json = JSON.parse(数据);
          const 增量 = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
          if (增量) { 全文 += 增量; this.打字输出(盒, 全文); }
        } catch (e) { /* 忽略不完整行 */ }
      }
    }
    return 全文;
  }

  /* ================= 离线助手 ================= */

  离线教学(文本) {
    const 需求 = 文本.toLowerCase();
    if (需求.includes("语法") || 需求.includes("怎么写") || 需求.includes("入门") || 需求.includes("怎么用")) {
      this.加消息("助手", this.语法速览());
      return;
    }
    if (需求.includes("循环") || 需求.includes("遍历")) {
      this.加消息("助手", this.循环讲解());
      return;
    }
    if (需求.includes("函数")) {
      this.加消息("助手", this.函数讲解());
      return;
    }
    if (需求.includes("类") || 需求.includes("对象")) {
      this.加消息("助手", this.类讲解());
      return;
    }
    // 尝试按关键词匹配内置模板
    const 模板 = 找模板(文本);
    if (模板) {
      this.加消息("助手", `离线模式下为你找到内置示例「${模板.名}」，已为你打开。想生成新程序，请配置 AI 密钥后使用「生成代码」。`);
      this.选项.打开示例(模板.名);
      return;
    }
    this.加消息("助手", this.语法速览());
  }

  离线模板(需求) {
    const 模板 = 找模板(需求);
    if (模板) {
      this.加消息("助手", `离线模式下从内置示例库匹配到「${模板.名}」，已为你打开，可在此基础上修改。`);
      this.选项.打开示例(模板.名);
    } else {
      this.加消息("助手", "离线模式暂无法凭空生成代码。请配置 AI 密钥（⚙ 设置）使用联网生成，或从左侧「示例」挑选一个内置程序学习修改。");
    }
  }

  离线讲解(源码) {
    // 规则引擎逐行讲解
    const 行们 = 源码.split("\n");
    const 讲解 = [];
    let 解释器说明 = "以下按行讲解这段「中文程」代码：\n";
    const 方言 = 取方言();
    for (let i = 0; i < 行们.length; i++) {
      const 行 = 行们[i].trim();
      if (!行) continue;
      if (行.startsWith("#") || 行.startsWith("//")) { 讲解.push(`第 ${i + 1} 行：注释，不执行`); continue; }
      if (行.startsWith("写") || 行.startsWith("打印")) { 讲解.push(`第 ${i + 1} 行：向控制台输出内容`); continue; }
      if (行.startsWith("设") || 行.startsWith("令")) { 讲解.push(`第 ${i + 1} 行：定义变量并（可选）赋初值`); continue; }
      if (行.startsWith("如果")) { 讲解.push(`第 ${i + 1} 行：条件判断，满足条件时执行后面的块`); continue; }
      if (行.startsWith("否则")) { 讲解.push(`第 ${i + 1} 行：上面条件都不满足时执行`); continue; }
      if (行.startsWith("当")) { 讲解.push(`第 ${i + 1} 行：循环——只要条件为真就反复执行`); continue; }
      if (行.startsWith("对于")) { 讲解.push(`第 ${i + 1} 行：循环——逐个遍历列表或数字范围`); continue; }
      if (行.startsWith("函数")) { 讲解.push(`第 ${i + 1} 行：定义函数（可反复调用的一段逻辑）`); continue; }
      if (行.startsWith("返回")) { 讲解.push(`第 ${i + 1} 行：结束函数并返回一个值`); continue; }
      if (行.startsWith("类")) { 讲解.push(`第 ${i + 1} 行：定义一个类（属性 + 方法的模板）`); continue; }
      if (行.startsWith("属性")) { 讲解.push(`第 ${i + 1} 行：声明类的字段`); continue; }
      if (行.startsWith("方法")) { 讲解.push(`第 ${i + 1} 行：声明类的方法`); continue; }
      if (行.includes("=")) { 讲解.push(`第 ${i + 1} 行：给变量赋值`); continue; }
      讲解.push(`第 ${i + 1} 行：执行语句`);
    }
    this.加消息("助手", 解释器说明 + 讲解.join("\n"));
  }

  离线诊断(源码) {
    try {
      解析源码(源码, 取方言());
      return "✅ 离线检查通过：这段代码语法上没有明显问题。运行看看结果是否符合预期吧。";
    } catch (e) {
      return `❌ 离线检查发现错误：\n${e.message}\n\n修正后重新运行即可。`;
    }
  }

  语法速览() {
    return `「中文程」语法速览（离线版）：

# 输出
写("你好，世界")

# 变量
设 年龄 = 18
年龄 = 年龄 + 1

# 条件
如果 年龄 >= 18 { 写("成年") } 否则 { 写("未成年") }

# 循环
对于 i 从 1 到 5 { 写(i) }
对于 名字 在 ["小明","小红"] { 写(名字) }

# 函数
函数 双倍(数) { 返回 数 * 2 }
写(双倍(21))

# 类
类 动物 {
  属性 名字 = "猫"
  方法 叫() { 写(本.名字 + "喵") }
}
设 宠物 = 新建 动物()
宠物.叫()

完整示例请在左侧「示例」中选择，配置 AI 密钥后可生成任意程序。`;
  }

  循环讲解() {
    return `「中文程」有两种循环写法：

# 1. 遍历列表
对于 水果 在 ["苹果", "香蕉", "梨"] {
    写("我喜欢" + 水果)
}

# 2. 遍历数字范围（从…到，包含两端）
对于 i 从 1 到 10 {
    写(i)
}

# 3. 条件循环（当…，直到条件不再成立）
设 数 = 1
当 数 <= 5 {
    写(数)
    数 = 数 + 1
}

提示：循环体内用「等待(500)」可以让每一步慢一点，便于观察。`;
  }

  函数讲解() {
    return `「中文程」函数写法：

函数 求平均(甲, 乙) {
    返回 (甲 + 乙) / 2
}

写(求平均(10, 20))    # 输出 15

要点：
· 用「函数」定义，函数名任取中文名
· 参数写在括号里，多个用逗号分隔
· 用「返回」给出结果；没有返回则结果为 空
· 函数可以调用函数：函数 平方(数) { 返回 数 * 数 }
· 函数内定义的变量是局部的，不会污染外部`;
  }

  类讲解() {
    return `「中文程」面向对象写法：

类 小狗 {
    属性 名字 = "旺财"          # 字段
    属性 年龄 = 1
    方法 介绍() {               # 方法
        写("我叫" + 本.名字 + "，今年" + 本.年龄 + "岁")
    }
    方法 长大() {
        本.年龄 = 本.年龄 + 1
    }
}

设 狗 = 新建 小狗()      # 实例化
狗.介绍()                 # 调用方法
狗.长大()
狗.介绍()

要点：
· 「本」代表这个对象自己（类似其他语言的 this）
· 方法名约定为「构造」时，新建对象会自动调用它`;
  }
}

/* ---------- 内置模板匹配 ---------- */
function 找模板(需求) {
  const 表 = [
    { 词: ["猜数字", "猜数", "猜一猜"], 名: "猜数字游戏" },
    { 词: ["九九", "乘法表"], 名: "九九乘法表" },
    { 词: ["斐波", "那契", "fib"], 名: "斐波那契数列" },
    { 词: ["画", "图形", "圆", "方"], 名: "画布绘图" },
    { 词: ["成绩", "学生", "评分"], 名: "学生成绩统计" },
    { 词: ["诗", "创作", "写诗"], 名: "中文诗生成器" },
    { 词: ["你好", "hello", "世界"], 名: "你好，世界" },
    { 词: ["计算", "加减", "四则"], 名: "多功能计算器" },
    { 词: ["排序", "冒泡"], 名: "冒泡排序" }
  ];
  for (const 项 of 表) {
    for (const 词 of 项.词) {
      if (需求.includes(词)) return { 名: 项.名 };
    }
  }
  return null;
}
