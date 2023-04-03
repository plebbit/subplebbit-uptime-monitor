module.exports = {
  chainProviders: {
    eth: {
      // if ETH RPC URL, won't use default ethers provider
      url: process.env.ETH_PROVIDER_URL
    }
  },
  ipfs: {
    // if gateway URL is defined, monitor won't start its own IPFS daemon
    gatewayUrl: 'https://ipfs.io'
  },
  monitor: {
    interval: 1000 * 60 * 10 // 10 minutes
  },
  alerts: [
    {
      path: './lib/alerts/telegram',
      options: {
        token: process.env.TELEGRAM_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
      }
    }
  ]
}
