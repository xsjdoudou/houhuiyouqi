const { PRODUCTS } = require('./payment-config')

// Callers must authenticate the transport before using any notification data.
function validateDelivery(order, event) {
  if (!order || !event || !Object.prototype.hasOwnProperty.call(PRODUCTS, order.productId)) return false
  const goods = event.GoodsInfo
  const pay = event.WeChatPayInfo
  return event.Event === 'xpay_goods_deliver_notify' &&
    typeof order.orderId === 'string' && order.orderId.length > 0 &&
    typeof order.owner === 'string' && order.owner.length > 0 &&
    event.OutTradeNo === order.orderId && event.OpenId === order.owner &&
    goods != null && goods.ProductId === order.productId && goods.Quantity === 1 &&
    pay != null && typeof pay.MchOrderNo === 'string' && pay.MchOrderNo.length > 0
}

function isPaidPendingDelivery(response) {
  return !!response && response.errcode === 0 && !!response.order && response.order.status === 2
}

function validateRefund(refund, event) {
  if (!refund || !event || event.Event !== 'xpay_refund_notify' || event.RetCode !== 0) return false
  const merchantMatch = typeof refund.merchantRefundId === 'string' && refund.merchantRefundId.length > 0 &&
    event.MchRefundId === refund.merchantRefundId
  const platformMatch = typeof refund.wxRefundId === 'string' && refund.wxRefundId.length > 0 &&
    event.WxRefundId === refund.wxRefundId
  if (!merchantMatch && !platformMatch) return false
  if (refund.merchantRefundId && event.MchRefundId && !merchantMatch) return false
  if (refund.wxRefundId && event.WxRefundId && !platformMatch) return false
  return true
}

module.exports = { validateDelivery, isPaidPendingDelivery, validateRefund }
