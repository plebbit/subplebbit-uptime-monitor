import config from '../config.js'
import monitorState from './monitor-state.js'
import {kubo} from './plebbit-js/plebbit-js.js'
import {fetchJson} from './utils.js'

const waitForIpfsAddMs = 1000 * 60 * 5

export const monitorIpfsGateways = async () => {
  for (const ipfsGatewayUrl of config.monitoring.ipfsGatewayUrls) {
    getCommentFetchStats(ipfsGatewayUrl)
      .then(stats => {
        console.log(stats)
        if (!monitorState.ipfsGateways[ipfsGatewayUrl]) {
          monitorState.ipfsGateways[ipfsGatewayUrl] = []
        }
        monitorState.ipfsGateways[ipfsGatewayUrl].push(stats)
      })
      .catch(e => console.log(e.message))    
  }
}

const getStatsLastHours = (hoursCount, ipfsGatewayUrl) => {
  if (typeof hoursCount !== 'number' && hoursCount < 1) {
    throw Error(`getStatsLastHours argument hoursCount '${hoursCount}' not a positve number`)
  }
  if (!monitorState.ipfsGateways[ipfsGatewayUrl]) {
    return []
  }
  const now = Math.round(Date.now() / 1000)
  const hoursAgo = now - 60 * 60 * hoursCount
  const statsArray = []
  for (const stats of monitorState.ipfsGateways[ipfsGatewayUrl]) {
    if (stats.lastCommentFetchAttemptTimestamp > hoursAgo) {
      statsArray.push(stats)
    }
  }
  return statsArray
}

const getSuccessRate = (stats) => {
  const successCount = stats.filter(stats => stats.lastCommentFetchSuccess === true).length
  if (successCount === 0) {
    return 0
  }
  return Number((successCount / stats.length).toFixed(2))
}

const getAverageTime = (stats) => {
  const successStats = stats.filter(stats => stats.lastCommentFetchSuccess === true)
  if (!successStats.length) {
    return
  }
  const totalTime = successStats.reduce((acc, stats) => acc + stats.lastCommentFetchTime, 0)
  return Math.round(totalTime / successStats.length)
}

const getMedianTime = (stats) => {
  const successStats = stats.filter(stats => stats.lastCommentFetchSuccess === true)
  if (!successStats.length) {
    return
  }
  const medianIndex = Math.floor(successStats.length / 2)
  return successStats[medianIndex].lastCommentFetchTime
}

const getAverageAttemptCount = (stats) => {
  const successStats = stats.filter(stats => stats.lastCommentFetchSuccess === true)
  if (!successStats.length) {
    return
  }
  const total = successStats.reduce((acc, stats) => acc + stats.lastCommentFetchAttemptCount, 0)
  return Math.round(total / successStats.length)
}

const getRandomString = () => (Math.random() + 1).toString(36).replace('.', '')

const createFakeComment = () => ({
  author: {
    address: getRandomString()
  },
  signature: {
    signature: getRandomString(),
    publicKey: getRandomString()
  },
  title: getRandomString(),
  content: getRandomString()
})

const fetchJsonRetry = async (fetchJsonRetryOptions) => {
  if (typeof fetchJsonRetryOptions?.url !== 'string') throw Error('fetchJsonRetryOptions.url not a string')
  if (typeof fetchJsonRetryOptions?.retries !== 'number') throw Error('fetchJsonRetryOptions.url not a number')
  if (typeof fetchJsonRetryOptions?.attempts !== 'number') throw Error('fetchJsonRetryOptions.url not a number')
  while (true) {
    fetchJsonRetryOptions.attempts++
    try {
      const json = await fetchJson(fetchJsonRetryOptions.url)
      return json
    }
    catch (e) {
      if (fetchJsonRetryOptions.attempts > fetchJsonRetryOptions.retries) {
        throw e
      }
      console.log(`${fetchJsonRetryOptions.retries - fetchJsonRetryOptions.attempts} retry left fetching '${fetchJsonRetryOptions.url}'`)
    }
  }
}

const getCommentFetchStats = async (ipfsGatewayUrl) => {
  const fakeComment = createFakeComment()
  const {path: cid} = await kubo.add(JSON.stringify(fakeComment))
  await kubo.pin.add(cid)
  console.log(`added comment '${cid}' to '${config.ipfsApiUrl}' to monitor '${ipfsGatewayUrl}'`)

  // wait for comment to propagate to ipfs
  await new Promise(r => setTimeout(r, waitForIpfsAddMs))

  console.log(`fetching comment '${cid}' from '${ipfsGatewayUrl}'`)
  let lastCommentFetchSuccess = false
  let lastCommentFetchTime
  let lastCommentFetchTimestamp
  let lastCommentFetchAttemptCount
  const lastCommentFetchAttemptTimestamp = Math.round(Date.now() / 1000)
  const fetchJsonRetryOptions = {
    url: `${ipfsGatewayUrl}/ipfs/${cid}`,
    retries: 3,
    attempts: 0
  }
  try {
    const beforeTimestamp = Date.now()
    const fetchedComment = await fetchJsonRetry(fetchJsonRetryOptions)
    if (fetchedComment.author.address !== fakeComment.author.address) {
      throw Error(`failed fetching comment from '${ipfsGatewayUrl}' got response '${JSON.stringify(fetchedComment).substring(0, 300)}'`)
    }
    lastCommentFetchSuccess = true
    lastCommentFetchTime = Math.round((Date.now() - beforeTimestamp) / 1000)
    lastCommentFetchTimestamp = lastCommentFetchAttemptTimestamp
    lastCommentFetchAttemptCount = fetchJsonRetryOptions.attempts

    console.log(`fetched comment '${cid}' from '${ipfsGatewayUrl}' in ${lastCommentFetchTime}s`)
  }
  catch (e) {
    console.log(`failed fetching comment '${cid}' from '${ipfsGatewayUrl}': ${e.message}`)
  }

  await kubo.pin.rm(cid)

  const lastStats = {lastCommentFetchSuccess, lastCommentFetchTime, lastCommentFetchAttemptCount}
  const stats1h = [...getStatsLastHours(1, ipfsGatewayUrl), lastStats]
  const stats6h = [...getStatsLastHours(6, ipfsGatewayUrl), lastStats]
  const stats24h = [...getStatsLastHours(24, ipfsGatewayUrl), lastStats]
  return {
    lastCommentFetchSuccess, 
    lastCommentFetchTime, 
    lastCommentFetchTimestamp, 
    lastCommentFetchAttemptTimestamp,
    lastCommentFetchAttemptCount,
    commentFetchSuccessRate1h: getSuccessRate(stats1h),
    commentFetchSuccessRate6h: getSuccessRate(stats6h),
    commentFetchSuccessRate24h: getSuccessRate(stats24h),
    commentFetchAverageTime1h: getAverageTime(stats1h),
    commentFetchAverageTime6h: getAverageTime(stats6h),
    commentFetchAverageTime24h: getAverageTime(stats24h),
    commentFetchMedianTime1h: getMedianTime(stats1h),
    commentFetchMedianTime6h: getMedianTime(stats6h),
    commentFetchMedianTime24h: getMedianTime(stats24h),
    commentFetchAverageAttemptCount1h: getAverageAttemptCount(stats1h),
    commentFetchAverageAttemptCount6h: getAverageAttemptCount(stats6h),
    commentFetchAverageAttemptCount24h: getAverageAttemptCount(stats24h)
  }
}
// test
// console.log(await getCommentFetchStats('https://pubsubprovider.xyz'))

// test
// monitorIpfsGateways(); setInterval(() => monitorIpfsGateways(), 1000 * 60 * 10)
