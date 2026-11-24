const { calculate, types, friendshipProfiles, friendshipProfilesV3 } = require('./content')

function createRecordsHandler(deps) {
  return async (event, owner) => {
    if (!owner || !event) return { ok: false }
    if (event.action === 'add') {
      const type = calculate(event.answers)
      if (!type) return { ok: false }
      const saved = await deps.add({ owner, type, version: 3, createdAt: new Date() })
      return { ok: true, id: saved._id }
    }
    if (event.action === 'list') {
      const records = await deps.list(owner)
      return {
        ok: true,
        records: records.map(record => ({
          id: record._id,
          version: record.version,
          createdAt: record.createdAt
        }))
      }
    }
    if ((event.action === 'get' || event.action === 'delete') &&
        typeof event.id === 'string' && event.id.length > 0) {
      if (event.action === 'delete') return { ok: await deps.remove(owner, event.id) }
      const record = await deps.get(owner, event.id)
      if (!record || record.owner !== owner || !types[record.type]) return { ok: false }
      if (!await deps.hasAccess(owner, record._id)) return { ok: true, locked: true }
      const version = record.version === 3 ? 3 : record.version === 2 ? 2 : 1
      const friendship = version === 3 ? friendshipProfilesV3[record.type]
        : version === 2 ? friendshipProfiles[record.type] : null
      const result = friendship && friendship.tag
        ? Object.assign({}, types[record.type], { tag: friendship.tag })
        : types[record.type]
      return { ok: true, locked: false, result, friendship, version }
    }
    return { ok: false }
  }
}

module.exports = { createRecordsHandler }
