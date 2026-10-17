import { request } from '@playwright/test'
import { getAdminToken } from './getToken'
import config from '../../../playwright.config'
import { v4 as uuidv4 } from 'uuid'

const API_USERS_URL = config.use.baseURL + '/graph/v1.0/users'
const API_GROUPS_URL = config.use.baseURL + '/graph/v1.0/groups'
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'

export async function createUser(username: string, password: string) {
  const adminToken = await getAdminToken(adminUsername, adminPassword)

  const context = await request.newContext()
  const response = await context.post(API_USERS_URL, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      onPremisesSamAccountName: username,
      displayName: username,
      mail: `${username}@test.com`,
      passwordProfile: { password }
    }
  })

  if (!response.ok()) {
    throw new Error(
      `Failed to create user ${username}: ${response.status()} - ${await response.text()}`
    )
  }

  const data = await response.json()
  return { id: data.id, username, password }
}

export async function createRandomUser() {
  const uniquePrefix = uuidv4().substring(0, 8)
  return await createUser(`Alice-${uniquePrefix}`, '123')
}

async function createGroup(group: string) {
  const adminToken = await getAdminToken(adminUsername, adminPassword)

  const context = await request.newContext()
  const response = await context.post(API_GROUPS_URL, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      displayName: group
    }
  })

  if (response.status() === 409) {
    const response = await context.get(`${API_GROUPS_URL}?$search="${group}"`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    return { id: data.value[0]?.id, displayName: data.value[0]?.displayName }
  } else if (!response.ok()) {
    throw new Error(
      `Failed to create group ${group}: ${response.status()} - ${await response.text()}`
    )
  }

  const data = await response.json()
  return { id: data.id, displayName: data.displayName }
}

async function addUserToGroup(groupId: string, userId: string) {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const context = await request.newContext()
  const response = await context.post(`${API_GROUPS_URL}/${groupId}/members/$ref`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      '@odata.id': `${API_USERS_URL}/${userId}`
    }
  })

  if (!response.ok()) {
    throw new Error(
      `Failed to add user ${userId} to group ${groupId}: ${response.status()} - ${await response.text()}`
    )
  }
}

export async function createUserWithGroups(groups: string[], username?: string, password?: string) {
  const user =
    username && password ? await createUser(username, password) : await createRandomUser()

  groups.forEach(async (group) => {
    const newGroup = await createGroup(group)
    addUserToGroup(newGroup.id, user.id)
  })

  return user
}

/**
 * A public link to a file in the user's personal space, read-only ("view"), with the given
 * password (the server may enforce one).
 */
export async function createPublicLink(
  username: string,
  password: string,
  fileName: string,
  linkPassword: string
) {
  const baseUrl = config.use.baseURL
  const token = await getAdminToken(username, password)
  const context = await request.newContext({ ignoreHTTPSErrors: true })
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const driveResponse = await context.get(`${baseUrl}/graph/v1.0/me/drive`, { headers })
    if (!driveResponse.ok()) {
      throw new Error(`Failed to get the drive of ${username}: ${driveResponse.status()}`)
    }
    const driveId = encodeURIComponent((await driveResponse.json()).id)
    const propfind = await context.fetch(
      `${baseUrl}/dav/spaces/${driveId}/${encodeURIComponent(fileName)}`,
      {
        method: 'PROPFIND',
        headers: { ...headers, Depth: '0', 'Content-Type': 'application/xml' },
        data: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>'
      }
    )
    const fileId = (await propfind.text()).match(/<oc:fileid>([^<]+)<\/oc:fileid>/)?.[1]
    if (!propfind.ok() || !fileId) {
      throw new Error(`File ${fileName} of ${username} not found: ${propfind.status()}`)
    }
    const response = await context.post(
      `${baseUrl}/graph/v1beta1/drives/${driveId}/items/${encodeURIComponent(fileId)}/createLink`,
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { type: 'view', password: linkPassword }
      }
    )
    if (!response.ok()) {
      throw new Error(
        `Failed to create a link for ${fileName}: ${response.status()} - ${await response.text()}`
      )
    }
    return (await response.json()).link.webUrl as string
  } finally {
    await context.dispose()
  }
}
