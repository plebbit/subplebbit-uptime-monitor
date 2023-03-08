const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const fs = require('fs-extra')
const path = require('path')
const monitor = require('./lib/monitor')
const startIpfs = require('./lib/start-ipfs')

if (!argv.subplebbits) {
  console.log('missing argument --subplebbits')
}
let subplebbits
try {
  subplebbits = fs.readFileSync(argv.subplebbits, 'utf8').trim().split(/\r?\n|\r/).map(item => item.trim())
}
catch (e) {
  e.message = `failed reading subplebbits file path '${argv.subplebbits}': ${e.message}`
  throw e
}

if (!argv.config) {
  console.log('missing argument --config')
}
let config
try {
  config = require(path.resolve(argv.config))
}
catch (e) {
  e.message = `failed reading config file path '${argv.config}': ${e.message}`
  throw e
}

console.log('config', config)
console.log('monitoring subplebbits', subplebbits)

if (!config?.alerts?.length) {
  throw Error('config file has no alerts array')
}
if (!config?.monitor?.interval) {
  throw Error('config file has no monitor.interval number')
}

;(async () => {
  if (!config?.ipfs?.gatewayUrl) {
    console.log('config file has no ipfs.gatewayUrl, starting an ipfs daemon...')
    await startIpfs()
  }

  for (subplebbit of subplebbits) {
    monitor(subplebbit, config).catch(console.log)
  }

})()
