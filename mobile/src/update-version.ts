export const APP_VERSION = '2.1.22'

export function isNewerVersion(latest: string, current: string): boolean {
  const clean = (value: string) => value.replace(/^v/i, '').split('-')[0].split('.').map(part => Number(part) || 0)
  const left = clean(latest), right = clean(current)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0)
  }
  return false
}

export const shouldPromptForUpdate = (latestVersion: string, promptedVersion: string | null) => latestVersion !== promptedVersion
