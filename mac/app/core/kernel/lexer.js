/* ============================================================
 * 中文程 · 词法分析器 (lexer.js)
 * ------------------------------------------------------------
 * 把「中文程」源码拆成 token 流。本分析器不认识任何具体语言，
 * 只根据当前方言的词表把中文/拼音单词映射成统一的 token 类型，
 * 因此同一内核可以驱动简体、繁体、拼音等多种中文语言。
 *
 * token = { type, value, line, column }
 * 类型取值（统一体系）：
 *   NUMBER STRING IDENT | 方言词表映射出的关键词类型 |
 *   PLUS MINUS STAR SLASH MOD ASGN EQ NEQ GT LT GE LE AND OR NOT
 *   LPAREN RPAREN LBRACKET RBRACKET LBRACE RBRACE COMMA SEMI DOT COLON
 *   NL(换行标记) EOF(结束)
 * ============================================================ */

class LexerError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line || 0;
    this.column = column || 0;
  }
}

class Lexer {
  constructor(source, dialect) {
    this.source = source;
    this.keywords = (dialect && dialect.keywords) || DIALECTS.zh.keywords;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    // 最长词优先匹配（如"否则如果"要在"否则"之前匹配）
    this.sortedKeywords = Object.keys(this.keywords).sort((a, b) => b.length - a.length);
  }

  peek() { return this.pos < this.source.length ? this.source[this.pos] : ""; }
  peekNext() { return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : ""; }

  advance(n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.pos < this.source.length) {
        if (this.source[this.pos] === "\n") { this.line++; this.column = 1; }
        else { this.column++; }
        this.pos++;
      }
    }
  }

  skipWhitespace() {
    while (this.pos < this.source.length) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r") { this.advance(); }
      else break;
    }
  }

  /* 若当前位置是注释开头则吃掉并返回 {text,line,column}，否则返回 null */
  readComment() {
    const c = this.peek(), n = this.peekNext();
    const line = this.line, column = this.column;
    let text = "";
    if (c === "#" && n === "*") {          // 多行 #* ... *#
      this.advance(2); text = "#*";
      while (this.pos < this.source.length && !(this.peek() === "*" && this.peekNext() === "#")) { text += this.peek(); this.advance(); }
      if (this.pos < this.source.length) { this.advance(2); text += "*#"; }
      return { text, line, column };
    }
    if (c === "/" && n === "*") {          // 多行 /* ... */
      this.advance(2); text = "/*";
      while (this.pos < this.source.length && !(this.peek() === "*" && this.peekNext() === "/")) { text += this.peek(); this.advance(); }
      if (this.pos < this.source.length) { this.advance(2); text += "*/"; }
      return { text, line, column };
    }
    if (c === "#") {                       // 单行 #
      this.advance(); text = "#";
      while (this.pos < this.source.length && this.peek() !== "\n") { text += this.peek(); this.advance(); }
      return { text, line, column };
    }
    if (c === "/" && n === "/") {          // 单行 //
      this.advance(2); text = "//";
      while (this.pos < this.source.length && this.peek() !== "\n") { text += this.peek(); this.advance(); }
      return { text, line, column };
    }
    return null;
  }

  isIdentChar(c) {
    if (!c) return false;
    // 中文、字母、数字、下划线（首字符排除数字由调用处判断）
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c) ||
           /[a-zA-Z0-9_]/.test(c);
  }

  isHan(c) { return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c); }

  tokenize(keepComments = false) {
    const tokens = [];
    while (true) {
      this.skipWhitespace();
      // 吃掉并收集注释（若要求保留）
      while (true) {
        const comment = this.readComment();
        if (!comment) break;
        if (keepComments) tokens.push({ type: "COMMENT", value: comment.text, line: comment.line, column: comment.column });
      }
      if (this.pos >= this.source.length) break;

      const line = this.line, column = this.column;
      const c = this.peek(), n = this.peekNext();

      /* 换行 → NL 标记（作为语句边界） */
      if (c === "\n") { tokens.push({ type: "NL", value: "\n", line, column }); this.advance(); continue; }

      /* 数字 */
      if (/[0-9]/.test(c)) {
        let text = "";
        while (/[0-9]/.test(this.peek())) { text += this.peek(); this.advance(); }
        if (this.peek() === "." && /[0-9]/.test(this.peekNext())) {
          text += "."; this.advance();
          while (/[0-9]/.test(this.peek())) { text += this.peek(); this.advance(); }
        }
        tokens.push({ type: "NUMBER", value: parseFloat(text), line, column });
        continue;
      }

      /* 字符串：双引号 或 单引号 */
      if (c === '"' || c === "'") {
        const quote = c; this.advance();
        let text = "";
        while (this.pos < this.source.length && this.peek() !== quote) {
          if (this.peek() === "\\") {
            this.advance();
            const e = this.peek();
            if (e === "n") text += "\n";
            else if (e === "t") text += "\t";
            else if (e === "r") text += "\r";
            else if (e === "\\") text += "\\";
            else if (e === '"') text += '"';
            else if (e === "'") text += "'";
            else { text += "\\" + e; }
            this.advance();
          } else {
            text += this.peek(); this.advance();
          }
        }
        if (this.pos >= this.source.length) throw new LexerError("字符串未闭合：" + text.slice(0, 12) + "…", line, column);
        this.advance(); // 跳过闭合引号
        tokens.push({ type: "STRING", value: text, line, column });
        continue;
      }

      /* 符号运算符 */
      const symbols = {
        "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH", "%": "MOD",
        "==": "EQ", "!=": "NEQ", ">=": "GE", "<=": "LE", ">": "GT", "<": "LT",
        "&&": "AND", "||": "OR", "!": "NOT", "=": "ASGN",
        "(": "LPAREN", ")": "RPAREN", "[": "LBRACKET", "]": "RBRACKET",
        "{": "LBRACE", "}": "RBRACE", ",": "COMMA", ";": "SEMI", ".": "DOT", ":": "COLON"
      };
      const two = c + n;
      if (symbols[two]) { tokens.push({ type: symbols[two], value: two, line, column }); this.advance(2); continue; }
      if (symbols[c]) { tokens.push({ type: symbols[c], value: c, line, column }); this.advance(); continue; }

      /* 标识符 / 关键词：
       * 先扫描出最大连续的标识符串（汉字/字母/数字/下划线），
       * 再用整串去匹配词表——只有整串都是关键词时才作为关键词，
       * 避免「中间」「jiafa」这类包含关键词字符的普通名称被误拆。 */
      if (this.isHan(c) || /[a-zA-Z_]/.test(c)) {
        let text = "";
        while (this.isIdentChar(this.peek())) { text += this.peek(); this.advance(); }
        if (this.keywords[text]) {
          tokens.push({ type: this.keywords[text], value: text, line, column });
        } else {
          tokens.push({ type: "IDENT", value: text, line, column });
        }
        continue;
      }

      throw new LexerError("无法识别的字符：" + JSON.stringify(c), line, column);
    }
    tokens.push({ type: "EOF", value: null, line: this.line, column: this.column });
    return tokens;
  }
}
