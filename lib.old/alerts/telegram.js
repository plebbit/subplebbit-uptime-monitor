const {Telegram} = require('telegraf')

const alert = async ({subplebbitAddress, config, alert, error} = {}) => {
  const token = alert?.options?.token
  const chatId = alert?.options?.chatId
  if (!token) {
    throw Error('no telegram alert config.alerts[index].option.token')
  }
  if (!chatId) {
    throw Error('no telegram alert config.alerts[index].option.chatId')
  }
  let message = `subplebbit '${subplebbitAddress}' is offline`
  if (error) {
    message += ` with error:

\`\`\`
${error}
\`\`\``
  }

  // if no subplebbitAddress only send custom error message
  if (!subplebbitAddress) {
    message = error.toString()
  }
  // make sure message isn't too long
  message = message.slice(0, 400)

  const telegram = new Telegram(token)
  // don't use parse mode HTML because HTML can be in the error message
  await telegram.sendMessage(chatId, message, {parse_mode: 'Markdown', disable_web_page_preview: true})
}

module.exports = alert
