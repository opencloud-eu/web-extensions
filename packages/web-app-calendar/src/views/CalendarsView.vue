<template>
  <div class="mng-page">
    <header class="mng-head">
      <h2 class="mng-title">{{ $gettext('Calendars') }}</h2>
      <p class="mng-sub">
        {{ $gettext('Manage your calendars and connect them to other apps with the CalDAV link.') }}
      </p>
    </header>

    <p v-if="error" class="mng-error">{{ error }}</p>

    <!-- Category: your calendars -->
    <section class="cat cat-cal">
      <div class="cat-head">
        <span class="cat-badge"><oc-icon name="calendar-2" fill-type="line" size="large" /></span>
        <div class="cat-headtext">
          <h3 class="cat-title">{{ $gettext('Your calendars') }}</h3>
          <p class="cat-sub">
            {{
              $gettext(
                'Connect them to other apps (Thunderbird, Apple Calendar, ...) with the CalDAV link.'
              )
            }}
          </p>
        </div>
      </div>

      <div class="cat-body">
        <form class="mng-form" @submit.prevent="create">
          <label class="mng-swatch" :title="$gettext('Colour')">
            <span class="mng-swatch-dot" :style="{ background: newColor }" />
            <input v-model="newColor" type="color" class="mng-swatch-input" />
          </label>
          <input
            v-model="newName"
            class="mng-input mng-grow"
            :placeholder="$gettext('New calendar name...')"
          />
          <oc-button submit="submit" appearance="filled" :disabled="busy || !newName.trim()">
            <oc-icon name="add" fill-type="line" size="small" />
            {{ $gettext('Create') }}
          </oc-button>
        </form>

        <ul class="mng-rows">
          <li v-for="c in calendars" :key="c.url" class="mng-row">
            <label class="mng-swatch" :title="$gettext('Colour')">
              <span class="mng-swatch-dot" :style="{ background: c.color || '#0082c9' }" />
              <input
                type="color"
                :value="c.color || '#0082c9'"
                class="mng-swatch-input"
                @change="recolor(c.url, $event)"
              />
            </label>
            <div class="mng-row-body">
              <input
                class="mng-name"
                :value="c.displayName"
                :aria-label="$gettext('Calendar name')"
                @change="rename(c.url, $event)"
              />
              <div class="mng-url-line">
                <input
                  class="mng-url"
                  :value="fullUrl(c.url)"
                  readonly
                  :aria-label="$gettext('CalDAV URL')"
                  @focus="selectAll"
                />
                <oc-button
                  appearance="raw"
                  :title="$gettext('Copy CalDAV URL')"
                  @click="copy(c.url)"
                >
                  <oc-icon name="file-copy" fill-type="line" size="small" />
                </oc-button>
              </div>
            </div>
            <div class="mng-actions">
              <oc-button appearance="raw" :title="$gettext('Export as .ics')" @click="exportCal(c)">
                <oc-icon name="download-2" fill-type="line" />
              </oc-button>
              <label class="mng-icon-btn" :title="$gettext('Import .ics')">
                <oc-icon name="upload-2" fill-type="line" />
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  class="mng-file"
                  @change="importCal(c, $event)"
                />
              </label>
              <oc-button
                appearance="raw"
                :title="$gettext('Delete calendar')"
                @click="confirmDelete(c)"
              >
                <oc-icon name="delete-bin-5" fill-type="line" variation="danger" />
              </oc-button>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useModals, useMessages } from '@opencloud-eu/web-pkg'
import { useCalDav } from '../composables/useCalDav'
import { splitIcs, mergeIcs, newUid } from '../lib/ical'
import type { CalendarCollection } from '../clients/caldav'

const { $gettext } = useGettext()
const { dispatchModal } = useModals()
const { showMessage } = useMessages()
const { client, calendars, ensureReady, fullUrl, createCalendar, updateCalendar, deleteCalendar } =
  useCalDav()

const newName = ref('')
const newColor = ref('#0082c9')
const busy = ref(false)
const error = ref('')

const run = async (fn: () => Promise<void>) => {
  busy.value = true
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = (e as Error).message || $gettext('Something went wrong')
  } finally {
    busy.value = false
  }
}

const create = () =>
  run(async () => {
    await createCalendar(newName.value.trim(), newColor.value)
    newName.value = ''
  })

const rename = (url: string, ev: Event) =>
  run(() => updateCalendar(url, { displayName: (ev.target as HTMLInputElement).value.trim() }))

const recolor = (url: string, ev: Event) =>
  run(() => updateCalendar(url, { color: (ev.target as HTMLInputElement).value }))

const confirmDelete = (c: CalendarCollection) => {
  dispatchModal({
    title: $gettext('Delete calendar'),
    message: $gettext('Delete "%{name}" and all its events? This cannot be undone.', {
      name: c.displayName
    }),
    confirmText: $gettext('Delete'),
    onConfirm: async () => {
      await deleteCalendar(c.url)
    }
  })
}

const selectAll = (ev: FocusEvent) => (ev.target as HTMLInputElement).select()

const exportCal = (c: CalendarCollection) =>
  run(async () => {
    const events = await client.listObjects(c.url, 'VEVENT')
    const todos = await client.listObjects(c.url, 'VTODO')
    const ics = mergeIcs([...events, ...todos].map((o) => o.data))
    const blob = new Blob([ics], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${c.displayName || 'calendar'}.ics`
    a.click()
    URL.revokeObjectURL(a.href)
  })

const importCal = (c: CalendarCollection, ev: Event) => {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }
  run(async () => {
    const text = await file.text()
    let added = 0
    let skipped = 0
    for (const obj of splitIcs(text)) {
      const uid = obj.uid || newUid()
      try {
        await client.putObject(c.url + encodeURIComponent(uid) + '.ics', obj.ics)
        added++
      } catch {
        // already present (412) or rejected - keep importing the rest
        skipped++
      }
    }
    input.value = ''
    showMessage({
      title: $gettext('Imported %{n} into %{name}', { n: String(added), name: c.displayName })
    })
    if (skipped) {
      error.value = $gettext('%{n} item(s) were skipped (already present or invalid).', {
        n: String(skipped)
      })
    }
  })
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showMessage({ title: $gettext('Copied to clipboard') })
  } catch {
    /* clipboard may be blocked; the field is selectable as a fallback */
  }
}
const copy = (url: string) => copyText(fullUrl(url))

onMounted(() => run(() => ensureReady(true)))
</script>

<style scoped>
.mng-page {
  height: 100%;
  overflow-y: auto;
  padding: 2rem;
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-sizing: border-box;
}
/* Include padding/border in every element's width so nothing (long URLs, the
   full-width inputs/select with flex-basis:100%) overflows its category card. */
.mng-page,
.mng-page * {
  box-sizing: border-box;
}
.mng-head {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}
.mng-title {
  margin: 0;
}
.mng-sub {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.4;
  color: var(--oc-role-on-surface-variant);
}

/* each category is its own clearly bounded card with a coloured badge */
.cat {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--oc-role-outline-variant);
  border-radius: 1rem;
  background: var(--oc-role-surface-container-low);
  /* no overflow:hidden - on small screens that would clip (hide) content that
     doesn't fit instead of letting it wrap; box-sizing + wrapping keep it tidy */
}
.cat-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--oc-role-outline-variant);
}
.cat-badge {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
}
.cat-headtext {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cat-title {
  margin: 0;
  font-size: 1.15em;
  font-weight: 700;
}
.cat-sub {
  margin: 0;
  font-size: 0.85em;
  line-height: 1.4;
  color: var(--oc-role-on-surface-variant);
}
.cat-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

/* per-category colour identity (badge tint + accent) */
.cat-cal .cat-badge {
  background: color-mix(in srgb, #0082c9 16%, transparent);
  color: #0082c9;
}
.cat-cal {
  border-top: 3px solid #0082c9;
}
.cat-sub .cat-badge {
  background: color-mix(in srgb, #46ba61 18%, transparent);
  color: #2e9e4f;
}
.cat-sub {
  border-top: 3px solid #46ba61;
}
.cat-share .cat-badge {
  background: color-mix(in srgb, #9a59b5 18%, transparent);
  color: #9a59b5;
}
.cat-share {
  border-top: 3px solid #9a59b5;
}

/* forms: a row that wraps; the long field takes its own line */
.mng-form {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.mng-form-wrap {
  flex-wrap: wrap;
}
.mng-full {
  flex: 1 1 100%;
  min-width: 0;
}
.mng-grow {
  flex: 1;
  min-width: 140px;
}
.mng-input {
  padding: 0.5rem 1rem;
  border: 1px solid var(--oc-role-outline-variant);
  border-radius: 0.5rem;
  background: var(--oc-role-surface);
  color: var(--oc-role-on-surface);
}
.mng-input:focus {
  outline: none;
  border-color: var(--oc-role-primary);
}

/* colour swatch */
.mng-swatch {
  position: relative;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  cursor: pointer;
}
.mng-swatch-dot {
  display: block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--oc-role-surface);
  box-shadow: 0 0 0 1px var(--oc-role-outline-variant);
}
.mng-swatch-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  cursor: pointer;
}
.mng-dot-static {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--oc-role-surface);
  box-shadow: 0 0 0 1px var(--oc-role-outline-variant);
}
.mng-row-icon {
  flex-shrink: 0;
  color: var(--oc-role-on-surface-variant);
}

/* lists rendered as aligned rows with hairline dividers between them */
.mng-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.mng-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: var(--oc-role-surface);
}
.mng-row + .mng-row {
  margin-top: 0.5rem;
}
.mng-row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mng-name {
  min-width: 0;
  padding: 0.25rem 0.5rem;
  font-size: 1.02em;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--oc-role-on-surface);
}
.mng-name:hover {
  border-color: var(--oc-role-outline-variant);
}
.mng-name:focus {
  border-color: var(--oc-role-primary);
  background: var(--oc-role-surface-container);
  outline: none;
}
.mng-name-static {
  font-size: 1.02em;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mng-count {
  flex-shrink: 0;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--oc-role-on-surface-variant);
  background: var(--oc-role-surface-container-high);
  padding: 2px 0.5rem;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mng-count-err {
  color: var(--oc-role-on-error-container);
  background: var(--oc-role-error-container);
}
.mng-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.mng-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: var(--oc-role-on-surface);
}
.mng-icon-btn:hover {
  background: var(--oc-role-surface-container-high);
}
.mng-file {
  display: none;
}

/* inline url field (CalDAV link / feed link) */
.mng-url-line {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-left: 0.5rem;
}
.mng-url {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-family: monospace;
  font-size: 0.8em;
  color: var(--oc-role-on-surface-variant);
}
.mng-url:focus {
  outline: none;
}
.mng-url-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-left: 0.5rem;
  font-size: 0.8em;
  color: var(--oc-role-on-surface-variant);
}
.mng-empty {
  margin: 0;
  padding: 0.5rem 0;
  font-size: 0.9em;
  color: var(--oc-role-on-surface-variant);
}
.mng-error {
  margin: 0;
  color: var(--oc-role-error);
}

/* Narrow screens: tighten padding and let rows wrap so nothing is clipped and
   the page (not the box) scrolls vertically. */
@media (max-width: 560px) {
  .mng-page {
    padding: 1rem;
    gap: 1rem;
  }
  .cat-head {
    padding: 1rem;
    gap: 0.75rem;
  }
  .cat-body {
    padding: 1rem;
  }
  .mng-row {
    flex-wrap: wrap;
  }
  .mng-row .mng-row-body {
    flex-basis: 100%;
    order: 2;
  }
}
</style>
