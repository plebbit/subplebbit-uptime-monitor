const ethers = require('ethers')
const fetch = require('node-fetch')
const {ipfsGatewayPort} = require('./settings')
const defaultIpfsGatewayUrl = `http://127.0.0.1:${ipfsGatewayPort}`

const monitor = async (subplebbitAddress, config) => {
  const monitor = new Monitor(subplebbitAddress, config)
  try {
    await monitor.getSubplebbit()
  }
  catch (e) {
    console.log(e.message)
  }

  if (monitor.isOnline()) {
    console.log('subplebbit is online', monitor.logInfo)
  }
  else {
    console.log('subplebbit is offline', monitor.logInfo)
    for (const alert of config?.alerts) {
      console.log('do alert', alert.path)
    }
  }
}

class Monitor {
  constructor(subplebbitAddress, config) {
    this.subplebbitAddress = subplebbitAddress
    this.config = config
    this.ipnsName = subplebbitAddress
    this.logInfo = {subplebbitAddress}
    this.errorInfo = `'${this.ipnsName}'`
    this.ipfsGatewayUrl = config?.ipfs?.gatewayUrl || defaultIpfsGatewayUrl
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
}

const resolveEnsTxtRecord = async (ensName, txtRecordName) => {
  const ethProvider = ethers.getDefaultProvider()
  const resolver = await ethProvider.getResolver(ensName)
  const txtRecordResult = await resolver.getText(txtRecordName)
  return txtRecordResult
}

module.exports = monitor
