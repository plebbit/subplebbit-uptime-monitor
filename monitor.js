import util from 'util'
// util.inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
import dotenv from 'dotenv'
dotenv.config()
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv

import {fetchMultisubUrl} from './lib/utils.js'
import config from './config.js'
import monitorState from './lib/monitor-state.js'
import {monitorSubplebbitsIpns} from './lib/subplebbit-ipns.js'
import {monitorSubplebbitsPubsub} from './lib/subplebbit-pubsub.js'
import {monitorIpfsGateways} from './lib/ipfs-gateway.js'

if (!config?.monitoring?.multisubs) {
  console.log(`missing config.js 'monitoring.multisubs'`)
  process.exit()
}

const multisubsIntervalMs = 1000 * 60 * 60
const subplebbitsIpnsIntervalMs = 1000 * 60 * 10
const subplebbitsPubsubIntervalMs = 1000 * 60 * 10
const ipfsGatewaysIntervalMs = 1000 * 60 * 10

// fetch subplebbits to monitor every hour
const multisubs = []
const getSubplebbitsMonitoring = async () => {
  const promises = await Promise.allSettled(config.monitoring.multisubs.map(multisubUrl => fetchMultisubUrl(multisubUrl)))
  for (const [i, {status, value: multisub, reason}] of promises.entries()) {
    if (status === 'fulfilled') {
      multisubs[i] = multisub
    }
    else {
      console.log(`failed getting subplebbits to monitor (${i + 1} of ${promises.length}): ${reason}`)
    }
  }

  const subplebbitsMap = new Map()
  for (const multisub of multisubs) {
    if (!multisub) {
      continue
    }
    for (const subplebbit of multisub.subplebbits) {
      if (!subplebbitsMap.has(subplebbit.address)) {
        subplebbitsMap.set(subplebbit.address, subplebbit)
      }
    }
  }

  // set initial state
  if (subplebbitsMap.size > 0) {
    monitorState.subplebbitsMonitoring = [...subplebbitsMap.values()]
    for (const subplebbit of monitorState.subplebbitsMonitoring) {
      monitorState.subplebbits[subplebbit.address] = {
        ...monitorState.subplebbits[subplebbit.address],
        address: subplebbit.address,
      }
    }
  }
}
setInterval(() => getSubplebbitsMonitoring().catch(e => console.log(e.message)), multisubsIntervalMs)

// fetch subs to monitor at least once before starting
while (!monitorState.subplebbitsMonitoring) {
  await getSubplebbitsMonitoring()
  if (!monitorState.subplebbitsMonitoring) {
    console.log('retrying getting subplebbits to monitor in 10 seconds')
    await new Promise(r => setTimeout(r, 10000))
  }
}

// fetch subplebbits ipns every 10min
monitorSubplebbitsIpns().catch(e => console.log(e.message))
setInterval(() => monitorSubplebbitsIpns().catch(e => console.log(e.message)), subplebbitsIpnsIntervalMs)

// rejoin pubsub every 10min
setTimeout(() => monitorSubplebbitsPubsub().catch(e => console.log(e.message)), 1000 * 60) // wait for some pubsub topics to be fetched
setInterval(() => monitorSubplebbitsPubsub().catch(e => console.log(e.message)), subplebbitsPubsubIntervalMs)

// fetch gateways every 10min
monitorIpfsGateways().catch(e => console.log(e.message))
setInterval(() => monitorIpfsGateways().catch(e => console.log(e.message)), ipfsGatewaysIntervalMs)

// start stats endpoint
import express from 'express'
const app = express()
app.get('/', function (req, res) {
  const subplebbits = []
  for (const subplebbitAddress in monitorState.subplebbits) {
    subplebbits.push({
      address: subplebbitAddress,
      lastSubplebbitUpdateTimestamp: monitorState.subplebbits[subplebbitAddress].lastSubplebbitUpdateTimestamp,
      lastSubplebbitPubsubMessageTimetamp: monitorState.subplebbits[subplebbitAddress].lastSubplebbitPubsubMessageTimetamp,
      pubsubDhtPeers: monitorState.subplebbits[subplebbitAddress].pubsubDhtPeers?.length,
      pubsubPeers: monitorState.subplebbits[subplebbitAddress].pubsubPeers?.length,
    })
  }
  const ipfsGateways = []
  for (const ipfsGatewayUrl in monitorState.ipfsGateways) {
    ipfsGateways.push({
      url: ipfsGatewayUrl,
      ...monitorState.ipfsGateways[ipfsGatewayUrl]?.[monitorState.ipfsGateways[ipfsGatewayUrl].length - 1]
    })
  }
  const jsonResponse = JSON.stringify({subplebbits, ipfsGateways}, null, 2)
  res.setHeader('Content-Type', 'application/json')
  res.send(jsonResponse)
})
app.listen(3000)

// debug
// console.log('monitoring', monitorState.subplebbitsMonitoring)
// setInterval(() => console.log(monitorState.subplebbits), 10000)
