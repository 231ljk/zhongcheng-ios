/* ============================================================
 * 中文程 · 标准库 (stdlib.js)
 * ------------------------------------------------------------
 * 全部为中文命名的内置函数：数学、文本、列表、字典、绘图、
 * 文件、时间等。所有函数由我们自己实现，宿主能力（画布、
 * 文件）通过 host 回调接入界面。
 *
 * 注意：F 上的键名（长度/类型/画点/系统/网络 等）是语言表面，
 * 用户直接书写，必须保持中文；内部实现变量一律英文。
 *
 * 函数约定：fn(参数数组, 解释器) → 返回值
 * ============================================================ */

function builtinTable(host) {
  const F = {};

  /* ---------- 类型与转换 ---------- */
  F.长度 = (p) => {
    const v = p[0];
    if (v && v.__type === "list") return v.data.length;
    if (v && v.__type === "dict") return Object.keys(v.data).length;
    if (typeof v === "string") return v.length;
    if (typeof v === "number") return String(v).length;
    if (v === null) return 0;
    return formatValue(v).length;
  };

  F.类型 = (p) => {
    const v = p[0];
    if (v === null) return "空";
    if (typeof v === "number") return "数字";
    if (typeof v === "string") return "文本";
    if (typeof v === "boolean") return "逻辑";
    if (v.__type === "list") return "列表";
    if (v.__type === "dict") return "字典";
    if (v.__type === "func") return "函数";
    if (v.__type === "class") return "类";
    if (v.__type === "instance") return v.cls.name;
    if (v.__type === "device") return "设备";
    return "未知";
  };

  F.转文本 = (p) => formatValue(p[0]);
  F.转数字 = (p) => {
    const n = parseFloat(formatValue(p[0]));
    return isNaN(n) ? 0 : n;
  };

  /* ---------- 数学 ---------- */
  F.取整 = (p) => Math.floor(toNum(p[0]));
  F.四舍五入 = (p) => Math.round(toNum(p[0]));

  /* 匹配(正则模式, 文本)：按正则找出所有匹配，返回列表（爬虫/文本提取用，对标 Python re）
   * 用了分组 (…) 就返回每组第一个捕获，否则返回整段匹配 */
  F.匹配 = (p, i, interp) => {
    const pat = formatValue(p[0] === null || p[0] === undefined ? "" : p[0]);
    const txt = formatValue(p[1] === null || p[1] === undefined ? "" : p[1]);
    let re;
    try { re = new RegExp(pat, "g"); }
    catch (e) { interp.fail("「匹配」的正则写法有误：" + (e && e.message)); return []; }
    const out = [];
    let m;
    while ((m = re.exec(txt)) !== null) {
      out.push(m.length > 1 && m[1] !== undefined ? m[1] : m[0]);
      if (m.index === re.lastIndex) re.lastIndex++;
      if (out.length >= 1000) break;
    }
    return { __type: "list", data: out };
  };
  F.整除 = (p, interp) => {
    const b = toNum(p[1]);
    if (b === 0) interp.fail("整除时除数不能为零");
    return Math.trunc(toNum(p[0]) / b);
  };
  F.绝对值 = (p) => Math.abs(toNum(p[0]));
  F.平方根 = (p) => Math.sqrt(toNum(p[0]));
  F.幂 = (p) => Math.pow(toNum(p[0]), toNum(p[1] || 1));
  F.正弦 = (p) => Math.sin(toNum(p[0]));
  F.余弦 = (p) => Math.cos(toNum(p[0]));
  F.正切 = (p) => Math.tan(toNum(p[0]));
  F.对数 = (p) => Math.log(toNum(p[0]));   // 自然对数 ln
  F.指数 = (p) => Math.exp(toNum(p[0]));   // e 的 x 次方
  F.圆周率 = () => Math.PI;
  F.随机数 = (p) => {
    const lo = toNum(p[0] || 0), hi = toNum(p[1] || 0);
    if (lo > hi) return lo;
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  };
  F.最大 = (p) => {
    if (p.length === 1 && p[0] && p[0].__type === "list") {
      if (!p[0].data.length) return 0;
      return Math.max(...p[0].data.map(toNum));
    }
    if (!p.length) return 0;
    return Math.max(...p.map(toNum));
  };
  F.最小 = (p) => {
    if (p.length === 1 && p[0] && p[0].__type === "list") {
      if (!p[0].data.length) return 0;
      return Math.min(...p[0].data.map(toNum));
    }
    if (!p.length) return 0;
    return Math.min(...p.map(toNum));
  };

  /* ---------- 环境 ---------- */
  F.当前目录 = () => (host.currentDir ? host.currentDir() : "");

  /* ---------- 时间 ---------- */
  F.当前时间 = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  F.时间戳 = () => Date.now();   // 毫秒，可用于计时

  /* ---------- 文本 ---------- */
  F.包含 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const part = p[1] === null ? "" : formatValue(p[1]);
    return text.includes(part);
  };
  F.替换 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const oldStr = p[1] === null ? "" : formatValue(p[1]);
    const newStr = p[2] === null ? "" : formatValue(p[2]);
    return text.split(oldStr).join(newStr);
  };
  F.分割 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const sep = p[1] === null || p[1] === undefined ? "" : formatValue(p[1]);
    const parts = text.split(sep);
    return { __type: "list", data: parts };
  };
  F.重复 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const n = Math.max(0, Math.floor(toNum(p[1] || 0)));
    return text.repeat(n);
  };
  F.范围 = (p) => {
    const start = Math.floor(toNum(p[0] || 0));
    const end = Math.floor(toNum(p[1] || 0));
    const data = [];
    for (let i = start; i <= end; i++) data.push(i);
    return { __type: "list", data };
  };
  F.找位置 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const part = p[1] === null ? "" : formatValue(p[1]);
    return text.indexOf(part);
  };
  F.截取 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    return text.slice(Math.floor(toNum(p[1] || 0)), Math.floor(toNum(p[2] === undefined || p[2] === null ? text.length : p[2])));
  };
  F.去空格 = (p) => (p[0] === null ? "" : formatValue(p[0])).trim();
  F.大写 = (p) => (p[0] === null ? "" : formatValue(p[0])).toUpperCase();
  F.小写 = (p) => (p[0] === null ? "" : formatValue(p[0])).toLowerCase();

  /* ---------- 列表 ---------- */
  F.追加 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「追加」的第一个参数必须是列表");
    list.data.push(p[1]);
    return list;
  };
  F.删除 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「删除」的第一个参数必须是列表");
    const i = Math.floor(toNum(p[1]));
    if (i < 0 || i >= list.data.length) interp.fail(`删除的索引 ${i} 超出范围`);
    list.data.splice(i, 1);
    return list;
  };
  F.排序 = (p) => {
    const list = p[0];
    if (!list || list.__type !== "list") return list;
    return { __type: "list", data: list.data.slice().sort((a, b) => toNum(a) - toNum(b)) };
  };
  F.反转 = (p) => {
    const list = p[0];
    if (!list || list.__type !== "list") return list;
    return { __type: "list", data: list.data.slice().reverse() };
  };

  /* 列表参数：传一个列表就展开，否则把所有参数当列表元素（求和(列表) / 求和(1,2,3) 都行） */
  function numItems(p) {
    if (p.length === 1 && p[0] && p[0].__type === "list") return p[0].data.map(toNum);
    return p.map(toNum);
  }
  /* 值是否相等（数字按数字比，其余按文本比） */
  function sameValue(a, b) {
    if (a === b) return true;
    if ((typeof a === "number" || typeof b === "number") && toNum(a) === toNum(b)) return true;
    return formatValue(a) === formatValue(b);
  }
  F.求和 = (p) => numItems(p).reduce((s, n) => s + n, 0);
  F.平均 = (p) => {
    const nums = numItems(p);
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
  };
  F.计数 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「计数」的第一个参数必须是列表");
    return list.data.reduce((c, v) => c + (sameValue(v, p[1]) ? 1 : 0), 0);
  };
  F.位置 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「位置」的第一个参数必须是列表");
    for (let i = 0; i < list.data.length; i++) if (sameValue(list.data[i], p[1])) return i;
    return -1;
  };
  F.切片 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「切片」的第一个参数必须是列表");
    const end = p[2] === undefined || p[2] === null ? list.data.length : Math.floor(toNum(p[2]));
    return { __type: "list", data: list.data.slice(Math.floor(toNum(p[1] || 0)), end) };
  };
  F.键列表 = (p, interp) => {
    const dict = p[0];
    if (!dict || dict.__type !== "dict") interp.fail("「键列表」的参数必须是字典");
    return { __type: "list", data: Object.keys(dict.data) };
  };
  F.值列表 = (p, interp) => {
    const dict = p[0];
    if (!dict || dict.__type !== "dict") interp.fail("「值列表」的参数必须是字典");
    return { __type: "list", data: Object.values(dict.data) };
  };

  /* ---------- JSON（联网 API / IoT 数据必备） ---------- */
  function fromJson(v) {
    if (Array.isArray(v)) return { __type: "list", data: v.map(fromJson) };
    if (v !== null && typeof v === "object") {
      const data = {};
      for (const k in v) data[k] = fromJson(v[k]);
      return { __type: "dict", data };
    }
    return v;
  }
  function toJson(v) {
    if (v && v.__type === "list") return v.data.map(toJson);
    if (v && v.__type === "dict") {
      const o = {};
      for (const k in v.data) o[k] = toJson(v.data[k]);
      return o;
    }
    return v;
  }
  F.解析Json = (p, interp) => {
    try { return fromJson(JSON.parse(formatValue(p[0]))); }
    catch (e) { interp.fail("JSON 解析失败：" + (e && e.message ? e.message : e)); }
  };
  F.生成Json = (p) => JSON.stringify(toJson(p[0]));

  /* ---------- 交互 ---------- */
  F.验证 = (p, interp) => {
    /* 程序自我检验：验证(条件) 或 验证("描述", 条件)，不成立就中文报错 */
    const cond = p.length > 1 ? p[1] : p[0];
    const desc = p.length > 1 ? formatValue(p[0]) : "";
    const ok = cond === true || (typeof cond === "number" && cond !== 0) || (typeof cond === "string" && cond.length > 0);
    if (!ok) interp.fail("验证失败" + (desc ? "：" + desc : ""));
    return null;
  };
  F.选择按钮 = async (p, interp) => {
    const labels = p[0];
    if (!labels || labels.__type !== "list" || !labels.data.length) interp.fail("「选择按钮」需要一个非空的文字列表");
    if (!host.chooseButtons) interp.fail("当前环境不支持「选择按钮」（请在 VSCode 扩展中使用）");
    const text = await host.chooseButtons(labels.data.map(formatValue));
    return text === null || text === undefined ? "" : text;
  };

  /* ---------- 画布绘图 ---------- */
  F.画布 = (p) => host.canvas(toNum(p[0] || 400), toNum(p[1] || 300), formatValue(p[2] || "画布"));
  F.清空画布 = () => host.clearCanvas();
  F.填充色 = (p) => { host.fillColor(formatValue(p[0])); return null; };
  F.笔画色 = (p) => { host.strokeColor(formatValue(p[0])); return null; };
  F.画点 = (p) => { host.drawPoint(toNum(p[0]), toNum(p[1]), toNum(p[2] || 2)); return null; };
  F.画线 = (p) => { host.drawLine(toNum(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3])); return null; };
  F.画圆 = (p) => { host.drawCircle(toNum(p[0]), toNum(p[1]), toNum(p[2] || 20)); return null; };
  F.画矩形 = (p) => { host.drawRect(toNum(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3])); return null; };
  F.画弧 = (p) => { host.drawArc(toNum(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3]), toNum(p[4]), toNum(p[5])); return null; };
  F.写字 = (p) => { host.drawText(formatValue(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3] || 14)); return null; };
  F.画多边形 = (p, interp) => {
    const points = p[0];
    if (!points || points.__type !== "list") interp.fail("「画多边形」需要传入坐标点列表");
    const coords = points.data.map(v => { if (v && v.__type === "list") return [toNum(v.data[0]), toNum(v.data[1])]; return [0, 0]; });
    host.drawPolygon(coords);
    return null;
  };

  /* ---------- 文件（通过界面回调，存于宿主本地） ---------- */
  F.读文件 = (p, interp) => {
    const content = host.readFile(formatValue(p[0]));
    if (content === null) interp.fail(`文件「${formatValue(p[0])}」不存在`);
    return content;
  };
  F.写文件 = (p) => { host.writeFile(formatValue(p[0]), formatValue(p[1])); return null; };

  /* ---------- AI 模块（纯内核实现，无需任何依赖，三端可用） ---------- */
  function asNumList(p, i, interp, name) {
    const v = p[i];
    if (!v || v.__type !== "list") interp.fail(`「${name}」第 ${i + 1} 个参数必须是列表`);
    return v.data.map(toNum);
  }

  /* 欧氏距离：两点的直线距离，是最近邻/聚类的基础 */
  F.欧氏距离 = (p, interp) => {
    const a = asNumList(p, 0, interp, "欧氏距离");
    const b = asNumList(p, 1, interp, "欧氏距离");
    let s = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
    return Math.sqrt(s);
  };

  /* 线性回归：从一堆 (x,y) 数据里找出最合适的直线 y = 斜率×x + 截距 */
  F.线性回归 = (p, interp) => {
    const x = asNumList(p, 0, interp, "线性回归");
    const y = asNumList(p, 1, interp, "线性回归");
    if (x.length === 0 || x.length !== y.length) interp.fail("「线性回归」需要两个等长且非空的列表");
    const n = x.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    const mx = sx / n, my = sy / n;
    let numerator = 0, denominator = 0;
    for (let i = 0; i < n; i++) { numerator += (x[i] - mx) * (y[i] - my); denominator += (x[i] - mx) * (x[i] - mx); }
    const slope = denominator === 0 ? 0 : numerator / denominator;
    return { __type: "dict", data: { "斜率": slope, "截距": my - slope * mx } };
  };

  /* 预测：用线性回归得到的模型算新输入 */
  F.预测 = (p, interp) => {
    const m = p[0];
    if (!m || m.__type !== "dict" || !("斜率" in m.data)) interp.fail("「预测」需要一个由「线性回归」生成的模型");
    return m.data["斜率"] * toNum(p[1]) + m.data["截距"];
  };

  /* 最近邻分类：看新数据点周围 k 个邻居大多是哪一类 */
  F.最近邻 = (p, interp) => {
    const samples = p[0], labels = p[1], target = p[2];
    if (!samples || samples.__type !== "list" || !labels || labels.__type !== "list" || !target || target.__type !== "list")
      interp.fail("「最近邻」需要：样本列表、标签列表、目标点（都是列表）");
    if (samples.data.length === 0 || samples.data.length !== labels.data.length)
      interp.fail("「最近邻」的样本与标签数量必须一致且非空");
    const k = Math.max(1, Math.floor(toNum(p[3] === undefined || p[3] === null ? 1 : p[3])));
    const targetPoint = target.data.map(toNum);
    const distances = samples.data.map((s, i) => {
      const point = (s && s.__type === "list") ? s.data.map(toNum) : [toNum(s)];
      let d = 0;
      const n = Math.min(point.length, targetPoint.length);
      for (let j = 0; j < n; j++) d += (point[j] - targetPoint[j]) * (point[j] - targetPoint[j]);
      return { d: Math.sqrt(d), label: labels.data[i] };
    });
    distances.sort((a, b) => a.d - b.d);
    const topK = distances.slice(0, Math.min(k, distances.length));
    const counts = new Map();
    for (const it of topK) counts.set(String(it.label), (counts.get(String(it.label)) || 0) + 1);
    let bestLabel = null, bestCount = -1;
    for (const [label, c] of counts) if (c > bestCount) { bestCount = c; bestLabel = label; }
    const origin = topK.find(it => String(it.label) === bestLabel);
    return origin ? origin.label : bestLabel;
  };

  /* 聚类（K均值）：自动把数据分成 k 堆，返回 k 个列表 */
  F.聚类 = (p, interp) => {
    const dataset = p[0];
    if (!dataset || dataset.__type !== "list" || dataset.data.length === 0) interp.fail("「聚类」第一个参数必须是非空列表");
    const k = Math.max(1, Math.min(Math.floor(toNum(p[1] === undefined || p[1] === null ? 2 : p[1])), dataset.data.length));
    const rounds = Math.max(1, Math.floor(toNum(p[2] === undefined || p[2] === null ? 30 : p[2])));
    const points = dataset.data.map(s => (s && s.__type === "list") ? s.data.map(toNum) : [toNum(s)]);
    const dim = points[0].length;
    const centers = [];
    for (let c = 0; c < k; c++) centers.push(points[Math.floor(c * points.length / k)].slice());
    const dist2 = (a, b) => { let s = 0; for (let j = 0; j < dim; j++) s += (a[j] - b[j]) * (a[j] - b[j]); return s; };
    let groups = points.map(() => 0);
    for (let round = 0; round < rounds; round++) {
      let changed = false;
      for (let i = 0; i < points.length; i++) {
        let bestC = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) { const d = dist2(points[i], centers[c]); if (d < bestD) { bestD = d; bestC = c; } }
        if (groups[i] !== bestC) { groups[i] = bestC; changed = true; }
      }
      const sums = centers.map(() => new Array(dim).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < points.length; i++) {
        counts[groups[i]]++;
        for (let j = 0; j < dim; j++) sums[groups[i]][j] += points[i][j];
      }
      for (let c = 0; c < k; c++) if (counts[c] > 0) for (let j = 0; j < dim; j++) centers[c][j] = sums[c][j] / counts[c];
      if (!changed) break;
    }
    const result = centers.map(() => ({ __type: "list", data: [] }));
    for (let i = 0; i < points.length; i++) result[groups[i]].data.push(dataset.data[i]);
    return { __type: "list", data: result };
  };

  /* 迷你神经网络：建网络([2,4,1]) → 训练网络(网络, 输入们, 目标们, 轮数, 学习率) → 网络预测(网络, 输入) */
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const pseudoRandom = (i, j) => { const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return (v - Math.floor(v)) - 0.5; };

  F.建网络 = (p, interp) => {
    const layersArg = p[0];
    if (!layersArg || layersArg.__type !== "list" || layersArg.data.length < 2) interp.fail("「建网络」需要层结构列表，例如 建网络([2, 4, 1])");
    const layers = layersArg.data.map(toNum).map(Math.floor);
    if (layers.some(n => n < 1)) interp.fail("「建网络」每层神经元数量必须不小于 1");
    const weights = [], biases = [];
    for (let l = 1; l < layers.length; l++) {
      const w = [], b = [];
      for (let j = 0; j < layers[l]; j++) {
        const row = [];
        for (let i = 0; i < layers[l - 1]; i++) row.push(pseudoRandom(l * 100 + j, i));
        w.push(row);
        b.push(pseudoRandom(l * 100 + j, 99));
      }
      weights.push(w); biases.push(b);
    }
    return { __type: "dict", data: { "__net": true, "layers": layers.slice(), "weights": weights, "biases": biases } };
  };

  F.训练网络 = (p, interp) => {
    const net = p[0];
    if (!net || net.__type !== "dict" || net.data["__net"] !== true) interp.fail("「训练网络」第一个参数必须是「建网络」生成的网络");
    const inputs = p[1], targets = p[2];
    if (!inputs || inputs.__type !== "list" || !targets || targets.__type !== "list") interp.fail("「训练网络」需要输入列表和目标列表");
    if (inputs.data.length === 0 || inputs.data.length !== targets.data.length) interp.fail("「训练网络」的输入与目标数量必须一致且非空");
    const epochs = Math.max(1, Math.floor(toNum(p[3] === undefined || p[3] === null ? 100 : p[3])));
    const lr = toNum(p[4] === undefined || p[4] === null ? 0.5 : p[4]);
    const W = net.data["weights"], B = net.data["biases"];
    const layerCount = W.length;
    const n = inputs.data.length;
    const expandInput = (v) => (v && v.__type === "list") ? v.data.map(toNum) : [toNum(v)];
    const forward = (input) => {
      const activations = [expandInput(input)];
      for (let l = 0; l < layerCount; l++) {
        const prev = activations[l];
        const next = [];
        for (let j = 0; j < W[l].length; j++) {
          let s = B[l][j];
          for (let i = 0; i < prev.length; i++) s += W[l][j][i] * prev[i];
          next.push(sigmoid(s));
        }
        activations.push(next);
      }
      return activations;
    };
    let totalError = 0;
    for (let epoch = 0; epoch < epochs; epoch++) {
      totalError = 0;
      const gW = W.map(w => w.map(r => r.map(() => 0)));
      const gB = B.map(b => b.map(() => 0));
      for (let s = 0; s < n; s++) {
        const activations = forward(inputs.data[s]);
        const expected = expandInput(targets.data[s]);
        const outputLayer = activations[layerCount];
        let delta = new Array(outputLayer.length);
        for (let j = 0; j < outputLayer.length; j++) {
          const e = outputLayer[j] - (expected[j] !== undefined ? expected[j] : 0);
          totalError += e * e;
          delta[j] = e * outputLayer[j] * (1 - outputLayer[j]);
        }
        for (let l = layerCount - 1; l >= 0; l--) {
          const prev = activations[l];
          const newDelta = l > 0 ? new Array(activations[l].length).fill(0) : null;
          for (let j = 0; j < W[l].length; j++) {
            gB[l][j] += delta[j];
            for (let i = 0; i < prev.length; i++) {
              gW[l][j][i] += delta[j] * prev[i];
              if (newDelta) newDelta[i] += W[l][j][i] * delta[j];
            }
          }
          if (newDelta) for (let i = 0; i < newDelta.length; i++) newDelta[i] *= prev[i] * (1 - prev[i]);
          delta = newDelta;
        }
      }
      for (let l = 0; l < layerCount; l++) {
        for (let j = 0; j < W[l].length; j++) {
          B[l][j] -= lr * gB[l][j] / n;
          for (let i = 0; i < W[l][j].length; i++) W[l][j][i] -= lr * gW[l][j][i] / n;
        }
      }
    }
    return totalError / n;
  };

  F.网络预测 = (p, interp) => {
    const net = p[0];
    if (!net || net.__type !== "dict" || net.data["__net"] !== true) interp.fail("「网络预测」第一个参数必须是「建网络」生成的网络");
    const W = net.data["weights"], B = net.data["biases"];
    let a = (p[1] && p[1].__type === "list") ? p[1].data.map(toNum) : [toNum(p[1])];
    for (let l = 0; l < W.length; l++) {
      const next = [];
      for (let j = 0; j < W[l].length; j++) {
        let s = B[l][j];
        for (let i = 0; i < a.length; i++) s += W[l][j][i] * a[i];
        next.push(sigmoid(s));
      }
      a = next;
    }
    return { __type: "list", data: a };
  };

  /* ---------- 系统模块（宿主能力：VSCode/桌面环境可用，网页沙箱不支持） ---------- */
  const needHost = (interp, name) => interp.fail(`当前环境不支持「${name}」（请在 VSCode 扩展中使用）`);

  /* 弹窗：弹出一个系统提示框（平级函数，方便入门） */
  F.弹窗 = (p, interp) => {
    if (!host.showPopup) needHost(interp, "弹窗");
    host.showPopup(formatValue(p[0]));
    return null;
  };

  F.系统 = {
    __type: "dict",
    data: {
      执行: (p, interp) => {
        if (!host.execCommand) needHost(interp, "系统.执行");
        try { return host.execCommand(formatValue(p[0])); }
        catch (e) { interp.fail("命令执行失败：" + (e && e.message ? e.message : e)); }
      },
      环境变量: (p) => (host.getEnv ? host.getEnv(formatValue(p[0])) : ""),
      目录: () => (host.currentDir ? host.currentDir() : ""),
      弹窗: (p) => { if (host.showPopup) host.showPopup(formatValue(p[0])); return null; },
      打开: (p) => { if (host.openExternal) host.openExternal(formatValue(p[0])); return null; },
    },
  };

  /* ---------- 网络模块（宿主能力：联网请求） ---------- */
  F.网络 = {
    __type: "dict",
    data: {
      请求: async (p, interp) => {
        if (!host.httpGet) needHost(interp, "网络.请求");
        return await host.httpGet(formatValue(p[0]));
      },
      提交: async (p, interp) => {
        if (!host.httpPost) needHost(interp, "网络.提交");
        return await host.httpPost(formatValue(p[0]), p[1] === null || p[1] === undefined ? "" : formatValue(p[1]));
      },
    },
  };

  /* ---------- IoT 设备模块（宿主能力：TCP 直连 + MQTT 消息订阅） ----------
   * 连接句柄是不透明的设备对象（__type:"device"），由宿主创建与管理。
   * MQTT订阅 接收一个中文程函数作为回调：函数(主题, 消息)，
   * 订阅后程序进入"事件模式"，直到调用 MQTT关闭 或按停止。 */
  function asDevice(p, i, interp, name) {
    const h = p[i];
    if (!h || h.__type !== "device") interp.fail(`「${name}」第 ${i + 1} 个参数必须是设备连接（先用 设备.连接TCP 或 设备.MQTT连接）`);
    return h;
  }

  F.设备 = {
    __type: "dict",
    data: {
      连接TCP: async (p, interp) => {
        if (!host.tcpConnect) needHost(interp, "设备.连接TCP");
        try { return await host.tcpConnect(formatValue(p[0]), toNum(p[1])); }
        catch (e) { interp.fail("TCP 连接失败：" + (e && e.message ? e.message : e)); }
      },
      发送: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.发送");
        try { host.tcpSend(h, formatValue(p[1])); return null; }
        catch (e) { interp.fail("发送失败：" + (e && e.message ? e.message : e)); }
      },
      接收: async (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.接收");
        try { return await host.tcpRecv(h); }
        catch (e) { interp.fail("接收失败：" + (e && e.message ? e.message : e)); }
      },
      关闭: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.关闭");
        try { host.devClose(h); } catch (e) {}
        return null;
      },
      MQTT连接: async (p, interp) => {
        if (!host.mqttConnect) needHost(interp, "设备.MQTT连接");
        try {
          return await host.mqttConnect(
            formatValue(p[0]), toNum(p[1] || 1883),
            p[2] === null || p[2] === undefined ? "" : formatValue(p[2]),
            p[3] === null || p[3] === undefined ? "" : formatValue(p[3])
          );
        } catch (e) { interp.fail("MQTT 连接失败：" + (e && e.message ? e.message : e)); }
      },
      MQTT发布: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.MQTT发布");
        try { host.mqttPublish(h, formatValue(p[1]), formatValue(p[2])); return null; }
        catch (e) { interp.fail("MQTT 发布失败：" + (e && e.message ? e.message : e)); }
      },
      MQTT订阅: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.MQTT订阅");
        const cb = p[2];
        if ((!cb || cb.__type !== "func") && typeof cb !== "function") interp.fail("「设备.MQTT订阅」第三个参数必须是回调函数：函数(主题, 消息)");
        try {
          host.mqttSubscribe(h, formatValue(p[1]), async (topic, message) => {
            try { await interp.invokeUserFn(cb, [topic, message]); }
            catch (e) { interp.fail("MQTT 回调执行出错：" + (e && e.message ? e.message : e)); }
          });
        } catch (e) { interp.fail("MQTT 订阅失败：" + (e && e.message ? e.message : e)); }
        return null;
      },
      MQTT关闭: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.MQTT关闭");
        try { host.mqttClose(h); } catch (e) {}
        return null;
      },
    },
  };

  /* ---------- 家居模块（Home Assistant 直连：长期令牌 + REST API） ----------
   * 一行连上家里的 HA：设 家 = 家居.连接HA("http://homeassistant.local:8123", "长期令牌")
   * 之后即可 家居.状态/数值/实体列表 查询，家居.打开/关闭/切换/开灯/关灯/调亮度/服务 控制。
   * 连接句柄同样是设备对象（__type:"device", kind:"ha"），走宿主 httpGet/httpPost（可带请求头）。 */
  function haHandle(p, i, interp, name) {
    const h = p[i];
    if (!h || h.__type !== "device" || h.kind !== "ha") interp.fail(`「${name}」第 ${i + 1} 个参数必须是家居连接（先用 家居.连接HA）`);
    return h;
  }
  async function haGet(interp, h, apiPath) {
    if (!host.httpGet) needHost(interp, "家居");
    const text = await host.httpGet(h.url + apiPath, { "Authorization": "Bearer " + h.token });
    try { return fromJson(JSON.parse(text)); }
    catch (e) { interp.fail("家居接口返回的数据无法解析（" + apiPath + "），请检查网址与令牌"); }
  }
  async function haPost(interp, h, apiPath, body) {
    if (!host.httpPost) needHost(interp, "家居");
    const text = await host.httpPost(h.url + apiPath, JSON.stringify(body || {}), {
      "Authorization": "Bearer " + h.token, "Content-Type": "application/json",
    });
    try { return fromJson(JSON.parse(text)); }
    catch (e) { interp.fail("家居接口返回的数据无法解析（" + apiPath + "），请检查网址与令牌"); }
  }
  async function haCallService(p, interp, domain, service) {
    const h = haHandle(p, 0, interp, "家居." + service);
    const body = {};
    if (p[1] !== undefined && p[1] !== null && formatValue(p[1]) !== "") body.entity_id = formatValue(p[1]);
    await haPost(interp, h, "/api/services/" + domain + "/" + service, body);
    return null;
  }

  F.家居 = {
    __type: "dict",
    data: {
      /* 连接HA(网址, 长期令牌)：令牌在 HA 网页「个人资料 → 长期访问令牌」创建 */
      连接HA: (p, interp) => {
        const url = formatValue(p[0]).replace(/\/+$/, "");
        const token = formatValue(p[1]);
        if (!url) interp.fail("「家居.连接HA」需要 Home Assistant 网址，例如 http://homeassistant.local:8123");
        if (!token) interp.fail("「家居.连接HA」需要长期访问令牌（在 HA 网页个人资料页最下方创建）");
        return { __type: "device", kind: "ha", url, token };
      },
      /* 状态(连接, 实体)：返回完整状态字典（含 state、attributes 等） */
      状态: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.状态");
        return await haGet(interp, h, "/api/states/" + formatValue(p[1]));
      },
      /* 数值(连接, 实体)：只取状态值并转成数字，例如温度传感器读数 */
      数值: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.数值");
        const st = await haGet(interp, h, "/api/states/" + formatValue(p[1]));
        return toNum(st && st.__type === "dict" ? st.data.state : 0);
      },
      /* 实体列表(连接)：家里全部实体（灯、开关、传感器……） */
      实体列表: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.实体列表");
        return await haGet(interp, h, "/api/states");
      },
      /* 服务(连接, 域, 服务, 实体?)：万能入口，可调用 HA 任意服务 */
      服务: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.服务");
        const body = {};
        if (p[3] !== undefined && p[3] !== null && formatValue(p[3]) !== "") body.entity_id = formatValue(p[3]);
        await haPost(interp, h, "/api/services/" + formatValue(p[1]) + "/" + formatValue(p[2]), body);
        return null;
      },
      /* 常用开关封装：打开/关闭/切换 任意实体；开灯/关灯/调亮度 专用于灯 */
      打开: (p, interp) => haCallService(p, interp, "homeassistant", "turn_on"),
      关闭: (p, interp) => haCallService(p, interp, "homeassistant", "turn_off"),
      切换: (p, interp) => haCallService(p, interp, "homeassistant", "toggle"),
      开灯: (p, interp) => haCallService(p, interp, "light", "turn_on"),
      关灯: (p, interp) => haCallService(p, interp, "light", "turn_off"),
      调亮度: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.调亮度");
        const brightness = Math.max(0, Math.min(255, Math.floor(toNum(p[2]))));
        await haPost(interp, h, "/api/services/light/turn_on", { entity_id: formatValue(p[1]), brightness });
        return null;
      },
    },
  };

  /* ---------- 服务模块（自写系统：HTTP 服务端） ----------
   * 用中文程自己开发智能家居中控 / Web 接口 / 设备网关：
   *   设 服 = 服务.开启(8080)
   *   服务.当请求(服, 函数(方式, 路径, 内容) 返回 "<h1>你好</h1>")
   * 浏览器/手机/厂商云平台访问 http://设备IP:8080 即可到达你的函数，
   * 函数返回的文本就是响应内容（网页/JSON 都行）。 */
  function svHandle(p, i, interp, name) {
    const h = p[i];
    if (!h || h.__type !== "device" || h.kind !== "server") interp.fail(`「${name}」第 ${i + 1} 个参数必须是服务句柄（先用 服务.开启）`);
    return h;
  }
  F.服务 = {
    __type: "dict",
    data: {
      /* 开启(端口, 处理函数?)：启动 HTTP 服务；可选直接给处理函数 */
      开启: async (p, interp) => {
        if (!host.httpServerStart) needHost(interp, "服务");
        const port = Math.floor(toNum(p[0] || 8080));
        const h = await host.httpServerStart(port);
        if (p[1] !== undefined && p[1] !== null) F.服务.data.当请求(p, interp);
        return h;
      },
      /* 当请求(服, 函数(方式, 路径, 内容))：函数返回的文本 = 响应内容 */
      当请求: (p, interp) => {
        if (!host.httpServerOn) needHost(interp, "服务");
        const h = svHandle(p, 0, interp, "服务.当请求");
        const fn = p[1];
        if (!fn || (fn.__type !== "func" && typeof fn !== "function")) interp.fail("「服务.当请求」的第二个参数必须是函数，例如 函数(方式, 路径, 内容)");
        host.httpServerOn(h, async (method, pathName, body) => {
          const result = await interp.invokeUserFn(fn, [method, pathName, body]);
          return formatValue(result);
        });
        return null;
      },
      /* 关闭(服)：停止服务并释放端口 */
      关闭: (p, interp) => {
        if (!host.httpServerClose) needHost(interp, "服务");
        const h = svHandle(p, 0, interp, "服务.关闭");
        host.httpServerClose(h);
        return null;
      },
    },
  };

  /* ---------- 电话 / 短信模块（像系统自带功能一样直接用） ----------
   * 手机上（打包的应用）通过手机自带的电话与短信能力真实拨打/发送，零配置；
   * 电脑上运行时自动模拟（输出提示），方便测试。
   *   电话.拨打("10086")
   *   电话.挂断()
   *   短信.发送("13800138000", "您的验证码是 123456") */
  F.电话 = {
    __type: "dict",
    data: {
      /* 拨打(号码)：手机上真实拨出；电脑上模拟通话 */
      拨打: async (p, interp) => {
        if (p[0] === null || p[0] === undefined) interp.fail("「电话.拨打」需要电话号码，例如 电话.拨打(\"10086\")");
        const num = formatValue(p[0]).trim();
        if (!num) interp.fail("「电话.拨打」的电话号码不能为空");
        if (!host.phoneDial) needHost(interp, "电话.拨打");
        return await host.phoneDial(num);
      },
      /* 挂断()：结束当前通话 */
      挂断: async (p, interp) => {
        if (!host.phoneHangup) needHost(interp, "电话.挂断");
        return await host.phoneHangup();
      },
    },
  };
  F.短信 = {
    __type: "dict",
    data: {
      /* 发送(号码, 内容)：手机上通过自带短信真实发送；电脑上模拟 */
      发送: async (p, interp) => {
        if (p[0] === null || p[0] === undefined) interp.fail("「短信.发送」需要收件人号码，例如 短信.发送(\"10086\", \"查话费\")");
        if (p[1] === null || p[1] === undefined) interp.fail("「短信.发送」需要短信内容（第二个参数），例如 短信.发送(\"10086\", \"查话费\")");
        const num = formatValue(p[0]).trim();
        const text = formatValue(p[1]);
        if (!num) interp.fail("「短信.发送」的收件人号码不能为空");
        if (!text) interp.fail("「短信.发送」的短信内容不能为空");
        if (!host.smsSend) needHost(interp, "短信.发送");
        return await host.smsSend(num, text);
      },
    },
  };

  /* ---------- 视频 / 音乐模块（系统自带的影音能力） ----------
   * 打包的网页/手机应用内嵌真实播放器；电脑上在浏览器打开播放。
   *   视频.播放("https://example.com/demo.mp4")
   *   视频.关闭()
   *   音乐.播放("https://example.com/demo.mp3")
   *   音乐.停止() */
  F.视频 = {
    __type: "dict",
    data: {
      播放: async (p, interp) => {
        if (p[0] === null || p[0] === undefined) interp.fail("「视频.播放」需要视频网址，例如 视频.播放(\"https://网站/视频.mp4\")");
        const url = formatValue(p[0]).trim();
        if (!url) interp.fail("「视频.播放」的视频网址不能为空");
        if (!host.videoPlay) needHost(interp, "视频.播放");
        return await host.videoPlay(url);
      },
      关闭: async (p, interp) => {
        if (!host.videoClose) needHost(interp, "视频.关闭");
        return await host.videoClose();
      },
    },
  };
  F.音乐 = {
    __type: "dict",
    data: {
      播放: async (p, interp) => {
        if (p[0] === null || p[0] === undefined) interp.fail("「音乐.播放」需要音乐网址，例如 音乐.播放(\"https://网站/歌曲.mp3\")");
        const url = formatValue(p[0]).trim();
        if (!url) interp.fail("「音乐.播放」的音乐网址不能为空");
        if (!host.audioPlay) needHost(interp, "音乐.播放");
        return await host.audioPlay(url);
      },
      停止: async (p, interp) => {
        if (!host.audioStop) needHost(interp, "音乐.停止");
        return await host.audioStop();
      },
    },
  };

  /* ---------- 界面模块（原生界面框架，不依赖浏览器、不是画布） ----------
   * 这是写"真系统"界面的官方路径：打包后用原生控件渲染
   * （安卓原生按钮/输入框/文字；网页打包用系统控件；未来裸机系统同 API 帧缓冲绘制）。
   *   界面.窗口("我的系统")
   *   界面.文字("欢迎")
   *   界面.按钮("开灯", 函数() { 家居.开灯(家, "light.keting") })
   *   界面.输入框("你的名字", 函数(名字) { 界面.文字("你好，" 加 名字) }) */
  F.界面 = {
    __type: "dict",
    data: {
      /* 窗口(标题?)：创建界面 */
      窗口: async (p, interp) => {
        if (!host.uiCreate) needHost(interp, "界面");
        const title = p[0] === null || p[0] === undefined ? "我的应用" : formatValue(p[0]);
        return await host.uiCreate(title);
      },
      /* 标题(文字)：设置界面顶部标题 */
      标题: async (p, interp) => {
        if (!host.uiTitle) needHost(interp, "界面.标题");
        return await host.uiTitle(formatValue(p[0] === null || p[0] === undefined ? "" : p[0]));
      },
      /* 文字(内容)：界面上加一行文字 */
      文字: async (p, interp) => {
        if (!host.uiText) needHost(interp, "界面.文字");
        return await host.uiText(formatValue(p[0] === null || p[0] === undefined ? "" : p[0]));
      },
      /* 按钮(文字, 函数)：加一个按钮，点击时执行函数 */
      按钮: async (p, interp) => {
        if (!host.uiButton) needHost(interp, "界面.按钮");
        const fn = p[1];
        if (!fn || (fn.__type !== "func" && typeof fn !== "function")) interp.fail("「界面.按钮」的第二个参数必须是函数，例如 函数() { … }");
        const label = formatValue(p[0] === null || p[0] === undefined ? "按钮" : p[0]);
        return await host.uiButton(label, async () => {
          const r = await interp.invokeUserFn(fn, []);
          return r === null || r === undefined ? null : r;
        });
      },
      /* 输入框(提示, 函数)：加一个输入框，用户确认后执行 函数(输入内容) */
      输入框: async (p, interp) => {
        if (!host.uiInput) needHost(interp, "界面.输入框");
        const fn = p[1];
        if (!fn || (fn.__type !== "func" && typeof fn !== "function")) interp.fail("「界面.输入框」的第二个参数必须是函数，例如 函数(内容) { … }");
        const hint = formatValue(p[0] === null || p[0] === undefined ? "请输入" : p[0]);
        return await host.uiInput(hint, async (value) => {
          return await interp.invokeUserFn(fn, [value === null || value === undefined ? "" : value]);
        });
      },
      /* 清空()：清掉界面全部内容 */
      清空: async (p, interp) => {
        if (!host.uiClear) needHost(interp, "界面.清空");
        return await host.uiClear();
      },
    },
  };

  /* ---------- 代码模块（结合其他语言，你始终只写中文） ----------
   *   设 结果 = 代码.运行("python", "print('你好')")
   * 支持：python（电脑需装 Python）、javascript/js（内置）、命令（系统命令行） */
  F.代码 = {
    __type: "dict",
    data: {
      运行: async (p, interp) => {
        if (!host.runCode) needHost(interp, "代码.运行");
        const lang = formatValue(p[0] === null || p[0] === undefined ? "" : p[0]).trim().toLowerCase();
        const src = formatValue(p[1] === null || p[1] === undefined ? "" : p[1]);
        if (!lang) interp.fail("「代码.运行」要告诉它运行什么语言，例如 代码.运行(\"python\", \"print(1)\")");
        return await host.runCode(lang, src);
      },
    },
  };

  return F;
}
