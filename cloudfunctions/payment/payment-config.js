const CLOUD_ENV_ID = 'cloud1-d4g6rq03i03578123'
const OFFER_ID = '1450737028'
const PRODUCTS = Object.freeze({
  one_time: Object.freeze({ price: 90, entitlement: 'record' }),
  always: Object.freeze({ price: 390, entitlement: 'permanent' })
})

module.exports = { CLOUD_ENV_ID, OFFER_ID, PRODUCTS }
