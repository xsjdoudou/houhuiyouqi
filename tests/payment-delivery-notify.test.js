const assert = require('assert')
const { handleDelivery } = require('../cloudfunctions/payment/delivery-notify')

async function run() {
  const order = { _id: 'db1', orderId: 'T12345678', owner: 'user1', recordId: 'r1', productId: 'one_time', status: 'pending', revoked: false }
  const event = {
    Event: 'xpay_goods_deliver_notify', OutTradeNo: order.orderId, OpenId: order.owner,
    GoodsInfo: { ProductId: order.productId, Quantity: 1 },
    WeChatPayInfo: { MchOrderNo: 'wx-order' }
  }
  let status = 1
  let writes = 0
  const deps = {
    findOrder: async () => order,
    queryOrder: async () => ({ errcode: 0, order: { status } }),
    markDelivered: async () => { writes++; order.status = 'delivered'; return true }
  }
  assert.notStrictEqual((await handleDelivery(event, deps)).ErrCode, 0)
  assert.strictEqual(writes, 0)
  status = 2
  assert.strictEqual((await handleDelivery(event, deps)).ErrCode, 0)
  assert.strictEqual((await handleDelivery(event, deps)).ErrCode, 0)
  assert.strictEqual(writes, 1)
  assert.notStrictEqual((await handleDelivery(Object.assign({}, event, { OpenId: 'attacker' }), deps)).ErrCode, 0)
  order.revoked = true
  assert.notStrictEqual((await handleDelivery(event, deps)).ErrCode, 0)
  assert.notStrictEqual((await handleDelivery({ Event: 'xpay_refund_notify' }, deps)).ErrCode, 0)
  console.log('payment delivery notification tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
