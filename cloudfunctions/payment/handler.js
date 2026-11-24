const { createOrder } = require('./create-order')
const { reconcileRecord } = require('./reconcile')

// Do not enable real payments until delivery, refunds and result access are complete.
const PAYMENT_READY = false

async function checkPurchase(owner, recordId, deps) {
  await reconcileRecord(owner, recordId, deps)
  if (await deps.hasAccess(owner, recordId)) return 'ALREADY_UNLOCKED'
  const pending = await deps.listPendingOrders(owner, recordId)
  return pending.length ? 'ORDER_PENDING' : ''
}

function createHandler(deps) {
  return async function handle(event, owner) {
    if (!owner) return { ok: false, code: 'UNAUTHENTICATED' }
    if (!event || (event.action !== 'create' && event.action !== 'reconcile')) return { ok: false, code: 'INVALID_ACTION' }
    if (event.action === 'reconcile') {
      try {
        return await reconcileRecord(owner, event.recordId, deps)
      } catch (error) {
        return { ok: false, code: 'RECONCILE_FAILED' }
      }
    }
    if (!PAYMENT_READY) return { ok: false, code: 'PAYMENT_NOT_READY' }
    try {
      const blocked = await checkPurchase(owner, event.recordId, deps)
      if (blocked) return { ok: false, code: blocked }
      const order = await createOrder({
        owner,
        recordId: event.recordId,
        productId: event.productId,
        loginCode: event.loginCode
      }, deps)
      return { ok: true, orderId: order.orderId, payData: order.payData }
    } catch (error) {
      return { ok: false, code: 'ORDER_CREATE_FAILED' }
    }
  }
}

module.exports = { createHandler, checkPurchase }
