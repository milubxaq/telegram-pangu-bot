# Telegram 中文排版机器人

在 Telegram 里自动整理中英文排版，零依赖，单文件运行。

## 功能

- 发送任意文字，机器人回复排版后的结果
- `/format 文字` 或回复某条消息后 `/format`
- 内联模式：在任意聊天输入 `@你的机器人 文字`，直接发送排版结果
- 自动跳过代码块、URL 与链接

## 部署

1. 在 [@BotFather](https://t.me/BotFather) 创建机器人，拿到 token
2. 运行：

```bash
export TELEGRAM_BOT_TOKEN=你的token
npm start
```

3. 如需内联模式，在 BotFather 中执行 `/setinline` 并设置占位提示

## 常驻运行

```bash
pm2 start bot.js --name pangu-bot --update-env
pm2 save
```

## License

MIT
