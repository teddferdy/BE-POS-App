const { AsyncLocalStorage } = require('async_hooks')

const userContext = new AsyncLocalStorage()

module.exports = userContext
