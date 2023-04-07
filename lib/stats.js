const path = require('path')

const stats = {}
const statsTimestamps = {}

class StatsPublisher {
  constructor(statsConfig, config) {
    this.statsConfig = statsConfig
    this.config = config
  }

  async publish() {
    try {
      const publish = require(path.resolve(this.statsConfig.path))
      await publish({statsConfig: this.statsConfig, stats, statsTimestamps})
    }
    catch (e) {
      e.message = `failed stats publish '${this.statsConfig.path}': ${e.message}}`
      console.log(e.message)
    }
  }
}

const start = async (config) => {
  for (const statsConfig of config?.stats || []) {
    const statsPublisher = new StatsPublisher(statsConfig, config)
    statsPublisher.publish().catch(e => console.log(e.message))
    setInterval(() => statsPublisher.publish().catch(e => console.log(e.message)), 10_000)
  }
}

const add = (key, value) => {
  stats[key] = value
  statsTimestamps[key] = Date.now()
}

module.exports = {
  start,
  add
}
