import { request, APIRequestContext } from '@playwright/test'
import config from '../../../playwright.config'

const baseUrl = config.use.baseURL
const clientId = 'web'

const logonUrl = `${baseUrl}/signin/v1/identifier/_/logon`
const tokenUrl = `${baseUrl}/konnect/v1/token`
const redirectUrl = `${baseUrl}/oidc-callback.html`

export async function getAdminToken(username: string, password: string): Promise<string> {
  const context = await request.newContext()

  const continueUrl = await logonUser(context, username, password)
  const code = await getAuthorizationCode(context, continueUrl)
  return await requestAccessToken(context, code)
}

async function logonUser(
  context: APIRequestContext,
  username: string,
  password: string
): Promise<string> {
  const response = await context.post(logonUrl, {
    headers: {
      'Kopano-Konnect-XSRF': '1',
      Referer: baseUrl,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      params: [username, password, '1'],
      hello: {
        scope: 'openid profile email',
        client_id: clientId,
        redirect_uri: redirectUrl,
        flow: 'oidc'
      }
    })
  })

  if (response.status() !== 200) {
    throw new Error(`Logon failed: ${response.statusText()}`)
  }

  const data = (await response.json()) as { hello: { continue_uri: string } }
  return data.hello.continue_uri
}

async function getAuthorizationCode(
  context: APIRequestContext,
  continueUrl: string
): Promise<string> {
  const authParams = new URLSearchParams({
    client_id: clientId,
    prompt: 'none',
    redirect_uri: redirectUrl,
    response_mode: 'query',
    response_type: 'code',
    scope: 'openid profile offline_access email'
  })

  const response = await context.get(continueUrl, {
    params: authParams,
    maxRedirects: 0
  })

  if (response.status() !== 302) {
    throw new Error(`Authorization failed: Expected 302 but received ${response.status()}`)
  }

  const location = response.headers()['location'] || ''
  const code = new URLSearchParams(location.split('?')[1]).get('code')
  if (!code) throw new Error('Missing auth code')

  return code
}

async function requestAccessToken(context: APIRequestContext, code: string): Promise<string> {
  const response = await context.post(tokenUrl, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      client_id: clientId,
      code,
      redirect_uri: redirectUrl,
      grant_type: 'authorization_code'
    }
  })

  if (response.status() !== 200) {
    throw new Error(`Token request failed: ${response.statusText()}`)
  }

  const { access_token } = (await response.json()) as { access_token: string }
  return access_token
}
