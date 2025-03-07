import { Browser, Page } from '@playwright/test'
import { LoginPage } from '../pages/loginPage'
import { createContext, closeContext } from './actorHelper'

export async function loginAsUser(
  browser: Browser,
  username: string,
  password: string
): Promise<{ page: Page }> {
  const { page } = await createContext(browser)
  const loginPage = new LoginPage(page)
  await page.goto('/')

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().endsWith('logon') && resp.status() === 200 && resp.request().method() === 'POST'
    ),
    loginPage.login(username, password)
  ])
  return { page }
}

export async function logout(page: Page): Promise<void> {
  const context = page.context()
  const loginPage = new LoginPage(page)
  await loginPage.logout()
  await closeContext(context)
}
