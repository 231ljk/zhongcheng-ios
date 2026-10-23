/* ============================================================
 * 中文程 · 方言词表 (dialects.js)
 * ------------------------------------------------------------
 * 「中文程」语言族的内核只有一个（词法/语法/解释器共享同一套
 * token 体系），不同的中文方言只是把同一批 token 映射成不同
 * 的词。这样"各种各样的编程语言"都能用同一引擎解释运行，
 * 且每一种方言都是中文编程。
 *
 * token 类型说明：
 *   VAR      变量声明           WRITE    输出
 *   IF       如果              ELSE_IF  否则如果
 *   ELSE     否则              WHILE    当
 *   FOR      对于              FUNC     函数
 *   RETURN   返回              TRUE     真
 *   FALSE    假                NULL     空
 *   AND      且                OR       或
 *   NOT      非                CLASS    类
 *   NEW      新建              PROP     属性(类内字段)
 *   METHOD   方法(类内函数)    THIS     本(类内自身引用)
 *   FROM     从                TO       到
 *   IN       在                PLUS     加
 *   MINUS    减                STAR     乘
 *   SLASH    除                MOD      取余
 *   EQ       等于(比较)        NEQ      不等于
 *   GT       大于              LT       小于
 *   GE       大于等于          LE       小于等于
 *   ASGN     赋值(设/令)       READ     读入
 *   CLS      清屏              WAIT     等待
 * ============================================================ */

const DIALECTS = {
  /* ---------- 简体 · 白话文 ---------- */
  zh: {
    名称: "简体中文程",
    简介: "用简体白话书写的中文编程语言",
    词表: {
      "设": "VAR", "令": "VAR", "让": "VAR",
      "写": "WRITE", "打印": "WRITE", "输出": "WRITE",
      "如果": "IF", "否则如果": "ELSE_IF", "否则": "ELSE",
      "当": "WHILE", "循环": "WHILE",
      "对于": "FOR", "遍历": "FOR",
      "函数": "FUNC", "定义": "FUNC",
      "返回": "RETURN", "回": "RETURN",
      "真": "TRUE", "假": "FALSE", "空": "NULL", "无": "NULL",
      "且": "AND", "并且": "AND", "或": "OR", "或者": "OR",
      "非": "NOT", "不": "NOT",
      "类": "CLASS", "新建": "NEW", "实例化": "NEW",
      "属性": "PROP", "字段": "PROP",
      "方法": "METHOD", "行为": "METHOD",
      "本": "THIS",
      "从": "FROM", "到": "TO", "在": "IN", "中": "IN",
      "加": "PLUS", "减": "MINUS", "乘": "STAR", "除": "SLASH", "取余": "MOD", "模": "MOD",
      "等于": "EQ", "不等于": "NEQ", "大于": "GT", "小于": "LT",
      "大于等于": "GE", "不小于": "GE", "小于等于": "LE", "不大于": "LE",
      "赋值": "ASGN",
      "读入": "READ", "输入": "READ",
      "清屏": "CLS",
      "等待": "WAIT", "延时": "WAIT"
    },
    内建函数: {  // 标准库函数（中文名）
      "长度": "长度", "类型": "类型", "转文本": "转文本", "转数字": "转数字",
      "取整": "取整", "绝对值": "绝对值", "平方根": "平方根", "幂": "幂",
      "随机数": "随机数", "当前时间": "当前时间", "清空画布": "清空画布",
      "画布": "画布", "画点": "画点", "画线": "画线", "画圆": "画圆",
      "画矩形": "画矩形", "填充色": "填充色", "笔画色": "笔画色",
      "包含": "包含", "替换": "替换", "分割": "分割",
      "追加": "追加", "删除": "删除", "排序": "排序", "反转": "反转",
      "最大": "最大", "最小": "最小", "重复": "重复", "范围": "范围",
      "读文件": "读文件", "写文件": "写文件", "当前目录": "当前目录",
      "画弧": "画弧", "写字": "写字", "画多边形": "画多边形"
    }
  },

  /* ---------- 繁体 · 文言风 ---------- */
  trad: {
    名称: "繁体中文程",
    简介: "用繁体汉字书写的中文编程语言",
    词表: {
      "設": "VAR", "令": "VAR", "讓": "VAR",
      "寫": "WRITE", "列印": "WRITE", "輸出": "WRITE",
      "如果": "IF", "否則如果": "ELSE_IF", "否則": "ELSE",
      "當": "WHILE", "循環": "WHILE",
      "對於": "FOR", "遍歷": "FOR",
      "函式": "FUNC", "定義": "FUNC",
      "回傳": "RETURN",
      "真": "TRUE", "假": "FALSE", "空": "NULL", "無": "NULL",
      "且": "AND", "並且": "AND", "或": "OR", "或者": "OR",
      "非": "NOT", "不": "NOT",
      "類": "CLASS", "新建": "NEW", "實例化": "NEW",
      "屬性": "PROP", "欄位": "PROP",
      "方法": "METHOD", "行為": "METHOD",
      "本": "THIS",
      "從": "FROM", "到": "TO", "在": "IN", "中": "IN",
      "加": "PLUS", "減": "MINUS", "乘": "STAR", "除": "SLASH", "取餘": "MOD", "模": "MOD",
      "等於": "EQ", "不等於": "NEQ", "大於": "GT", "小於": "LT",
      "大於等於": "GE", "不小於": "GE", "小於等於": "LE", "不大於": "LE",
      "賦值": "ASGN",
      "讀入": "READ", "輸入": "READ",
      "清屏": "CLS",
      "等待": "WAIT", "延時": "WAIT"
    },
    内建函数: {
      "長度": "长度", "類型": "类型", "轉文本": "转文本", "轉數字": "转数字",
      "取整": "取整", "絕對值": "绝对值", "平方根": "平方根", "冪": "幂",
      "隨機數": "随机数", "當前時間": "当前时间", "清空畫布": "清空画布",
      "畫布": "画布", "畫點": "画点", "畫線": "画线", "畫圓": "画圆",
      "畫矩形": "画矩形", "填充色": "填充色", "筆畫色": "笔画色",
      "包含": "包含", "替換": "替换", "分割": "分割",
      "追加": "追加", "刪除": "删除", "排序": "排序", "反轉": "反转",
      "最大": "最大", "最小": "最小", "重複": "重复", "範圍": "范围",
      "讀文件": "读文件", "寫文件": "写文件", "當前目錄": "当前目录",
      "畫弧": "画弧", "寫字": "写字", "畫多邊形": "画多边形"
    }
  },

  /* ---------- 拼音 · 注音风 ---------- */
  pinyin: {
    名称: "拼音中文程",
    简介: "用汉语拼音书写的中文编程语言",
    词表: {
      "she": "VAR", "ling": "VAR", "rang": "VAR",
      "xie": "WRITE", "dayin": "WRITE", "shuchu": "WRITE",
      "ruguo": "IF", "fouzeruguo": "ELSE_IF", "fouze": "ELSE",
      "dang": "WHILE", "xunhuan": "WHILE",
      "duiyu": "FOR", "bianli": "FOR",
      "hanshu": "FUNC", "dingyi": "FUNC",
      "fanhui": "RETURN", "hui": "RETURN",
      "zhen": "TRUE", "jia": "FALSE", "kong": "NULL", "wu": "NULL",
      "qie": "AND", "bingqie": "AND", "huo": "OR", "huozhe": "OR",
      "fei": "NOT", "bu": "NOT",
      "lei": "CLASS", "xinjian": "NEW", "shilihua": "NEW",
      "shuxing": "PROP", "ziduan": "PROP",
      "fangfa": "METHOD", "xingwei": "METHOD",
      "ben": "THIS",
      "cong": "FROM", "dao": "TO", "zai": "IN", "zhong": "IN",
      "jia": "PLUS", "jian": "MINUS", "cheng": "STAR", "chu": "SLASH", "quyu": "MOD", "mo": "MOD",
      "dengyu": "EQ", "budengyu": "NEQ", "dayu": "GT", "xiaoyu": "LT",
      "dayudengyu": "GE", "buxiaoyu": "GE", "xiaoyudengyu": "LE", "budayu": "LE",
      "fuzhi": "ASGN",
      "duru": "READ", "shuru": "READ",
      "qingping": "CLS",
      "dengdai": "WAIT", "yanshi": "WAIT"
    },
    内建函数: {
      "changdu": "长度", "leixing": "类型", "zhuanwenben": "转文本", "zhuanshuzi": "转数字",
      "quzheng": "取整", "jueduizhi": "绝对值", "pingfangen": "平方根", "mi": "幂",
      "suijishu": "随机数", "dangqianshijian": "当前时间", "qingkonghuabu": "清空画布",
      "huabu": "画布", "huadian": "画点", "huaxian": "画线", "huayuan": "画圆",
      "huajuxing": "画矩形", "tianchongse": "填充色", "bihuase": "笔画色",
      "baohan": "包含", "tihuan": "替换", "fenge": "分割",
      "zhuijia": "追加", "zhuiJIA": "追加", "shanchu": "删除", "paixu": "排序", "fanzhuan": "反转",
      "zuida": "最大", "zuixiao": "最小", "chongfu": "重复", "fanwei": "范围",
      "duwenjian": "读文件", "xiewenjian": "写文件", "dangqianmulu": "当前目录",
      "huahu": "画弧", "xiezi": "写字", "huaduobianxing": "画多边形"
    }
  }
};

/* 当前方言（默认简体，可在界面切换） */
let 当前方言 = "zh";

function 取方言() {
  return DIALECTS[当前方言] || DIALECTS.zh;
}

function 取方言名() {
  return 取方言().名称;
}
