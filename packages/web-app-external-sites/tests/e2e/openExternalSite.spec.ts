import { test, Page, expect, Browser } from '@playwright/test'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'
import {
  loginAsUser,
  logout,
  logoutWithoutCloseContext
} from '../../../../support/helpers/authHelper'
import { createRandomUser, createUserWithGroups } from '../../../../support/helpers/api/apiHelper'

let userPage: Page
let browser: Browser

test.describe('External Sites Visibility Control', () => {
  test.beforeEach(({ browser: testBrowser }) => {
    browser = testBrowser
  })

  test.afterEach(async () => {
    if (userPage) {
      await logout(userPage)
    }
  })

  test('user with correct groups can see external sites in menu', async () => {
    const user = await createUserWithGroups(['admin', 'editor'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    // Check visibility
    await expect(appSwitcher.getExternalSite('Admin Panel')).toBeVisible()
    await expect(appSwitcher.getExternalSite('Editor Tools')).toBeVisible()
    await expect(appSwitcher.getExternalSite('Public Site')).toBeVisible()

    // Check link attributes
    await expect(appSwitcher.getExternalSite('Admin Panel')).toHaveAttribute(
      'href',
      'https://github.com'
    )
    await expect(appSwitcher.getExternalSite('Admin Panel')).toHaveAttribute('target', '_blank')
  })

  test('user without required groups cannot see restricted external sites', async () => {
    const user = await createUserWithGroups(['viewer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    // Should not see restricted sites
    await expect(appSwitcher.getExternalSite('Admin Panel')).not.toBeVisible()
    await expect(appSwitcher.getExternalSite('Editor Tools')).not.toBeVisible()

    // But should see public sites
    await expect(appSwitcher.getExternalSite('Public Site')).toBeVisible()
  })

  test('user cannot directly visit embedded site route without the required group', async () => {
    const user = await createUserWithGroups(['viewer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    // Try to navigate directly to embedded site route
    await userPage.goto('/external-sites/dev-tools')

    // Should be redirected to /
    await expect(userPage).toHaveURL(/files|^\/$/)
  })

  test('user with developer visibility can see embedded site and see routes', async () => {
    const user = await createUserWithGroups(['developer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    // Should see embedded site in menu
    await expect(appSwitcher.getExternalSite('Dev Tools')).toBeVisible()

    // Should NOT have target="_blank" (it's embedded)
    await expect(appSwitcher.getExternalSite('Dev Tools')).not.toHaveAttribute('target', '_blank')

    // Should be able to navigate to embedded route
    await appSwitcher.getExternalSite('Dev Tools').click()
    await expect(userPage).toHaveURL(/external-sites\/dev-tools/)
  })

  test('dashboard visibility control works correctly', async () => {
    const user = await createUserWithGroups(['admin'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    // Should see admin dashboard
    await expect(appSwitcher.getDashboard('Admin Dashboard')).toBeVisible()
    // Should be able to navigate to dashboard
    await appSwitcher.openDashboard('Admin Dashboard')

    await expect(userPage).toHaveURL(/external-sites\/admin-dashboard/)
    await expect(userPage.locator('h1:has-text("Admin Dashboard")')).toBeVisible()
  })

  test('restricted dashboard is not visible to unauthorized users', async () => {
    const user = await createUserWithGroups(['viewer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    // Should NOT see admin dashboard
    await expect(appSwitcher.getDashboard('Admin Dashboard')).not.toBeVisible()

    // Should see public dashboard
    await expect(appSwitcher.getDashboard('Main Dashboard')).toBeVisible()
  })

  test('restricted dashboard route cannot be accessed directly', async () => {
    const user = await createUserWithGroups(['viewer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    // Try to access admin dashboard directly
    await userPage.goto('/external-sites/admin-dashboard')

    // Should be redirected
    await expect(userPage).toHaveURL(/files|^\/$/)
  })

  test('dashboard shows external links with correct attributes', async () => {
    const user = await createUserWithGroups(['support'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    // Navigate to support dashboard
    await userPage.goto('/external-sites/support')
    await userPage.pause()

    // All dashboard sites should be external links
    await expect(userPage.getByRole('link', { name: 'Ticket System' })).toHaveAttribute(
      'href',
      'https://zendesk.com'
    )
    await expect(userPage.getByRole('link', { name: 'Ticket System' })).toHaveAttribute(
      'target',
      '_blank'
    )

    await expect(userPage.getByRole('link', { name: 'Knowledge Base' })).toHaveAttribute(
      'href',
      'https://notion.so'
    )
    await expect(userPage.getByRole('link', { name: 'Knowledge Base' })).toHaveAttribute(
      'target',
      '_blank'
    )
  })

  test('visibility control with "all" groups requirement works', async () => {
    // User with only one of the required groups - should not see teh site
    const user1 = await createUserWithGroups(['admin'])
    userPage = (await loginAsUser(browser, user1.username, user1.password)).page

    let appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    await expect(appSwitcher.getExternalSite('Super Admin Panel')).not.toBeVisible()
    await logoutWithoutCloseContext(userPage)

    // User with all required groups - should see the site
    const user2 = await createUserWithGroups(['admin', 'superuser'])
    userPage = (await loginAsUser(browser, user2.username, user2.password)).page

    appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    await expect(appSwitcher.getExternalSite('Super Admin Panel')).toBeVisible()
    await expect(appSwitcher.getExternalSite('Super Admin Panel')).toHaveAttribute(
      'href',
      'https://aws.amazon.com/console'
    )
  })

  test('visibility control with "none" groups restriction works', async () => {
    // User with forbidden group - should not see even with allowed group
    const user = await createUserWithGroups(['user', 'guest'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    await expect(appSwitcher.getExternalSite('User Panel')).not.toBeVisible()
  })

  test('complex visibility control with multiple conditions works', async () => {
    // User meets all conditions
    const validUser = await createUserWithGroups(['editor', 'verified'])
    userPage = (await loginAsUser(browser, validUser.username, validUser.password)).page

    let appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    await expect(appSwitcher.getExternalSite('Complex Visibility Site')).toBeVisible()
    await expect(appSwitcher.getExternalSite('Complex Visibility Site')).toHaveAttribute(
      'href',
      'https://docker.com'
    )
    await logout(userPage)

    // User fails "all" condition
    const invalidUser = await createUserWithGroups(['editor']) // missing 'verified'
    userPage = (await loginAsUser(browser, invalidUser.username, invalidUser.password)).page

    appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    await expect(appSwitcher.getExternalSite('Complex Visibility Site')).not.toBeVisible()
  })

  test('user with no groups can see public sites', async () => {
    const user = await createRandomUser() // No specific groups
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    const appSwitcher = new AppSwitcher(userPage)
    await appSwitcher.clickAppSwitcher()

    // Should see public sites (no visibility config)
    await expect(appSwitcher.getExternalSite('Public Site')).toBeVisible()
    await expect(appSwitcher.getExternalSite('OpenCloud')).toBeVisible()

    // Should not see restricted sites
    await expect(appSwitcher.getExternalSite('Admin Panel')).not.toBeVisible()
    await expect(appSwitcher.getExternalSite('Editor Tools')).not.toBeVisible()
  })

  //---
  test('dashboard shows only visible sites within site groups', async () => {
    const user = await createUserWithGroups(['support'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    // Navigate to support dashboard
    await userPage.goto('/external-sites/support')

    // Should see sites available to support users
    await expect(userPage.getByRole('link', { name: 'Ticket System' })).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Knowledge Base' })).toBeVisible()

    // Should NOT see admin-only sites
    await expect(userPage.getByRole('link', { name: 'System Configuration' })).not.toBeVisible()
    await expect(userPage.getByRole('link', { name: 'User Management' })).not.toBeVisible()
  })

  test('dashboard hides entire site groups when no sites are visible', async () => {
    const user = await createUserWithGroups(['viewer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    // Navigate to developer dashboard that viewer should see but with no visible sites
    await userPage.goto('/external-sites/dev-dashboard')

    // Should show "no sites available" message
    await expect(userPage.locator('text=No sites available')).toBeVisible()

    // Should NOT show any site group headings
    await expect(userPage.locator('h2:has-text("Development Tools")')).not.toBeVisible()
    await expect(userPage.locator('h2:has-text("Admin Tools")')).not.toBeVisible()
  })

  test('mixed visibility site groups show only permitted sites', async () => {
    const user = await createUserWithGroups(['developer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/dev-dashboard')

    // Should see the site group heading
    await expect(userPage.locator('h2:has-text("Development Tools")')).toBeVisible()

    // Should see developer-visible sites
    await expect(userPage.getByRole('link', { name: 'API Documentation' })).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Code Repository' })).toBeVisible()

    // Should NOT see admin-only sites in the same group
    await expect(userPage.getByRole('link', { name: 'CI/CD Pipeline' })).not.toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Server Monitoring' })).not.toBeVisible()
  })

  test('user with elevated permissions sees all sites in mixed groups', async () => {
    const user = await createUserWithGroups(['developer', 'admin'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/dev-dashboard')

    // Should see all sites in the group
    await expect(userPage.getByRole('link', { name: 'API Documentation' })).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Code Repository' })).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'CI/CD Pipeline' })).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Server Monitoring' })).toBeVisible()
  })

  test('nested visibility control works for embedded sites in dashboards', async () => {
    const user = await createUserWithGroups(['finance'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/finance')

    // Should see embedded finance sites
    const budgetLink = userPage.getByRole('link', { name: 'Budget Planning' })
    await expect(budgetLink).toBeVisible()
  })

  test('site group with no visible sites is completely hidden', async () => {
    const user = await createUserWithGroups(['viewer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/admin-dashboard')
    // Should be redirected due to not visible
    await expect(userPage).toHaveURL(/files|^\/$/)
  })

  test('dashboard with partial site visibility shows filtered groups', async () => {
    const user = await createUserWithGroups(['hr'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/management')

    // Should see HR section
    await expect(userPage.locator('h2:has-text("HR Tools")')).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Employee Records' })).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Payroll System' })).toBeVisible()

    // Should NOT see Finance section (no finance group)
    await expect(userPage.locator('h2:has-text("Finance Tools")')).not.toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Budget Reports' })).not.toBeVisible()
  })

  test('complex nested visibility control with multiple group requirements', async () => {
    const user = await createUserWithGroups(['manager', 'verified'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/management')

    // Should see manager tools that require both manager AND verified
    await expect(userPage.locator('h2:has-text("Management Tools")')).toBeVisible()
    await expect(userPage.getByRole('link', { name: 'Team Analytics' })).toBeVisible()

    // But should NOT see executive tools (requires executive group)
    await expect(userPage.getByRole('link', { name: 'Executive Reports' })).not.toBeVisible()
  })

  //--
  test('dashboard sites respect target attribute for external links', async () => {
    const user = await createUserWithGroups(['support'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/support')

    // External sites should have target="_blank"
    await expect(userPage.getByRole('link', { name: 'Ticket System' })).toHaveAttribute(
      'target',
      '_blank'
    )
    await expect(userPage.getByRole('link', { name: 'Knowledge Base' })).toHaveAttribute(
      'target',
      '_blank'
    )
  })

  test('dashboard sites respect target attribute for embedded links', async () => {
    const user = await createUserWithGroups(['support', 'admin'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    await userPage.goto('/external-sites/support')

    // Embedded sites should NOT have target="_blank"
    const internalChatLink = userPage.getByRole('link', { name: 'User Management' })
    await expect(internalChatLink).not.toHaveAttribute('target', '_blank')

    // Should navigate within the app
    await internalChatLink.click()
    await expect(userPage).toHaveURL(/external-sites\/support\/user-management/)
  })

  test('embedded dashboard sites can be accessed directly with proper groups', async () => {
    const user = await createUserWithGroups(['developer'])
    userPage = (await loginAsUser(browser, user.username, user.password)).page

    // Should be able to access embedded dashboard site directly
    await userPage.goto('/external-sites/dev-dashboard/api-documentation')
    await expect(userPage).toHaveURL(/external-sites\/dev-dashboard\/api-documentation/)

    // Should show embedded content
    await expect(userPage.locator('iframe')).toBeVisible()
  })
})
