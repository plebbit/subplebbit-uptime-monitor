const ethers = require('ethers')
const fetch = require('node-fetch')
const {ipfsGatewayPort, ipfsApiPort} = require('./settings')
const defaultIpfsGatewayUrl = `http://127.0.0.1:${ipfsGatewayPort}`
const defaultPubsubClientUrl = `http://127.0.0.1:${ipfsApiPort}/api/v0`
const path = require('path')
const pubsub = require('./pubsub')
const ipfsMonitor = require('./ipfsMonitor')
const stats = require('./stats')

const startMonitorLoop = async (subplebbitAddress, config) => {
  await ipfsMonitor.start(config)

  const monitor = new Monitor(subplebbitAddress, config)
  if (typeof config.monitor.interval !== 'number') {
    throw Error('invalid config.monitor.interval not a number')
  }
  monitor.monitor()
  setInterval(() => monitor.monitor(), config.monitor.interval)
}

class Monitor {
  constructor(subplebbitAddress, config) {
    this.subplebbitAddress = subplebbitAddress
    this.config = config
    this.ipnsName = subplebbitAddress
    this.logInfo = {subplebbitAddress}
    this.errorInfo = `'${this.ipnsName}'`
    this.ipfsGatewayUrl = config?.plebbitOptions?.ipfsGatewayUrls?.[0] || defaultIpfsGatewayUrl
    this.pubsubHttpClientOptions = config?.plebbitOptions?.pubsubHttpClientsOptions?.[0] || defaultPubsubClientUrl
    this.lastAlert = 0

    // add first before checking so the subs are in order
    stats.add(this.subplebbitAddress, 'pending')
  }

  async monitor() {
    // reset values before loop
    delete this.subplebbit
    delete this.challenge

    if (ipfsMonitor.ipfsGatewayIsOffline) {
      console.log('ipfs gateway is offline, skip monitor', this.logInfo)
      return
    }
    if (ipfsMonitor.pubsubProviderIsOffline) {
      console.log('pubsub provider is offline, skip monitor', this.logInfo)
      return
    }

    let error
    try {
      await this.getSubplebbit()
    }
    catch (e) {
      error = e
      console.log(e.message)
    }
    if (!error) {
      try {
        await this.getChallenge()
      }
      catch (e) {
        error = e
        console.log(e.message)
      }
    }

    let isOnline = false
    if (!error) {
      try {
        isOnline = this.isOnline()
      }
      catch (e) {
        error = e
        console.log(e.message)
      }
    }

    if (isOnline) {
      console.log('subplebbit is online', this.logInfo)
      stats.add(this.subplebbitAddress, 'online')
    }
    else {
      console.log('subplebbit is offline', this.logInfo)
      stats.add(this.subplebbitAddress, 'offline')
      if (this.shouldAlert()) {
        await this.alert(error)
      }
      else {
        console.log('should not alert', this.logInfo)
      }
    }
  }

  async getSubplebbit() {
    if (this.subplebbitAddress.endsWith('.eth')) {
      console.log('resolving address', this.logInfo)
      try {
        this.ipnsName = await resolveEnsTxtRecord(this.subplebbitAddress, 'subplebbit-address', this.config?.plebbitOptions?.chainProviders?.eth?.urls?.[0])
      }
      catch (e) {
        e.message = `failed resolving address ${this.errorInfo}: ${e.message}`
        throw e
      }
      this.logInfo.ipnsName = this.ipnsName
      this.errorInfo = `'${this.subplebbitAddress}' '${this.ipnsName}'`
      console.log('resolved address', this.logInfo)
    }

    console.log('fetching ipns name', this.logInfo)
    const text = await fetch(`${this.ipfsGatewayUrl}/ipns/${this.ipnsName}`).then(res => res.text())
    try {
      this.subplebbit = JSON.parse(text)
    }
    catch (e) {
      throw Error(`failed fetching subplebbit ipns ${this.errorInfo}: '${text?.slice?.(0, 200)}'`)
    }
    console.log('fetched ipns name', this.logInfo)

    return this.subplebbit
  }

  // TODO: must remove getChallenge once IP reputation is enabled for failed challenges
  // also this implementation doesn't check the subplebbit signature
  async getChallenge() {
    console.log('getting pubsub challenge', this.logInfo)
    try {
      this.challenge = await pubsub.getChallenge(this)
    }
    catch (e) {
      // console.log(e)
      throw Error(`failed getting pubsub challenge ${this.errorInfo}: ${e.message}`)
    }
    console.log('got pubsub challenge', this.logInfo)

    return this.challenge
  }

  isOnline() {
    if (typeof this.subplebbit?.updatedAt !== 'number') {
      throw Error('failed getting subplebbit ipns')
    }
    const now = Math.round(Date.now() / 1000)
    if (this.subplebbit?.updatedAt <= now - 60 * 60) { // 60 minutes ago
      throw Error('subplebbit ipns older than 1 hour')
    } 
    if (!this.challenge) {
      throw Error('failed getting pubsub challenge')
    }
    return true
  }

  shouldAlert() {
    if (this.lastAlert > Date.now() - 1000 * 60 * 60 * 3) { // only alert once per 3 hour
      return false
    }
    return true
  }

  async alert(error) {
    for (const alertConfig of this.config?.alerts) {
      console.log('alerting', alertConfig.path, this.logInfo)
      try {
        const alert = require(path.resolve(alertConfig.path))
        await alert({
          subplebbitAddress: this.subplebbitAddress,
          config: this.config,
          alert: alertConfig, 
          error
        })
      }
      catch (e) {
        e.message = `failed alert '${alertConfig.path}': ${e.message}}`
        console.log(e.message)
      }
    }
    this.lastAlert = Date.now()
  }
}

const resolveEnsTxtRecord = async (ensName, txtRecordName, chainProviderUrl) => {
  let ethProvider
  if (chainProviderUrl) {
    ethProvider = new ethers.JsonRpcProvider(chainProviderUrl)
  }
  else {
    ethProvider = ethers.getDefaultProvider()
  }
  const resolver = await ethProvider.getResolver(ensName)
  if (!resolver) {
    throw Error(`ethProvider.getResolver returned '${resolver}', can't get text record`)
  }
  const txtRecordResult = await resolver.getText(txtRecordName)
  return txtRecordResult
}

module.exports = startMonitorLoop
