const trim = value => (typeof value === 'string' ? value.trim() : '')

const normalizeMysqlUrl = value => {
  const raw = trim(value)
  if (!raw) return ''
  if (raw.startsWith('mysql://')) return raw
  if (raw.startsWith('mysql2://')) return `mysql://${raw.slice('mysql2://'.length)}`
  return ''
}

const buildMysqlUrlFromParts = env => {
  const host =
    trim(env.MYSQLHOST) ||
    trim(env.MYSQL_HOST) ||
    trim(env.MYSQL_PRIVATE_HOST) ||
    trim(env.MYSQL_PUBLIC_HOST)
  const port = trim(env.MYSQLPORT) || trim(env.MYSQL_PORT) || '3306'
  const user = trim(env.MYSQLUSER) || trim(env.MYSQL_USERNAME)
  const password = trim(env.MYSQLPASSWORD) || trim(env.MYSQL_PASSWORD) || trim(env.MYSQL_ROOT_PASSWORD)
  const database = trim(env.MYSQLDATABASE) || trim(env.MYSQL_DATABASE) || trim(env.MYSQL_DB)

  if (!host || !user || !password || !database) return ''

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`
}

export const resolveDatabaseUrl = (env = process.env) => {
  const directUrl =
    normalizeMysqlUrl(env.MYSQL_URL) ||
    normalizeMysqlUrl(env.DATABASE_URL) ||
    normalizeMysqlUrl(env.MYSQL_PUBLIC_URL)

  if (directUrl) return directUrl

  return buildMysqlUrlFromParts(env)
}

export const applyDatabaseUrl = (env = process.env) => {
  const databaseUrl = resolveDatabaseUrl(env)
  if (databaseUrl) {
    env.DATABASE_URL = databaseUrl
  }
  return databaseUrl
}
