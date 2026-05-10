/**
 * parser.js — 中文自然语言日期 / 时间识别引擎
 *
 * 功能:
 *   从一段文本中识别出日期（明天、周五、5月10日等）和时间（下午3点等），
 *   返回一个结构化对象，供收集箱"预处理预览"使用。
 *
 * 识别规则（按优先级）:
 *   1. 相对日期 — 今天、明天、后天、大后天
 *   2. 星期引用 — 周一、下周三、上周五 等
 *   3. 绝对日期 — 5月10日、5-10、2024/05/10 等
 *   4. 时间段 — 上午/下午/晚上/中午 + 数字点/点半/点X分
 *   5. 纯时间 — 15:30、3:00 等 HH:MM 格式
 *
 * 返回格式:
 *   {
 *     originalText,       // 原始输入
 *     title,              // 去除日期时间后的纯文本（可作为任务标题）
 *     recognizedDate,     // ISO 日期 "YYYY-MM-DD" 或 null
 *     recognizedTime,     // "HH:MM" 或 null
 *     dateLabel,          // 日期中文描述（如 "明天"、"5月10日"），用于 UI 展示
 *     timeLabel,          // 时间中文描述（如 "下午3点"），用于 UI 展示
 *   }
 */

/* ================================================================== */
/*  工具常量                                                           */
/* ================================================================== */

/** 星期映射：中文 → 0-6 (周日=0，周一=1，...，周六=6) */
const WEEKDAY_MAP = {
  '周日': 0, '星期天': 0, '星期天': 0,
  '周一': 1, '星期一': 1,
  '周二': 2, '星期二': 2,
  '周三': 3, '星期三': 3,
  '周四': 4, '星期四': 4,
  '周五': 5, '星期五': 5,
  '周六': 6, '星期六': 6,
};

/** 数字中文 → 阿拉伯数字 */
const CN_NUM = {
  '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
};

/**
 * 将中文数字字符串转换为阿拉伯数字
 * 支持: "一"~"十", "十一"~"十九", "二十"~"二十三"（最多到 23 点）
 */
function parseCnNumber(str) {
  // 先尝试直接映射
  if (CN_NUM[str] !== undefined) return CN_NUM[str];

  // "十X" → 10+X，如 "十二" → 12
  if (str.startsWith('十') && str.length === 2) {
    return 10 + (CN_NUM[str[1]] || 0);
  }
  // "X十" → X*10，如 "二十" → 20
  if (str.endsWith('十') && str.length === 2) {
    return (CN_NUM[str[0]] || 0) * 10;
  }
  // "X十Y" → X*10+Y，如 "二十三" → 23
  const shiIdx = str.indexOf('十');
  if (shiIdx > 0 && shiIdx < str.length - 1) {
    const tens = CN_NUM[str[shiIdx - 1]] || 0;
    const ones = CN_NUM[str[shiIdx + 1]] || 0;
    return tens * 10 + ones;
  }

  return null;
}

/* ================================================================== */
/*  日期识别                                                           */
/* ================================================================== */

/**
 * 根据给定的年/月/日构造 ISO 日期字符串
 */
function toISODate(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/** 获取今天的 Date 对象（去除时分秒） */
function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 尝试从文本开头匹配一个日期模式。
 * 返回 { date: "YYYY-MM-DD"|null, label: string, remaining: string }
 * remaining 是去掉日期部分后的剩余文本。
 */

// 1. 相对日期: 今天 / 明天 / 后天 / 大后天
const RE_RELATIVE = /^(今天|明天|后天|大后天)/;

function tryRelative(text) {
  const m = text.match(RE_RELATIVE);
  if (!m) return null;

  const base = today();
  const offsets = { '今天': 0, '明天': 1, '后天': 2, '大后天': 3 };
  const days = offsets[m[1]];
  const d = new Date(base);
  d.setDate(d.getDate() + days);

  return {
    date: toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    label: m[1],
    remaining: text.slice(m[1].length),
  };
}

// 2. 星期引用: (下/上)? 周X / 星期X
const RE_WEEKDAY = /^((下|上)?周([一二三四五六日天])(一|二|三|四|五|六)?)/;

function tryWeekday(text) {
  // 更精确的匹配
  const patterns = [
    /^下个?周(一|二|三|四|五|六|日|天)/,       // 下周一
    /^下个?星期(一|二|三|四|五|六|日|天)/,      // 下星期一
    /^上个?周(一|二|三|四|五|六|日|天)/,         // 上周一
    /^上个?星期(一|二|三|四|五|六|日|天)/,       // 上星期一
    /^周(一|二|三|四|五|六|日)/,                 // 周一
    /^星期(一|二|三|四|五|六|日|天)/,            // 星期一
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;

    let dayKey = m[1];
    if (dayKey === '天') dayKey = '日';
    // 根据上下文推断是"周X"还是"星期X"
    const isWeekPrefix = re.source.includes('星期');
    const fullKey = isWeekPrefix ? `星期${dayKey}` : `周${dayKey}`;

    const targetWeekday = WEEKDAY_MAP[fullKey];
    if (targetWeekday === undefined) return null;

    let weekOffset = 0;   // 默认为本周
    if (m[0].includes('下')) weekOffset = 1;
    else if (m[0].includes('上')) weekOffset = -1;

    const base = today();
    const currentWeekday = base.getDay();   // 0=周日
    let dayDiff = targetWeekday - currentWeekday;

    // 如果未指定"上/下"，且目标星期已过（或为今天），默认指本周
    if (weekOffset === 0 && dayDiff < 0) {
      // 本周已过，默认指下周
      dayDiff += 7;
    }

    dayDiff += weekOffset * 7;

    const d = new Date(base);
    d.setDate(d.getDate() + dayDiff);

    return {
      date: toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      label: m[0],
      remaining: text.slice(m[0].length),
    };
  }

  return null;
}

// 3. 绝对日期: X月X日、X月X号、X-X、X/X、XXXX-XX-XX
const RE_ABSOLUTE_DATE = /^(\d{1,2})月(\d{1,2})[日号]|^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})|^(\d{1,2})[\/-](\d{1,2})/;

function tryAbsoluteDate(text) {
  // 先尝试 "X月X日/号"
  let m = text.match(/^(\d{1,2})月(\d{1,2})[日号]/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const year = today().getFullYear();
    return {
      date: toISODate(year, month, day),
      label: m[0],
      remaining: text.slice(m[0].length),
    };
  }

  // 再尝试 YYYY-MM-DD / YYYY/MM/DD
  m = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return {
      date: toISODate(year, month, day),
      label: m[0],
      remaining: text.slice(m[0].length),
    };
  }

  // 最后尝试 M-D / M/D（无年份）
  m = text.match(/^(\d{1,2})[\/-](\d{1,2})/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const year = today().getFullYear();
    return {
      date: toISODate(year, month, day),
      label: m[0],
      remaining: text.slice(m[0].length),
    };
  }

  return null;
}

/**
 * 从文本中提取日期信息（按优先级尝试各规则）
 */
function extractDate(text) {
  // 按优先级依次尝试
  let result = tryRelative(text);
  if (!result) result = tryWeekday(text);
  if (!result) result = tryAbsoluteDate(text);

  return result;
}

/* ================================================================== */
/*  时间识别                                                           */
/* ================================================================== */

/**
 * 尝试从文本开头匹配一个时间模式。
 * 返回 { time: "HH:MM"|null, label: string, remaining: string }
 */

// 时间段前缀: 凌晨/早上/上午/中午/下午/傍晚/晚上
// 规则:
//   凌晨 0-5、早上 6-8、上午 9-11、中午 12、下午 13-17、傍晚 18-19、晚上 20-23
const PERIOD_MAP = {
  '凌晨': { base: 0 },
  '早上': { base: 6 },
  '上午': { base: 0 },   // 上午9点=9，上午11点=11
  '中午': { base: 12 },
  '下午': { base: 12 },  // 下午3点=15，下午1点=13
  '傍晚': { base: 18 },
  '晚上': { base: 20 },  // 晚上8点=20
};

function tryTime(text) {
  /**
   * 匹配模式：
   *   凌晨/早上/上午/中午/下午/傍晚/晚上 + [数字] + 点 + [数字]分? + [数字]秒?
   *   凌晨/早上/上午/中午/下午/傍晚/晚上 + [数字] + 点半
   */
  const re = /^(凌晨|早上|上午|中午|下午|傍晚|晚上)?(\S*?)(\d{1,2}|[一二两三四五六七八九十]+)点(半|(\d{1,2})分?)?/;

  const m = text.match(re);
  if (!m) {
    // 尝试纯 HH:MM 格式
    return tryColonTime(text);
  }

  const period = m[1] || '上午';  // 默认上午
  let hour = parseCnNumber(m[3]);
  if (hour === null) hour = parseInt(m[3], 10);
  if (isNaN(hour) || hour < 0 || hour > 23) return null;

  let minute = 0;
  if (m[4] === '半') {
    minute = 30;
  } else if (m[5]) {
    minute = parseInt(m[5], 10);
  }

  // 根据时间段调整小时
  const periodInfo = PERIOD_MAP[period];
  if (periodInfo) {
    if (period === '下午' && hour < 12) hour += 12;
    else if (period === '晚上' && hour < 20) hour += (periodInfo.base - (hour % 12));
    else if (period === '上午' && hour === 12) hour = 0;   // 上午12点 = 0:00
  }

  // 更加精确的时间段处理
  if (period === '晚上' && hour < 12) hour += 12;
  if (period === '凌晨' && hour >= 0 && hour < 6) { /* keep as-is */ }
  if (period === '中午') hour = 12;

  // 重新计算：更简单的逻辑
  hour = parseCnNumber(m[3]);
  if (hour === null) hour = parseInt(m[3], 10);
  if (isNaN(hour)) return null;

  // 上午 12 → 0
  if (period === '上午' && hour === 12) hour = 0;
  // 下午 1-11 → +12，下午 12 → 12
  else if (period === '下午' && hour !== 12) hour += 12;
  // 晚上 1-11 → +12（晚上8点=20点）
  else if (period === '晚上') {
    if (hour >= 8 && hour <= 11) hour += 12;  // 晚上8-11点 → 20-23
    else if (hour >= 1 && hour <= 7) hour += 12;  // 凌晨场景统一
  }
  // 凌晨 12 → 0
  else if (period === '凌晨' && hour === 12) hour = 0;
  // 中午 12 → 12
  else if (period === '中午') hour = 12;

  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    time: timeStr,
    label: m[0],
    remaining: text.slice(m[0].length),
  };
}

/** 纯 HH:MM / H:MM 格式 */
function tryColonTime(text) {
  const re = /^(\d{1,2}):(\d{2})/;
  const m = text.match(re);
  if (!m) return null;

  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return {
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    label: m[0],
    remaining: text.slice(m[0].length),
  };
}

/* ================================================================== */
/*  对外主函数                                                         */
/* ================================================================== */

/**
 * 解析文本，提取日期和时间信息
 * @param {string} rawText - 用户输入的原始文本
 * @returns {object} 结构化解析结果
 */
export function parse(rawText) {
  const text = rawText.trim();
  if (!text) {
    return {
      originalText: text,
      title: '',
      recognizedDate: null,
      recognizedTime: null,
      dateLabel: null,
      timeLabel: null,
    };
  }

  let remaining = text;
  let dateResult = null;
  let timeResult = null;

  // Step 1: 先尝试从文本开头提取日期
  dateResult = extractDate(remaining);
  if (dateResult) {
    remaining = dateResult.remaining.trim();
  }

  // Step 2: 在剩余文本开头尝试提取时间
  if (remaining) {
    timeResult = tryTime(remaining);
    if (timeResult) {
      remaining = timeResult.remaining.trim();
    }
  }

  // Step 3: 如果第一步没提取到日期，在时间之后再次尝试
  if (!dateResult && timeResult && timeResult.remaining.trim()) {
    dateResult = extractDate(timeResult.remaining.trim());
    if (dateResult) {
      remaining = dateResult.remaining.trim();
    }
  }

  // Step 4: 剩余的文本作为标题
  const title = remaining || text;

  return {
    originalText: text,
    title,
    recognizedDate: dateResult ? dateResult.date : null,
    recognizedTime: timeResult ? timeResult.time : null,
    dateLabel: dateResult ? dateResult.label : null,
    timeLabel: timeResult ? timeResult.label : null,
  };
}
