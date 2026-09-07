// Apply only the additive Google identity change before the normal guarded db push.
// Never delete/rewrite accounts or globally accept unrelated data-loss warnings.
export async function prepareGoogleSchema(db) {
  const tables = await db.$queryRaw`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User'
  `
  if (!tables.length) return // A fresh database is created by db push.

  const hasColumn = async () => (await db.$queryRaw`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'googleSubject'
  `).length > 0
  const hasIndex = async () => (await db.$queryRaw`
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User'
      AND INDEX_NAME = 'User_googleSubject_key'
    GROUP BY INDEX_NAME
    HAVING COUNT(*) = 1 AND MIN(NON_UNIQUE) = 0
      AND MIN(COLUMN_NAME) = 'googleSubject' AND COUNT(SUB_PART) = 0
  `).length > 0

  if (!await hasColumn()) {
    try {
      await db.$executeRaw`ALTER TABLE \`User\` ADD COLUMN \`googleSubject\` VARCHAR(191) NULL`
    } catch (error) {
      // Another starting replica may have just added the same column.
      if (!await hasColumn()) throw error
    }
  }
  if (await hasIndex()) return

  const duplicates = await db.$queryRaw`
    SELECT 1 AS duplicateFound FROM \`User\`
    WHERE \`googleSubject\` IS NOT NULL
    GROUP BY \`googleSubject\` HAVING COUNT(*) > 1 LIMIT 1
  `
  if (duplicates.length) {
    throw new Error('Cannot add Google identity uniqueness: duplicate non-null User.googleSubject values exist. Resolve the account links before restarting. No account data was changed.')
  }

  try {
    await db.$executeRaw`CREATE UNIQUE INDEX \`User_googleSubject_key\` ON \`User\` (\`googleSubject\`)`
  } catch (error) {
    // Recheck for another replica; all other failures still stop startup.
    if (!await hasIndex()) throw error
  }
}
