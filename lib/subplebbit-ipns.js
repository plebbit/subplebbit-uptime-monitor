import config from '../config.js'
import monitorState from './monitor-state.js'
import Plebbit from '@plebbit/plebbit-js'
import {getPlebbitAddressFromPublicKey, getTimeAgo} from './utils.js'

const plebbit = await Plebbit(config.plebbitOptions)
// plebbit.on('error', console.log)

export const monitorSubplebbitsIpns = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring) {
    // console.log(`fetching subplebbit '${subplebbit?.address}' ipns`)
    plebbit.getSubplebbit(subplebbit?.address)
      .then(async subplebbitUpdate => {
        console.log(`fetched subplebbit '${subplebbit?.address}' ipns last updated ${getTimeAgo(subplebbitUpdate.updatedAt)}`)
        monitorState.subplebbits[subplebbit?.address] = {
          ...monitorState.subplebbits[subplebbit?.address],
          lastSubplebbitUpdateTimestamp: subplebbitUpdate.updatedAt,
          pubsubTopic: subplebbitUpdate.pubsubTopic, // needed for pubsub monitoring
          publicKey: subplebbitUpdate.signature.publicKey // needed for pubsub monitoring
        }

        // TODO: fetch how many dht peers for subplebbit update
        // const text = await fetch(`https://delegated-ipfs.dev/routing/v1/providers/${subplebbitUpdate.updateCid}`).then(res => res.text())
      })
      .catch(e => console.log(`failed to get subplebbit '${subplebbit?.address}': ${e.message}`))
  }
}
