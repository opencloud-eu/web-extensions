import { Locator, Page } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly usernameField: Locator
  readonly passwordField: Locator
  readonly loginBtn: Locator
  readonly myAccount: Locator
  readonly logoutBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.usernameField = this.page.getByPlaceholder('Username')
    this.passwordField = this.page.getByPlaceholder('Password')
    this.loginBtn = this.page.getByRole('button', { name: 'Log in' })
    this.myAccount = this.page.getByLabel('My Account')
    this.logoutBtn = this.page.locator('#oc-topbar-account-logout')
  }

  async login(username: string, password: string) {
    await this.usernameField.fill(username)
    await this.passwordField.fill(password)
    await this.loginBtn.click()
  }

  async logout() {
    await this.myAccount.click()
    await this.logoutBtn.click()
  }
}
