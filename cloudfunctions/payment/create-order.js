const crypto = require('crypto')
const { PRODUCTS } = require('./payment-config')
const { createPaymentParameters } = require('./signing')

// Dependencies must be implemented server-side; owner is the verified cloud caller.
async function createOrder({ owner, recordId, productId, loginCode }, deps) {
  if (typeof owner !== 'string' || !owner ||
      typeof recordId !== 'string' || !recordId ||
      typeof loginCode !== 'string' || !loginCode ||
      typeof productId !== 'string' ||
      !Object.prototype.hasOwnProperty.call(PRODUCTS, productId)) {
    throw new Error('Invalid order request')
  }

  const record = await deps.getRecord(recordId)
  if (!record || record._id !== recordId || record.owner !== owner) {
    throw new Error('Record unavailable')
  }
  const session = await deps.exchangeCode(loginCode)
  if (!session || session.openid !== owner ||
      typeof session.sessionKey !== 'string' || !session.sessionKey) {
    throw new Error('Login identity mismatch')
  }

  const orderId = 'T' + crypto.randomBytes(15).toString('hex')
  const payData = createPaymentParameters({
    productId, orderId, attach: orderId,
    appKey: deps.appKey, sessionKey: session.sessionKey, env: deps.paymentEnv
  })
  await deps.insertOrder({
    orderId, owner, recordId, productId, price: PRODUCTS[productId].price,
    status: 'pending', revoked: false, createdAt: new Date()
  })
  return { orderId, payData }
}

module.exports = { createOrder }
