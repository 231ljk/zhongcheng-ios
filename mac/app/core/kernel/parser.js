/* ============================================================
 * 中文程 · 语法分析器 (parser.js)
 * ------------------------------------------------------------
 * 递归下降分析器：把 token 流构造成 AST（抽象语法树）。
 * 同样不认识具体语言——只依据统一的 token 类型，因此三种
 * 方言共享同一语法结构，写出的都是"中文编程"。
 *
 * AST 节点统一用 { type: "…", … } 表示（内部结构，全部英文）：
 *   Program Assign AssignTarget ExprStmt Block Write Read Clear Wait
 *   If While For FuncDecl FuncExpr Return Class Prop Method New
 *   Literal Variable This Binary Unary Call Member Index List Dict
 * ============================================================ */

class SyntaxError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line || 0;
    this.column = column || 0;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  ahead(k = 1) { return this.tokens[this.pos + k]; }
  advance() { this.pos++; }

  check(type) { return this.peek().type === type; }

  match(type) {
    if (this.check(type)) { const t = this.peek(); this.advance(); return t; }
    return null;
  }

  expect(type, desc) {
    const t = this.match(type);
    if (!t) {
      const cur = this.peek();
      throw new SyntaxError(`此处应为「${desc}」但遇到了「${cur.value !== undefined && cur.value !== null ? cur.value : cur.type}」（第 ${cur.line} 行）`, cur.line, cur.column);
    }
    return t;
  }

  skipNL() {
    while (this.check("NL") || this.check("SEMI")) this.advance();
  }

  /* ---------- 程序 ---------- */
  parseProgram() {
    const stmts = [];
    while (!this.check("EOF")) {
      this.skipNL();
      if (this.check("EOF")) break;
      stmts.push(this.parseStmt());
      this.skipNL();
    }
    return { type: "Program", stmts };
  }

  /* ---------- 语句 ---------- */
  parseStmt() {
    const t = this.peek();
    switch (t.type) {
      case "VAR":   return this.parseVarDecl();
      case "IF":    return this.parseIf();
      case "WHILE": return this.parseWhile();
      case "BREAK": return this.parseBreak();
      case "FOR":   return this.parseFor();
      case "FUNC":  return this.parseFunc();
      case "RETURN":return this.parseReturn();
      case "CLASS": return this.parseClass();
      case "WRITE": return this.parseBuiltinCall("Write");
      case "READ":  return this.parseBuiltinCall("Read");
      case "CLS":   return this.parseBuiltinCall("Clear");
      case "WAIT":  return this.parseBuiltinCall("Wait");
      case "NL":
      case "SEMI":  this.skipNL(); return this.parseStmt();
      default:      return this.parseExprStmt();
    }
  }

  /* 设 x = 表达式  /  设 x  */
  parseVarDecl() {
    const t0 = this.peek();
    this.match("VAR");
    const name = this.expect("IDENT", "变量名").value;
    let value = null;
    if (this.match("ASGN")) value = this.parseExpression();
    return { type: "Assign", name, value, declare: true, line: t0.line, column: t0.column };
  }

  /* x = 表达式  /  本.属性 = 值  /  列表[下标] = 值 */
  parseExprStmt() {
    const t0 = this.peek();
    const expr = this.parseExpression();
    if (this.match("ASGN")) {
      const assignable = expr && (expr.type === "Variable" || expr.type === "Member" || expr.type === "Index");
      if (!assignable) {
        const t = this.peek();
        throw new SyntaxError(`等号左边必须是变量、属性或列表元素（第 ${t.line} 行）`, t.line, t.column);
      }
      const value = this.parseExpression();
      return { type: "AssignTarget", target: expr, value, line: t0.line, column: t0.column };
    }
    if (expr === null) {
      const t = this.peek();
      throw new SyntaxError(`无法理解的语句（第 ${t.line} 行）`, t.line, t.column);
    }
    return { type: "ExprStmt", expr, line: t0.line, column: t0.column };
  }

  /* 如果 (条件) { 体 } 否则如果 (条件) { 体 } … 否则 { 体 } */
  parseIf() {
    const t0 = this.peek();
    this.match("IF");
    const branches = [];
    const cond = this.parseCondExpr();
    branches.push({ cond, body: this.parseBlock() });
    this.skipNL();   // 块结束后的换行也要跳过，否则链式分支断开
    while (this.check("ELSE_IF")) {
      this.match("ELSE_IF");
      const cond2 = this.parseCondExpr();
      branches.push({ cond: cond2, body: this.parseBlock() });
      this.skipNL();
    }
    let elseBody = null;
    if (this.match("ELSE")) elseBody = this.parseBlock();
    return { type: "If", branches, elseBody, line: t0.line, column: t0.column };
  }

  parseCondExpr() {
    this.skipNL();
    const hasParen = !!this.match("LPAREN");
    if (hasParen) this.skipNL();
    const expr = this.parseExpression();
    if (hasParen) {
      this.skipNL();
      this.expect("RPAREN", "右括号）");
    }
    return expr;
  }

  /* 当 (条件) { 体 }   或   永远 { 体 }（省略条件 = 恒真循环，配「跳出」使用） */
  parseWhile() {
    const t0 = this.peek();
    this.match("WHILE");
    this.skipNL();
    const cond = this.check("LBRACE") ? { type: "Literal", value: true } : this.parseCondExpr();
    return { type: "While", cond, body: this.parseBlock(), line: t0.line, column: t0.column };
  }

  /* 跳出（跳出当前循环） */
  parseBreak() {
    const t0 = this.peek();
    this.match("BREAK");
    return { type: "Break", line: t0.line, column: t0.column };
  }

  /* 对于 i 在 列表 { 体 }   或   对于 i 从 1 到 10 { 体 } */
  parseFor() {
    const t0 = this.peek();
    this.match("FOR");
    this.skipNL();
    const varName = this.expect("IDENT", "循环变量名").value;
    this.skipNL();
    if (this.match("IN")) {
      const source = this.parseExpression();
      return { type: "For", varName, source, body: this.parseBlock(), line: t0.line, column: t0.column };
    }
    if (this.match("FROM")) {
      const start = this.parseExpression();
      this.expect("TO", "「到」");
      const end = this.parseExpression();
      return { type: "For", varName, start, end, body: this.parseBlock(), line: t0.line, column: t0.column };
    }
    const t = this.peek();
    throw new SyntaxError(`「对于」后需要「在」或「从…到」（第 ${t.line} 行）`, t.line, t.column);
  }

  /* 函数 名字(参数…) { 体 } */
  parseFunc() {
    const t0 = this.peek();
    this.match("FUNC");
    const name = this.expect("IDENT", "函数名").value;
    this.skipNL();
    this.expect("LPAREN", "（");
    this.skipNL();
    const params = [];
    while (!this.check("RPAREN")) {
      if (this.check("EOF")) throw new SyntaxError("函数参数列表未闭合", this.peek().line, this.peek().column);
      params.push(this.expect("IDENT", "参数名").value);
      if (!this.match("COMMA")) break;
      this.skipNL();
    }
    this.expect("RPAREN", "）");
    this.skipNL();
    const body = this.parseBlock();
    return { type: "FuncDecl", name, params, body, line: t0.line, column: t0.column };
  }

  /* 返回 表达式  /  返回 */
  parseReturn() {
    const t0 = this.peek();
    this.match("RETURN");
    this.skipNL();
    let value = null;
    if (!this.check("NL") && !this.check("EOF") && !this.check("RBRACE") && !this.check("SEMI")) {
      value = this.parseExpression();
    }
    return { type: "Return", value, line: t0.line, column: t0.column };
  }

  /* 类 名字 { 属性 x = …; 方法 f(…) { … } } */
  parseClass() {
    const t0 = this.peek();
    this.match("CLASS");
    const name = this.expect("IDENT", "类名").value;
    this.skipNL();
    this.expect("LBRACE", "｛");
    this.skipNL();
    const members = [];
    while (true) {
      if (this.check("EOF")) throw new SyntaxError("类定义未闭合", this.peek().line, this.peek().column);
      this.skipNL();
      if (this.check("RBRACE")) break;   // 成员结束后的换行要先跳过再判断类结束
      if (this.check("PROP")) {
        this.match("PROP");
        const propName = this.expect("IDENT", "属性名").value;
        let propValue = null;
        if (this.match("ASGN")) propValue = this.parseExpression();
        members.push({ type: "Prop", name: propName, value: propValue });
        this.skipNL();
        continue;
      }
      if (this.check("METHOD") || this.check("FUNC")) {
        this.advance();
        const methodName = this.expect("IDENT", "方法名").value;
        this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          params.push(this.expect("IDENT", "参数名").value);
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        this.skipNL();
        const body = this.parseBlock();
        members.push({ type: "Method", name: methodName, params, body });
        continue;
      }
      const t = this.peek();
      throw new SyntaxError(`类成员需要以「属性」或「方法」开头（第 ${t.line} 行）`, t.line, t.column);
    }
    this.expect("RBRACE", "｝");
    return { type: "Class", name, members, line: t0.line, column: t0.column };
  }

  /* 块 { 语句… } */
  parseBlock() {
    this.skipNL();
    this.expect("LBRACE", "｛");
    this.skipNL();
    const stmts = [];
    while (!this.check("RBRACE")) {
      if (this.check("EOF")) throw new SyntaxError("语句块未闭合，缺少｝", this.peek().line, this.peek().column);
      stmts.push(this.parseStmt());
      this.skipNL();
    }
    this.expect("RBRACE", "｝");
    return { type: "Block", stmts };
  }

  /* 写(…) 读入(…) 清屏() 等待(…) —— 语句级内置调用 */
  parseBuiltinCall(nodeType) {
    const t0 = this.peek();
    this.advance(); // 吃掉关键词 token
    this.skipNL();
    this.expect("LPAREN", "（");
    this.skipNL();
    const params = [];
    while (!this.check("RPAREN")) {
      if (this.check("EOF")) throw new SyntaxError("调用参数列表未闭合", this.peek().line, this.peek().column);
      params.push(this.parseExpression());
      if (!this.match("COMMA")) break;
      this.skipNL();
    }
    this.expect("RPAREN", "）");
    return { type: nodeType, params, line: t0.line, column: t0.column };
  }

  /* ---------- 表达式 ---------- */

  /* 或 */
  parseExpression() {
    this.skipNL();
    let left = this.parseAnd();
    while (this.check("OR")) {
      this.advance(); this.skipNL();
      const right = this.parseAnd();
      left = { type: "Binary", op: "or", left, right };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseComparison();
    while (this.check("AND")) {
      this.advance(); this.skipNL();
      const right = this.parseComparison();
      left = { type: "Binary", op: "and", left, right };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();
    while (true) {
      const t = this.peek().type;
      const mapping = { "EQ": "eq", "NEQ": "neq", "GT": "gt", "LT": "lt", "GE": "ge", "LE": "le" };
      if (mapping[t]) {
        this.advance(); this.skipNL();
        const right = this.parseAdditive();
        left = { type: "Binary", op: mapping[t], left, right };
      } else break;
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (true) {
      const t = this.peek().type;
      if (t === "PLUS" || t === "MINUS") {
        this.advance(); this.skipNL();
        const right = this.parseMultiplicative();
        left = { type: "Binary", op: t === "PLUS" ? "add" : "sub", left, right };
      } else break;
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek().type;
      if (t === "STAR" || t === "SLASH" || t === "MOD") {
        this.advance(); this.skipNL();
        const right = this.parseUnary();
        left = { type: "Binary", op: t === "STAR" ? "mul" : t === "SLASH" ? "div" : "mod", left, right };
      } else break;
    }
    return left;
  }

  parseUnary() {
    const t = this.peek().type;
    if (t === "NOT" || t === "MINUS") {
      this.advance(); this.skipNL();
      const operand = this.parseUnary();
      return { type: "Unary", op: t === "NOT" ? "not" : "neg", operand };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parseAtom();
    while (true) {
      this.skipNL();
      const t = this.peek().type;
      if (t === "DOT") {
        this.advance();
        const name = this.expect("IDENT", "成员名").value;
        expr = { type: "Member", object: expr, name };
      } else if (t === "LBRACKET") {
        this.advance(); this.skipNL();
        const index = this.parseExpression();
        this.expect("RBRACKET", "】");
        expr = { type: "Index", object: expr, index };
      } else if (t === "LPAREN") {
        this.advance(); this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          if (this.check("EOF")) throw new SyntaxError("调用参数未闭合", this.peek().line, this.peek().column);
          params.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        expr = { type: "Call", target: expr, params };
      } else break;
    }
    return expr;
  }

  parseAtom() {
    this.skipNL();
    const t = this.peek();
    switch (t.type) {
      case "NUMBER": this.advance(); return { type: "Literal", value: t.value };
      case "STRING": this.advance(); return { type: "Literal", value: t.value };
      case "TRUE":  this.advance(); return { type: "Literal", value: true };
      case "FALSE": this.advance(); return { type: "Literal", value: false };
      case "NULL":  this.advance(); return { type: "Literal", value: null };
      case "THIS":  this.advance(); return { type: "This" };
      case "IDENT": {
        this.advance();
        return { type: "Variable", name: t.value };
      }
      case "LPAREN": {
        this.advance(); this.skipNL();
        const expr = this.parseExpression();
        this.skipNL();
        this.expect("RPAREN", "）");
        return expr;
      }
      case "LBRACKET": {
        this.advance(); this.skipNL();
        const elements = [];
        while (!this.check("RBRACKET")) {
          if (this.check("EOF")) throw new SyntaxError("列表未闭合", this.peek().line, this.peek().column);
          elements.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RBRACKET", "】");
        return { type: "List", elements };
      }
      case "LBRACE": {
        this.advance(); this.skipNL();
        const pairs = [];
        while (!this.check("RBRACE")) {
          if (this.check("EOF")) throw new SyntaxError("字典未闭合", this.peek().line, this.peek().column);
          let key;
          if (this.check("STRING")) key = this.match("STRING").value;
          else if (this.check("IDENT")) key = this.match("IDENT").value;
          else {
            const tt = this.peek();
            throw new SyntaxError(`字典键应为文本或名称（第 ${tt.line} 行）`, tt.line, tt.column);
          }
          this.skipNL();
          this.expect("COLON", "：");
          this.skipNL();
          const value = this.parseExpression();
          pairs.push({ key, value });
          this.skipNL();
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RBRACE", "｝");
        return { type: "Dict", pairs };
      }
      case "NEW": {
        this.advance();
        const className = this.expect("IDENT", "类名").value;
        this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          params.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        return { type: "New", className, params };
      }
      case "READ":
      case "CLS":
      case "WAIT":
      case "WRITE": {
        // 内置调用也可作为表达式（如：设 猜测 = 读入("…")）
        const type = t.type === "READ" ? "Read" : t.type === "CLS" ? "Clear" : t.type === "WAIT" ? "Wait" : "Write";
        this.advance(); this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          if (this.check("EOF")) throw new SyntaxError("调用参数未闭合", this.peek().line, this.peek().column);
          params.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        return { type, params, line: t.line, column: t.column };
      }
      case "FUNC": {
        // 函数表达式（可作值传递）：函数 (参数) { 体 } 或 函数 名字(参数) { 体 }
        const start = this.peek();
        this.advance();
        let funcName = null;
        if (this.check("IDENT")) funcName = this.match("IDENT").value;
        this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          params.push(this.expect("IDENT", "参数名").value);
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        this.skipNL();
        const body = this.parseBlock();
        return { type: "FuncExpr", name: funcName, params, body, line: start.line, column: start.column };
      }
      default: {
        return null;
      }
    }
  }
}

function parseSource(source, dialect) {
  const lexer = new Lexer(source, dialect);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseProgram();
}
