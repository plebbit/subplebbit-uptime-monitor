const ethers = require('ethers')
const ethProvider = ethers.getDefaultProvider()
const fetch = require('node-fetch')
const {ipfsGatewayPort} = require('./settings')
const ipnsGatewayUrl = `http://127.0.0.1:${ipfsGatewayPort}/ipns`

const isOnline = (subplebbit) => {
  if (typeof subplebbit?.updatedAt !== 'number') {
    return false
  }
  const now = Math.round(Date.now() / 1000)
  if (subplebbit?.updatedAt > now - 60 * 60) { // 60 minutes ago
    return true
  } 
  return false
}

const monitor = async (subplebbitAddress, config) => {
  let ipnsName = subplebbitAddress
  const logInfo = {subplebbitAddress}
  let errorInfo = `'${ipnsName}'`

  if (subplebbitAddress.endsWith('.eth')) {
    console.log('resolving address', logInfo)
    try {
      ipnsName = await resolveEnsTxtRecord(subplebbitAddress, 'subplebbit-address')
    }
    catch (e) {
      e.message = `failed resolving address ${errorInfo}: ${e.message}`
      throw e
    }
    logInfo.ipnsName = ipnsName
    errorInfo = `'${subplebbitAddress}' '${ipnsName}'`
    console.log('resolved address', logInfo)
  }

  console.log('fetching ipns name', logInfo)
  const text = await fetch(`${ipnsGatewayUrl}/${ipnsName}`).then(res => res.text())
  let subplebbit
  try {
    subplebbit = JSON.parse(text)
  }
  catch (e) {
    throw Error(`failed fetching subplebbit ipns ${errorInfo}: '${text}'`)
  }
  console.log('fetched ipns name', logInfo)

  if (isOnline(subplebbit)) {
    console.log('subplebbit is online', logInfo)
  }
  else {
    console.log('subplebbit is offline', logInfo)
  }
}

const resolveEnsTxtRecord = async (ensName, txtRecordName) => {
  const resolver = await ethProvider.getResolver(ensName)
  const txtRecordResult = await resolver.getText(txtRecordName)
  return txtRecordResult
}

module.exports = monitor
