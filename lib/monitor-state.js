import fs from 'fs'

// no initial state, the app state is set by importing this file and adding props to this object
let monitorState = {
  subplebbits: {}
}

try {
  monitorState = JSON.parse(fs.readFileSync('monitorState.json', 'utf8'))
}
catch (e) {}

export default monitorState

setInterval(() => {
  fs.writeFileSync('monitorState.json', JSON.stringify(monitorState, null, 2))
}, 1000 * 60)
