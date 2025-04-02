import { request } from '@playwright/test'
import { getAdminToken } from './getToken'
import config from '../../../playwright.config'
import { v4 as uuidv4 } from 'uuid'

const API_URL = config.use.baseURL + '/graph/v1.0/users'
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'

export async function createUser(username: string, password: string) {
  const adminToken = await getAdminToken(adminUsername, adminPassword)

  const context = await request.newContext()
  const response = await context.post(API_URL, {
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
  const uniquePrefix = uuidv4().substring(0, 4)
  return await createUser(`Alice-${uniquePrefix}`, '123')
}
