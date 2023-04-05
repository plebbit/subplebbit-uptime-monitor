const {Telegram} = require('telegraf')
const fs = require('fs-extra')
const path = require('path')
const lastMessageIdPath = path.resolve(__dirname, '..', '..', 'stats-telegram-last-message-id')

let lastMessageId
try {
  lastMessageId = Number(fs.readFileSync(lastMessageIdPath))
}
catch (e) {}

let previousMessage

const publish = async ({statsConfig, stats, statsTimestamps} = {}) => {
  const token = statsConfig?.options?.token
  const chatId = statsConfig?.options?.chatId
  if (!token) {
    throw Error('no telegram alert config.alerts[index].option.token')
  }
  if (!chatId) {
    throw Error('no telegram alert config.alerts[index].option.chatId')
  }

  const greenIcon = '🟢'
  const redIcon = '🔴'
  const yellowIcon = '🟡'
  let message = ''
  for (const statsName in stats) {
    const value = stats[statsName]
    const time = new Date(statsTimestamps[statsName]).toISOString().split('.')[0] 
    let icon = yellowIcon
    if (value === 'online') {
      icon = greenIcon
    }
    if (value === 'offline') {
      icon = redIcon
    }
    message += `${statsName} ${icon} (${time})\n\n`
  }

  // message can be empty if no stats yet
  if (!message || message === previousMessage) {
    return
  }

  const telegram = new Telegram(token)

  if (lastMessageId) {
    await telegram.editMessageText(
      chatId,
      lastMessageId,
      undefined,
      message,
      {parse_mode: 'HTML', disable_web_page_preview: true}
    )
  }
  else {
    // don't use parse mode HTML because HTML can be in the error message
    const res = await telegram.sendMessage(chatId, message, {parse_mode: 'Markdown', disable_web_page_preview: true})
    if (!lastMessageId) {
      lastMessageId = res.message_id
      fs.writeFileSync(lastMessageIdPath, String(lastMessageId))
    }  
  }
  previousMessage = message
}

module.exports = publish
