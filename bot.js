'use strict';

/**
 * Telegram 中文排版机器人
 * 无第三方依赖，使用 long polling + 内联模式。
 * 环境变量：TELEGRAM_BOT_TOKEN
 */

const { formatText } = require('./pangu');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const MAX_LEN = 4000;

if (!TOKEN) {
  console.error('缺少环境变量 TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const HELP_TEXT = [
  '中文排版机器人',
  '',
  '用法：',
  '1. 直接发送一段文字，我会帮你在中英文、中文与数字之间补空格',
  '2. 回复任意文字消息并输入 /format，只处理那条消息',
  '3. 在任意聊天输入 @本机器人 <文字>，使用内联模式直接发排版结果',
  '',
  '命令：',
  '/format - 格式化紧跟的文字或你回复的消息',
  '/help - 显示本说明',
  '',
  '不会修改代码块与链接。',
].join('\n');

function formatChunk(text) {
  return formatText(text, { spacing: true, punctuation: false });
}

function splitMessage(text) {
  if (text.length <= MAX_LEN) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > MAX_LEN) {
    let cut = rest.lastIndexOf('\n', MAX_LEN);
    if (cut < MAX_LEN / 2) cut = MAX_LEN;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function call(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`API ${method} 失败:`, data.description);
  }
  return data;
}

async function sendFormatted(chatId, text, replyTo) {
  const formatted = formatChunk(text);
  if (!formatted.trim()) return;
  const parts = splitMessage(formatted);
  for (const part of parts) {
    await call('sendMessage', {
      chat_id: chatId,
      text: part,
      reply_to_message_id: replyTo,
      disable_web_page_preview: true,
    });
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption;
  if (!text) return;

  if (text === '/start') {
    await call('sendMessage', { chat_id: chatId, text: HELP_TEXT });
    return;
  }
  if (text === '/help') {
    await call('sendMessage', { chat_id: chatId, text: HELP_TEXT });
    return;
  }
  if (text.startsWith('/format')) {
    const arg = text.slice('/format'.length).trim();
    if (arg) {
      await sendFormatted(chatId, arg, msg.message_id);
      return;
    }
    const replied = msg.reply_to_message;
    const repliedText = replied && (replied.text || replied.caption);
    if (repliedText) {
      await sendFormatted(chatId, repliedText, replied.message_id);
      return;
    }
    await call('sendMessage', {
      chat_id: chatId,
      text: '请回复一条文字消息并输入 /format，或直接用 /format 文字内容',
      reply_to_message_id: msg.message_id,
    });
    return;
  }
  if (text.startsWith('/')) return;

  await sendFormatted(chatId, text, msg.message_id);
}

async function handleInlineQuery(query) {
  const text = query.query;
  const formatted = formatChunk(text);
  if (!formatted.trim()) {
    await call('answerInlineQuery', { inline_query_id: query.id, results: [] });
    return;
  }
  await call('answerInlineQuery', {
    inline_query_id: query.id,
    cache_time: 0,
    results: [
      {
        type: 'article',
        id: 'pangu-' + Date.now(),
        title: '发送排版结果',
        description: formatted.slice(0, 120),
        input_message_content: {
          message_text: formatted.slice(0, 4096),
          disable_web_page_preview: true,
        },
      },
    ],
  });
}

async function poll() {
  let offset = 0;
  while (true) {
    try {
      const res = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
      const data = await res.json();
      if (!data.ok) {
        console.error('getUpdates 失败:', data.description);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      for (const update of data.result) {
        offset = update.update_id + 1;
        try {
          if (update.message) await handleMessage(update.message);
          else if (update.inline_query) await handleInlineQuery(update.inline_query);
        } catch (err) {
          console.error('处理更新失败:', err);
        }
      }
    } catch (err) {
      console.error('轮询异常:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

console.log('中文排版机器人已启动');
poll();
