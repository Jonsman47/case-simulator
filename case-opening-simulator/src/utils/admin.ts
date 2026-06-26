import type { CloudSession } from '../cloud/cloudSave'

export const ADMIN_USERNAME = 'Jonsman'

function normalizeAdminName(value: string | undefined) {
  return value?.trim().toLowerCase()
}

export function isAdminUsername(value: string | undefined) {
  return normalizeAdminName(value) === ADMIN_USERNAME.toLowerCase()
}

export function isAdminSession(session: CloudSession | null) {
  if (!session) {
    return false
  }

  const emailName = session.user.email.split('@')[0]

  return isAdminUsername(session.user.username) || isAdminUsername(emailName)
}
