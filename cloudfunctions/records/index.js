const cloud = require('wx-server-sdk')
const { createRecordsHandler } = require('./service')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const records = db.collection('test_records')
const orders = db.collection(process.env.VIRTUAL_PAYMENT_SANDBOX === '1'
  ? 'payment_sandbox_orders' : 'payment_orders')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const handle = createRecordsHandler({
    add: async data => records.add({ data }),
    get: async (owner, id) => {
      const result = await records.where({ _id: id, owner }).limit(1).get()
      return result.data[0]
    },
    list: async owner => {
      const result = await records.where({ owner }).orderBy('createdAt', 'desc').limit(100).get()
      return result.data
    },
    remove: async (owner, id) => {
      const result = await records.where({ _id: id, owner }).remove()
      return result.stats.removed > 0
    },
    hasAccess: async (owner, id) => {
      const base = { owner, status: 'delivered', revoked: false }
      const permanent = await orders.where(Object.assign({}, base, { productId: 'always' })).limit(1).get()
      if (permanent.data.length) return true
      const single = await orders.where(Object.assign({}, base, { productId: 'one_time', recordId: id })).limit(1).get()
      return single.data.length > 0
    }
  })
  return handle(event, OPENID)
}
