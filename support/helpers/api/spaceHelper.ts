// Minimal Project Space helpers for the web-extensions e2e suite.
//
// The canonical reference for these patterns lives in the `opencloud-eu/web`
// repo (separate monorepo, not importable here):
//   - tests/e2e/support/api/graph/spaces.ts   — createSpace, getSpaceIdBySpaceName
//   - tests/e2e/support/api/share/share.ts    — full role-UUID table + share API
//   - tests/e2e/support/api/davSpaces/spaces.ts — file ops within a space
//
// We deliberately re-implement a narrow subset rather than depending on web's
// Cucumber-coupled helpers (UsersEnvironment singletons, custom request
// wrappers). When extension-sdk eventually exposes shared e2e helpers, this
// file should be deleted in favour of those.
import { request } from '@playwright/test'
import config from '../../../playwright.config'
import { getAdminToken } from './getToken'

const baseUrl = config.use.baseURL
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'

// OC unified-role UUID for "Space Editor" — write access to all files in a
// Project Space. Verified against web/tests/e2e/support/api/share/share.ts
// `getPermissionsRoleIdByName('space editor')` and OC source
// `services/graph/pkg/unifiedrole/roles.go`. Other role UUIDs from there:
//   space viewer   a8d5fe5e-96e3-418d-825b-534dbdf22b99
//   space editor   58c63c02-1d89-4572-916a-870abc5a1b7d  (used here)
//   manager        312c0871-5ef7-4b3a-85b6-0e4074c64049
//   viewer         b1e2218d-eef8-4d4c-b82d-0f1a1b48f3b5  (single file/folder)
//   editor         fb6c3e19-e378-47e5-b277-9732f9de6e21  (single file/folder)
//   file editor    2d00ce52-1fc2-4dbc-8b95-a73b73395f5a  (single file write)
const SPACE_EDITOR_ROLE_ID = '58c63c02-1d89-4572-916a-870abc5a1b7d'

export interface ProjectSpace {
  id: string
  name: string
  webDavUrl: string
  rootItemId: string
}

export async function createProjectSpace(name: string): Promise<ProjectSpace> {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const ctx = await request.newContext()

  const res = await ctx.post(`${baseUrl}/graph/v1.0/drives`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    data: { name, driveType: 'project' }
  })
  if (!res.ok()) {
    throw new Error(`createProjectSpace failed: ${res.status()} - ${await res.text()}`)
  }
  const drive = await res.json()
  return {
    id: drive.id,
    name: drive.name,
    webDavUrl: drive.root.webDavUrl,
    rootItemId: drive.root.id
  }
}

export async function inviteUserToSpace(
  spaceId: string,
  userId: string,
  roleId: string = SPACE_EDITOR_ROLE_ID
) {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const ctx = await request.newContext()

  // Endpoint and payload shape per opencloud-eu/libre-graph-api v1beta1.
  // The recipient-type discriminator is a libregraph annotation key with
  // dots (not dashes): `@libre.graph.recipient.type`. Valid values: "user",
  // "group". User identifier field is `objectId` (UUID from /graph/v1.0/users).
  const res = await ctx.post(`${baseUrl}/graph/v1beta1/drives/${spaceId}/root/invite`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      recipients: [{ '@libre.graph.recipient.type': 'user', objectId: userId }],
      roles: [roleId]
    }
  })
  if (!res.ok()) {
    throw new Error(
      `inviteUserToSpace(${userId} → ${spaceId}) failed: ${res.status()} - ${await res.text()}`
    )
  }
}

// File Editor unified-role-id (write access to a single item). See the
// SPACE_EDITOR_ROLE_ID comment near the top of this file for the canonical
// table.
const FILE_EDITOR_ROLE_ID = '2d00ce52-1fc2-4dbc-8b95-a73b73395f5a'

export interface AdminFile {
  driveId: string
  itemId: string
}

export async function uploadFileAsAdmin(
  filename: string,
  body: string | Buffer
): Promise<AdminFile> {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const ctx = await request.newContext()

  // Discover the admin's personal drive.
  const drivesRes = await ctx.get(`${baseUrl}/graph/v1.0/me/drives`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  if (!drivesRes.ok()) {
    throw new Error(`uploadFileAsAdmin.drives failed: ${drivesRes.status()}`)
  }
  const { value: drives } = (await drivesRes.json()) as {
    value: Array<{ id: string; driveType: string; root: { id: string; webDavUrl: string } }>
  }
  const personal = drives.find((d) => d.driveType === 'personal')
  if (!personal) throw new Error('admin has no personal drive')

  // PUT the file content via WebDAV — webDavUrl lives under `.root`.
  const putUrl = `${personal.root.webDavUrl.replace(/\/$/, '')}/${encodeURIComponent(filename)}`
  const putRes = await ctx.put(putUrl, {
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'text/plain' },
    data: body
  })
  if (!putRes.ok()) {
    throw new Error(`uploadFileAsAdmin.put failed: ${putRes.status()} - ${await putRes.text()}`)
  }

  // Resolve the file's item id by listing root children.
  const childrenRes = await ctx.get(
    `${baseUrl}/graph/v1.0/drives/${personal.id}/items/${personal.root.id}/children`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  )
  const { value: children } = (await childrenRes.json()) as {
    value: Array<{ id: string; name: string }>
  }
  const item = children.find((c) => c.name === filename)
  if (!item) throw new Error(`uploadFileAsAdmin: ${filename} not in root`)
  return { driveId: personal.id, itemId: item.id }
}

// Fetches a file's current content via WebDAV using admin credentials. Used
// in tests that need to assert the server-side state after a collab session
// has written back.
export async function fetchFileAsAdmin(file: AdminFile): Promise<string> {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const ctx = await request.newContext()
  const url = `${baseUrl}/remote.php/dav/spaces/${encodeURIComponent(file.itemId)}`
  const res = await ctx.get(url, { headers: { Authorization: `Bearer ${adminToken}` } })
  if (!res.ok()) {
    throw new Error(`fetchFileAsAdmin GET failed: ${res.status()} - ${await res.text()}`)
  }
  return res.text()
}

export async function inviteUserToFile(
  file: AdminFile,
  recipientId: string,
  roleId: string = FILE_EDITOR_ROLE_ID
) {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const ctx = await request.newContext()
  const res = await ctx.post(
    `${baseUrl}/graph/v1beta1/drives/${file.driveId}/items/${file.itemId}/invite`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        recipients: [{ '@libre.graph.recipient.type': 'user', objectId: recipientId }],
        roles: [roleId]
      }
    }
  )
  if (!res.ok()) {
    throw new Error(`inviteUserToFile failed: ${res.status()} - ${await res.text()}`)
  }
}

export async function uploadFileToSpace(
  space: ProjectSpace,
  filename: string,
  body: string | Buffer
): Promise<{ fileId: string }> {
  const adminToken = await getAdminToken(adminUsername, adminPassword)
  const ctx = await request.newContext()

  const url = `${space.webDavUrl.replace(/\/$/, '')}/${encodeURIComponent(filename)}`
  const putRes = await ctx.put(url, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'text/plain'
    },
    data: body
  })
  if (!putRes.ok()) {
    throw new Error(`uploadFileToSpace.put failed: ${putRes.status()} - ${await putRes.text()}`)
  }

  // Look up the file's libregraph item id (= the fileId we use as the
  // Hocuspocus document name on the client side). List children of root
  // and match by name — OC doesn't expose a path-based item GET.
  const childrenRes = await ctx.get(
    `${baseUrl}/graph/v1.0/drives/${space.id}/items/${space.rootItemId}/children`,
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  )
  if (!childrenRes.ok()) {
    throw new Error(
      `uploadFileToSpace.children failed: ${childrenRes.status()} - ${await childrenRes.text()}`
    )
  }
  const { value: children } = (await childrenRes.json()) as { value: Array<{ id: string; name: string }> }
  const item = children.find((c) => c.name === filename)
  if (!item) {
    throw new Error(
      `uploadFileToSpace: child "${filename}" not found among [${children.map((c) => c.name).join(', ')}]`
    )
  }
  return { fileId: item.id }
}
