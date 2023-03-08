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
  ipfs: {
    // if gateway URL is defined, monitor won't start its own IPFS daemon
    gatewayUrl: ''
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
