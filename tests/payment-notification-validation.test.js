const assert = require('assert')
const { validateDelivery, isPaidPendingDelivery, validateRefund } = require('../cloudfunctions/payment/notification-validation')

const order = { orderId: 'T1234567', owner: 'openid1', productId: 'one_time' }
const event = {
  Event: 'xpay_goods_deliver_notify', OpenId: 'openid1', OutTradeNo: 'T1234567',
  GoodsInfo: { ProductId: 'one_time', Quantity: 1 }, WeChatPayInfo: { MchOrderNo: 'wx-order' }
}
assert.strictEqual(validateDelivery(order, event), true)
for (const change of [
  { Event: 'other' }, { OpenId: 'openid2' }, { OutTradeNo: 'T2345678' },
  { GoodsInfo: { ProductId: 'always', Quantity: 1 } },
  { GoodsInfo: { ProductId: 'one_time', Quantity: 0 } },
  { GoodsInfo: { ProductId: 'one_time', Quantity: 2 } },
  { WeChatPayInfo: { MchOrderNo: '' } }, { GoodsInfo: null }
]) assert.strictEqual(validateDelivery(order, Object.assign({}, event, change)), false)
assert.strictEqual(validateDelivery(Object.assign({}, order, { productId: '__proto__' }), event), false)

assert.strictEqual(isPaidPendingDelivery({ errcode: 0, order: { status: 2 } }), true)
for (const status of [0, 1, 3, 4, 5, 6, 7, 8, '2', 'paid']) {
  assert.strictEqual(isPaidPendingDelivery({ errcode: 0, order: { status } }), false)
}
assert.strictEqual(isPaidPendingDelivery({ errcode: 1, order: { status: 2 } }), false)

const refund = { merchantRefundId: 'refund1', wxRefundId: 'wx-refund1' }
const refundEvent = { Event: 'xpay_refund_notify', RetCode: 0, MchRefundId: 'refund1', WxRefundId: 'wx-refund1' }
assert.strictEqual(validateRefund(refund, refundEvent), true)
assert.strictEqual(validateRefund(refund, Object.assign({}, refundEvent, { RetCode: 1 })), false)
assert.strictEqual(validateRefund(refund, Object.assign({}, refundEvent, { WxRefundId: 'other' })), false)
assert.strictEqual(validateRefund({}, refundEvent), false)
console.log('payment notification validation tests passed')
