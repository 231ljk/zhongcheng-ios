/* ============================================================
 * 中文程 · 内置开发文档 (docs.js)
 * ------------------------------------------------------------
 * 随扩展一起打包分发，完全离线可看（不需要联网访问任何网站）。
 * module.exports.docsHtml(section?) → 完整 HTML 字符串
 * ============================================================ */
"use strict";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function code(s) { return '<pre class="code">' + esc(s) + "</pre>"; }

function table(head, rows) {
  return '<table><thead><tr>' + head.map((h) => "<th>" + h + "</th>").join("") +
    '</tr></thead><tbody>' +
    rows.map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") +
    "</tbody></table>";
}

function fn(name, sig, desc) {
  return "<tr><td><b>" + name + "</b></td><td>" + sig + "</td><td>" + desc + "</td></tr>";
}

function buildSections() {
  const S = {};

  S.start = `
  <h2>快速上手</h2>
  <p>中文程是一门完全自主开发的中文编程语言：会写中文，就会编程。三种方言（简体 / 繁体 / 拼音）共用同一个内核。</p>
  <h3>三步开始</h3>
  <ol>
    <li>点左侧活动栏的「中」字图标 → <b>新建项目</b>，选一个模板；</li>
    <li>在打开的 .zy 文件里写代码；</li>
    <li>按 <b>F5</b> 或 <b>Ctrl+R</b> 运行，输出显示在下方「输出」面板，绘图显示在画布面板。</li>
  </ol>
  ${code('# 我的第一个程序\n写("你好，中文程")\n写("1 加 1 等于 " + 转文本(1 加 1))')}
  <h3>也可以不用模板</h3>
  <p>新建一个 .zy 文件（资源管理器右键 → 新建文件，命名为 <code>你好.zy</code>），写上代码直接按 F5。</p>
  <h3>官方示例</h3>
  <p>扩展自带的「示例工程」文件夹里有 17 个可直接运行的示例：从猜数字、画图，到 AI 体验、智能家居、智能音箱、语言特色。</p>`;

  S.syntax = `
  <h2>基础语法</h2>
  <h3>变量与输出</h3>
  ${code('设 名字 = "小明"        # 令 / 让 也可以\n写("你好，" + 名字)     # 写 / 打印 / 输出 都行\n设 年龄 = 读入("你几岁？")   # 弹出输入框')}
  <p>文本用引号包起来；<code>+</code> 可以拼接文本、相加数字；<code>#</code> 后面是注释。</p>
  <h3>运算</h3>
  ${code('设 a = 7 加 3        # 加 减 乘 除 取余\n设 b = 10 大于 5      # 等于 不等于 大于 小于 大于等于 小于等于\n设 c = 真 且 假       # 且 / 或 / 非')}
  <h3>条件</h3>
  ${code('如果 年龄 大于等于 18 {\n  写("成年人")\n} 否则如果 年龄 大于 6 {\n  写("学生")\n} 否则 {\n  写("儿童")\n}')}
  <h3>循环</h3>
  ${code('对于 i 从 1 到 10 {     # 从 1 数到 10\n  写(i)\n}\n\n设 n = 0\n当 n 小于 3 {           # 满足条件就一直循环\n  n = n 加 1\n}\n\n遍历 项目 在 列表 {      # 逐个取出列表元素\n  写(项目)\n}')}
  <h3>函数</h3>
  ${code('函数 打招呼(名字) {\n  返回 "你好，" + 名字\n}\n写(打招呼("世界"))')}
  <h3>列表与字典</h3>
  ${code('设 水果 = ["苹果", "香蕉", "橘子"]\n追加(水果, "西瓜")\n写(水果[0])            # 苹果\n写(长度(水果))          # 4\n\n设 人数 = {"小明": 12, "小红": 13}\n写(人数["小红"])')}
  <h3>类</h3>
  ${code('类 动物 {\n  属性 名字\n  方法 叫() {\n    返回 本.名字 加 "在叫"\n  }\n}\n设 狗 = 新建 动物\n狗.名字 = "旺财"\n写(狗.叫())')}
  <h3>JSON 与验证</h3>
  ${code('设 数据 = 解析Json(\'{"温度": 23.5}\')\n写(数据["温度"])          # 23.5\n\n验证("加法正确", 1 加 1 等于 2)   # 不成立立刻中文报错')}`;

  S.funcs = `
  <h2>内置函数</h2>
  <p>以下函数任何方言直接调用（繁体/拼音写法见方言对照）。</p>
  <h3>数学</h3>
  <table><thead><tr><th>函数</th><th>写法</th><th>说明</th></tr></thead><tbody>
  ${fn("取整", "取整(3.9) → 3", "向下取整")}
  ${fn("四舍五入", "四舍五入(3.5) → 4", "")}
  ${fn("整除", "整除(7, 2) → 3", "除数不能为零")}
  ${fn("绝对值 / 平方根 / 幂", "幂(2, 10) → 1024", "")}
  ${fn("正弦 余弦 正切 对数 指数", "对数(e) ", "对数是自然对数 ln")}
  ${fn("圆周率", "圆周率() → 3.14159…", "")}
  ${fn("随机数", "随机数(1, 6) ", "含两端，骰子")}
  ${fn("最大 / 最小", "最大(3, 1, 2) → 3", "也可传列表")}
  ${fn("求和 / 平均", "求和(列表)", "列表或多参数都行")}
  </tbody></table>
  <h3>文本</h3>
  <table><thead><tr><th>函数</th><th>写法</th><th>说明</th></tr></thead><tbody>
  ${fn("长度", "长度(\"你好\") → 2", "列表/字典/数字也适用")}
  ${fn("类型", "类型(123) → \"数字\"", "空/数字/文本/逻辑/列表/字典/函数/类/设备")}
  ${fn("转文本 / 转数字", "转数字(\"3.14\") → 3.14", "")}
  ${fn("包含 / 找位置", "包含(\"中文程\",\"文\") → 真", "")}
  ${fn("替换 / 分割 / 重复", "分割(\"a,b\", \",\") → 列表", "")}
  ${fn("截取 / 去空格 / 大写 / 小写", "截取(\"中文程\", 0, 2) → \"中文\"", "")}
  ${fn("范围", "范围(1, 5) → [1,2,3,4,5]", "含两端")}
  </tbody></table>
  <h3>列表 / 字典</h3>
  <table><thead><tr><th>函数</th><th>写法</th><th>说明</th></tr></thead><tbody>
  ${fn("追加 / 删除", "追加(列表, 元素)", "直接改原列表")}
  ${fn("排序 / 反转 / 切片", "切片(列表, 1, 3)", "")}
  ${fn("计数 / 位置", "位置(列表, 元素) → 下标", "找不到返回 -1")}
  ${fn("键列表 / 值列表", "键列表(字典) → 列表", "")}
  </tbody></table>
  <h3>时间与交互</h3>
  <table><thead><tr><th>函数</th><th>写法</th><th>说明</th></tr></thead><tbody>
  ${fn("当前时间", "当前时间() → \"2026年10月4日 12:00:00\"", "")}
  ${fn("时间戳", "时间戳()", "毫秒，可用来计时")}
  ${fn("等待", "等待(1)", "单位秒，小数也行")}
  ${fn("选择按钮", "选择按钮([\"开\", \"关\"])", "弹出按钮组，返回点中的文字")}
  ${fn("弹窗", "弹窗(\"你好\")", "系统弹窗")}
  ${fn("验证", "验证(\"描述\", 条件)", "程序自我检验，不成立中文报错")}
  </tbody></table>
  <h3>文件</h3>
  ${code('设 内容 = 读文件("笔记.txt")    # 读不到返回空\n写文件("笔记.txt", "新内容")\n写(当前目录())')}
  <h3>画布绘图</h3>
  ${code('画布(400, 300, "我的画")\n填充色("天蓝")\n画矩形(50, 50, 100, 80, 真)\n笔画色("黑")\n画圆(200, 150, 60, 真)\n写字(180, 40, "你好", 20)')}
  <p>颜色可用中文名（纯白/黑/天蓝/浅绿…）或 #十六进制；坐标左上角为原点。</p>
  <h3>用中文写 AI</h3>
  <table><thead><tr><th>函数</th><th>说明</th></tr></thead><tbody>
  ${fn("欧氏距离", "两点距离")}
  ${fn("线性回归(横坐标, 纵坐标)", "返回 {\"斜率\", \"截距\"}，配 预测(模型, x)")}
  ${fn("最近邻(样本, 标签, 新样本)", "分类")}
  ${fn("聚类(数据, 组数)", "聚类分群")}
  ${fn("建网络 / 训练网络 / 网络预测", "迷你神经网络：建网络(2, [4, 1])")}
  </tbody></table>
  ${code('设 网 = 建网络(2, [4, 1])\n训练网络(网, [[0,0],[0,1],[1,0],[1,1]], [[0],[1],[1],[0]], 2000)\n写(网络预测(网, [0, 1]))')}`;

  S.modules = `
  <h2>功能模块</h2>
  <h3>系统模块（调用系统，VSCode 扩展与命令行应用可用）</h3>
  ${code('系统.执行("notepad")            # 运行系统命令\n系统.打开("https://…")          # 用默认浏览器/程序打开\n系统.弹窗("提醒")\n写(系统.环境变量("PATH"))\n写(系统.目录())')}
  <h3>网络模块（联网）</h3>
  ${code('设 回复 = 网络.请求("https://api.example.com/data")\n写(回复)\n设 结果 = 网络.提交("https://…", "数据")')}
  <p>15 秒超时；配合 解析Json 处理接口数据。</p>
  <h3>设备模块（IoT：TCP + MQTT，零依赖）</h3>
  ${code('设 设 = 设备.连接TCP("192.168.1.50", 8080)\n设备.发送(设, "开机")\n写(设备.接收(设))\n设备.关闭(设)\n\n设 云 = 设备.MQTT连接("broker.example.com", 1883, "用户名", "密码")\n设备.MQTT发布(云, "home/light", "on")\n设备.MQTT订阅(云, "home/sensor", 函数(主题, 消息) {\n  写(主题 加 " → " 加 消息)\n})')}
  <p>订阅后程序进入「事件监听模式」，按「停止」结束。</p>
  <h3>家居模块（Home Assistant 一行直连）</h3>
  ${code('设 家 = 家居.连接HA("http://homeassistant.local:8123", "长期令牌")\n写(家居.数值(家, "sensor.wendu"))\n家居.打开(家, "light.keting")\n家居.调亮度(家, "light.keting", 200)\n家居.服务(家, "switch", "turn_on", "switch.plug")')}
  <p>成员：连接HA / 状态 / 数值 / 实体列表 / 服务 / 打开 / 关闭 / 切换 / 开灯 / 关灯 / 调亮度。令牌在 HA 网页右上角头像 → 安全 → 长期访问令牌 创建。</p>
  <h3>服务模块（自建 Web 服务 / 中控）</h3>
  ${code('设 服 = 服务.开启(8080)\n服务.当请求(服, 函数(方式, 路径, 内容) {\n  如果 路径 == "/灯/开" {\n    返回 "<h1>已开灯</h1>"\n  }\n  返回 "<h1>我的系统</h1>"\n})')}
  <p>浏览器访问 <code>http://本机IP:8080</code> 就到达你的函数；服务运行期间程序保持不退出。</p>`;

  S.pack = `
  <h2>打包应用</h2>
  <p>写好的程序可以打包成独立可用的东西：侧边栏「打包应用」、主页顶部「打包」、或命令面板「中文程：打包应用」。.zy 程序支持 5 种格式：</p>
  <table><thead><tr><th>格式</th><th>产物</th><th>适用</th></tr></thead><tbody>
  <tr><td><b>网页应用</b></td><td>单个 .html</td><td>浏览器双击即用；画布绘图、联网、选择按钮；不支持系统命令与 IoT</td></tr>
  <tr><td><b>命令行应用</b></td><td>.js + 启动.bat + 启动.sh</td><td>Windows / Linux / macOS / 树莓派 / NAS（装 Node.js）；功能最全，含 IoT</td></tr>
  <tr><td><b>Android 应用工程</b></td><td>完整 Android Studio 工程</td><td>一键构建 APK（装手机）或 AAB；小米/华为/OPPO/vivo/应用宝等商店通用</td></tr>
  <tr><td><b>鸿蒙应用工程</b></td><td>完整 DevEco Studio 工程</td><td>自动签名构建，上架华为应用市场</td></tr>
  <tr><td><b>IoT 设备系统</b></td><td>设备程序 + 启动脚本 + 生态注册说明</td><td>音响/微波炉/电视的设备端系统，可注册进米家 / 华为云生态</td></tr>
  </tbody></table>
  <p>打包产物生成在源文件同目录；Android / 鸿蒙工程内附「打包与上架说明.txt」，按步骤在对应开发者平台注册提交（授权审核由厂商后台完成）。</p>
  <h3>兼容其他编程语言</h3>
  <p>打开 .py / .js / .java / .sh / .bat 文件，同样能用中文程的「运行程序」（python / node / java / sh / cmd 执行，输出到面板）和「打包应用」（生成「启动器」文件夹：源码副本 + 双击启动脚本 + 运行说明）。</p>
  <h3>快捷键</h3>
  <table><thead><tr><th>按键</th><th>作用</th></tr></thead><tbody>
  <tr><td>F5 / Ctrl+R</td><td>运行当前程序</td></tr>
  <tr><td>Ctrl+Shift+R</td><td>停止</td></tr>
  </tbody></table>`;

  S.iot = `
  <h2>智能家居与 IoT</h2>
  <h3>路线一：控制已有设备（Home Assistant）</h3>
  <p>装一个 Home Assistant（开源免费），把小米/涂鸦等设备接入 HA，然后中文程一行直连：</p>
  ${code('设 家 = 家居.连接HA("http://HA的地址:8123", "长期令牌")\n写(家居.数值(家, "sensor.wendu"))\n家居.打开(家, "light.keting")')}
  <h3>路线二：自建中控</h3>
  <p>用「服务」模块写自己的中控页面，手机浏览器随时访问：</p>
  ${code('设 服 = 服务.开启(8080)\n服务.当请求(服, 函数(方式, 路径, 内容) {\n  如果 路径 == "/开灯" { 家居.打开(家, "light.keting") }\n  返回 "<h1>已执行：" 加 路径 加 "</h1>"\n})')}
  <h3>路线三：写设备端系统（音响/微波炉/电视…）</h3>
  <p>设备端系统的标准范式：本地 HTTP 控制 + 云端 MQTT 命令 + 状态上报（见官方示例「智能音箱.zy」）：</p>
  ${code('设 状态 = {"电源": 假, "音量": 30}\n设 云 = 设备.MQTT连接("服务器", 1883)\n设备.MQTT订阅(云, "设备/命令", 函数(主题, 消息) {\n  状态.电源 = 消息 == "on"\n  设备.MQTT发布(云, "设备/状态", 生成Json(状态))\n})\n设 服 = 服务.开启(8090)\n服务.当请求(服, 函数(方式, 路径, 内容) {\n  返回 生成Json(状态)\n})')}
  <p>写好后用「打包应用 → IoT 设备系统」生成设备程序 + 启动脚本 + 生态注册说明。</p>
  <h3>注册进设备生态</h3>
  <table><thead><tr><th>生态</th><th>路径</th></tr></thead><tbody>
  <tr><td>米家</td><td>iot.mi.com 注册开发者 → 创建产品（选设备类型）→ 按物模型定义属性 → 把平台下发的 MQTT 接入参数换进程序 → 设备上线，米家 App 随时控制</td></tr>
  <tr><td>华为云 IoT</td><td>华为云 IoTDA 创建产品与物模型 → 注册设备拿 device_id/密钥 → 替换接入参数 → 智慧生活 App 控制</td></tr>
  <tr><td>Home Assistant</td><td>开源免授权：MQTT 直连即被 HA 自动发现</td></tr>
  </tbody></table>`;

  S.features = `
  <h2>语言特色</h2>
  <p>中文程有自己的语法特色，这是别家语言没有的：</p>
  <h3>永远 —— 无条件循环</h3>
  ${code('永远 {\n  写("心跳")\n  等待(1)\n}')}
  <p>设备心跳、常驻服务的天然写法，中文读起来就是人话。</p>
  <h3>跳出 —— 跳出循环</h3>
  ${code('对于 i 从 1 到 100 {\n  如果 i 等于 10 {\n    跳出\n  }\n}')}
  <p>「当」「对于」「永远」都能用；在循环外用会得到中文提示。</p>
  <h3>验证 —— 程序自我检验</h3>
  ${code('验证("求和正确", 总数 等于 55)\n验证(心跳 大于 0)')}
  <p>不成立立刻中文报错「验证失败：描述」并指出行号。给设备写的程序可以用它自己检查自己。</p>
  <h3>三种方言</h3>
  <p>文件名含「繁」自动识别繁体，含「拼音」自动识别拼音，其余为简体：</p>
  ${code('简体：设 心跳 = 0    当 x 小于 3 { … }    返回\n繁体：設 心跳 = 0    當 x 小於 3 { … }    回傳\n拼音：she xintiao = 0    dang x xiaoyu 3 { … }    fanhui')}`;

  S.cli = `
  <h2>命令行与远程协助</h2>
  <p>中文程除了在 IDE 里用，还提供全平台（Windows / macOS / Linux）命令行工具 <code>zc</code>：运行程序、和内置 AI 对话、远程协助都能在终端完成。</p>
  <h3>安装命令行工具</h3>
  <p>先装 Node.js（nodejs.org）。在扩展安装目录里执行一次全局安装，之后任意目录都能用 <code>zc</code> 命令：</p>
  ${code('npm install -g .')}
  <p>不想全局安装，也可以直接用 node 调用：<code>node 扩展目录/bin/zc.js help</code>。</p>
  <h3>命令一览</h3>
  ${code('zc run 程序.zy      # 运行中文程程序（也可直接 zc 程序.zy）\nzc ai               # 和本地大模型连续对话（完全离线）\nzc ai 帮我写个循环   # 一次性提问\nzc serve            # 开启远程协助，显示连接码\nzc assist 123456    # 输入对方连接码，协助对方电脑')}
  <h3>远程协助：连接码直连，局域网零延迟</h3>
  <p>两台电脑都装好工具，连同一个 WiFi / 局域网：</p>
  <ol>
    <li>被控电脑执行 <code>zc serve</code>，屏幕显示一个 <b>6 位连接码</b>；</li>
    <li>协助电脑执行 <code>zc assist 连接码</code>，自动发现并直连，无需 IP、无需内网穿透；</li>
    <li>连上后可 <b>列表</b> 浏览对方文件、<b>下载</b> 到本机、<b>上传</b> 到对方：</li>
  </ol>
  ${code('列表                    # 看共享目录\n列表 文档               # 进入子目录\n下载 文档/报告.txt       # 下载到本机当前目录\n上传 我的文件.zip 文档/   # 本机文件传到对方\n信息                    # 看对方系统信息')}
  <p>默认只共享执行 <code>zc serve</code> 时所在的目录；用 <code>zc serve --root 目录路径</code> 可指定共享范围。</p>
  <h3>跨互联网协助</h3>
  <p>两台电脑不在同一网络时，6 位码无法自动穿透（那需要厂商的公网服务器）。方式：被控端路由器把服务端口转发出来，协助端直连：</p>
  ${code('zc assist 123456@对方公网IP:端口')}
  <p>同一局域网内的连接是直连，没有中转，速度取决于你的局域网本身，文件传输无额外延迟。</p>`;

  S.faq = `
  <h2>常见问题</h2>
  <h3>怎么运行？</h3>
  <p>打开 .zy 文件按 <b>F5</b> 或 <b>Ctrl+R</b>；也可以用侧边栏「运行程序」（没打开文件时会让你挑一个）；或者在资源管理器里右键 .zy 文件 → 中文程：运行当前文件。</p>
  <h3>怎么停止？</h3>
  <p><b>Ctrl+Shift+R</b>，或侧边栏「停止」。会同时断开 TCP/MQTT 连接、关掉外部程序。</p>
  <h3>打包出来的东西在哪？</h3>
  <p>在源文件同一个文件夹里，打包完成后会自动在文件管理器中显示。</p>
  <h3>命令行应用要装什么？</h3>
  <p>目标机器装 Node.js（nodejs.org）即可运行 .js；双击 .bat / .sh 启动。网页应用 .html 什么都不用装。</p>
  <h3>怎么换方言？</h3>
  <p>不用设置——文件名里带「繁」就是繁体，带「拼音」就是拼音，否则简体。三种方言同一个内核，能力完全一样。</p>
  <h3>哪里有示例？</h3>
  <p>官方「示例工程」文件夹有 17 个示例：猜数字、画图形、AI 体验、智能家居、家居控制、我的智能家居、智能音箱、语言特色等，全部可直接运行。</p>
  <h3>提示「无法启动 python / node」？</h3>
  <p>运行其他语言的文件前，需要先安装对应的运行环境（Python、Node.js、Java 等），装好后重试。</p>`;

  const NAV = [
    ["start", "快速上手"],
    ["syntax", "基础语法"],
    ["funcs", "内置函数"],
    ["modules", "功能模块"],
    ["pack", "打包应用"],
    ["iot", "智能家居与 IoT"],
    ["features", "语言特色"],
    ["cli", "命令行与远程协助"],
    ["faq", "常见问题"],
  ];

  return { S, NAV };
}

function buildDocs(scriptUri) {
  const { S, NAV } = buildSections();
  const body = NAV.map(([id, label]) => '<section id="' + id + '">' + (S[id] || "") + "</section>").join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.75;
         background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
  .wrap { display: flex; min-height: 100vh; }
  nav { width: 168px; flex: none; padding: 20px 10px; border-right: 1px solid var(--vscode-panel-border); position: sticky; top: 0; height: 100vh; }
  nav .logo { font-weight: 700; font-size: 15px; padding: 0 10px 12px; }
  nav button { display: block; width: 100%; text-align: left; background: none; border: none; color: var(--vscode-editor-foreground);
         padding: 7px 10px; font-size: 13px; font-family: inherit; cursor: pointer; border-radius: 5px; }
  nav button:hover { background: var(--vscode-list-hoverBackground); }
  main { flex: 1; padding: 24px 34px 60px; max-width: 780px; }
  h2 { font-size: 20px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; margin-top: 8px; }
  h3 { font-size: 15px; margin: 22px 0 8px; }
  p, li { opacity: .92; }
  code { background: var(--vscode-textCodeBlock-background); padding: 1px 6px; border-radius: 4px; font-size: 12.5px; }
  pre.code { background: var(--vscode-textCodeBlock-background); padding: 12px 14px; border-radius: 8px;
         font-family: Consolas, monospace; font-size: 13px; overflow-x: auto; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 18px; font-size: 13px; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: var(--vscode-sideBar-background); }
  section { scroll-margin-top: 16px; }
  section:target, section.flash { animation: hi 1.2s; }
  @keyframes hi { 0% { background: var(--vscode-list-hoverBackground); } 100% { background: transparent; } }
  @media (max-width: 640px) { nav { display: none; } }
</style></head>
<body><div class="wrap">
  <nav>
    <div class="logo">🏮 中文程文档</div>
    ${NAV.map(([id, label]) => '<button data-go="' + id + '">' + label + "</button>").join("\n    ")}
  </nav>
  <main>
    ${body}
    <p style="opacity:.5;margin-top:40px">中文程 · 内置离线文档 · 随扩展分发，无需联网</p>
  </main>
</div>
<script src="${scriptUri}"></script>
</body></html>`;
}

/* ---------- AI 知识库：同一份文档转成纯文本，喂给内置大模型 ---------- */
function htmlToText(s) {
  return String(s)
    .replace(/<h2>/g, "\n\n## ").replace(/<\/h2>/g, "\n")
    .replace(/<h3>/g, "\n\n### ").replace(/<\/h3>/g, "\n")
    .replace(/<pre class="code">/g, "\n```\n").replace(/<\/pre>/g, "\n```\n")
    .replace(/<li>/g, "\n- ")
    .replace(/<\/tr>/g, "\n").replace(/<\/t[dh]>/g, " | ")
    .replace(/<p>/g, "\n").replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
}

function knowledgeText() {
  const { S, NAV } = buildSections();
  /* 章节自带 <h2> 标题，去重避免知识库首行重复 */
  return NAV.map(([id, label]) => {
    const html = String(S[id] || "").replace(/^\s*<h2>[\s\S]*?<\/h2>/, "");
    return "## " + label + "\n\n" + htmlToText(html);
  }).join("\n\n");
}

module.exports = { docsHtml: buildDocs, knowledgeText };
