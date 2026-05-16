import { Browser, test as base } from '@playwright/test'
import { satisfies, valid } from 'semver'
import { LoginPage } from '../pages/loginPage'

// SemVer range string. Full semver grammar: <, <=, >=, >, ^, ~, space-AND, ||-OR.
type SemverRange = string

export type VersionFixtures = {
  webVersion: string
  ocVersion: string
  skipIfWeb: (range: SemverRange, reason?: string) => void
  skipIfOc: (range: SemverRange, reason?: string) => void
  // Internal: shared boot-log scrape result so webVersion/ocVersion don't probe multiple times.
  // Undefined when both WEB_VERSION and OC_VERSION env vars are set (no probe needed).
  _discoveredVersions: { webVersion: string; ocVersion: string } | undefined
}

const WEB_VERSION_LOG_RE = /OpenCloud Web UI (\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?)/
const OC_VERSION_LOG_RE = /OpenCloud (\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?)\s+\S+/ // "OpenCloud 6.2.0 rolling"

const requireValidSemver = (value: string, axis: 'web' | 'oc', source: string): string => {
  if (!valid(value)) {
    throw new Error(`Resolved ${axis} version "${value}" from ${source} is not a valid SemVer.`)
  }
  return value
}

// Capture the boot-time version logs by performing a full authenticated login.
// Both lines come from web's announceVersions() which only fires AFTER auth, so
// an unauthenticated probe gets bounced to the IDP and never sees them.
const captureBootVersions = async (
  browser: Browser,
  timeoutMs = 60_000
): Promise<{ webVersion: string; ocVersion: string }> => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  try {
    let webVersion: string | undefined
    let ocVersion: string | undefined
    let resolveSeen: () => void
    let rejectSeen: (e: Error) => void
    const seen = new Promise<void>((res, rej) => {
      resolveSeen = res
      rejectSeen = rej
    })
    page.on('console', (msg) => {
      const text = msg.text()
      if (!webVersion) {
        const wm = WEB_VERSION_LOG_RE.exec(text)
        if (wm) webVersion = wm[1]
      }
      if (!ocVersion && !WEB_VERSION_LOG_RE.test(text)) {
        const om = OC_VERSION_LOG_RE.exec(text)
        if (om) ocVersion = om[1]
      }
      if (webVersion && ocVersion) {
        resolveSeen()
      }
    })

    const timer = setTimeout(
      () =>
        rejectSeen(
          new Error(
            `Did not see both "OpenCloud Web UI X.Y.Z" and "OpenCloud X.Y.Z <edition>" logs within ${timeoutMs}ms (web=${webVersion ?? 'missing'}, oc=${ocVersion ?? 'missing'})`
          )
        ),
      timeoutMs
    )

    // Authenticate; the SPA only emits announceVersions() after the auth context is set up.
    const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'
    const loginPage = new LoginPage(page)
    await page.goto('/')
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().endsWith('logon') &&
          resp.status() === 200 &&
          resp.request().method() === 'POST'
      ),
      loginPage.login(adminUsername, adminPassword)
    ])

    await seen
    clearTimeout(timer)
    return { webVersion: webVersion!, ocVersion: ocVersion! }
  } finally {
    await ctx.close()
  }
}

export const test = base.extend<{}, VersionFixtures>({
  // Shared one-shot scrape; runs at most once per worker, only when at least one
  // axis actually needs it. webVersion / ocVersion below depend on this fixture so
  // the result is cached and reused without any module-level state.
  _discoveredVersions: [
    async ({ browser }, use) => {
      if (process.env.WEB_VERSION && process.env.OC_VERSION) {
        await use(undefined)
        return
      }
      await use(await captureBootVersions(browser))
    },
    { scope: 'worker' }
  ],
  webVersion: [
    async ({ _discoveredVersions }, use) => {
      const fromEnv = process.env.WEB_VERSION
      if (fromEnv) {
        const v = requireValidSemver(fromEnv, 'web', 'WEB_VERSION env')
        console.log(`[versions] webVersion=${v} (from WEB_VERSION env)`)
        await use(v)
        return
      }
      const v = requireValidSemver(_discoveredVersions!.webVersion, 'web', 'boot log scrape')
      console.log(`[versions] webVersion=${v} (scraped from boot log)`)
      await use(v)
    },
    { scope: 'worker' }
  ],
  ocVersion: [
    async ({ _discoveredVersions }, use) => {
      const fromEnv = process.env.OC_VERSION
      if (fromEnv) {
        const v = requireValidSemver(fromEnv, 'oc', 'OC_VERSION env')
        console.log(`[versions] ocVersion=${v} (from OC_VERSION env)`)
        await use(v)
        return
      }
      const v = requireValidSemver(_discoveredVersions!.ocVersion, 'oc', 'boot log scrape')
      console.log(`[versions] ocVersion=${v} (scraped from boot log)`)
      await use(v)
    },
    { scope: 'worker' }
  ],
  skipIfWeb: [
    async ({ webVersion }, use) => {
      await use((range, reason) => {
        base.skip(satisfies(webVersion, range), reason ?? `web ${webVersion} matches ${range}`)
      })
    },
    { scope: 'worker' }
  ],
  skipIfOc: [
    async ({ ocVersion }, use) => {
      await use((range, reason) => {
        base.skip(satisfies(ocVersion, range), reason ?? `oc ${ocVersion} matches ${range}`)
      })
    },
    { scope: 'worker' }
  ]
})
