import config from '../config.js'
import monitorState from './monitor-state.js'
import Plebbit from '@plebbit/plebbit-js'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')
import {getPlebbitAddressFromPublicKey} from './utils.js'

const plebbit = await Plebbit(config.plebbitOptions)
// plebbit.on('error', console.log)

export const monitorSubplebbitsIpns = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring) {
    // console.log(`fetching subplebbit '${subplebbit?.address}' ipns`)
    plebbit.getSubplebbit(subplebbit?.address)
      .then(async subplebbitUpdate => {
        console.log(`fetched subplebbit '${subplebbit?.address}' ipns last updated ${timeAgo.format(subplebbitUpdate.updatedAt * 1000)}`)
        monitorState.subplebbits[subplebbit?.address] = {
          ...monitorState.subplebbits[subplebbit?.address],
          lastSubplebbitUpdateTimestamp: subplebbitUpdate.updatedAt,
          pubsubTopic: subplebbitUpdate.pubsubTopic
        }

        // TODO: fetch how many dht peers for subplebbit update
        // const text = await fetch(`https://delegated-ipfs.dev/routing/v1/providers/${subplebbitUpdate.updateCid}`).then(res => res.text())
      })
      .catch(e => console.log(`failed to get subplebbit '${subplebbit?.address}': ${e.message}`))
  }
}
