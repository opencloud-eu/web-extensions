// Playwright-standard session reuse. The first test that asks for a logged-in
// `page` for a given user pays the full UI-login cost once and writes the
// resulting cookies + localStorage to a temp file. Every subsequent caller
// gets a fresh browser context bootstrapped from that file — no UI flow.
//
// Saves ~3-4s per test for users that already logged in this run.

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'
import type { Browser, Page } from '@playwright/test'
import { LoginPage } from '../pages/loginPage'

const STATE_DIR = join(tmpdir(), 'oc-e2e-states')
if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true })

const inflight = new Map<string, Promise<string>>()

function stateFileFor(username: string) {
  return join(STATE_DIR, `${username}.json`)
}

async function captureState(
  browser: Browser,
  username: string,
  password: string
): Promise<string> {
  const file = stateFileFor(username)
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  await page.goto('/')
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('logon') && r.status() === 200 && r.request().method() === 'POST'
    ),
    new LoginPage(page).login(username, password)
  ])
  await ctx.storageState({ path: file })
  await ctx.close()
  return file
}

// Returns a fresh Page already logged in as the given user. Internally caches
// the storage state on disk so repeat calls within the same test run skip
// the UI login altogether.
export async function loginCached(
  browser: Browser,
  username: string,
  password: string
): Promise<{ page: Page }> {
  let p = inflight.get(username)
  if (!p) {
    p = captureState(browser, username, password)
    inflight.set(username, p)
  }
  const stateFile = await p
  const ctx = await browser.newContext({ storageState: stateFile, ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  await page.goto('/')
  return { page }
}

export async function disposeSession(page: Page) {
  await page.context().close()
}
