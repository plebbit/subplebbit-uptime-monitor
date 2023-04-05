const fetch = require('node-fetch')
const {ipfsGatewayPort, ipfsApiPort} = require('./settings')
const defaultIpfsGatewayUrl = `http://127.0.0.1:${ipfsGatewayPort}`
const defaultPubsubClientUrl = `http://127.0.0.1:${ipfsApiPort}/api/v0`
const path = require('path')

const IpfsHttpClient = require('ipfs-http-client')
let pubsubIpfsClient
let lastAlert

const ipfsMonitor = {
  started: false,
  ipfsGatewayIsOffline: false,
  pubsubProviderIsOffline: false,
}

let starting
ipfsMonitor.start = async (config) => {
  if (ipfsMonitor.started) {
    while (starting) {
      await new Promise(r => setTimeout(r, 100))
    }
    return
  }
  ipfsMonitor.started = true
  starting = true

  if (typeof config.monitor.interval !== 'number') {
    throw Error('invalid config.monitor.interval not a number')
  }

  // wait for ipfs monitor at least once before finishing starting
  console.log('testing ipfs gateway and pubsub provider before starting...')
  await Promise.all([
    updateIpfsGatewayIsOffline(config),
    updatePubsubProviderIsOffline(config)
  ])
  starting = false

  setInterval(() => {
    updateIpfsGatewayIsOffline(config).catch(e => console.log(e.message))
    updatePubsubProviderIsOffline(config).catch(e => console.log(e.message))
  }, config.monitor.interval).unref()
}

const alert = async (config, error) => {
  if (lastAlert > Date.now() - 1000 * 60 * 60 * 3) { // only alert once per 3 hour
    return false
  }
  for (const alertConfig of config?.alerts) {
    console.log('alerting', alertConfig.path, error.message)
    try {
      const alert = require(path.resolve(alertConfig.path))
      await alert({
        subplebbitAddress: undefined,
        config,
        alert: alertConfig, 
        error
      })
    }
    catch (e) {
      e.message = `failed alert '${alertConfig.path}': ${e.message}}`
      console.log(e.message)
    }
  }
  lastAlert = Date.now()
}

const updateIpfsGatewayIsOffline = async (config) => {
  const ipfsGatewayUrl = config?.plebbitOptions?.ipfsGatewayUrls?.[0] || defaultIpfsGatewayUrl

  try {
    const text = await fetch(`${ipfsGatewayUrl}/ipfs/bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m`).then(res => res.text())
    if (!text.startsWith('Hello')) {
      throw Error(`failed fetching ipfs hello: '${text?.slice?.(0, 200)}'`)
    }
    ipfsMonitor.ipfsGatewayIsOffline = false
  }
  catch (e) {
    ipfsMonitor.ipfsGatewayIsOffline = true
    await alert(config, Error(`ipfs gateway '${ipfsGatewayUrl}' is offline: ${e.message}`))
    console.log(e.message)
  }
}

const updatePubsubProviderIsOffline = async (config) => {
  const pubsubHttpClientOptions = config?.plebbitOptions?.pubsubHttpClientsOptions?.[0] || defaultPubsubClientUrl

  try {
    await publishPubsubHello(pubsubHttpClientOptions)
    ipfsMonitor.pubsubProviderIsOffline = false
  }
  catch (e) {
    ipfsMonitor.pubsubProviderIsOffline = true
    await alert(config, Error(`pubsub provider '${pubsubHttpClientOptions}' is offline: ${e.message}`))
    console.log(e.message)
  }
}

const publishPubsubHello = async (pubsubHttpClientOptions) => {
  // make the ipfs client a singleton to not waste resources
  if (!pubsubIpfsClient) {
    pubsubIpfsClient = IpfsHttpClient.create({url: pubsubHttpClientOptions})
  }

  const pubsubTopic = 'uptime monitor ' + getRandomString()
  const message = 'hello'
  const timeout = 120_000
  let received = false
  let error

  let onMessageReceived
  const messageReceivedPromise = new Promise((resolve, reject) => {
    onMessageReceived = async (rawMessageReceived) => {
      console.log({rawMessageReceived})
      received = true
      resolve(rawMessageReceived)
    }

    // pubsubIpfsClient.pubsub.publish timed out
    setTimeout(() => {
      if (!received) {
        error = Error(`pubsub hello message timed out (${timeout / 1000} seconds)`)
        resolve()
      }
    }, timeout).unref()
  })

  await pubsubIpfsClient.pubsub.subscribe(pubsubTopic, onMessageReceived)
  await pubsubIpfsClient.pubsub.publish(pubsubTopic, Buffer.from(message))

  await messageReceivedPromise
  if (error) {
    throw error
  }
}

const getRandomString = () => (Math.random() + 1).toString(36).replace('.', '')

module.exports = ipfsMonitor
