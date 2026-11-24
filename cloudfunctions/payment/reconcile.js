const { isPaidPendingDelivery } = require('./notification-validation')

async function reconcileOrder(order, deps) {
  const response = await deps.queryOrder(order.owner, order.orderId)
  if (!response || response.errcode !== 0 || !response.order ||
      !Number.isInteger(response.order.status)) throw new Error('Order query failed')
  if (isPaidPendingDelivery(response)) {
    return await deps.markDelivered(order)
  }
  if (response.order.status === 6) await deps.markClosed(order)
  return false
}

async function reconcileRecord(owner, recordId, deps) {
  if (typeof owner !== 'string' || !owner || typeof recordId !== 'string' || !recordId) {
    throw new Error('Invalid request')
  }
  const record = await deps.getRecord(recordId)
  if (!record || record._id !== recordId || record.owner !== owner) throw new Error('Record unavailable')
  const orders = await deps.listPendingOrders(owner)
  let updated = false
  let failed = false
  for (const order of orders) {
    if (order.owner !== owner || order.status !== 'pending' || order.revoked !== false ||
        (order.productId !== 'always' && (order.productId !== 'one_time' ||
          typeof order.recordId !== 'string' || !order.recordId))) {
      continue
    }
    try {
      updated = await reconcileOrder(order, deps) || updated
    } catch (error) {
      failed = true
    }
  }
  if (failed) throw new Error('Order reconciliation incomplete')
  return { ok: true, updated, checked: orders.length }
}

module.exports = { reconcileRecord }
