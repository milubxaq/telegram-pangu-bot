'use strict';

const CJK = '\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF';
const CJK_PUNCT_END = '\\u3001\\u3002\\uFF0C\\uFF01\\uFF1F\\uFF1B\\uFF1A\\uFF09\\u300B\\u300D\\u300F\\u3011\\u2026';
const CJK_PUNCT_START = '\\uFF08\\u300A\\u300C\\u300E\\u3010';

// 占位符使用私用区字符，正常文本中几乎不可能出现
const PH_OPEN = '\uE000';
const PH_CLOSE = '\uE001';

function protectSegments(line) {
  const protectedParts = [];
  const put = (raw) => {
    const token = PH_OPEN + protectedParts.length + PH_CLOSE;
    protectedParts.push(raw);
    return token;
  };

  let s = line;
  // 1. 行内代码
  s = s.replace(/`[^`\n]*`/g, put);
  // 2. 裸链接
  s = s.replace(/https?:\/\/[^\s<>()[\]]+/g, put);
  // 3. HTML 标签
  s = s.replace(/<\/?[A-Za-z][^>\n]*>/g, put);
  // 4. Markdown 链接目标与图片地址
  s = s.replace(/\[[^\]]*\]\([^)\n]*\)/g, (m) => {
    const idx = m.lastIndexOf('](');
    const label = m.slice(0, idx + 2);
    const target = m.slice(idx + 2);
    return label + put(target);
  });
  // 5. Wiki 链接
  s = s.replace(/\[\[[^\]\n]+\]\]/g, put);
  // 6. 引用式链接定义
  s = s.replace(/^(\s*\[[^\]]+\]:\s*)(\S+)/, (_, head, url) => head + put(url));

  return { text: s, parts: protectedParts };
}

function restoreSegments(text, parts) {
  const re = new RegExp(PH_OPEN + '(\\d+)' + PH_CLOSE, 'g');
  let s = text;
  // 占位符可能嵌套（先保护的 URL 会被后保护的外层片段再次包裹），需要反复还原
  for (let i = 0; i < 5 && re.test(s); i++) {
    re.lastIndex = 0;
    s = s.replace(re, (_, idx) => parts[Number(idx)]);
  }
  return s;
}

function applySpacing(text) {
  let s = text;
  // 中英文/数字之间补空格（多轮处理，避免相邻规则互相吞掉）
  for (let i = 0; i < 2; i++) {
    s = s.replace(new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g'), '$1 $2');
    s = s.replace(new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g'), '$1 $2');
  }
  // 占位符视为英文片段，与中文之间同样需要空格
  s = s.replace(new RegExp(`([${CJK}])(` + PH_OPEN + ')', 'g'), '$1 $2');
  s = s.replace(new RegExp('(' + PH_CLOSE + `)([${CJK}])`, 'g'), '$1 $2');
  // 中文与中文标点之间不应有空格
  s = s.replace(new RegExp(`([${CJK}])\\s+([${CJK_PUNCT_END}])`, 'g'), '$1$2');
  s = s.replace(new RegExp(`([${CJK_PUNCT_START}])\\s+([${CJK}])`, 'g'), '$1$2');
  return s;
}

function applyPunctuation(text) {
  // 仅在两侧都是中文时把半角标点转成全角，避免影响数字与代码
  return text
    .replace(new RegExp(`([${CJK}])\\s*,\\s*([${CJK}])`, 'g'), '$1，$2')
    .replace(new RegExp(`([${CJK}])\\s*;\\s*([${CJK}])`, 'g'), '$1；$2')
    .replace(new RegExp(`([${CJK}])\\s*:\\s*([${CJK}])`, 'g'), '$1：$2')
    .replace(new RegExp(`([${CJK}])\\s*\\?\\s*([${CJK}])`, 'g'), '$1？$2')
    .replace(new RegExp(`([${CJK}])\\s*!\\s*([${CJK}])`, 'g'), '$1！$2')
    .replace(new RegExp(`([${CJK}])\\s*\\.\\s*([${CJK}])`, 'g'), '$1。$2');
}

function formatLine(line, options) {
  const { spacing = true, punctuation = false } = options || {};
  if (!line) return line;

  // 缩进代码块
  if (/^(?:\t| {4,})\S/.test(line)) return line;

  const { text, parts } = protectSegments(line);
  let s = text;
  if (spacing) s = applySpacing(s);
  if (punctuation) s = applyPunctuation(s);
  return restoreSegments(s, parts);
}

/**
 * 格式化整段文本。
 * @param {string} text
 * @param {{spacing?: boolean, punctuation?: boolean}} [options]
 * @returns {string}
 */
function formatText(text, options) {
  if (!text) return text;
  const lines = text.split('\n');
  let inFence = false;
  const result = lines.map((line) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return formatLine(line, options);
  });
  return result.join('\n');
}

module.exports = { formatText, formatLine };
