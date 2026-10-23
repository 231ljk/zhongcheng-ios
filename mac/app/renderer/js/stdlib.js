/* ============================================================
 * 中文程 · 标准库 (stdlib.js)
 * ------------------------------------------------------------
 * 全部为中文命名的内置函数：数学、文本、列表、字典、绘图、
 * 文件、时间等。所有函数由我们自己实现，宿主能力（画布、
 * 文件）通过 运行时 回调接入界面。
 *
 * 函数约定：fn(参数数组, 解释器) → 返回值
 * ============================================================ */

function 内置函数表(运行时) {
  const F = {};

  /* ---------- 类型与转换 ---------- */
  F.长度 = (p) => {
    const 值 = p[0];
    if (值 && 值.__类型 === "列表") return 值.数据.length;
    if (值 && 值.__类型 === "字典") return Object.keys(值.数据).length;
    if (typeof 值 === "string") return 值.length;
    if (typeof 值 === "number") return String(值).length;
    if (值 === null) return 0;
    return 格式化值(值).length;
  };

  F.类型 = (p) => {
    const 值 = p[0];
    if (值 === null) return "空";
    if (typeof 值 === "number") return "数字";
    if (typeof 值 === "string") return "文本";
    if (typeof 值 === "boolean") return "逻辑";
    if (值.__类型 === "列表") return "列表";
    if (值.__类型 === "字典") return "字典";
    if (值.__类型 === "函数") return "函数";
    if (值.__类型 === "类") return "类";
    if (值.__类型 === "实例") return 值.类.名字;
    return "未知";
  };

  F.转文本 = (p) => 格式化值(p[0]);
  F.转数字 = (p) => {
    const n = parseFloat(格式化值(p[0]));
    return isNaN(n) ? 0 : n;
  };

  /* ---------- 数学 ---------- */
  F.取整 = (p) => Math.floor(转数字(p[0]));
  F.绝对值 = (p) => Math.abs(转数字(p[0]));
  F.平方根 = (p) => Math.sqrt(转数字(p[0]));
  F.幂 = (p) => Math.pow(转数字(p[0]), 转数字(p[1] || 1));
  F.随机数 = (p) => {
    const 最小 = 转数字(p[0] || 0), 最大 = 转数字(p[1] || 0);
    if (最小 > 最大) return 最小;
    return Math.floor(Math.random() * (最大 - 最小 + 1)) + 最小;
  };
  F.最大 = (p) => {
    if (p.length === 1 && p[0] && p[0].__类型 === "列表") {
      if (!p[0].数据.length) return 0;
      return Math.max(...p[0].数据.map(转数字));
    }
    if (!p.length) return 0;
    return Math.max(...p.map(转数字));
  };
  F.最小 = (p) => {
    if (p.length === 1 && p[0] && p[0].__类型 === "列表") {
      if (!p[0].数据.length) return 0;
      return Math.min(...p[0].数据.map(转数字));
    }
    if (!p.length) return 0;
    return Math.min(...p.map(转数字));
  };

  /* ---------- 环境 ---------- */
  F.当前目录 = () => (运行时.当前目录 ? 运行时.当前目录() : "");

  /* ---------- 时间 ---------- */
  F.当前时间 = () => {
    const 现 = new Date();
    const 补 = (n) => String(n).padStart(2, "0");
    return `${现.getFullYear()}年${补(现.getMonth() + 1)}月${补(现.getDate())}日 ${补(现.getHours())}:${补(现.getMinutes())}:${补(现.getSeconds())}`;
  };

  /* ---------- 文本 ---------- */
  F.包含 = (p) => {
    const 文本 = p[0] === null ? "" : 格式化值(p[0]);
    const 片段 = p[1] === null ? "" : 格式化值(p[1]);
    return 文本.includes(片段);
  };
  F.替换 = (p) => {
    const 文本 = p[0] === null ? "" : 格式化值(p[0]);
    const 旧 = p[1] === null ? "" : 格式化值(p[1]);
    const 新 = p[2] === null ? "" : 格式化值(p[2]);
    return 文本.split(旧).join(新);
  };
  F.分割 = (p) => {
    const 文本 = p[0] === null ? "" : 格式化值(p[0]);
    const 分隔符 = p[1] === null || p[1] === undefined ? "" : 格式化值(p[1]);
    const 部分 = 文本.split(分隔符);
    return { __类型: "列表", 数据: 部分 };
  };
  F.重复 = (p) => {
    const 文本 = p[0] === null ? "" : 格式化值(p[0]);
    const n = Math.max(0, Math.floor(转数字(p[1] || 0)));
    return 文本.repeat(n);
  };
  F.范围 = (p) => {
    const 起点 = Math.floor(转数字(p[0] || 0));
    const 终点 = Math.floor(转数字(p[1] || 0));
    const 数据 = [];
    for (let i = 起点; i <= 终点; i++) 数据.push(i);
    return { __类型: "列表", 数据 };
  };

  /* ---------- 列表 ---------- */
  F.追加 = (p, 解释器) => {
    const 列表 = p[0];
    if (!列表 || 列表.__类型 !== "列表") 解释器.报错("「追加」的第一个参数必须是列表");
    列表.数据.push(p[1]);
    return 列表;
  };
  F.删除 = (p, 解释器) => {
    const 列表 = p[0];
    if (!列表 || 列表.__类型 !== "列表") 解释器.报错("「删除」的第一个参数必须是列表");
    const i = Math.floor(转数字(p[1]));
    if (i < 0 || i >= 列表.数据.length) 解释器.报错(`删除的索引 ${i} 超出范围`);
    列表.数据.splice(i, 1);
    return 列表;
  };
  F.排序 = (p) => {
    const 列表 = p[0];
    if (!列表 || 列表.__类型 !== "列表") return 列表;
    return { __类型: "列表", 数据: 列表.数据.slice().sort((a, b) => 转数字(a) - 转数字(b)) };
  };
  F.反转 = (p) => {
    const 列表 = p[0];
    if (!列表 || 列表.__类型 !== "列表") return 列表;
    return { __类型: "列表", 数据: 列表.数据.slice().reverse() };
  };

  /* ---------- 画布绘图 ---------- */
  F.画布 = (p, 解释器) => 运行时.画布(转数字(p[0] || 400), 转数字(p[1] || 300), 格式化值(p[2] || "画布"));
  F.清空画布 = () => 运行时.清空画布();
  F.填充色 = (p) => { 运行时.填充色(格式化值(p[0])); return null; };
  F.笔画色 = (p) => { 运行时.笔画色(格式化值(p[0])); return null; };
  F.画点 = (p) => { 运行时.画点(转数字(p[0]), 转数字(p[1]), 转数字(p[2] || 2)); return null; };
  F.画线 = (p) => { 运行时.画线(转数字(p[0]), 转数字(p[1]), 转数字(p[2]), 转数字(p[3])); return null; };
  F.画圆 = (p) => { 运行时.画圆(转数字(p[0]), 转数字(p[1]), 转数字(p[2] || 20)); return null; };
  F.画矩形 = (p) => { 运行时.画矩形(转数字(p[0]), 转数字(p[1]), 转数字(p[2]), 转数字(p[3])); return null; };
  F.画弧 = (p) => { 运行时.画弧(转数字(p[0]), 转数字(p[1]), 转数字(p[2]), 转数字(p[3]), 转数字(p[4]), 转数字(p[5])); return null; };
  F.写字 = (p) => { 运行时.写字(格式化值(p[0]), 转数字(p[1]), 转数字(p[2]), 转数字(p[3] || 14)); return null; };
  F.画多边形 = (p, 解释器) => {
    const 点 = p[0];
    if (!点 || 点.__类型 !== "列表") 解释器.报错("「画多边形」需要传入坐标点列表");
    const 坐标 = 点.数据.map(v => { if (v && v.__类型 === "列表") return [转数字(v.数据[0]), 转数字(v.数据[1])]; return [0, 0]; });
    运行时.画多边形(坐标);
    return null;
  };

  /* ---------- 文件（通过界面回调，存于浏览器本地） ---------- */
  F.读文件 = (p, 解释器) => {
    const 内容 = 运行时.读文件(格式化值(p[0]));
    if (内容 === null) 解释器.报错(`文件「${格式化值(p[0])}」不存在`);
    return 内容;
  };
  F.写文件 = (p) => { 运行时.写文件(格式化值(p[0]), 格式化值(p[1])); return null; };

  return F;
}
