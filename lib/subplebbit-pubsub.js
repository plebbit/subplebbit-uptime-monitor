import './use-node-fetch.js'
import util from 'util'
util.inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
import config from '../config.js'
import monitorState from './monitor-state.js'
import {stringToCid, getPlebbitAddressFromPublicKey, getTimeAgo} from './utils.js'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()
import {HttpsProxyAgent} from 'https-proxy-agent'
import {stripHtml} from 'string-strip-html'
import {create as createKubo} from 'kubo-rpc-client'
import * as cborg from 'cborg'
import {toString as uint8ArrayToString} from 'uint8arrays/to-string'
import PQueue from 'p-queue'
import {Agent} from 'https'

const kubo = await createKubo({
  url: config.pubsubApiUrl, 
  agent: new Agent({keepAlive: true, maxSockets: Infinity})
})

const fetchOptions = {
  agent: process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined,
  headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36'}
}

export const monitorSubplebbitsPubsub = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring) {
    const pubsubTopic = monitorState.subplebbits[subplebbit?.address]?.pubsubTopic
    const subplebbitPublicKey = monitorState.subplebbits[subplebbit?.address]?.publicKey
    monitorSubplebbitPubsub(subplebbit, pubsubTopic, subplebbitPublicKey)
      .catch(e => console.log(e.message))
  }
}

const monitorSubplebbitPubsub = async (subplebbit, pubsubTopic, subplebbitPublicKey) => {
  if (!pubsubTopic) {
    throw Error(`can't monitor pubsub for '${subplebbit.address}' no pubsub topic found yet`)
  }
  if (!subplebbitPublicKey) {
    throw Error(`can't monitor pubsub for '${subplebbit.address}' no subplebbit public key found yet`)
  }

  fetchPubsubDhtPeers(subplebbit, pubsubTopic)
    .then(pubsubDhtPeers => {
      if (pubsubDhtPeers) {
        console.log(`fetched ${pubsubDhtPeers.length} pubsub dht peers for '${subplebbit?.address}'`)
      }
      monitorState.subplebbits[subplebbit?.address] = {
        ...monitorState.subplebbits[subplebbit?.address],
        pubsubDhtPeers
      }
    })
    .catch(e => console.log(e.message))

  ;(async () => {
    const lastSubplebbitPubsubMessageTimetamp = await getLastSubplebbitPubsubMessageTimetamp(subplebbit, pubsubTopic, subplebbitPublicKey)
    if (lastSubplebbitPubsubMessageTimetamp) {
      console.log(`got pubsub message from subplebbit '${subplebbit?.address}' ${getTimeAgo(lastSubplebbitPubsubMessageTimetamp)}`)
    }
    monitorState.subplebbits[subplebbit?.address] = {
      ...monitorState.subplebbits[subplebbit?.address],
      lastSubplebbitPubsubMessageTimetamp
    }

    // fetch pubsub peers after subcribing to topic in getLastSubplebbitPubsubMessageTimetamp
    await new Promise(r => setTimeout(r, 10000))
    const pubsubPeers = await fetchPubsubPeers(subplebbit, pubsubTopic)
    if (pubsubPeers) {
      console.log(`fetched ${pubsubPeers.length} pubsub peers for '${subplebbit?.address}'`)
    }
    monitorState.subplebbits[subplebbit?.address] = {
      ...monitorState.subplebbits[subplebbit?.address],
      pubsubPeers
    }    
  })().catch(e => console.log(e.message))
}

const fetchPubsubDhtPeers = async (subplebbit, pubsubTopic) => {
  if (!pubsubTopic) {
    throw Error(`can't fetch pubsub dht peers for '${subplebbit.address}' no pubsub topic found yet`)
  }

  // the pubsub topic dht key used by kubo is a cid of "floodsub:topic"
  const pubsubTopicDhtKey = await stringToCid(`floodsub:${pubsubTopic}`)

  let error = Error(`failed fetching pubsub dht peers for '${subplebbit.address}'`)
  for (const delegatedRoutingUrl of config.delegatedRoutingUrls) {
    try {
      let textResponse = await fetch(`${delegatedRoutingUrl}/routing/v1/providers/${pubsubTopicDhtKey}`, fetchOptions).then(res => res.text())
      try {
        const {Providers: pubsubDhtPeers} = JSON.parse(textResponse)
        if (!Array.isArray(pubsubDhtPeers)) {
          error = Error(`failed fetching pubsub dht peers for '${subplebbit.address}' from url '${delegatedRoutingUrl}' got response '${textResponse.substring(0, 400)}'`)
          continue
        }
        return pubsubDhtPeers
      }
      catch (e) {
        try {
          textResponse = stripHtml(textResponse).result
        }
        catch (e) {}
        error = Error(`failed fetching pubsub dht peers for '${subplebbit.address}' from url '${delegatedRoutingUrl}' got response '${textResponse.substring(0, 400)}'`)
        continue
      }
    }
    catch (e) {
      error = Error(`failed fetching pubsub dht peers for '${subplebbit.address}' from url '${delegatedRoutingUrl}': ${e.message}`)
      continue
    }
  }
  // none of the delegated routing urls worked
  throw error
}
// test
// console.log(await fetchPubsubDhtPeers({address: 'business-and-finance.eth'}, '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh'))

const fetchPubsubPeers = async (subplebbit, pubsubTopic) => {
  if (!pubsubTopic) {
    throw Error(`can't fetch pubsub peers for '${subplebbit.address}' no pubsub topic found yet`)
  }

  try {
    // probably not needed to check subscriptions
    // const subscriptions = await kubo.pubsub.ls()
    // if (!subscriptions.includes(pubsubTopic)) {
    //   throw Error(`not yet subscribed to pubsub topic '${pubsubTopic}'`)
    // }

    const pubsubPeers = await kubo.pubsub.peers(pubsubTopic)
    return pubsubPeers
  }
  catch (e) {
    throw Error(`failed fetching pubsub peers for '${subplebbit.address}': ${e.message}`)
  }
}
// test
// console.log(await fetchPubsubPeers({address: 'business-and-finance.eth'}, '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh'))

const getLastSubplebbitPubsubMessageTimetamp = async (subplebbit, pubsubTopic, subplebbitPublicKey) => {
  if (!pubsubTopic) {
    throw Error(`can't get last pubsub message timetamp for '${subplebbit.address}' no pubsub topic found yet`)
  }
  if (!subplebbitPublicKey) {
    throw Error(`can't get last pubsub message timetamp for '${subplebbit.address}' no subplebbit public key found yet`)
  }

  await startListeningToPubsubMessages(subplebbit, pubsubTopic, subplebbitPublicKey)

  return lastPubsubMessages[subplebbit.address]
}
// test
// setInterval(async () => console.log(await getLastSubplebbitPubsubMessageTimetamp({address: 'business-and-finance.eth'}, '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh', 'umVN3GWZtpq4ZJokGwplTbyOt5HGJ03wDHTbQ4m3rxg')), 10000)

const isListeningToPubsubMessages = {}
const lastPubsubMessages = {}
const startListeningToPubsubMessages = async (subplebbit, pubsubTopic, subplebbitPublicKey) => {
  if (isListeningToPubsubMessages[pubsubTopic]) {
    return
  }
  isListeningToPubsubMessages[pubsubTopic] = true

  const onPubsubMessageReceived = (rawPubsubMessage) => {
    try {
      const pubsubMessage = cborg.decode(rawPubsubMessage?.data)
      const pubsubMessagePublicKeyBase64 = uint8ArrayToString(pubsubMessage?.signature?.publicKey, 'base64')

      // TODO: this can be exploited by republishing old subplebbit messages, needs more validation
      if (subplebbitPublicKey === pubsubMessagePublicKeyBase64) {
        lastPubsubMessages[subplebbit.address] = Math.round(Date.now() / 1000)
      }
    }
    catch (e) {
      console.log(`failed onPubsubMessageReceived for '${subplebbit.address}': ${e.message}`)
    }
  }

  try {
    await kubo.pubsub.subscribe(pubsubTopic, onPubsubMessageReceived)
  }
  catch (e) {
    isListeningToPubsubMessages[pubsubTopic] = false
    throw e
  }
}

// test
// setInterval(async () => console.log(await monitorSubplebbitPubsub({address: 'business-and-finance.eth'}, '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh', 'umVN3GWZtpq4ZJokGwplTbyOt5HGJ03wDHTbQ4m3rxg')), 10000)
