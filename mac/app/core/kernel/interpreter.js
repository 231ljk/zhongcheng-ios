/* ============================================================
 * 中文程 · 解释器 (interpreter.js)
 * ------------------------------------------------------------
 * 自研的树遍历（tree-walking）解释器：直接沿着 AST 求值。
 * 采用异步执行模型，保证"等待""读入"等操作不冻结界面，
 * 同时循环过程中随时可响应"停止"命令。
 *
 * 值模型（内部结构一律英文，用户可见的文本仍为中文）：
 *   数字 number / 文本 string / 逻辑 boolean / 空 null
 *   列表 { __type:"list", data:[…] }
 *   字典 { __type:"dict", data:{…} }
 *   函数 { __type:"func", name, params, body, env }   （闭包）
 *   类   { __type:"class", name, props, methods, env }
 *   实例 { __type:"instance", cls, fields }
 * ============================================================ */

class RuntimeError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line || 0;
    this.column = column || 0;
  }
}

/* ---------- 环境（作用域链） ---------- */
class Scope {
  constructor(parent) {
    this.vars = new Map();
    this.parent = parent || null;
  }

  define(name, value) { this.vars.set(name, value); }

  find(name) {
    let scope = this;
    while (scope) {
      if (scope.vars.has(name)) return scope;
      scope = scope.parent;
    }
    return null;
  }

  get(name) {
    const scope = this.find(name);
    if (!scope) throw new RuntimeError(`未定义的名称：「${name}」。需要先「设」一下，或者检查拼写。`);
    return scope.vars.get(name);
  }

  assign(name, value) {
    const scope = this.find(name);
    if (scope) { scope.vars.set(name, value); return; }
    // 未声明时自动定义（宽容模式，方便初学者）
    this.vars.set(name, value);
  }
}

/* ---------- 解释器 ---------- */
class Interpreter {
  constructor(host) {
    this.host = host;          // 提供 print/input/clear/sleep/canvas/file 等宿主能力
    this.stopped = false;      // 停止标志
    this.curLine = 0;
    this.curColumn = 0;
    this.globals = new Scope();
    this.registerBuiltins();
  }

  /* 记录语句位置，用于错误定位 */
  markPos(node) {
    if (node && node.line) { this.curLine = node.line; this.curColumn = node.column; }
  }

  fail(message, node) {
    if (node && node.line) throw new RuntimeError(message, node.line, node.column);
    throw new RuntimeError(message, this.curLine, this.curColumn);
  }

  checkStop() {
    if (this.stopped || (this.host && this.host.stopped)) throw new RuntimeError("程序已被手动停止", this.curLine, this.curColumn);
  }

  yieldTick() { return Promise.resolve(); }

  /* ---------- 入口 ---------- */
  async run(program) {
    this.stopped = false;
    for (const stmt of program.stmts) {
      this.checkStop();
      try { await this.exec(stmt, this.globals); }
      catch (e) { if (e && e.__break) this.fail("「跳出」只能用在循环里"); throw e; }
      await this.yieldTick();
    }
  }

  /* ---------- 语句执行（异步） ---------- */
  async exec(node, env) {
    if (!node) return null;
    this.markPos(node);
    switch (node.type) {
      case "Block": {
        const childEnv = new Scope(env);
        for (const stmt of node.stmts) {
          this.checkStop();
          await this.exec(stmt, childEnv);
          await this.yieldTick();
        }
        return null;
      }
      case "Assign": {
        let value = null;
        if (node.value) value = await this.eval(node.value, env);
        if (node.declare) env.define(node.name, value);
        else env.assign(node.name, value);
        return null;
      }
      case "AssignTarget": {
        const value = await this.eval(node.value, env);
        await this.assignTo(node.target, value, env, node);
        return null;
      }
      case "ExprStmt": {
        await this.eval(node.expr, env);
        return null;
      }
      case "Write": {
        const parts = [];
        for (const arg of node.params) {
          const value = await this.eval(arg, env);
          parts.push(formatValue(value));
        }
        this.host.print(parts.join(" "));
        return null;
      }
      case "Read": {
        let prompt = "";
        if (node.params && node.params.length > 0) {
          const value = await this.eval(node.params[0], env);
          prompt = formatValue(value);
        }
        const result = await this.host.input(prompt);
        return result;
      }
      case "Clear": {
        this.host.clear();
        return null;
      }
      case "Wait": {
        let ms = 1000;
        if (node.params && node.params.length > 0) {
          const value = await this.eval(node.params[0], env);
          ms = toNum(value) || 1000;
        }
        await this.host.sleep(ms);
        return null;
      }
      case "If": {
        for (const branch of node.branches) {
          const cond = await this.eval(branch.cond, env);
          if (truthy(cond)) { await this.exec(branch.body, env); return null; }
        }
        if (node.elseBody) await this.exec(node.elseBody, env);
        return null;
      }
      case "While": {
        while (truthy(await this.eval(node.cond, env))) {
          this.checkStop();
          try { await this.exec(node.body, env); }
          catch (e) { if (e && e.__break) break; throw e; }
          await this.yieldTick();
        }
        return null;
      }
      case "For": {
        const childEnv = new Scope(env);
        if (node.source) {
          const source = await this.eval(node.source, env);
          const iter = iterableOf(source, this);
          for (const element of iter) {
            this.checkStop();
            childEnv.define(node.varName, element);
            try { await this.exec(node.body, childEnv); }
            catch (e) { if (e && e.__break) break; throw e; }
            await this.yieldTick();
          }
        } else {
          const fromVal = await this.eval(node.start, env);
          const toVal = await this.eval(node.end, env);
          const start = Math.floor(toNum(fromVal) || 0);
          const end = Math.floor(toNum(toVal) || 0);
          const step = start <= end ? 1 : -1;
          for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
            this.checkStop();
            childEnv.define(node.varName, i);
            try { await this.exec(node.body, childEnv); }
            catch (e) { if (e && e.__break) break; throw e; }
            await this.yieldTick();
          }
        }
        return null;
      }
      case "Break": {
        throw { __break: true };
      }
      case "FuncDecl": {
        const fnValue = { __type: "func", name: node.name, params: node.params, body: node.body, env };
        env.define(node.name, fnValue);
        return null;
      }
      case "FuncExpr": {
        return { __type: "func", name: node.name || "匿名", params: node.params, body: node.body, env };
      }
      case "Return": {
        let value = null;
        if (node.value) value = await this.eval(node.value, env);
        throw { __return: value };
      }
      case "Class": {
        const props = new Map();
        const methods = new Map();
        for (const member of node.members) {
          if (member.type === "Prop") props.set(member.name, member);
          else if (member.type === "Method") methods.set(member.name, member);
        }
        env.define(node.name, { __type: "class", name: node.name, props, methods, env });
        return null;
      }
      default:
        this.fail(`未知语句类型：${node.type}`, node);
        return null;
    }
  }

  /* ---------- 表达式求值（同步） ---------- */
  async eval(node, env) {
    if (node === null || node === undefined) return null;
    switch (node.type) {
      case "Literal": return node.value;
      case "FuncExpr": {
        return { __type: "func", name: node.name || "匿名", params: node.params, body: node.body, env };
      }
      case "This": {
        const scope = env.find("本");
        if (!scope || !scope.vars.has("本")) this.fail("「本」只能在类的方法内使用", node);
        return scope.vars.get("本");
      }
      case "Variable": {
        return env.get(node.name);
      }
      case "List": {
        const data = [];
        for (const element of node.elements) data.push(await this.eval(element, env));
        return { __type: "list", data };
      }
      case "Dict": {
        const data = {};
        for (const pair of node.pairs) {
          const key = typeof pair.key === "string" ? pair.key : formatValue(pair.key);
          data[key] = await this.eval(pair.value, env);
        }
        return { __type: "dict", data };
      }
      case "New": {
        const clsValue = env.get(node.className);
        if (!clsValue || clsValue.__type !== "class") this.fail(`「${node.className}」不是类，无法新建`, node);
        const instance = { __type: "instance", cls: clsValue, fields: new Map() };
        // 初始化属性默认值
        for (const [name, propNode] of clsValue.props) {
          let value = null;
          if (propNode.value) value = await this.eval(propNode.value, clsValue.env);
          instance.fields.set(name, value);
        }
        // 调用构造方法（方法名约定为「构造」）
        const ctor = clsValue.methods.get("构造");
        if (ctor) {
          const fnValue = { __type: "func", name: "构造", params: ctor.params, body: ctor.body, env: clsValue.env };
          await this.callFunc(fnValue, node.params, env, instance);
        }
        return instance;
      }
      case "Member": {
        const object = await this.eval(node.object, env);
        return getMember(object, node.name, this, node);
      }
      case "Index": {
        const object = await this.eval(node.object, env);
        const index = await this.eval(node.index, env);
        if (object.__type === "list") {
          const i = Math.floor(toNum(index));
          if (i < 0 || i >= object.data.length) this.fail(`列表索引 ${i} 超出范围（长度 ${object.data.length}）`, node);
          return object.data[i];
        }
        if (object.__type === "dict") {
          const key = typeof index === "string" ? index : formatValue(index);
          if (!(key in object.data)) this.fail(`字典中没有键「${key}」`, node);
          return object.data[key];
        }
        if (typeof object === "string") {
          const i = Math.floor(toNum(index));
          if (i < 0 || i >= object.length) this.fail(`文本索引 ${i} 超出范围`, node);
          return object[i];
        }
        this.fail("该值不能按下标访问", node);
        return null;
      }
      case "Unary": {
        const operand = await this.eval(node.operand, env);
        if (node.op === "not") return !truthy(operand);
        if (node.op === "neg") return -(toNum(operand));
        this.fail(`未知一元运算：${node.op}`, node);
        return null;
      }
      case "Binary": {
        const left = await this.eval(node.left, env);
        if (node.op === "and") { if (!truthy(left)) return false; return truthy(await this.eval(node.right, env)); }
        if (node.op === "or") { if (truthy(left)) return true; return truthy(await this.eval(node.right, env)); }
        const right = await this.eval(node.right, env);
        switch (node.op) {
          case "add": return doAdd(left, right, this, node);
          case "sub": return toNum(left) - toNum(right);
          case "mul": return toNum(left) * toNum(right);
          case "div":
            if (toNum(right) === 0) this.fail("除数不能为零", node);
            return toNum(left) / toNum(right);
          case "mod": {
            // 与 Python 内核一致：商向负无穷取整的余数（-7 取余 3 = 2）
            if (toNum(right) === 0) this.fail("取余时除数不能为零", node);
            const a = toNum(left), b = toNum(right);
            return ((a % b) + b) % b;
          }
          case "eq": return isEqual(left, right);
          case "neq": return !isEqual(left, right);
          case "gt": return toNum(left) > toNum(right);
          case "lt": return toNum(left) < toNum(right);
          case "ge": return toNum(left) >= toNum(right);
          case "le": return toNum(left) <= toNum(right);
          default: this.fail(`未知运算：${node.op}`, node);
        }
        return null;
      }
      case "Call": {
        const target = await this.eval(node.target, env);
        return this.callValue(target, node.params, env, node);
      }
      case "Read": {
        let prompt = "";
        if (node.params && node.params.length > 0) {
          prompt = formatValue(await this.eval(node.params[0], env));
        }
        return await this.host.input(prompt);
      }
      case "Clear": {
        this.host.clear();
        return null;
      }
      case "Wait": {
        let ms = 1000;
        if (node.params && node.params.length > 0) {
          ms = toNum(await this.eval(node.params[0], env)) || 1000;
        }
        await this.host.sleep(ms);
        return null;
      }
      case "Write": {
        const parts = [];
        for (const arg of node.params) parts.push(formatValue(await this.eval(arg, env)));
        this.host.print(parts.join(" "));
        return null;
      }
      default:
        this.fail(`未知表达式类型：${node.type}`, node);
        return null;
    }
  }

  /* 调用：函数值 / 成员方法 / 内置函数 */
  async callValue(target, paramNodes, env, node) {
    // 内置函数（JS 函数）
    if (typeof target === "function") {
      const args = [];
      for (const p of paramNodes) args.push(await this.eval(p, env));
      return await target(args, this);
    }
    // 中文程函数
    if (target && target.__type === "func") {
      return this.callFunc(target, paramNodes, env, null);
    }
    // 实例方法（绑定本）
    if (target && target.__type === "boundmethod") {
      return this.callFunc(target.fn, paramNodes, env, target.instance);
    }
    if (target && target.__type === "instance") {
      // 实例被直接调用：若实例是函数对象包装？不支持
      this.fail("实例不能直接调用，请调用它的方法", node);
    }
    this.fail("这里不是一个可以调用的函数", node);
    return null;
  }

  async callFunc(fnValue, paramNodes, env, self) {
    const args = [];
    for (const p of paramNodes) args.push(await this.eval(p, env));
    if (args.length !== fnValue.params.length) {
      this.fail(`函数「${fnValue.name || "匿名"}」需要 ${fnValue.params.length} 个参数，实际给了 ${args.length} 个`);
    }
    const callEnv = new Scope(fnValue.env);
    if (self !== null && self !== undefined) callEnv.define("本", self);
    for (let i = 0; i < fnValue.params.length; i++) callEnv.define(fnValue.params[i], args[i]);
    try {
      await this.exec(fnValue.body, callEnv);
    } catch (e) {
      if (e && e.__return !== undefined) return e.__return;
      throw e;
    }
    return null;
  }

  /* 供宿主事件回调使用：参数已求值好，直接按值调用一个中文程函数（或内置函数） */
  async invokeUserFn(fnValue, args) {
    if (typeof fnValue === "function") return await fnValue(args, this);
    if (fnValue && fnValue.__type === "func") {
      if (args.length !== fnValue.params.length) {
        this.fail(`函数「${fnValue.name || "匿名"}」需要 ${fnValue.params.length} 个参数，实际给了 ${args.length} 个`);
      }
      const callEnv = new Scope(fnValue.env);
      for (let i = 0; i < fnValue.params.length; i++) callEnv.define(fnValue.params[i], args[i]);
      try {
        await this.exec(fnValue.body, callEnv);
      } catch (e) {
        if (e && e.__return !== undefined) return e.__return;
        throw e;
      }
      return null;
    }
    this.fail("这里需要一个函数");
  }

  /* 赋值到：变量 / 成员属性 / 下标元素 */
  async assignTo(target, value, env, node) {
    if (target.type === "Variable") { env.assign(target.name, value); return; }
    const object = await this.eval(target.object, env);
    if (target.type === "Member") {
      if (object.__type === "instance") { object.fields.set(target.name, value); return; }
      if (object.__type === "dict") { object.data[target.name] = value; return; }
      this.fail("该值不能设置成员", node);
    }
    if (target.type === "Index") {
      const index = await this.eval(target.index, env);
      if (object.__type === "list") {
        object.data[Math.floor(toNum(index))] = value;
        return;
      }
      if (object.__type === "dict") { object.data[formatValue(index)] = value; return; }
      this.fail("该值不能按下标赋值", node);
    }
    this.fail("无法赋值的对象", node);
  }

  /* ---------- 内置函数注册 ---------- */
  registerBuiltins() {
    const builtins = builtinTable(this.host);
    for (const [name, fn] of Object.entries(builtins)) {
      this.globals.define(name, fn);
    }
    // 注册当前方言的内建函数别名（繁体「長度」、拼音「changdu」等 → 同一实现），
    // 否则繁体/拼音程序调用这些函数会报「未定义的名称」
    const dialect = typeof getDialect === "function" ? getDialect() : null;
    if (dialect && dialect.builtins) {
      for (const [alias, canonical] of Object.entries(dialect.builtins)) {
        if (builtins[canonical] && !this.globals.vars.has(alias)) this.globals.define(alias, builtins[canonical]);
      }
    }
  }
}

/* ==================== 值工具 ==================== */

function truthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (value.__type === "list") return value.data.length > 0;
  if (value.__type === "dict") return Object.keys(value.data).length > 0;
  return true;
}

function toNum(value) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function formatValue(value, depth = 0) {
  if (value === null || value === undefined) return "空";
  if (typeof value === "boolean") return value ? "真" : "假";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "function") return "〈内置函数〉";
  if (value.__type === "list") {
    if (depth > 3) return "[…]";
    return "[" + value.data.map(v => formatValue(v, depth + 1)).join(", ") + "]";
  }
  if (value.__type === "dict") {
    if (depth > 3) return "{…}";
    const entries = Object.entries(value.data).map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`);
    return "{" + entries.join(", ") + "}";
  }
  if (value.__type === "func") return `〈函数 ${value.name || "匿名"}〉`;
  if (value.__type === "class") return `〈类 ${value.name}〉`;
  if (value.__type === "instance") return `〈${value.cls.name} 实例〉`;
  if (value.__type === "boundmethod") return `〈方法 ${value.fn.name}〉`;
  if (value.__type === "device") return `〈设备连接${value.kind ? "·" + value.kind : ""}〉`;
  return String(value);
}

function doAdd(left, right, interp, node) {
  if (typeof left === "string" || typeof right === "string") {
    return formatValue(left) + formatValue(right);
  }
  if (left && left.__type === "list" && right && right.__type === "list") {
    return { __type: "list", data: left.data.concat(right.data) };
  }
  if (typeof left === "number" && typeof right === "number") return left + right;
  return toNum(left) + toNum(right);
}

function isEqual(left, right) {
  if ((left && left.__type === "list") || (right && right.__type === "list") ||
      (left && left.__type === "dict") || (right && right.__type === "dict")) {
    try { return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right)); }
    catch (e) { return left === right; }
  }
  return left === right;
}

function normalizeValue(value) {
  if (value === null) return null;
  if (value.__type === "list") return value.data.map(normalizeValue);
  if (value.__type === "dict") { const o = {}; for (const k in value.data) o[k] = normalizeValue(value.data[k]); return o; }
  return value;
}

function iterableOf(value, interp) {
  if (value.__type === "list") return value.data;
  if (value.__type === "dict") return Object.values(value.data);
  if (typeof value === "string") return value.split("");
  if (typeof value === "number") { const a = []; for (let i = 0; i < value; i++) a.push(i); return a; }
  if (value === null) return [];
  interp.fail("这个值不能用于「在」循环");
  return [];
}

function getMember(object, name, interp, node) {
  if (object.__type === "instance") {
    if (object.fields.has(name)) return object.fields.get(name);
    const methodNode = object.cls.methods.get(name);
    if (methodNode) {
      const fnValue = { __type: "func", name, params: methodNode.params, body: methodNode.body, env: object.cls.env };
      return { __type: "boundmethod", fn: fnValue, instance: object };
    }
    interp.fail(`实例「${object.cls.name}」没有成员「${name}」`, node);
  }
  if (object.__type === "dict") {
    if (name in object.data) return object.data[name];
    interp.fail(`字典中没有键「${name}」`, node);
  }
  if (object.__type === "list") {
    if (name === "长度") return object.data.length;
    interp.fail(`列表没有成员「${name}」`, node);
  }
  interp.fail("该值不能访问成员", node);
  return null;
}
