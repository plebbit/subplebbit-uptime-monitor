### How to use

```
node monitor --subplebbits <path/to/subplebbits> --config <path/to/config>
```

### Subplebbits

A line break separated list of subplebbits.

### Config

A javascript file like:

```
module.exports = {
  plebbitOptions: {
    // if gateway URL is defined, monitor won't start its own IPFS daemon
    ipfsGatewayUrls: ['https://ipfs.io'],
    pubsubHttpClientsOptions: ['https://pubsubprovider.xyz/api/v0'],
    chainProviders: {
      eth: {
        // if ETH RPC URL, won't use default ethers.js provider
        urls: [process.env.ETH_PROVIDER_URL]
      }
    },
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
```
