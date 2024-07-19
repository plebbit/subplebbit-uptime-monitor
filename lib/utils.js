import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()
import fs from 'fs'
import {stripHtml} from 'string-strip-html'
import {HttpsProxyAgent} from 'https-proxy-agent'

export const fetchMultisubUrl = async (multisubUrl) => {
  // if url is a file, try to read the file
  if (!multisubUrl.startsWith('http')) {
    return JSON.parse(fs.readFileSync(multisubUrl, 'utf8'))
  }

  console.log(`fetching multisub url '${multisubUrl}'`)
  let multisub
  try {
    multisub = await fetchJson(multisubUrl)
  } 
  catch (e) {
    throw Error(`failed fetching multisub from url '${multisubUrl}': ${e.message}`)
  }
  if (!Array.isArray(multisub.subplebbits)) {
    throw Error(`failed fetching multisub from url '${multisubUrl}' got response '${JSON.stringify(multisub).substring(0, 300)}'`)
  }
  return multisub
}

const fetchOptions = {
  agent: process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined,
  headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36'}
}

export const fetchJson = async (url) => {
  let textResponse = await fetch(url, fetchOptions).then((res) => res.text())
  try {
    const json = JSON.parse(textResponse)
    return json
  }
  catch (e) {
    try {
      textResponse = stripHtml(textResponse).result
    }
    catch (e) {}
    throw Error(`failed fetching got response '${textResponse.substring(0, 300)}'`)
  }
}

export const fetchKuboApi = async (url) => {
  let textResponse = await fetch(url, {...fetchOptions, method: 'POST'}).then((res) => res.text())
  try {
    const json = textResponse.split('\n').filter(line => line !== '').map(line => JSON.parse(line))
    return json
  }
  catch (e) {
    try {
      textResponse = stripHtml(textResponse).result
    }
    catch (e) {}
    throw Error(`failed fetching got response '${textResponse.substring(0, 300)}'`)
  }
}

import {fromString as uint8ArrayFromString} from 'uint8arrays/from-string'
import {toString as uint8ArrayToString} from 'uint8arrays/to-string'
import {create as createMultihash} from 'multiformats/hashes/digest'
const protobufPublicKeyPrefix = new Uint8Array([8, 1, 18, 32])
const multihashIdentityCode = 0
export const getPlebbitAddressFromPublicKey = (publicKeyBase64) => {
  const publicKeyBuffer = uint8ArrayFromString(publicKeyBase64, 'base64')
  const publicKeyBufferWithPrefix = new Uint8Array(protobufPublicKeyPrefix.length + publicKeyBuffer.length)
  publicKeyBufferWithPrefix.set(protobufPublicKeyPrefix, 0)
  publicKeyBufferWithPrefix.set(publicKeyBuffer, protobufPublicKeyPrefix.length)
  const multihash = createMultihash(multihashIdentityCode, publicKeyBufferWithPrefix).bytes
  return uint8ArrayToString(multihash, 'base58btc')
}

import {CID} from 'multiformats/cid'
import {sha256} from 'multiformats/hashes/sha2'
import {base32} from 'multiformats/bases/base32'

export const pubsubTopicToDhtKey = async (pubsubTopic) => {
  // pubsub topic dht key used by kubo is a cid of "floodsub:topic" https://github.com/libp2p/go-libp2p-pubsub/blob/3aa9d671aec0f777a7f668ca2b2ceb37218fb6bb/discovery.go#L328
  const string = `floodsub:${pubsubTopic}`

  // convert string to same cid as kubo https://github.com/libp2p/go-libp2p/blob/024293c77e17794b0dd9dacec3032b4c5a535f64/p2p/discovery/routing/routing.go#L70
  const bytes = new TextEncoder().encode(string)
  const hash = await sha256.digest(bytes)
  const cidVersion = 1
  const multicodec = 0x55
  const cid = CID.create(cidVersion, multicodec, hash)
  return cid.toString(base32)
}

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')
export const getTimeAgo = (timestampSeconds) => timestampSeconds ? timeAgo.format(timestampSeconds * 1000) : 'never'
