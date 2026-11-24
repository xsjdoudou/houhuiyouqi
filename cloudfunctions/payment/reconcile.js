const { isPaidPendingDelivery } = require('./notification-validation')
const { logPayment } = require('./diagnostics')

async function reconcileOrder(order, deps) {
  const response = await deps.queryOrder(order.owner, order.orderId)
  if (!response || response.errcode !== 0 || !response.order ||
      !Number.isInteger(response.order.status)) throw new Error('Order query failed')
  if (isPaidPendingDelivery(response)) {
    try {
      const updated = await deps.markDelivered(order)
      logPayment(updated ? 'reconcile_delivered' : 'reconcile_not_updated')
      return updated
    } catch (error) {
      logPayment('reconcile_delivery_failed')
      throw error
    }
  }
  if (response.order.status === 6) await deps.markClosed(order)
  return false
}

async function reconcileRecord(owner, recordId, deps) {
  if (typeof owner !== 'string' || !owner || typeof recordId !== 'string' || !recordId) {
    throw new Error('Invalid request')
  }
  let record
  try {
    record = await deps.getRecord(recordId)
  } catch (error) {
    logPayment('reconcile_record_read_failed')
    throw error
  }
  if (!record || record._id !== recordId || record.owner !== owner) {
    logPayment('reconcile_record_unavailable')
    throw new Error('Record unavailable')
  }
  let orders
  try {
    orders = await deps.listPendingOrders(owner)
  } catch (error) {
    logPayment('reconcile_orders_read_failed')
    throw error
  }
  logPayment('reconcile_pending_orders', { count: orders.length })
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
      logPayment('reconcile_order_failed')
      failed = true
    }
  }
  if (failed) throw new Error('Order reconciliation incomplete')
  return { ok: true, updated, checked: orders.length }
}

module.exports = { reconcileRecord }
