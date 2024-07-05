export default {
  monitoring: {
    // multisub urls or file paths to monitor (will support ipns names in the future)
    multisubs: [
      'https://raw.githubusercontent.com/plebbit/temporary-default-subplebbits/master/multisub.json',
      './temporary-default-subplebbits-multisub.json'
    ],
    ipfsGatewayUrls: [
      'https://ipfsgateway.xyz',
      'https://ipfs.io',
      'https://cloudflare-ipfs.com'
    ]
  },
  delegatedRoutingUrls: [
    // 'https://example.com',
    'https://delegated-ipfs.dev',
  ],
  ipfsApiUrl: 'http://pubsub:pubsub@89.36.231.54/api/v0',
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
  }
}
