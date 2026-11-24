const { createOrder } = require('./create-order')

// Do not enable real payments until delivery, refunds and result access are complete.
const PAYMENT_READY = false

function createHandler(deps) {
  return async function handle(event, owner) {
    if (!owner) return { ok: false, code: 'UNAUTHENTICATED' }
    if (!event || event.action !== 'create') return { ok: false, code: 'INVALID_ACTION' }
    if (!PAYMENT_READY) return { ok: false, code: 'PAYMENT_NOT_READY' }
    try {
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

module.exports = { createHandler }
