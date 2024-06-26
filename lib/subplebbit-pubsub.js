import util from 'util'
util.inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
import config from '../config.js'
import monitorState from './monitor-state.js'
import {stringToCid} from './utils.js'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()
import {HttpsProxyAgent} from 'https-proxy-agent'
import {stripHtml} from 'string-strip-html'

const fetchOptions = {
  agent: process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined,
  headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36'}
}

export const monitorSubplebbitsPubsub = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring) {
    monitorSubplebbitPubsub(subplebbit)
      .catch(e => console.log(e.message))
  }
}

const monitorSubplebbitPubsub = async (subplebbit) => {
  fetchPubsubDhtPeers(subplebbit)
    .then(pubsubDhtPeers => {
      monitorState.subplebbits[subplebbit?.address] = {
        ...monitorState.subplebbits[subplebbit?.address],
        pubsubDhtPeers
      }
    })
    .catch(e => console.log(e.message))
}

const fetchPubsubDhtPeers = async (subplebbit) => {
  const pubsubTopic = monitorState.subplebbits[subplebbit?.address]?.pubsubTopic
  if (!pubsubTopic) {
    throw Error(`can't monitor pubsub for '${subplebbit.address}' no pubsub topic found yet`)
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
// console.log(await fetchPubsubDhtPeers({address: 'business-and-finance.eth', pubsubTopic: '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh'}))
