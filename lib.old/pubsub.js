const assert = require('assert')
const {encryptEd25519AesGcm, decryptEd25519AesGcm} = require('./utils/encryption')
const {fromString: uint8ArrayFromString} = require('uint8arrays/from-string')
const {toString: uint8ArrayToString} = require('uint8arrays/to-string')
const {signBufferEd25519, verifyBufferEd25519} = require('./utils/signature')
const {generatePrivateKey, getPublicKeyFromPrivateKey, getPlebbitAddressFromPrivateKey, getChallengeRequestIdFromPublicKey} = require('./utils/crypto')
const cborg = require('cborg')

const IpfsHttpClient = require('ipfs-http-client')
let pubsubIpfsClient

// TODO: must remove getChallenge once IP reputation is enabled for failed challenges
// also this implementation doesn't check the subplebbit signature
const getChallenge = async (monitor) => {
  assert(monitor, `pubsub.getChallenge missing argument monitor`)
  assert(monitor.pubsubHttpClientOptions, `pubsub.getChallenge missing argument monitor.pubsubHttpClientOptions`)
  assert(monitor.ipnsName, `pubsub.getChallenge missing argument monitor.ipnsName`)
  assert(monitor.subplebbitAddress, `pubsub.getChallenge missing argument monitor.subplebbitAddress`)
  assert(monitor.subplebbit?.signature?.publicKey, `pubsub.getChallenge missing argument monitor.subplebbit.signature.publicKey`)

  // make the ipfs client a singleton to not waste resources
  if (!pubsubIpfsClient) {
    pubsubIpfsClient = IpfsHttpClient.create({url: monitor.pubsubHttpClientOptions})
  }

  const authorSigner = await generateSigner()
  const pubsubMessageSigner = await generateSigner()

  // create comment
  const comment = {
    subplebbitAddress: monitor.subplebbitAddress,
    timestamp: Math.round(Date.now() / 1000),
    protocolVersion: '1.0.0',
    content: 'uptime monitor',
    title: 'uptime monitor',
    author: {address: authorSigner.address},
  }

  // create comment signature
  // signed prop names can be in any order
  const commentSignedPropertyNames = ['subplebbitAddress', 'author', 'timestamp', 'content', 'title', 'link', 'parentCid']
  const commentSignature = await sign({
    objectToSign: comment,
    signedPropertyNames: commentSignedPropertyNames,
    privateKey: authorSigner.privateKey,
  })
  comment.signature = {
    signature: commentSignature,
    publicKey: authorSigner.publicKey,
    type: 'ed25519',
    signedPropertyNames: commentSignedPropertyNames,
  }
  // console.log({comment})

  // encrypt publication
  const encrypted = await encryptEd25519AesGcm(JSON.stringify({publication: comment}), pubsubMessageSigner.privateKey, monitor.subplebbit.signature.publicKey)

  // create pubsub challenge request message
  const challengeRequestPubsubMessage = {
    type: 'CHALLENGEREQUEST',
    timestamp: Math.round(Date.now() / 1000),
    challengeRequestId: await getChallengeRequestIdFromPublicKey(pubsubMessageSigner.publicKey),
    acceptedChallengeTypes: ['image/png'],
    encrypted,
    protocolVersion: '1.0.0',
    userAgent: `/uptime-monitor:1.0.0/`,
  }

  // create pubsub challenge request message signature
  const challengeRequestPubsubMessageSignedPropertyNames = ['type', 'timestamp', 'challengeRequestId', 'encrypted', 'acceptedChallengeTypes']
  const challengeRequestPubsubMessageSignature = await sign({
    objectToSign: challengeRequestPubsubMessage,
    signedPropertyNames: challengeRequestPubsubMessageSignedPropertyNames,
    privateKey: pubsubMessageSigner.privateKey,
  })
  challengeRequestPubsubMessage.signature = {
    signature: uint8ArrayFromString(challengeRequestPubsubMessageSignature, 'base64'),
    publicKey: uint8ArrayFromString(pubsubMessageSigner.publicKey, 'base64'),
    type: 'ed25519',
    signedPropertyNames: challengeRequestPubsubMessageSignedPropertyNames,
  }
  // console.log({challengeRequestPubsubMessage})

  // publish pubsub challenge request message
  // TODO: plebbit-js bug that causes subplebbit.pubsubTopic to be name.eth which is incorrect
  const pubsubTopic = monitor.subplebbit.pubsubTopic || monitor.ipnsName
  const challengePubsubMessage = await publishPubsubMessage(pubsubTopic, challengeRequestPubsubMessage, monitor.logInfo)
  // console.log({challengePubsubMessage})
  return challengePubsubMessage
}

const publishPubsubMessage = async (pubsubTopic, messageObject, logInfo) => {
  const timeout = 120_000
  let received = false
  let error

  let onMessageReceived
  const messageReceivedPromise = new Promise((resolve, reject) => {
    onMessageReceived = async (rawMessageReceived) => {
      const messageReceivedObject = cborg.decode(rawMessageReceived.data)

      // not the message we're looking for
      if (messageObject.challengeRequestId.toString() !== messageReceivedObject.challengeRequestId.toString()) {
        return
      }

      // handle publishing CHALLENGEREQUEST and CHALLENGEANSWER
      if (messageObject.type === 'CHALLENGEREQUEST' || messageObject.type === 'CHALLENGEANSWER') {
        if (messageReceivedObject.type === 'CHALLENGE' || messageReceivedObject.type === 'CHALLENGEVERIFICATION') {
          console.log('unsubscribed from', logInfo)
          await pubsubIpfsClient.pubsub.unsubscribe(pubsubTopic)
          received = true
          resolve(messageReceivedObject)
        }
      }

      // handle publishing CHALLENGE
      if (messageObject.type === 'CHALLENGE') {
        if (messageReceivedObject.type === 'CHALLENGEANSWER') {
          received = true
          resolve(messageReceivedObject)
        }
      }
    }

    // publishPubsubMessage timed out
    setTimeout(() => {
      if (!received) {
        error = Error(`publish pubsub message timed out (${timeout / 1000} seconds)`)
        resolve()
      }
    }, timeout).unref()
  })

  await pubsubIpfsClient.pubsub.subscribe(pubsubTopic, onMessageReceived)
  console.log('subscribed to', logInfo)

  const message = cborg.encode(messageObject)
  await pubsubIpfsClient.pubsub.publish(pubsubTopic, message)
  console.log('published message:', messageObject.type)

  // handle publishing CHALLENGEVERIFICATION
  if (messageObject.type === 'CHALLENGEVERIFICATION') {
    return
  }

  const messageReceived = await messageReceivedPromise
  if (error) {
    throw error
  }
  return messageReceived
}

const getBufferToSign = (objectToSign, signedPropertyNames) => {
  const propsToSign = {}
  for (const propertyName of signedPropertyNames) {
    if (objectToSign[propertyName] !== null && objectToSign[propertyName] !== undefined) {
      propsToSign[propertyName] = objectToSign[propertyName]
    }
  }
  const bufferToSign = cborg.encode(propsToSign)
  return bufferToSign
}

const sign = async ({objectToSign, signedPropertyNames, privateKey}) => {
  const bufferToSign = getBufferToSign(objectToSign, signedPropertyNames)
  const signatureBuffer = await signBufferEd25519(bufferToSign, privateKey)
  const signatureBase64 = uint8ArrayToString(signatureBuffer, 'base64')
  return signatureBase64
}

const verify = async ({objectToSign, signedPropertyNames, signature, publicKey}) => {
  const bufferToSign = getBufferToSign(objectToSign, signedPropertyNames)
  const signatureAsBuffer = uint8ArrayFromString(signature, 'base64')
  const res = await verifyBufferEd25519(bufferToSign, signatureAsBuffer, publicKey)
  return res
}

const generateSigner = async () => {
  const privateKey = await generatePrivateKey()
  const publicKey = await getPublicKeyFromPrivateKey(privateKey)
  const address = await getPlebbitAddressFromPrivateKey(privateKey)
  return {privateKey, publicKey, address}
}

const getRandomString = () => (Math.random() + 1).toString(36).replace('.', '')

module.exports = {getChallenge}
