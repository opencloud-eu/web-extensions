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

export async function updateUserGroups(userId: string, newGroups: string[]) {
  // Remove user from all current groups
  // await removeUserFromAllGroups(userId)

  newGroups.forEach(async (group) => {
    const newGroup = await createGroup(group)
    addUserToGroup(newGroup.id, userId)
  })
}
