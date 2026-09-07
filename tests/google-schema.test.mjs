import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { prepareGoogleSchema } from '../scripts/prepare-google-schema.mjs'

function database(options = {}) {
  const state = { table: true, column: false, index: false, duplicates: false, ...options }
  const writes = []
  const db = {
    async $queryRaw(strings) {
      const sql = strings.join('')
      if (sql.includes('information_schema.TABLES')) return state.table ? [{}] : []
      if (sql.includes('information_schema.COLUMNS')) return state.column ? [{}] : []
      if (sql.includes('information_schema.STATISTICS')) return state.index ? [{}] : []
      if (sql.includes('duplicateFound')) return state.duplicates ? [{}] : []
      throw new Error(`Unexpected query: ${sql}`)
    },
    async $executeRaw(strings) {
      const sql = strings.join('')
      writes.push(sql)
      if (state.fail) throw new Error('DDL failed')
      if (sql.includes('ADD COLUMN')) state.column = true
      else if (sql.includes('CREATE UNIQUE INDEX')) state.index = true
      else throw new Error(`Unexpected write: ${sql}`)
      if (state.concurrent) throw new Error('Another replica completed DDL first')
    },
  }
  return { db, writes, state }
}
test('existing users get only an additive nullable column and unique index', async () => {
  const { db, writes, state } = database()
  await prepareGoogleSchema(db)
  assert.equal(writes.length, 2)
  assert.match(writes[0], /ADD COLUMN `googleSubject` VARCHAR\(191\) NULL/)
  assert.match(writes[1], /CREATE UNIQUE INDEX `User_googleSubject_key`/)
  assert.equal(state.index, true)
  assert.ok(writes.every(sql => !/DELETE|UPDATE|DROP|TRUNCATE/.test(sql)))
})
test('restart after successful preparation makes no changes', async () => {
  const { db, writes } = database({ column: true, index: true })
  await prepareGoogleSchema(db)
  assert.deepEqual(writes, [])
})
test('partial migration resumes by adding just the missing index', async () => {
  const { db, writes } = database({ column: true })
  await prepareGoogleSchema(db)
  assert.equal(writes.length, 1)
  assert.match(writes[0], /CREATE UNIQUE INDEX/)
})
test('fresh database is left for the normal schema sync', async () => {
  const { db, writes } = database({ table: false })
  await prepareGoogleSchema(db)
  assert.deepEqual(writes, [])
})
test('duplicate Google links halt startup without altering user data', async () => {
  const { db, writes } = database({ column: true, duplicates: true })
  await assert.rejects(prepareGoogleSchema(db), /duplicate non-null User.googleSubject/)
  assert.deepEqual(writes, [])
})
test('concurrent replicas completing the same DDL are tolerated', async () => {
  const { db, state } = database({ concurrent: true })
  await prepareGoogleSchema(db)
  assert.equal(state.column, true)
  assert.equal(state.index, true)
})
test('unexpected DDL failures remain fatal', async () => {
  const { db } = database({ fail: true })
  await assert.rejects(prepareGoogleSchema(db), /DDL failed/)
})
test('production startup prepares schema before guarded db push', async () => {
  const source = await readFile(new URL('../scripts/start-production.mjs', import.meta.url), 'utf8')
  assert.ok(source.indexOf('await prepareGoogleSchema(schemaClient)') < source.indexOf("'db', 'push'"))
  assert.ok(!source.includes('--accept-data-loss'))
  assert.ok(!source.includes('--force-reset'))
})
