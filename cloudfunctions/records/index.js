const cloud = require('wx-server-sdk')
const { calculate } = require('./content')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const records = db.collection('test_records')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false }

  if (event.action === 'add') {
    const answers = event.answers
    const type = calculate(answers)
    if (!type) return { ok: false }
    await records.add({ data: { owner: OPENID, type, createdAt: new Date() } })
    return { ok: true }
  }
  if (event.action === 'list') {
    const result = await records.where({ owner: OPENID }).orderBy('createdAt', 'desc').limit(100).get()
    return { ok: true, records: result.data }
  }
  if (event.action === 'delete' && typeof event.id === 'string') {
    const result = await records.where({ _id: event.id, owner: OPENID }).remove()
    return { ok: result.stats.removed > 0 }
  }
  return { ok: false }
}
