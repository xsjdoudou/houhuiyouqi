const assert = require('assert')
const { createOrder } = require('../cloudfunctions/payment/create-order')
const { reconcileRecord } = require('../cloudfunctions/payment/reconcile')
const { createRecordsHandler } = require('../cloudfunctions/records/service')
const { canAccessResult } = require('../cloudfunctions/payment/result-access')

async function run() {
  const owner = 'test-owner'
  const record = { _id: 'r1', owner, type: 'xufei', version: 3 }
  const otherRecord = { _id: 'r2', owner, type: 'lina', version: 3 }
  const orders = []
  let platformStatus = 1
  const deps = {
    appKey: 'test-key',
    exchangeCode: async () => ({ openid: owner, sessionKey: 'test-session' }),
    getRecord: async id => [record, otherRecord].find(item => item._id === id),
    insertOrder: async order => orders.push(Object.assign({ _id: order.orderId }, order)),
    listPendingOrders: async user => orders.filter(order =>
      order.owner === user && order.status === 'pending'),
    queryOrder: async () => ({ errcode: 0, order: { status: platformStatus } }),
    markDelivered: async order => {
      if (order.status !== 'pending' || order.revoked) return false
      order.status = 'delivered'
      return true
    },
    markClosed: async order => { order.status = 'closed'; return true }
  }
  const getResult = createRecordsHandler({
    get: async (user, id) => [record, otherRecord].find(item => item._id === id && item.owner === user),
    hasAccess: async (user, id) => canAccessResult(user, await deps.getRecord(id), orders)
  })
  const view = (user, id) => getResult({ action: 'get', id }, user)
  await createOrder({ owner, recordId: 'r1', productId: 'one_time', loginCode: 'code' }, deps)
  assert.strictEqual((await view(owner, 'r1')).locked, true)
  await reconcileRecord(owner, 'r1', deps)
  assert.strictEqual((await view(owner, 'r1')).locked, true)
  platformStatus = 2
  await reconcileRecord(owner, 'r2', deps)
  assert.strictEqual((await view(owner, 'r1')).locked, false)
  assert.strictEqual((await view(owner, 'r2')).locked, true)
  await reconcileRecord(owner, 'r1', deps)
  assert.strictEqual(orders.length, 1)
  assert.strictEqual((await view('another-user', 'r1')).ok, false)

  await createOrder({ owner, recordId: 'r1', productId: 'always', loginCode: 'code' }, deps)
  await reconcileRecord(owner, 'r1', deps)
  assert.strictEqual((await view(owner, 'r2')).locked, false)
  orders[1].revoked = true
  assert.strictEqual((await view(owner, 'r2')).locked, true)
  assert.strictEqual((await view(owner, 'r1')).locked, false)
  console.log('payment flow tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
