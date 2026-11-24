const assert = require('assert')
const { createRecordsHandler } = require('../cloudfunctions/records/service')

async function run() {
  let access = false
  let saved
  const handler = createRecordsHandler({
    add: async data => { saved = data; return { _id: 'r1' } },
    list: async () => [{ _id: 'r1', owner: 'user1', type: 'xufei', version: 3, createdAt: '2026-01-01' }],
    get: async (owner, id) => id === 'r1' ? { _id: id, owner: 'user1', type: 'xufei', version: 3 } : null,
    hasAccess: async () => access,
    remove: async (owner, id) => owner === 'user1' && id === 'r1'
  })
  const add = await handler({ action: 'add', answers: Array(16).fill(0) }, 'user1')
  assert.deepStrictEqual(add, { ok: true, id: 'r1' })
  assert.strictEqual(saved.owner, 'user1')
  assert.strictEqual(JSON.stringify(add).includes(saved.type), false)
  const list = await handler({ action: 'list' }, 'user1')
  assert.strictEqual(JSON.stringify(list).includes('xufei'), false)
  assert.deepStrictEqual(await handler({ action: 'get', id: 'r1' }, 'user1'), { ok: true, locked: true })
  assert.deepStrictEqual(await handler({ action: 'get', id: 'r1' }, 'user2'), { ok: false })
  access = true
  const result = await handler({ action: 'get', id: 'r1' }, 'user1')
  assert.strictEqual(result.result.name, '许飞')
  assert.strictEqual(result.locked, false)
  assert.deepStrictEqual(await handler({ action: 'get', id: 'r1' }, ''), { ok: false })
  console.log('records service tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
