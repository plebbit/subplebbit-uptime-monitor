const ethers = require('ethers')
const fetch = require('node-fetch')
const {ipfsGatewayPort} = require('./settings')
const defaultIpfsGatewayUrl = `http://127.0.0.1:${ipfsGatewayPort}`
const path = require('path')

const startMonitorLoop = async (subplebbitAddress, config) => {
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
    this.ipfsGatewayUrl = config?.ipfs?.gatewayUrl || defaultIpfsGatewayUrl
    this.lastAlert = 0
  }

  async monitor() {
    let error
    try {
      await this.getSubplebbit()
    }
    catch (e) {
      error = e
      console.log(e.message)
    }

    if (this.isOnline()) {
      console.log('subplebbit is online', this.logInfo)
    }
    else {
      console.log('subplebbit is offline', this.logInfo)
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
        ipnsName = await resolveEnsTxtRecord(this.subplebbitAddress, 'subplebbit-address')
      }
      catch (e) {
        e.message = `failed resolving address ${this.errorInfo}: ${e.message}`
        throw e
      }
      this.logInfo.ipnsName = ipnsName
      this.errorInfo = `'${this.subplebbitAddress}' '${this.ipnsName}'`
      console.log('resolved address', this.logInfo)
    }

    console.log('fetching ipns name', this.logInfo)
    const text = await fetch(`${this.ipfsGatewayUrl}/ipns/${this.ipnsName}`).then(res => res.text())
    try {
      this.subplebbit = JSON.parse(text)
    }
    catch (e) {
      throw Error(`failed fetching subplebbit ipns ${this.errorInfo}: '${text}'`)
    }
    console.log('fetched ipns name', this.logInfo)

    return this.subplebbit
  }

  isOnline() {
    if (typeof this.subplebbit?.updatedAt !== 'number') {
      return false
    }
    const now = Math.round(Date.now() / 1000)
    if (this.subplebbit?.updatedAt > now - 60 * 60) { // 60 minutes ago
      return true
    } 
    return false
  }

  shouldAlert() {
    if (this.lastAlert > Date.now() - 1000 * 60 * 60) { // only alert once per hour
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

const resolveEnsTxtRecord = async (ensName, txtRecordName) => {
  const ethProvider = ethers.getDefaultProvider()
  const resolver = await ethProvider.getResolver(ensName)
  const txtRecordResult = await resolver.getText(txtRecordName)
  return txtRecordResult
}

module.exports = startMonitorLoop
