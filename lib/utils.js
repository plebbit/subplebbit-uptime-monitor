import fs from 'fs'
import {stripHtml} from 'string-strip-html'

export const fetchMultisubUrl = async (multisubUrl) => {
  // if url is a file, try to read the file
  if (!multisubUrl.startsWith('http')) {
    return JSON.parse(fs.readFileSync(multisubUrl, 'utf8'))
  }

  let textResponse
  try {
    console.log(`fetching multisub url '${multisubUrl}'`)
    textResponse = await fetch(multisubUrl).then((res) => res.text())
    try {
      const multisub = JSON.parse(textResponse)
      if (!Array.isArray(multisub.subplebbits)) {
        throw Error(`failed fetching multisub from url '${multisubUrl}' got response '${textResponse.substring(0, 400)}'`)
      }
      return multisub
    }
    catch (e) {
      try {
        textResponse = stripHtml(textResponse).result
      }
      catch (e) {}
      throw Error(`failed fetching multisub from url '${multisubUrl}' got response '${textResponse.substring(0, 400)}'`)
    }
  } 
  catch (e) {
    throw Error(`failed fetching multisub from url '${multisubUrl}': ${e.message}`)
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

import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { base32 } from 'multiformats/bases/base32'

const cidVersion = 1
const multicodec = 0x55
export const stringToCid = async (string) => {
  const bytes = new TextEncoder().encode(string)
  const hash = await sha256.digest(bytes)
  const cid = CID.create(cidVersion, multicodec, hash)
  return cid.toString(base32)
}
