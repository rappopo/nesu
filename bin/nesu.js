function start() {
  var nesu = require('../index.js')
  nesu()
}

module.exports = start

if (!module.parent) {
  start()
}