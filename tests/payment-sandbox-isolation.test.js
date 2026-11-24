const assert = require('assert')
const Module = require('module')

const originalLoad = Module._load
const paymentPath = require.resolve('../cloudfunctions/payment/index')
const recordsPath = require.resolve('../cloudfunctions/records/index')
const originalEnv = Object.assign({}, process.env)

function loadFunctions(sandbox) {
  if (sandbox === undefined) delete process.env.VIRTUAL_PAYMENT_SANDBOX
  else process.env.VIRTUAL_PAYMENT_SANDBOX = sandbox
  const names = []
  const cloud = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database: () => ({ collection: name => { names.push(name); return {} } })
  }
  Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloud
    return originalLoad.call(this, request, parent, isMain)
  }
  delete require.cache[paymentPath]
  delete require.cache[recordsPath]
  require(paymentPath)
  require(recordsPath)
  return names
}

try {
  assert.deepStrictEqual(loadFunctions(undefined),
    ['payment_orders', 'payment_order_locks', 'test_records', 'payment_orders'])
  assert.deepStrictEqual(loadFunctions('1'),
    ['payment_sandbox_orders', 'payment_sandbox_order_locks', 'test_records', 'payment_sandbox_orders'])
  assert.deepStrictEqual(loadFunctions('true'),
    ['payment_orders', 'payment_order_locks', 'test_records', 'payment_orders'])
  console.log('payment sandbox isolation tests passed')
} finally {
  Module._load = originalLoad
  if (originalEnv.VIRTUAL_PAYMENT_SANDBOX === undefined) delete process.env.VIRTUAL_PAYMENT_SANDBOX
  else process.env.VIRTUAL_PAYMENT_SANDBOX = originalEnv.VIRTUAL_PAYMENT_SANDBOX
  delete require.cache[paymentPath]
  delete require.cache[recordsPath]
}
