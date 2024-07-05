import fs from 'fs'

// no initial state, the app state is set by importing this file and adding props to this object
let monitorState = {
  subplebbits: {}
}

// try to load state from disk on startup
try {
  monitorState = JSON.parse(fs.readFileSync('monitorState.json', 'utf8'))
}
catch (e) {}

export default monitorState

// save state to disk every 1min
setInterval(() => {
  fs.writeFileSync('monitorState.json', JSON.stringify(monitorState, null, 2))
}, 1000 * 60)
