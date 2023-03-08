const {Telegram} = require('telegraf')

const alert = async ({subplebbitAddress, error, alert, config} = {}) => {
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
<code>
${error}
</code>`
  }
  const telegram = new Telegram(token)
  await telegram.sendMessage(chatId, message, {parse_mode: 'HTML'})
}

module.exports = alert
