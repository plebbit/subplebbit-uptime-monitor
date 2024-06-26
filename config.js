export default {
  // multisub urls to monitor (can support files and ipns names in the future)
  multisubs: [
    'https://raw.githubusercontent.com/plebbit/temporary-default-subplebbits/master/multisub.json',
    './temporary-default-subplebbits-multisub.json'
  ],
  delegatedRoutingUrls: [
    // 'https://example.com',
    'https://delegated-ipfs.dev',
  ],
  plebbitOptions: {
    // if gateway URL is defined, monitor won't start its own IPFS daemon
    ipfsGatewayUrls: ['http://89.36.231.207'],
    pubsubHttpClientsOptions: ['https://pubsubprovider.xyz/api/v0'],
    chainProviders: {
      eth: {
        urls: ['http://15.235.132.69']
      },
      sol: {
        urls: ['http://15.235.132.69']
      }
    },
  },
  // monitor: {
  //   interval: 1000 * 60 * 10 // 10 minutes
  // },
  // alerts: [
  //   {
  //     path: './lib/alerts/telegram',
  //     options: {
  //       token: process.env.TELEGRAM_TOKEN,
  //       chatId: process.env.TELEGRAM_CHAT_ID
  //     }
  //   },
  //   {
  //     path: './lib/alerts/telegram',
  //     options: {
  //       token: process.env.TELEGRAM_TOKEN,
  //       chatId: process.env.TELEGRAM_CHAT_ID_2
  //     }
  //   },
  // ],
  // stats: [
  //   {
  //     path: './lib/stats/telegram',
  //     options: {
  //       token: process.env.TELEGRAM_TOKEN,
  //       chatId: process.env.TELEGRAM_CHANNEL_ID
  //     }
  //   }
  // ]
}
