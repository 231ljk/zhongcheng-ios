/* ============================================================
 * 中文程 · 语法分析器 (parser.js)
 * ------------------------------------------------------------
 * 递归下降分析器：把 token 流构造成 AST（抽象语法树）。
 * 同样不认识具体语言——只依据统一的 token 类型，因此三种
 * 方言共享同一语法结构，写出的都是"中文编程"。
 *
 * AST 节点统一用 { 类型: "…", … } 表示，类型有：
 *   程序 赋值 输出 如果 当 对于 函数 返回 类 属性 方法 新建
 *   字面量 变量 二元 一元 调用 成员 下标 列表 字典 读入 清屏 等待
 * ============================================================ */

class 语法错误 extends Error {
  constructor(消息, 行, 列) {
    super(消息);
    this.行 = 行; this.列 = 列;
  }
}

class 语法分析器 {
  constructor(tokens) {
    this.tokens = tokens;
    this.位置 = 0;
  }

  当前() { return this.tokens[this.位置]; }
  下一个(k = 1) { return this.tokens[this.位置 + k]; }
  前进() { this.位置++; }

  检查(类型) { return this.当前().类型 === 类型; }

  匹配(类型) {
    if (this.检查(类型)) { const t = this.当前(); this.前进(); return t; }
    return null;
  }

  期望(类型, 说明) {
    const t = this.匹配(类型);
    if (!t) {
      const 现 = this.当前();
      throw new 语法错误(`此处应为「${说明}」但遇到了「${现.值 !== undefined && 现.值 !== null ? 现.值 : 现.类型}」（第 ${现.行} 行）`, 现.行, 现.列);
    }
    return t;
  }

  跳过NL() {
    while (this.检查("NL") || this.检查("SEMI")) this.前进();
  }

  /* ---------- 程序 ---------- */
  分析程序() {
    const 语句 = [];
    while (!this.检查("EOF")) {
      this.跳过NL();
      if (this.检查("EOF")) break;
      语句.push(this.分析语句());
      this.跳过NL();
    }
    return { 类型: "程序", 语句 };
  }

  /* ---------- 语句 ---------- */
  分析语句() {
    const t = this.当前();
    switch (t.类型) {
      case "VAR":   return this.分析变量声明();
      case "IF":    return this.分析如果();
      case "WHILE": return this.分析当();
      case "FOR":   return this.分析对于();
      case "FUNC":  return this.分析函数();
      case "RETURN":return this.分析返回();
      case "CLASS": return this.分析类();
      case "WRITE": return this.分析内置调用("输出");
      case "READ":  return this.分析内置调用("读入");
      case "CLS":   return this.分析内置调用("清屏");
      case "WAIT":  return this.分析内置调用("等待");
      case "NL":
      case "SEMI":  this.跳过NL(); return this.分析语句();
      default:      return this.分析表达式语句();
    }
  }

  /* 设 x = 表达式  /  设 x  */
  分析变量声明() {
    const t0 = this.当前();
    this.匹配("VAR");
    const 名字 = this.期望("IDENT", "变量名").值;
    let 值 = null;
    if (this.匹配("ASGN")) 值 = this.分析表达式();
    return { 类型: "赋值", 名字, 值, 声明: true, 行: t0.行, 列: t0.列 };
  }

  /* x = 表达式  /  本.属性 = 值  /  列表[下标] = 值 */
  分析表达式语句() {
    const t0 = this.当前();
    const 表达式 = this.分析表达式();
    if (this.匹配("ASGN")) {
      const 可赋值 = 表达式 && (表达式.类型 === "变量" || 表达式.类型 === "成员" || 表达式.类型 === "下标");
      if (!可赋值) {
        const t = this.当前();
        throw new 语法错误(`等号左边必须是变量、属性或列表元素（第 ${t.行} 行）`, t.行, t.列);
      }
      const 值 = this.分析表达式();
      return { 类型: "赋值目标", 目标: 表达式, 值, 行: t0.行, 列: t0.列 };
    }
    if (表达式 === null) {
      const t = this.当前();
      throw new 语法错误(`无法理解的语句（第 ${t.行} 行）`, t.行, t.列);
    }
    return { 类型: "表达式语句", 表达式, 行: t0.行, 列: t0.列 };
  }

  /* 如果 (条件) { 体 } 否则如果 (条件) { 体 } … 否则 { 体 } */
  分析如果() {
    const t0 = this.当前();
    this.匹配("IF");
    const 分支 = [];
    const 条件 = this.分析条件表达式();
    分支.push({ 条件, 体: this.分析块() });
    this.跳过NL();   // 块结束后的换行也要跳过，否则链式分支断开
    while (this.检查("ELSE_IF")) {
      this.匹配("ELSE_IF");
      const 条件2 = this.分析条件表达式();
      分支.push({ 条件: 条件2, 体: this.分析块() });
      this.跳过NL();
    }
    let 否则体 = null;
    if (this.匹配("ELSE")) 否则体 = this.分析块();
    return { 类型: "如果", 分支, 否则体, 行: t0.行, 列: t0.列 };
  }

  分析条件表达式() {
    this.跳过NL();
    const 有括号 = !!this.匹配("LPAREN");
    if (有括号) this.跳过NL();
    const 表达式 = this.分析表达式();
    if (有括号) {
      this.跳过NL();
      this.期望("RPAREN", "右括号）");
    }
    return 表达式;
  }

  /* 当 (条件) { 体 } */
  分析当() {
    const t0 = this.当前();
    this.匹配("WHILE");
    const 条件 = this.分析条件表达式();
    return { 类型: "当", 条件, 体: this.分析块(), 行: t0.行, 列: t0.列 };
  }

  /* 对于 i 在 列表 { 体 }   或   对于 i 从 1 到 10 { 体 } */
  分析对于() {
    const t0 = this.当前();
    this.匹配("FOR");
    this.跳过NL();
    const 变量 = this.期望("IDENT", "循环变量名").值;
    this.跳过NL();
    if (this.匹配("IN")) {
      const 源 = this.分析表达式();
      return { 类型: "对于", 变量, 源, 体: this.分析块(), 行: t0.行, 列: t0.列 };
    }
    if (this.匹配("FROM")) {
      const 起点 = this.分析表达式();
      this.期望("TO", "「到」");
      const 终点 = this.分析表达式();
      return { 类型: "对于", 变量, 起点, 终点, 体: this.分析块(), 行: t0.行, 列: t0.列 };
    }
    const t = this.当前();
    throw new 语法错误(`「对于」后需要「在」或「从…到」（第 ${t.行} 行）`, t.行, t.列);
  }

  /* 函数 名字(参数…) { 体 } */
  分析函数() {
    const t0 = this.当前();
    this.匹配("FUNC");
    const 名字 = this.期望("IDENT", "函数名").值;
    this.跳过NL();
    this.期望("LPAREN", "（");
    this.跳过NL();
    const 参数 = [];
    while (!this.检查("RPAREN")) {
      if (this.检查("EOF")) throw new 语法错误("函数参数列表未闭合", this.当前().行, this.当前().列);
      参数.push(this.期望("IDENT", "参数名").值);
      if (!this.匹配("COMMA")) break;
      this.跳过NL();
    }
    this.期望("RPAREN", "）");
    this.跳过NL();
    const 体 = this.分析块();
    return { 类型: "函数", 名字, 参数, 体, 行: t0.行, 列: t0.列 };
  }

  /* 返回 表达式  /  返回 */
  分析返回() {
    const t0 = this.当前();
    this.匹配("RETURN");
    this.跳过NL();
    let 值 = null;
    if (!this.检查("NL") && !this.检查("EOF") && !this.检查("RBRACE") && !this.检查("SEMI")) {
      值 = this.分析表达式();
    }
    return { 类型: "返回", 值, 行: t0.行, 列: t0.列 };
  }

  /* 类 名字 { 属性 x = …; 方法 f(…) { … } } */
  分析类() {
    const t0 = this.当前();
    this.匹配("CLASS");
    const 名字 = this.期望("IDENT", "类名").值;
    this.跳过NL();
    this.期望("LBRACE", "｛");
    this.跳过NL();
    const 成员 = [];
    while (true) {
      if (this.检查("EOF")) throw new 语法错误("类定义未闭合", this.当前().行, this.当前().列);
      this.跳过NL();
      if (this.检查("RBRACE")) break;   // 成员结束后的换行要先跳过再判断类结束
      if (this.检查("PROP")) {
        this.匹配("PROP");
        const 属性名 = this.期望("IDENT", "属性名").值;
        let 属性值 = null;
        if (this.匹配("ASGN")) 属性值 = this.分析表达式();
        成员.push({ 类型: "属性", 名字: 属性名, 值: 属性值 });
        this.跳过NL();
        continue;
      }
      if (this.检查("METHOD") || this.检查("FUNC")) {
        this.前进();
        const 方法名 = this.期望("IDENT", "方法名").值;
        this.跳过NL();
        this.期望("LPAREN", "（");
        this.跳过NL();
        const 参数 = [];
        while (!this.检查("RPAREN")) {
          参数.push(this.期望("IDENT", "参数名").值);
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RPAREN", "）");
        this.跳过NL();
        const 体 = this.分析块();
        成员.push({ 类型: "方法", 名字: 方法名, 参数, 体 });
        continue;
      }
      const t = this.当前();
      throw new 语法错误(`类成员需要以「属性」或「方法」开头（第 ${t.行} 行）`, t.行, t.列);
    }
    this.期望("RBRACE", "｝");
    return { 类型: "类", 名字, 成员, 行: t0.行, 列: t0.列 };
  }

  /* 块 { 语句… } */
  分析块() {
    this.跳过NL();
    this.期望("LBRACE", "｛");
    this.跳过NL();
    const 语句 = [];
    while (!this.检查("RBRACE")) {
      if (this.检查("EOF")) throw new 语法错误("语句块未闭合，缺少｝", this.当前().行, this.当前().列);
      语句.push(this.分析语句());
      this.跳过NL();
    }
    this.期望("RBRACE", "｝");
    return { 类型: "块", 语句 };
  }

  /* 写(…) 读入(…) 清屏() 等待(…) —— 语句级内置调用 */
  分析内置调用(节点类型) {
    const t0 = this.当前();
    this.前进(); // 吃掉关键词 token
    this.跳过NL();
    this.期望("LPAREN", "（");
    this.跳过NL();
    const 参数 = [];
    while (!this.检查("RPAREN")) {
      if (this.检查("EOF")) throw new 语法错误("调用参数列表未闭合", this.当前().行, this.当前().列);
      参数.push(this.分析表达式());
      if (!this.匹配("COMMA")) break;
      this.跳过NL();
    }
    this.期望("RPAREN", "）");
    return { 类型: 节点类型, 参数, 行: t0.行, 列: t0.列 };
  }

  /* ---------- 表达式 ---------- */

  /* 或 */
  分析表达式() {
    this.跳过NL();
    let 左 = this.分析且();
    while (this.检查("OR")) {
      this.前进(); this.跳过NL();
      const 右 = this.分析且();
      左 = { 类型: "二元", 运算: "或", 左, 右 };
    }
    return 左;
  }

  分析且() {
    let 左 = this.分析比较();
    while (this.检查("AND")) {
      this.前进(); this.跳过NL();
      const 右 = this.分析比较();
      左 = { 类型: "二元", 运算: "且", 左, 右 };
    }
    return 左;
  }

  分析比较() {
    let 左 = this.分析加减();
    while (true) {
      const t = this.当前().类型;
      const 映射 = { "EQ": "等于", "NEQ": "不等于", "GT": "大于", "LT": "小于", "GE": "大于等于", "LE": "小于等于" };
      if (映射[t]) {
        this.前进(); this.跳过NL();
        const 右 = this.分析加减();
        左 = { 类型: "二元", 运算: 映射[t], 左, 右 };
      } else break;
    }
    return 左;
  }

  分析加减() {
    let 左 = this.分析乘除();
    while (true) {
      const t = this.当前().类型;
      if (t === "PLUS" || t === "MINUS") {
        this.前进(); this.跳过NL();
        const 右 = this.分析乘除();
        左 = { 类型: "二元", 运算: t === "PLUS" ? "加" : "减", 左, 右 };
      } else break;
    }
    return 左;
  }

  分析乘除() {
    let 左 = this.分析一元();
    while (true) {
      const t = this.当前().类型;
      if (t === "STAR" || t === "SLASH" || t === "MOD") {
        this.前进(); this.跳过NL();
        const 右 = this.分析一元();
        左 = { 类型: "二元", 运算: t === "STAR" ? "乘" : t === "SLASH" ? "除" : "取余", 左, 右 };
      } else break;
    }
    return 左;
  }

  分析一元() {
    const t = this.当前().类型;
    if (t === "NOT" || t === "MINUS") {
      this.前进(); this.跳过NL();
      const 操作数 = this.分析一元();
      return { 类型: "一元", 运算: t === "NOT" ? "非" : "负", 操作数 };
    }
    return this.分析后缀();
  }

  分析后缀() {
    let 表达式 = this.分析原子();
    while (true) {
      this.跳过NL();
      const t = this.当前().类型;
      if (t === "DOT") {
        this.前进();
        const 名字 = this.期望("IDENT", "成员名").值;
        表达式 = { 类型: "成员", 对象: 表达式, 名字 };
      } else if (t === "LBRACKET") {
        this.前进(); this.跳过NL();
        const 索引 = this.分析表达式();
        this.期望("RBRACKET", "】");
        表达式 = { 类型: "下标", 对象: 表达式, 索引 };
      } else if (t === "LPAREN") {
        this.前进(); this.跳过NL();
        const 参数 = [];
        while (!this.检查("RPAREN")) {
          if (this.检查("EOF")) throw new 语法错误("调用参数未闭合", this.当前().行, this.当前().列);
          参数.push(this.分析表达式());
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RPAREN", "）");
        表达式 = { 类型: "调用", 目标: 表达式, 参数 };
      } else break;
    }
    return 表达式;
  }

  分析原子() {
    this.跳过NL();
    const t = this.当前();
    switch (t.类型) {
      case "NUMBER": this.前进(); return { 类型: "字面量", 值: t.值 };
      case "STRING": this.前进(); return { 类型: "字面量", 值: t.值 };
      case "TRUE":  this.前进(); return { 类型: "字面量", 值: true };
      case "FALSE": this.前进(); return { 类型: "字面量", 值: false };
      case "NULL":  this.前进(); return { 类型: "字面量", 值: null };
      case "THIS":  this.前进(); return { 类型: "本" };
      case "IDENT": {
        this.前进();
        return { 类型: "变量", 名字: t.值 };
      }
      case "LPAREN": {
        this.前进(); this.跳过NL();
        const 表达式 = this.分析表达式();
        this.跳过NL();
        this.期望("RPAREN", "）");
        return 表达式;
      }
      case "LBRACKET": {
        this.前进(); this.跳过NL();
        const 元素 = [];
        while (!this.检查("RBRACKET")) {
          if (this.检查("EOF")) throw new 语法错误("列表未闭合", this.当前().行, this.当前().列);
          元素.push(this.分析表达式());
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RBRACKET", "】");
        return { 类型: "列表", 元素 };
      }
      case "LBRACE": {
        this.前进(); this.跳过NL();
        const 键值 = [];
        while (!this.检查("RBRACE")) {
          if (this.检查("EOF")) throw new 语法错误("字典未闭合", this.当前().行, this.当前().列);
          let 键;
          if (this.检查("STRING")) 键 = this.匹配("STRING").值;
          else if (this.检查("IDENT")) 键 = this.匹配("IDENT").值;
          else {
            const tt = this.当前();
            throw new 语法错误(`字典键应为文本或名称（第 ${tt.行} 行）`, tt.行, tt.列);
          }
          this.跳过NL();
          this.期望("COLON", "：");
          this.跳过NL();
          const 值 = this.分析表达式();
          键值.push({ 键, 值 });
          this.跳过NL();
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RBRACE", "｝");
        return { 类型: "字典", 键值 };
      }
      case "NEW": {
        this.前进();
        const 类名 = this.期望("IDENT", "类名").值;
        this.跳过NL();
        this.期望("LPAREN", "（");
        this.跳过NL();
        const 参数 = [];
        while (!this.检查("RPAREN")) {
          参数.push(this.分析表达式());
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RPAREN", "）");
        return { 类型: "新建", 类名, 参数 };
      }
      case "READ":
      case "CLS":
      case "WAIT":
      case "WRITE": {
        // 内置调用也可作为表达式（如：设 猜测 = 读入("…")）
        const 类型 = t.类型 === "READ" ? "读入" : t.类型 === "CLS" ? "清屏" : t.类型 === "WAIT" ? "等待" : "输出";
        this.前进(); this.跳过NL();
        this.期望("LPAREN", "（");
        this.跳过NL();
        const 参数 = [];
        while (!this.检查("RPAREN")) {
          if (this.检查("EOF")) throw new 语法错误("调用参数未闭合", this.当前().行, this.当前().列);
          参数.push(this.分析表达式());
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RPAREN", "）");
        return { 类型, 参数, 行: t.行, 列: t.列 };
      }
      case "FUNC": {
        // 函数表达式（可作值传递）：函数 (参数) { 体 } 或 函数 名字(参数) { 体 }
        const 起始 = this.当前();
        this.前进();
        let 函数名 = null;
        if (this.检查("IDENT")) 函数名 = this.匹配("IDENT").值;
        this.跳过NL();
        this.期望("LPAREN", "（");
        this.跳过NL();
        const 参数 = [];
        while (!this.检查("RPAREN")) {
          参数.push(this.期望("IDENT", "参数名").值);
          if (!this.匹配("COMMA")) break;
          this.跳过NL();
        }
        this.期望("RPAREN", "）");
        this.跳过NL();
        const 体 = this.分析块();
        return { 类型: "函数表达式", 名字: 函数名, 参数, 体, 行: 起始.行, 列: 起始.列 };
      }
      default: {
        return null;
      }
    }
  }
}

function 解析源码(源码, 方言) {
  const 词法 = new 词法分析器(源码, 方言);
  const tokens = 词法.分析();
  const 语法 = new 语法分析器(tokens);
  return 语法.分析程序();
}
