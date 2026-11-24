const assert = require('assert')
const { reconcileRecord } = require('../cloudfunctions/payment/reconcile')
const { createWechatApi } = require('../cloudfunctions/payment/wechat-api')

async function run() {
  const order = { _id: 'db1', orderId: 'T12345678', owner: 'user1', recordId: 'r1', productId: 'one_time', status: 'pending', revoked: false }
  let count = 0
  let closed = 0
  let status = 2
  const deps = {
    getRecord: async id => ({ _id: id, owner: 'user1' }),
    listPendingOrders: async () => [order],
    queryOrder: async () => ({ errcode: 0, order: { status } }),
    markDelivered: async () => { count++; return true },
    markClosed: async () => { closed++; return true }
  }
  assert.deepStrictEqual(await reconcileRecord('user1', 'r1', deps), { ok: true, updated: true, checked: 1 })
  assert.strictEqual(count, 1)
  status = 1
  assert.strictEqual((await reconcileRecord('user1', 'r1', deps)).updated, false)
  status = 6
  await reconcileRecord('user1', 'r1', deps)
  assert.strictEqual(closed, 1)
  status = '2'
  await assert.rejects(reconcileRecord('user1', 'r1', deps))
  await assert.rejects(reconcileRecord('user2', 'r1', deps))
  status = 2
  await reconcileRecord('user1', 'r1', Object.assign({}, deps, { listPendingOrders: async () => [Object.assign({}, order, { owner: 'user2' })] }))
  assert.strictEqual(count, 1)
  await reconcileRecord('user1', 'r2', deps)
  assert.strictEqual(count, 2)
  await reconcileRecord('user1', 'r2', Object.assign({}, deps, {
    listPendingOrders: async () => [Object.assign({}, order, { recordId: '' })]
  }))
  assert.strictEqual(count, 2)
  const secondOrder = Object.assign({}, order, { _id: 'db2', orderId: 'T87654321', recordId: 'r2' })
  const attempted = []
  await assert.rejects(reconcileRecord('user1', 'r2', Object.assign({}, deps, {
    listPendingOrders: async () => [order, secondOrder],
    queryOrder: async (owner, orderId) => {
      attempted.push(orderId)
      if (orderId === order.orderId) throw new Error('network failure')
      return { errcode: 0, order: { status: 2 } }
    }
  })))
  assert.deepStrictEqual(attempted, [order.orderId, secondOrder.orderId])
  assert.strictEqual(count, 3)

  const calls = []
  const api = createWechatApi({ appId: 'appid', appSecret: 'secret', appKey: 'key' }, async (url, method, body) => {
    calls.push({ url, method, body })
    return calls.length === 1 ? { access_token: 'token', expires_in: 7200 } : { errcode: 0, order: { status: 2 } }
  })
  assert.strictEqual((await api.queryOrder('user1', 'T12345678')).order.status, 2)
  assert.strictEqual(calls[0].method, 'POST')
  assert.strictEqual(new URL(calls[0].url).pathname, '/cgi-bin/stable_token')
  assert.deepStrictEqual(JSON.parse(calls[0].body), { grant_type: 'client_credential', appid: 'appid', secret: 'secret' })
  assert.strictEqual(calls[1].method, 'POST')
  assert.deepStrictEqual(JSON.parse(calls[1].body), { openid: 'user1', env: 0, order_id: 'T12345678' })
  await api.queryOrder('user1', 'T12345678')
  assert.strictEqual(calls.length, 3)
  const sandboxCalls = []
  const sandboxApi = createWechatApi({
    appId: 'appid', appSecret: 'secret', appKey: 'sandbox-key', paymentEnv: 1
  }, async (url, method, body) => {
    sandboxCalls.push({ url, method, body })
    return sandboxCalls.length === 1
      ? { access_token: 'token', expires_in: 7200 }
      : { errcode: 0, order: { status: 2 } }
  })
  await sandboxApi.queryOrder('user1', 'T12345678')
  assert.strictEqual(JSON.parse(sandboxCalls[1].body).env, 1)
  assert.strictEqual(new URL(sandboxCalls[1].url).searchParams.get('pay_sig'),
    require('../cloudfunctions/payment/signing').signPayRequest('/xpay/query_order', sandboxCalls[1].body, 'sandbox-key'))
  console.log('payment reconcile tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
