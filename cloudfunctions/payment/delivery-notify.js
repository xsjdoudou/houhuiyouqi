const { validateDelivery, isPaidPendingDelivery } = require('./notification-validation')

async function handleDelivery(event, deps) {
  if (!event || event.Event !== 'xpay_goods_deliver_notify' ||
      typeof event.OutTradeNo !== 'string' || typeof event.OpenId !== 'string') {
    return { ErrCode: 1, ErrMsg: 'invalid notification' }
  }
  const order = await deps.findOrder(event.OutTradeNo, event.OpenId)
  if (!validateDelivery(order, event) || order.revoked !== false) {
    return { ErrCode: 1, ErrMsg: 'invalid order' }
  }
  if (order.status === 'delivered') return { ErrCode: 0, ErrMsg: 'success' }
  if (order.status !== 'pending') return { ErrCode: 1, ErrMsg: 'order unavailable' }
  const response = await deps.queryOrder(order.owner, order.orderId)
  if (!isPaidPendingDelivery(response)) return { ErrCode: 1, ErrMsg: 'payment unconfirmed' }
  await deps.markDelivered(order)
  const current = await deps.findOrder(order.orderId, order.owner)
  if (!current || current.revoked !== false || current.status !== 'delivered') {
    return { ErrCode: 1, ErrMsg: 'delivery incomplete' }
  }
  return { ErrCode: 0, ErrMsg: 'success' }
}

module.exports = { handleDelivery }
