const assert = require('assert')
const { createWechatApi } = require('../cloudfunctions/payment/wechat-api')
const { reconcileRecord } = require('../cloudfunctions/payment/reconcile')

async function run() {
  const original = console.log
  const logs = []
  console.log = (...args) => logs.push(args.join(' '))
  try {
    let calls = 0
    const api = createWechatApi({
      appId: 'private-appid', appSecret: 'private-secret', appKey: 'private-key', paymentEnv: 1
    }, async () => {
      calls++
      return calls === 1
        ? { access_token: 'private-token', expires_in: 7200 }
        : { errcode: 12345, errmsg: 'private-response' }
    })
    let delivered = 0
    const order = {
      owner: 'private-owner', orderId: 'T12345678', recordId: 'private-record',
      productId: 'one_time', status: 'pending', revoked: false
    }
    await assert.rejects(reconcileRecord(order.owner, order.recordId, {
      getRecord: async () => ({ _id: order.recordId, owner: order.owner }),
      listPendingOrders: async () => [order],
      queryOrder: api.queryOrder,
      markDelivered: async () => { delivered++ }
    }))
    assert.strictEqual(delivered, 0)
    const output = logs.join('\n')
    assert(output.includes('"stage":"query_response"'))
    assert(output.includes('"errcode":12345'))
    for (const secret of [
      'private-appid', 'private-secret', 'private-key', 'private-token',
      'private-response', 'private-owner', 'private-record', 'T12345678'
    ]) assert(!output.includes(secret))

    const failedTokenApi = createWechatApi({
      appId: 'appid', appSecret: 'secret', appKey: 'key'
    }, async () => ({ errcode: 40013, errmsg: 'private-token-error' }))
    await assert.rejects(failedTokenApi.queryOrder('user', 'T12345678'))
    assert(logs.join('\n').includes('"errcode":40013'))
    assert(!logs.join('\n').includes('private-token-error'))
  } finally {
    console.log = original
  }
  console.log('payment diagnostics tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
