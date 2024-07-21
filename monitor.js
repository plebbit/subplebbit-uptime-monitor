import util from 'util'
// util.inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
import dotenv from 'dotenv'
dotenv.config()
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv
import fs from 'fs-extra'
import fetch from 'node-fetch'

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

const apiPort = 3000
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
app.get('/', (req, res) => {
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
  // cache expires after 1 minutes (60 seconds), must revalidate if expired
  res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate')
  res.send(jsonResponse)
})
app.get('/history', async (req, res) => {
  // cache expires after 10 minutes (600 seconds), must revalidate if expired
  res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate')
  const isFrom = (from, date) => {
    if (!from) return true
    try {
      return from <= new Date(date).getTime()
    }
    catch (e) {}
    return false
  }
  const isTo = (to, date) => {
    if (!to) return true
    try {
      return to >= new Date(date).getTime()
    }
    catch (e) {}
    return false
  }
  try {
    const from = new Date(req.query.from).getTime()
    const to = new Date(req.query.to).getTime()
    const files = await fs.readdir('history')
    const history = []
    for (const file of files) {
      if (isFrom(from, file) && isTo(to, file)) {
        try {
          const stats = JSON.parse(await fs.readFile(`history/${file}`, 'utf8'))
          history.push([Math.round(new Date().getTime() / 1000), stats])
        }
        catch (e) {
          console.log(e)
        }
      }
    }
    const jsonResponse = JSON.stringify(history)
    res.setHeader('Content-Type', 'application/json')
    res.send(jsonResponse)
  }
  catch (e) {
    console.log(e)
    res.status(404)
    res.send(e.message)
  }
})
// save history every 1min
setInterval(async () => {
  const history = await fetch(`http://127.0.0.1:${apiPort}`).then(res => res.json())
  await fs.ensureDir('history')
  await fs.writeFile(`history/${new Date().toISOString()}`, JSON.stringify(history))
}, 1000 * 60)
app.listen(apiPort)

// debug
// console.log('monitoring', monitorState.subplebbitsMonitoring)
// setInterval(() => console.log(monitorState.subplebbits), 10000)
