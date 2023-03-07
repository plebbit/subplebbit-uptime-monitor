module.exports = {
  monitor: {
    interval: 1000 * 60 * 10 // 10 minutes
  },
  alerts: [
    {
      path: './lib/alerts/telegram',
      options: {
        token: 'ABC...'
      }
    }
  ]
}
