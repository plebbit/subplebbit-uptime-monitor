const fetch = require('node-fetch')
const {ipfsGatewayPort, ipfsApiPort} = require('./settings')
const defaultIpfsGatewayUrl = `http://127.0.0.1:${ipfsGatewayPort}`
const defaultPubsubClientUrl = `http://127.0.0.1:${ipfsApiPort}/api/v0`
const path = require('path')
const stats = require('./stats')

const {getChallengeRequestIdFromPublicKey, generateSigner} = require('./utils/crypto')
const {encryptEd25519AesGcm} = require('./utils/encryption')
const {fromString: uint8ArrayFromString} = require('uint8arrays/from-string')
const {toString: uint8ArrayToString} = require('uint8arrays/to-string')
const {signBufferEd25519, verifyBufferEd25519} = require('./utils/signature')
const cborg = require('cborg')

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
    stats.add(ipfsGatewayUrl, 'online')
  }
  catch (e) {
    ipfsMonitor.ipfsGatewayIsOffline = true
    stats.add(ipfsGatewayUrl, 'offline')
    await alert(config, Error(`ipfs gateway '${ipfsGatewayUrl}' is offline: ${e.message}`))
    console.log(e.message)
  }
}

const updatePubsubProviderIsOffline = async (config) => {
  const pubsubHttpClientOptions = config?.plebbitOptions?.pubsubHttpClientsOptions?.[0] || defaultPubsubClientUrl

  try {
    await publishPubsubHello(pubsubHttpClientOptions)
    ipfsMonitor.pubsubProviderIsOffline = false
    stats.add(pubsubHttpClientOptions, 'online')
  }
  catch (e) {
    ipfsMonitor.pubsubProviderIsOffline = true
    stats.add(pubsubHttpClientOptions, 'offline')
    await alert(config, Error(`pubsub provider '${pubsubHttpClientOptions}' is offline: ${e.message}`))
    console.log(e.message)
  }
}

let subplebbitSigner

const publishPubsubHello = async (pubsubHttpClientOptions) => {
  // make the ipfs client a singleton to not waste resources
  if (!pubsubIpfsClient) {
    pubsubIpfsClient = IpfsHttpClient.create({url: pubsubHttpClientOptions})
  }

  if (!subplebbitSigner) {
    subplebbitSigner = await generateSigner()
  }
  const pubsubTopic = subplebbitSigner.address
  const message = await generateChallengeMessage(subplebbitSigner)
  const timeout = 120_000
  let received = false
  let error

  let onMessageReceived
  const messageReceivedPromise = new Promise((resolve, reject) => {
    onMessageReceived = async (rawMessageReceived) => {
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

const generateChallengeMessage = async (subplebbitSigner) => {
  const authorSigner = await generateSigner()

  const challenges = [{challenge: '1+1=?', type: 'text'}]
  const encryptedChallenges = await encryptEd25519AesGcm(
    JSON.stringify(challenges),
    subplebbitSigner.privateKey,
    authorSigner.publicKey
  )
  const challengePubsubMessage = {
    type: 'CHALLENGE',
    timestamp: Math.round(Date.now() / 1000),
    challengeRequestId: await getChallengeRequestIdFromPublicKey(authorSigner.publicKey),
    encryptedChallenges,
    protocolVersion: '1.0.0',
    userAgent: `/protocol-test:1.0.0/`,
  }

  // create pubsub challenge message signature
  const challengePubsubMessageSignedPropertyNames = ['type', 'timestamp', 'challengeRequestId', 'encryptedChallenges']
  const challengePubsubMessageSignature = await sign({
    objectToSign: challengePubsubMessage,
    signedPropertyNames: challengePubsubMessageSignedPropertyNames,
    privateKey: subplebbitSigner.privateKey,
  })
  challengePubsubMessage.signature = {
    signature: uint8ArrayFromString(challengePubsubMessageSignature, 'base64'),
    publicKey: uint8ArrayFromString(subplebbitSigner.publicKey, 'base64'),
    type: 'ed25519',
    signedPropertyNames: challengePubsubMessageSignedPropertyNames,
  }

  return cborg.encode(challengePubsubMessage)
}

const getBufferToSign = (objectToSign, signedPropertyNames) => {
  const propsToSign = {}
  for (const propertyName of signedPropertyNames) {
    if (objectToSign[propertyName] !== null && objectToSign[propertyName] !== undefined) {
      propsToSign[propertyName] = objectToSign[propertyName]
    }
  }
  // console.log({propsToSign})
  const bufferToSign = cborg.encode(propsToSign)
  return bufferToSign
}

const sign = async ({objectToSign, signedPropertyNames, privateKey}) => {
  const bufferToSign = getBufferToSign(objectToSign, signedPropertyNames)
  const signatureBuffer = await signBufferEd25519(bufferToSign, privateKey)
  const signatureBase64 = uint8ArrayToString(signatureBuffer, 'base64')
  return signatureBase64
}

module.exports = ipfsMonitor
