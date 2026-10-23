/* ============================================================
 * 中文程 · 词法分析器 (lexer.js)
 * ------------------------------------------------------------
 * 把「中文程」源码拆成 token 流。本分析器不认识任何具体语言，
 * 只根据当前方言的词表把中文/拼音单词映射成统一的 token 类型，
 * 因此同一内核可以驱动简体、繁体、拼音等多种中文语言。
 *
 * token = { 类型, 值, 行, 列 }
 * 类型取值（统一体系）：
 *   NUMBER STRING IDENT | 方言词表映射出的关键词类型 |
 *   PLUS MINUS STAR SLASH MOD ASGN EQ NEQ GT LT GE LE AND OR NOT
 *   LPAREN RPAREN LBRACKET RBRACKET LBRACE RBRACE COMMA SEMI DOT COLON
 *   NL(换行标记) EOF(结束)
 * ============================================================ */

class 词法错误 extends Error {
  constructor(消息, 行, 列) {
    super(消息);
    this.行 = 行; this.列 = 列;
  }
}

class 词法分析器 {
  constructor(源码, 方言) {
    this.源码 = 源码;
    this.词表 = (方言 && 方言.词表) || DIALECTS.zh.词表;
    this.位置 = 0;
    this.行 = 1;
    this.列 = 1;
    // 最长词优先匹配（如"否则如果"要在"否则"之前匹配）
    this.词表排序 = Object.keys(this.词表).sort((a, b) => b.length - a.length);
  }

  当前字符() { return this.位置 < this.源码.length ? this.源码[this.位置] : ""; }
  下一个字符() { return this.位置 + 1 < this.源码.length ? this.源码[this.位置 + 1] : ""; }

  前进(n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.位置 < this.源码.length) {
        if (this.源码[this.位置] === "\n") { this.行++; this.列 = 1; }
        else { this.列++; }
        this.位置++;
      }
    }
  }

  跳过空白() {
    while (this.位置 < this.源码.length) {
      const c = this.当前字符();
      if (c === " " || c === "\t" || c === "\r") { this.前进(); }
      else break;
    }
  }

  /* 若当前位置是注释开头则吃掉并返回 {文本,行,列}，否则返回 null */
  取注释() {
    const c = this.当前字符(), n = this.下一个字符();
    const 行 = this.行, 列 = this.列;
    let 文本 = "";
    if (c === "#" && n === "*") {          // 多行 #* ... *#
      this.前进(2); 文本 = "#*";
      while (this.位置 < this.源码.length && !(this.当前字符() === "*" && this.下一个字符() === "#")) { 文本 += this.当前字符(); this.前进(); }
      if (this.位置 < this.源码.length) { this.前进(2); 文本 += "*#"; }
      return { 文本, 行, 列 };
    }
    if (c === "/" && n === "*") {          // 多行 /* ... */
      this.前进(2); 文本 = "/*";
      while (this.位置 < this.源码.length && !(this.当前字符() === "*" && this.下一个字符() === "/")) { 文本 += this.当前字符(); this.前进(); }
      if (this.位置 < this.源码.length) { this.前进(2); 文本 += "*/"; }
      return { 文本, 行, 列 };
    }
    if (c === "#") {                       // 单行 #
      this.前进(); 文本 = "#";
      while (this.位置 < this.源码.length && this.当前字符() !== "\n") { 文本 += this.当前字符(); this.前进(); }
      return { 文本, 行, 列 };
    }
    if (c === "/" && n === "/") {          // 单行 //
      this.前进(2); 文本 = "//";
      while (this.位置 < this.源码.length && this.当前字符() !== "\n") { 文本 += this.当前字符(); this.前进(); }
      return { 文本, 行, 列 };
    }
    return null;
  }

  是标识符字符(c) {
    if (!c) return false;
    // 中文、字母、数字、下划线（首字符排除数字由调用处判断）
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c) ||
           /[a-zA-Z0-9_]/.test(c);
  }

  是汉字(c) { return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c); }

  分析(保留注释 = false) {
    const tokens = [];
    while (true) {
      this.跳过空白();
      // 吃掉并收集注释（若要求保留）
      while (true) {
        const 注释 = this.取注释();
        if (!注释) break;
        if (保留注释) tokens.push({ 类型: "COMMENT", 值: 注释.文本, 行: 注释.行, 列: 注释.列 });
      }
      if (this.位置 >= this.源码.length) break;

      const 行 = this.行, 列 = this.列;
      const c = this.当前字符(), n = this.下一个字符();

      /* 换行 → NL 标记（作为语句边界） */
      if (c === "\n") { tokens.push({ 类型: "NL", 值: "\n", 行, 列 }); this.前进(); continue; }

      /* 数字 */
      if (/[0-9]/.test(c)) {
        let 文本 = "";
        while (/[0-9]/.test(this.当前字符())) { 文本 += this.当前字符(); this.前进(); }
        if (this.当前字符() === "." && /[0-9]/.test(this.下一个字符())) {
          文本 += "."; this.前进();
          while (/[0-9]/.test(this.当前字符())) { 文本 += this.当前字符(); this.前进(); }
        }
        tokens.push({ 类型: "NUMBER", 值: parseFloat(文本), 行, 列 });
        continue;
      }

      /* 字符串：双引号 或 单引号 */
      if (c === '"' || c === "'") {
        const 引号 = c; this.前进();
        let 文本 = "";
        while (this.位置 < this.源码.length && this.当前字符() !== 引号) {
          if (this.当前字符() === "\\") {
            this.前进();
            const e = this.当前字符();
            if (e === "n") 文本 += "\n";
            else if (e === "t") 文本 += "\t";
            else if (e === "r") 文本 += "\r";
            else if (e === "\\") 文本 += "\\";
            else if (e === '"') 文本 += '"';
            else if (e === "'") 文本 += "'";
            else { 文本 += "\\" + e; }
            this.前进();
          } else {
            文本 += this.当前字符(); this.前进();
          }
        }
        if (this.位置 >= this.源码.length) throw new 词法错误("字符串未闭合：" + 文本.slice(0, 12) + "…", 行, 列);
        this.前进(); // 跳过闭合引号
        tokens.push({ 类型: "STRING", 值: 文本, 行, 列 });
        continue;
      }

      /* 符号运算符 */
      const 符号 = {
        "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH", "%": "MOD",
        "==": "EQ", "!=": "NEQ", ">=": "GE", "<=": "LE", ">": "GT", "<": "LT",
        "&&": "AND", "||": "OR", "!": "NOT", "=": "ASGN",
        "(": "LPAREN", ")": "RPAREN", "[": "LBRACKET", "]": "RBRACKET",
        "{": "LBRACE", "}": "RBRACE", ",": "COMMA", ";": "SEMI", ".": "DOT", ":": "COLON"
      };
      const 两字符 = c + n;
      if (符号[两字符]) { tokens.push({ 类型: 符号[两字符], 值: 两字符, 行, 列 }); this.前进(2); continue; }
      if (符号[c]) { tokens.push({ 类型: 符号[c], 值: c, 行, 列 }); this.前进(); continue; }

      /* 标识符 / 关键词：
       * 先扫描出最大连续的标识符串（汉字/字母/数字/下划线），
       * 再用整串去匹配词表——只有整串都是关键词时才作为关键词，
       * 避免「中间」「jiafa」这类包含关键词字符的普通名称被误拆。 */
      if (this.是汉字(c) || /[a-zA-Z_]/.test(c)) {
        let 文本 = "";
        while (this.是标识符字符(this.当前字符())) { 文本 += this.当前字符(); this.前进(); }
        if (this.词表[文本]) {
          tokens.push({ 类型: this.词表[文本], 值: 文本, 行, 列 });
        } else {
          tokens.push({ 类型: "IDENT", 值: 文本, 行, 列 });
        }
        continue;
      }

      throw new 词法错误("无法识别的字符：" + JSON.stringify(c), 行, 列);
    }
    tokens.push({ 类型: "EOF", 值: null, 行: this.行, 列: this.列 });
    return tokens;
  }
}
