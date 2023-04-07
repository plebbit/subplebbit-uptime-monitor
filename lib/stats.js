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
      e.message = `failed stats publish '${this.statsConfig}': ${e.message}}`
      console.log(e.message)
    }
  }
}

const statsPublishers = []

const start = async (config) => {
  for (const statsConfig of config?.stats || []) {
    const statsPublisher = new StatsPublisher(statsConfig, config)
    if (typeof config.monitor.interval !== 'number') {
      throw Error('invalid config.monitor.interval not a number')
    }
    statsPublishers.push(statsPublisher)
    statsPublisher.publish().catch(e => console.log(e.message))
    setInterval(() => statsPublisher.publish().catch(e => console.log(e.message)), config.monitor.interval / 10)
  }
}

const add = (key, value) => {
  const previousValue = stats[key]
  stats[key] = value
  statsTimestamps[key] = Date.now()
  if (previousValue !== value) {
    for (const statsPublisher of statsPublishers) {
      statsPublisher.publish().catch(e => console.log(e.message))
    }
  }
}

module.exports = {
  start,
  add
}
