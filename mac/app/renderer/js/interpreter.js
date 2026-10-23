/* ============================================================
 * 中文程 · 解释器 (interpreter.js)
 * ------------------------------------------------------------
 * 自研的树遍历（tree-walking）解释器：直接沿着 AST 求值。
 * 采用异步执行模型，保证"等待""读入"等操作不冻结界面，
 * 同时循环过程中随时可响应"停止"命令。
 *
 * 值模型：
 *   数字 number / 文本 string / 逻辑 boolean / 空 null
 *   列表 { __类型:"列表", 数据:[…] }
 *   字典 { __类型:"字典", 数据:{…} }
 *   函数 { __类型:"函数", 名字, 参数, 体, 环境 }   （闭包）
 *   类   { __类型:"类", 名字, 属性, 方法 }
 *   实例 { __类型:"实例", 类, 字段 }
 * ============================================================ */

class 运行时错误 extends Error {
  constructor(消息, 行, 列) {
    super(消息);
    this.行 = 行 || 0; this.列 = 列 || 0;
  }
}

/* ---------- 环境（作用域链） ---------- */
class 作用域 {
  constructor(父) { this.变量 = new Map(); this.父 = 父 || null; }

  定义(名字, 值) { this.变量.set(名字, 值); }

  查找(名字) {
    let 环 = this;
    while (环) {
      if (环.变量.has(名字)) return 环;
      环 = 环.父;
    }
    return null;
  }

  取(名字) {
    const 环 = this.查找(名字);
    if (!环) throw new 运行时错误(`未定义的名称：「${名字}」。需要先「设」一下，或者检查拼写。`);
    return 环.变量.get(名字);
  }

  赋值(名字, 值) {
    const 环 = this.查找(名字);
    if (环) { 环.变量.set(名字, 值); return; }
    // 未声明时自动定义（宽容模式，方便初学者）
    this.变量.set(名字, 值);
  }
}

/* ---------- 解释器 ---------- */
class 解释器 {
  constructor(运行时) {
    this.运行时 = 运行时;      // 提供 输出/读入/清屏/等待/画布/文件 等宿主能力
    this.停止 = false;         // 停止标志
    this.当前行 = 0; this.当前列 = 0;
    this.全局 = new 作用域();
    this.注册内置函数();
  }

  /* 记录语句位置，用于错误定位 */
  定位(节点) {
    if (节点 && 节点.行) { this.当前行 = 节点.行; this.当前列 = 节点.列; }
  }

  报错(消息, 节点) {
    if (节点 && 节点.行) throw new 运行时错误(消息, 节点.行, 节点.列);
    throw new 运行时错误(消息, this.当前行, this.当前列);
  }

  检查停止() {
    if (this.停止 || (this.运行时 && this.运行时.停止)) throw new 运行时错误("程序已被手动停止", this.当前行, this.当前列);
  }

  让出() { return Promise.resolve(); }

  /* ---------- 入口 ---------- */
  async 运行(程序) {
    this.停止 = false;
    for (const 语句 of 程序.语句) {
      this.检查停止();
      await this.执行(语句, this.全局);
      await this.让出();
    }
  }

  /* ---------- 语句执行（异步） ---------- */
  async 执行(节点, 环境) {
    if (!节点) return null;
    this.定位(节点);
    switch (节点.类型) {
      case "块": {
        const 子环境 = new 作用域(环境);
        for (const 语句 of 节点.语句) {
          this.检查停止();
          await this.执行(语句, 子环境);
          await this.让出();
        }
        return null;
      }
      case "赋值": {
        let 值 = null;
        if (节点.值) 值 = await this.求值(节点.值, 环境);
        if (节点.声明) 环境.定义(节点.名字, 值);
        else 环境.赋值(节点.名字, 值);
        return null;
      }
      case "赋值目标": {
        const 值 = await this.求值(节点.值, 环境);
        await this.赋值到(节点.目标, 值, 环境, 节点);
        return null;
      }
      case "表达式语句": {
        await this.求值(节点.表达式, 环境);
        return null;
      }
      case "输出": {
        const 片段 = [];
        for (const 参数 of 节点.参数) {
          const 值 = await this.求值(参数, 环境);
          片段.push(格式化值(值));
        }
        this.运行时.输出(片段.join(" "));
        return null;
      }
      case "读入": {
        let 提示 = "";
        if (节点.参数 && 节点.参数.length > 0) {
          const 值 = await this.求值(节点.参数[0], 环境);
          提示 = 格式化值(值);
        }
        const 结果 = await this.运行时.读入(提示);
        return 结果;
      }
      case "清屏": {
        this.运行时.清屏();
        return null;
      }
      case "等待": {
        let 毫秒 = 1000;
        if (节点.参数 && 节点.参数.length > 0) {
          const 值 = await this.求值(节点.参数[0], 环境);
          毫秒 = 转数字(值) || 1000;
        }
        await this.运行时.等待(毫秒);
        return null;
      }
      case "如果": {
        for (const 分支 of 节点.分支) {
          const 条件 = await this.求值(分支.条件, 环境);
          if (真值(条件)) { await this.执行(分支.体, 环境); return null; }
        }
        if (节点.否则体) await this.执行(节点.否则体, 环境);
        return null;
      }
      case "当": {
        while (真值(await this.求值(节点.条件, 环境))) {
          this.检查停止();
          await this.执行(节点.体, 环境);
          await this.让出();
        }
        return null;
      }
      case "对于": {
        const 子环境 = new 作用域(环境);
        if (节点.源) {
          const 源 = await this.求值(节点.源, 环境);
          const 迭代 = 可迭代(源, this);
          for (const 元素 of 迭代) {
            this.检查停止();
            子环境.定义(节点.变量, 元素);
            await this.执行(节点.体, 子环境);
            await this.让出();
          }
        } else {
          const 起点 = await this.求值(节点.起点, 环境);
          const 终点 = await this.求值(节点.终点, 环境);
          const 开始 = Math.floor(转数字(起点) || 0);
          const 结束 = Math.floor(转数字(终点) || 0);
          const 步长 = 开始 <= 结束 ? 1 : -1;
          for (let i = 开始; 步长 > 0 ? i <= 结束 : i >= 结束; i += 步长) {
            this.检查停止();
            子环境.定义(节点.变量, i);
            await this.执行(节点.体, 子环境);
            await this.让出();
          }
        }
        return null;
      }
      case "函数": {
        const 函数值 = { __类型: "函数", 名字: 节点.名字, 参数: 节点.参数, 体: 节点.体, 环境 };
        环境.定义(节点.名字, 函数值);
        return null;
      }
      case "函数表达式": {
        return { __类型: "函数", 名字: 节点.名字 || "匿名", 参数: 节点.参数, 体: 节点.体, 环境 };
      }
      case "返回": {
        let 值 = null;
        if (节点.值) 值 = await this.求值(节点.值, 环境);
        throw { __返回: 值 };
      }
      case "类": {
        const 属性 = new Map();
        const 方法 = new Map();
        for (const 成员 of 节点.成员) {
          if (成员.类型 === "属性") 属性.set(成员.名字, 成员);
          else if (成员.类型 === "方法") 方法.set(成员.名字, 成员);
        }
        环境.定义(节点.名字, { __类型: "类", 名字: 节点.名字, 属性, 方法, 环境 });
        return null;
      }
      default:
        this.报错(`未知语句类型：${节点.类型}`, 节点);
        return null;
    }
  }

  /* ---------- 表达式求值（同步） ---------- */
  async 求值(节点, 环境) {
    if (节点 === null || 节点 === undefined) return null;
    switch (节点.类型) {
      case "字面量": return 节点.值;
      case "函数表达式": {
        return { __类型: "函数", 名字: 节点.名字 || "匿名", 参数: 节点.参数, 体: 节点.体, 环境 };
      }
      case "本": {
        const 环 = 环境.查找("本");
        if (!环 || !环.变量.has("本")) this.报错("「本」只能在类的方法内使用", 节点);
        return 环.变量.get("本");
      }
      case "变量": {
        return 环境.取(节点.名字);
      }
      case "列表": {
        const 数据 = [];
        for (const 元素 of 节点.元素) 数据.push(await this.求值(元素, 环境));
        return { __类型: "列表", 数据 };
      }
      case "字典": {
        const 数据 = {};
        for (const 对 of 节点.键值) {
          const 键 = typeof 对.键 === "string" ? 对.键 : 格式化值(对.键);
          数据[键] = await this.求值(对.值, 环境);
        }
        return { __类型: "字典", 数据 };
      }
      case "新建": {
        const 类值 = 环境.取(节点.类名);
        if (!类值 || 类值.__类型 !== "类") this.报错(`「${节点.类名}」不是类，无法新建`, 节点);
        const 实例 = { __类型: "实例", 类: 类值, 字段: new Map() };
        // 初始化属性默认值
        for (const [名, 属性节点] of 类值.属性) {
          let 值 = null;
          if (属性节点.值) 值 = await this.求值(属性节点.值, 类值.环境);
          实例.字段.set(名, 值);
        }
        // 调用构造方法（方法名约定为「构造」）
        const 构造 = 类值.方法.get("构造");
        if (构造) {
          const 函数值 = { __类型: "函数", 名字: "构造", 参数: 构造.参数, 体: 构造.体, 环境: 类值.环境 };
          await this.调用函数(函数值, 节点.参数, 环境, 实例);
        }
        return 实例;
      }
      case "成员": {
        const 对象 = await this.求值(节点.对象, 环境);
        return 取成员(对象, 节点.名字, this, 节点);
      }
      case "下标": {
        const 对象 = await this.求值(节点.对象, 环境);
        const 索引 = await this.求值(节点.索引, 环境);
        if (对象.__类型 === "列表") {
          const i = Math.floor(转数字(索引));
          if (i < 0 || i >= 对象.数据.length) this.报错(`列表索引 ${i} 超出范围（长度 ${对象.数据.length}）`, 节点);
          return 对象.数据[i];
        }
        if (对象.__类型 === "字典") {
          const 键 = typeof 索引 === "string" ? 索引 : 格式化值(索引);
          if (!(键 in 对象.数据)) this.报错(`字典中没有键「${键}」`, 节点);
          return 对象.数据[键];
        }
        if (typeof 对象 === "string") {
          const i = Math.floor(转数字(索引));
          if (i < 0 || i >= 对象.length) this.报错(`文本索引 ${i} 超出范围`, 节点);
          return 对象[i];
        }
        this.报错("该值不能按下标访问", 节点);
        return null;
      }
      case "一元": {
        const 操作数 = await this.求值(节点.操作数, 环境);
        if (节点.运算 === "非") return !真值(操作数);
        if (节点.运算 === "负") return -(转数字(操作数));
        this.报错(`未知一元运算：${节点.运算}`, 节点);
        return null;
      }
      case "二元": {
        const 左 = await this.求值(节点.左, 环境);
        if (节点.运算 === "且") { if (!真值(左)) return false; return 真值(await this.求值(节点.右, 环境)); }
        if (节点.运算 === "或") { if (真值(左)) return true; return 真值(await this.求值(节点.右, 环境)); }
        const 右 = await this.求值(节点.右, 环境);
        switch (节点.运算) {
          case "加": return 相加(左, 右, this, 节点);
          case "减": return 转数字(左) - 转数字(右);
          case "乘": return 转数字(左) * 转数字(右);
          case "除":
            if (转数字(右) === 0) this.报错("除数不能为零", 节点);
            return 转数字(左) / 转数字(右);
          case "取余": {
            // 与 Python 内核一致：商向负无穷取整的余数（-7 取余 3 = 2）
            if (转数字(右) === 0) this.报错("取余时除数不能为零", 节点);
            const 被除数 = 转数字(左), 除数 = 转数字(右);
            return ((被除数 % 除数) + 除数) % 除数;
          }
          case "等于": return 相等(左, 右);
          case "不等于": return !相等(左, 右);
          case "大于": return 转数字(左) > 转数字(右);
          case "小于": return 转数字(左) < 转数字(右);
          case "大于等于": return 转数字(左) >= 转数字(右);
          case "小于等于": return 转数字(左) <= 转数字(右);
          default: this.报错(`未知运算：${节点.运算}`, 节点);
        }
        return null;
      }
      case "调用": {
        const 目标 = await this.求值(节点.目标, 环境);
        return this.调用(目标, 节点.参数, 环境, 节点);
      }
      case "读入": {
        let 提示 = "";
        if (节点.参数 && 节点.参数.length > 0) {
          提示 = 格式化值(await this.求值(节点.参数[0], 环境));
        }
        return await this.运行时.读入(提示);
      }
      case "清屏": {
        this.运行时.清屏();
        return null;
      }
      case "等待": {
        let 毫秒 = 1000;
        if (节点.参数 && 节点.参数.length > 0) {
          毫秒 = 转数字(await this.求值(节点.参数[0], 环境)) || 1000;
        }
        await this.运行时.等待(毫秒);
        return null;
      }
      case "输出": {
        const 片段 = [];
        for (const 参数 of 节点.参数) 片段.push(格式化值(await this.求值(参数, 环境)));
        this.运行时.输出(片段.join(" "));
        return null;
      }
      default:
        this.报错(`未知表达式类型：${节点.类型}`, 节点);
        return null;
    }
  }

  /* 调用：函数值 / 成员方法 / 内置函数 */
  async 调用(目标, 参数节点, 环境, 节点) {
    // 内置函数（JS 函数）
    if (typeof 目标 === "function") {
      const 参数 = [];
      for (const p of 参数节点) 参数.push(await this.求值(p, 环境));
      return 目标(参数, this);
    }
    // 中文程函数
    if (目标 && 目标.__类型 === "函数") {
      return this.调用函数(目标, 参数节点, 环境, null);
    }
    // 实例方法（绑定本）
    if (目标 && 目标.__类型 === "实例方法") {
      return this.调用函数(目标.函数, 参数节点, 环境, 目标.实例);
    }
    if (目标 && 目标.__类型 === "实例") {
      // 实例被直接调用：若实例是函数对象包装？不支持
      this.报错("实例不能直接调用，请调用它的方法", 节点);
    }
    this.报错("这里不是一个可以调用的函数", 节点);
    return null;
  }

  async 调用函数(函数值, 参数节点, 环境, 本) {
    const 参数 = [];
    for (const p of 参数节点) 参数.push(await this.求值(p, 环境));
    if (参数.length !== 函数值.参数.length) {
      this.报错(`函数「${函数值.名字 || "匿名"}」需要 ${函数值.参数.length} 个参数，实际给了 ${参数.length} 个`);
    }
    const 调用环境 = new 作用域(函数值.环境);
    if (本 !== null && 本 !== undefined) 调用环境.定义("本", 本);
    for (let i = 0; i < 函数值.参数.length; i++) 调用环境.定义(函数值.参数[i], 参数[i]);
    try {
      await this.执行(函数值.体, 调用环境);
    } catch (e) {
      if (e && e.__返回 !== undefined) return e.__返回;
      throw e;
    }
    return null;
  }

  /* 赋值到：变量 / 成员属性 / 下标元素 */
  async 赋值到(目标, 值, 环境, 节点) {
    if (目标.类型 === "变量") { 环境.赋值(目标.名字, 值); return; }
    const 对象 = await this.求值(目标.对象, 环境);
    if (目标.类型 === "成员") {
      if (对象.__类型 === "实例") { 对象.字段.set(目标.名字, 值); return; }
      if (对象.__类型 === "字典") { 对象.数据[目标.名字] = 值; return; }
      this.报错("该值不能设置成员", 节点);
    }
    if (目标.类型 === "下标") {
      const 索引 = await this.求值(目标.索引, 环境);
      if (对象.__类型 === "列表") {
        对象.数据[Math.floor(转数字(索引))] = 值;
        return;
      }
      if (对象.__类型 === "字典") { 对象.数据[格式化值(索引)] = 值; return; }
      this.报错("该值不能按下标赋值", 节点);
    }
    this.报错("无法赋值的对象", 节点);
  }

  /* ---------- 内置函数注册 ---------- */
  注册内置函数() {
    const 内建 = 内置函数表(this.运行时);
    for (const [名, fn] of Object.entries(内建)) {
      this.全局.定义(名, fn);
    }
    // 注册当前方言的内建函数别名（繁体「長度」、拼音「changdu」等 → 同一实现），
    // 否则繁体/拼音程序调用这些函数会报「未定义的名称」
    const 方言 = typeof 取方言 === "function" ? 取方言() : null;
    if (方言 && 方言.内建函数) {
      for (const [别名, 标准名] of Object.entries(方言.内建函数)) {
        if (内建[标准名] && !this.全局.变量.has(别名)) this.全局.定义(别名, 内建[标准名]);
      }
    }
  }
}

/* ==================== 值工具 ==================== */

function 真值(值) {
  if (值 === null || 值 === undefined) return false;
  if (typeof 值 === "boolean") return 值;
  if (typeof 值 === "number") return 值 !== 0;
  if (typeof 值 === "string") return 值.length > 0;
  if (值.__类型 === "列表") return 值.数据.length > 0;
  if (值.__类型 === "字典") return Object.keys(值.数据).length > 0;
  return true;
}

function 转数字(值) {
  if (typeof 值 === "number") return 值;
  if (typeof 值 === "boolean") return 值 ? 1 : 0;
  if (值 === null) return 0;
  const n = parseFloat(值);
  return isNaN(n) ? 0 : n;
}

function 格式化值(值, 深度 = 0) {
  if (值 === null || 值 === undefined) return "空";
  if (typeof 值 === "boolean") return 值 ? "真" : "假";
  if (typeof 值 === "number") return String(值);
  if (typeof 值 === "string") return 值;
  if (值.__类型 === "列表") {
    if (深度 > 3) return "[…]";
    return "[" + 值.数据.map(v => 格式化值(v, 深度 + 1)).join(", ") + "]";
  }
  if (值.__类型 === "字典") {
    if (深度 > 3) return "{…}";
    const 条目 = Object.entries(值.数据).map(([k, v]) => `${k}: ${格式化值(v, 深度 + 1)}`);
    return "{" + 条目.join(", ") + "}";
  }
  if (值.__类型 === "函数") return `〈函数 ${值.名字 || "匿名"}〉`;
  if (值.__类型 === "类") return `〈类 ${值.名字}〉`;
  if (值.__类型 === "实例") return `〈${值.类.名字} 实例〉`;
  if (值.__类型 === "实例方法") return `〈方法 ${值.函数.名字}〉`;
  return String(值);
}

function 相加(左, 右, 解释器, 节点) {
  if (typeof 左 === "string" || typeof 右 === "string") {
    return 格式化值(左) + 格式化值(右);
  }
  if (左 && 左.__类型 === "列表" && 右 && 右.__类型 === "列表") {
    return { __类型: "列表", 数据: 左.数据.concat(右.数据) };
  }
  if (typeof 左 === "number" && typeof 右 === "number") return 左 + 右;
  return 转数字(左) + 转数字(右);
}

function 相等(左, 右) {
  if ((左 && 左.__类型 === "列表") || (右 && 右.__类型 === "列表") ||
      (左 && 左.__类型 === "字典") || (右 && 右.__类型 === "字典")) {
    try { return JSON.stringify(归一(左)) === JSON.stringify(归一(右)); }
    catch (e) { return 左 === 右; }
  }
  return 左 === 右;
}

function 归一(值) {
  if (值 === null) return null;
  if (值.__类型 === "列表") return 值.数据.map(归一);
  if (值.__类型 === "字典") { const o = {}; for (const k in 值.数据) o[k] = 归一(值.数据[k]); return o; }
  return 值;
}

function 可迭代(值, 解释器) {
  if (值.__类型 === "列表") return 值.数据;
  if (值.__类型 === "字典") return Object.values(值.数据);
  if (typeof 值 === "string") return 值.split("");
  if (typeof 值 === "number") { const a = []; for (let i = 0; i < 值; i++) a.push(i); return a; }
  if (值 === null) return [];
  解释器.报错("这个值不能用于「在」循环");
  return [];
}

function 取成员(对象, 名字, 解释器, 节点) {
  if (对象.__类型 === "实例") {
    if (对象.字段.has(名字)) return 对象.字段.get(名字);
    const 方法节点 = 对象.类.方法.get(名字);
    if (方法节点) {
      const 函数值 = { __类型: "函数", 名字, 参数: 方法节点.参数, 体: 方法节点.体, 环境: 对象.类.环境 };
      return { __类型: "实例方法", 函数: 函数值, 实例: 对象 };
    }
    解释器.报错(`实例「${对象.类.名字}」没有成员「${名字}」`, 节点);
  }
  if (对象.__类型 === "字典") {
    if (名字 in 对象.数据) return 对象.数据[名字];
    解释器.报错(`字典中没有键「${名字}」`, 节点);
  }
  if (对象.__类型 === "列表") {
    if (名字 === "长度") return 对象.数据.length;
    解释器.报错(`列表没有成员「${名字}」`, 节点);
  }
  解释器.报错("该值不能访问成员", 节点);
  return null;
}

