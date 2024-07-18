import path from 'path'
import {fileURLToPath} from 'url'
import { spawn } from 'child_process'
import fs from 'fs-extra'
import ps from 'node:process'
import ProgressBar from 'progress'
import https from 'https'
import decompress from 'decompress'

const ipfsGatewayPort = 8080
const ipfsApiPort = 5001
const ipfsClientVersion = '0.29.0'
let ipfsClientUrl = `https://dist.ipfs.io/kubo/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_linux-amd64.tar.gz`
if (process.platform === 'win32') {
  ipfsClientUrl = `https://dist.ipfs.io/kubo/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_windows-amd64.zip`
}
if (process.platform === 'darwin') {
  ipfsClientUrl = `https://dist.ipfs.io/kubo/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_darwin-amd64.tar.gz`
}

const downloadWithProgress = (url) =>
  new Promise((resolve) => {
    const split = url.split('/')
    const fileName = split[split.length - 1]
    const chunks = []
    const req = https.request(url)
    req.on('response', (res) => {
      // handle redirects
      if (res.statusCode == 301 || res.statusCode === 302) {
        resolve(downloadWithProgress(res.headers.location))
        return
      }

      const len = parseInt(res.headers['content-length'], 10)
      console.log()
      const bar = new ProgressBar(`  ${fileName} [:bar] :rate/bps :percent :etas`, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len,
      })
      res.on('data', (chunk) => {
        chunks.push(chunk)
        bar.tick(chunk.length)
      })
      res.on('end', () => {
        console.log('\n')
        resolve(Buffer.concat(chunks))
      })
    })
    req.end()
  })

// official kubo downloads need to be extracted
const downloadAndExtract = async (url, destinationPath) => {
  const binName = 'ipfs'
  const binPath = path.join(destinationPath, binName)
  if (fs.pathExistsSync(binPath)) {
    return
  }
  const split = url.split('/')
  const fileName = split[split.length - 1]
  const dowloadPath = path.join(destinationPath, fileName)
  const file = await downloadWithProgress(url)
  fs.ensureDirSync(destinationPath)
  await fs.writeFile(dowloadPath, file)
  await decompress(dowloadPath, destinationPath)
  const extractedPath = path.join(destinationPath, 'kubo')
  const extractedBinPath = path.join(extractedPath, binName)
  fs.moveSync(extractedBinPath, binPath)
  fs.removeSync(extractedPath)
  fs.removeSync(dowloadPath)
}

// use this custom function instead of spawnSync for better logging
// also spawnSync might have been causing crash on start on windows
const spawnAsync = (...args) =>
  new Promise((resolve, reject) => {
    const spawedProcess = spawn(...args)
    spawedProcess.on('exit', (exitCode, signal) => {
      if (exitCode === 0) resolve()
      else
        reject(
          Error(
            `spawnAsync process '${spawedProcess.pid}' exited with code '${exitCode}' signal '${signal}'`
          )
        )
    })
    spawedProcess.stderr.on('data', (data) => console.error(data.toString()))
    spawedProcess.stdin.on('data', (data) => console.log(data.toString()))
    spawedProcess.stdout.on('data', (data) => console.log(data.toString()))
    spawedProcess.on('error', (data) => console.error(data.toString()))
  })

const startIpfs = async () => {
  const ipfsFileName = 'ipfs'
  const rootPath = path.dirname(fileURLToPath(import.meta.url))
  const ipfsFolderPath = path.resolve(rootPath, 'bin')
  const ipfsPath = path.resolve(ipfsFolderPath, ipfsFileName)
  if (!fs.pathExistsSync(ipfsPath)) {
    await downloadAndExtract(ipfsClientUrl, ipfsFolderPath)
  }
  const ipfsDataPath = path.resolve(rootPath, '.ipfs')

  if (!fs.existsSync(ipfsPath)) {
    throw Error(`ipfs binary '${ipfsPath}' doesn't exist`)
  }

  fs.ensureDirSync(ipfsDataPath)
  const env = { IPFS_PATH: ipfsDataPath }
  // init ipfs client on first launch
  try {
    await spawnAsync(ipfsPath, ['init'], { env, hideWindows: true })
  } catch (e) {}

  // dont use 8080 port because it's too common
  await spawnAsync(ipfsPath, ['config', 'Addresses.Gateway', `/ip4/127.0.0.1/tcp/${ipfsGatewayPort}`], {
    env,
    hideWindows: true,
  })
  // dont use 5001 in case it's already in use
  await spawnAsync(ipfsPath, ['config', 'Addresses.API', `/ip4/127.0.0.1/tcp/${ipfsApiPort}`], {
    env,
    hideWindows: true,
  })

  await new Promise((resolve, reject) => {
    const ipfsProcess = spawn(
      ipfsPath,
      ['daemon', '--enable-pubsub-experiment', '--enable-namesys-pubsub'],
      { env, hideWindows: true }
    )
    console.log(`ipfs daemon process started with pid ${ipfsProcess.pid}`)
    let lastError
    ipfsProcess.stderr.on('data', (data) => {
      lastError = data.toString()
      console.error(data.toString())
    })
    ipfsProcess.stdin.on('data', (data) => console.log(data.toString()))
    ipfsProcess.stdout.on('data', (data) => console.log(data.toString()))
    ipfsProcess.on('error', (data) => console.error(data.toString()))
    ipfsProcess.on('exit', () => {
      console.error(`ipfs process with pid ${ipfsProcess.pid} exited`)
      reject(Error(lastError))
    })
    process.on('exit', () => {
      try {
        ps.kill(ipfsProcess.pid)
      } catch (e) {
        console.log(e)
      }
      try {
        // sometimes ipfs doesnt exit unless we kill pid +1
        ps.kill(ipfsProcess.pid + 1)
      } catch (e) {
        console.log(e)
      }
    })

    // daemon is ready
    ipfsProcess.stdout.on("data", (data) => {
      if (data.toString().match("Daemon is ready")) {
        resolve()
      }
    })
  })
}

startIpfs()
