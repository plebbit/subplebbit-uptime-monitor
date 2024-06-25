import config from '../config.js'
import monitorState from './monitor-state.js'
import {stringToCid} from './utils.js'

export const monitorSubplebbitsPubsub = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring) {
    const pubsubTopic = monitorState.subplebbits[subplebbit.address].pubsubTopic
    if (!pubsubTopic) {
      console.log(`can't monitor pubsub for '${subplebbit.address}' no pubsub topic found`)
      continue
    }
    // the pubsub topic dht key used by kubo is a cid of "floodsub:topic"
    const pubsubTopicDhtKey = await stringToCid(`floodsub:${pubsubTopic}`)
    fetch(`https://delegated-ipfs.dev/routing/v1/providers/${pubsubTopicDhtKey}`).then(res => res.text())
    .then(async text => {
      console.log(`fetched subplebbit '${subplebbit?.address}' pubsub dht peers`, text)
      // monitorState.subplebbits[subplebbit?.address] = {
      //   ...monitorState.subplebbits[subplebbit?.address],
      //   lastSubplebbitUpdateTimetsamp: subplebbitUpdate.updatedAt
      // }

      // TODO: fetch how many dht peers for subplebbit update
    })
    .catch(e => console.log(`failed to fetch pubsub dht peers for '${subplebbit?.address}': ${e.message}`))
  }
}
