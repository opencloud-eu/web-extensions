<template>
  <main class="notes-overview ext:min-h-full ext:overflow-auto ext:p-4 md:ext:p-6">
    <section class="notes-overview__hero ext:mx-auto ext:max-w-6xl ext:rounded-[2rem] ext:p-6 md:ext:p-8">
      <div class="notes-overview__hero-layout">
        <div>
          <div class="notes-overview__eyebrow">
            <oc-icon name="sticky-note" fill-type="line" size="small" />
            <span>{{ $gettext('Modern file-native notes') }}</span>
          </div>
          <h1 class="ext:mt-4 ext:mb-3 ext:text-3xl ext:leading-tight md:ext:text-5xl">
            {{ $gettext('A calmer workspace for structured notes and living documentation.') }}
          </h1>
          <p class="notes-overview__lede ext:mb-0 ext:max-w-3xl ext:text-base md:ext:text-lg">
            {{
              $gettext(
                'Notes stays close to OpenCloud: every notebook is just a folder, every page is markdown, and the interface is built for fast browsing, writing and finding context.'
              )
            }}
          </p>
        </div>

        <oc-card class="notes-overview__aside ext:h-fit">
          <div class="ext:flex ext:flex-col ext:gap-4">
            <div>
              <p class="notes-overview__label">{{ $gettext('Notebook format') }}</p>
              <h2 class="ext:mt-1 ext:mb-2 ext:text-xl">{{ $gettext('.ocnb + markdown') }}</h2>
              <p class="notes-overview__muted ext:my-0">
                {{
                  $gettext(
                    'That means versioning, sharing, WebDAV access and backups stay exactly where you already manage them today.'
                  )
                }}
              </p>
            </div>

            <div class="notes-overview__stack">
              <div class="notes-overview__stack-card">
                <span class="notes-overview__stack-title">{{ $gettext('Notebook folder') }}</span>
                <span class="notes-overview__stack-copy">{{ $gettext('Project Atlas.ocnb') }}</span>
              </div>
              <div class="notes-overview__stack-card notes-overview__stack-card--nested">
                <span class="notes-overview__stack-title">{{ $gettext('Pages inside') }}</span>
                <span class="notes-overview__stack-copy">{{ $gettext('Vision.md, Roadmap.md, Decisions.md') }}</span>
              </div>
            </div>
          </div>
        </oc-card>
      </div>
    </section>

    <section class="notes-overview__grid ext:mx-auto ext:max-w-6xl">
      <oc-card class="notes-overview__card bg-role-surface-container ext:border">
        <oc-icon name="book-open" fill-type="line" size="large" color="var(--oc-color-icon-notes)" />
        <h3 class="ext:mb-2 ext:mt-4">{{ $gettext('Structured notebooks') }}</h3>
        <p class="notes-overview__muted ext:my-0">
          {{
            $gettext(
              'Create one notebook per project, customer or topic and keep nested folders for sections that need real hierarchy.'
            )
          }}
        </p>
      </oc-card>

      <oc-card class="notes-overview__card bg-role-surface-container ext:border">
        <oc-icon name="article" fill-type="line" size="large" color="var(--oc-color-role-primary, #2563eb)" />
        <h3 class="ext:mb-2 ext:mt-4">{{ $gettext('Markdown first') }}</h3>
        <p class="notes-overview__muted ext:my-0">
          {{
            $gettext(
              'Write lightweight pages that remain portable. Your content is readable even outside the app and easy to automate later.'
            )
          }}
        </p>
      </oc-card>

      <oc-card class="notes-overview__card bg-role-surface-container ext:border">
        <oc-icon name="search" fill-type="line" size="large" color="var(--oc-color-role-primary, #2563eb)" />
        <h3 class="ext:mb-2 ext:mt-4">{{ $gettext('Fast retrieval') }}</h3>
        <p class="notes-overview__muted ext:my-0">
          {{
            $gettext(
              'The next step is a richer browsing surface with quick filters, recent pages and a better navigator instead of a plain tree.'
            )
          }}
        </p>
      </oc-card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { AppConfigObject } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'

defineProps<{ applicationConfig: AppConfigObject }>()

const { $gettext } = useGettext()
</script>

<style scoped>
.notes-overview {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(244, 187, 68, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.02), transparent 36%);
}

.notes-overview__hero-layout {
  display: grid;
  gap: 1.5rem;
}

.notes-overview__hero {
  border: 1px solid var(--oc-color-role-outline-variant, #d7dde5);
  background:
    linear-gradient(135deg, rgba(244, 187, 68, 0.08), rgba(37, 99, 235, 0.04) 45%, transparent 72%),
    var(--oc-color-role-surface-container, var(--oc-color-role-surface, transparent));
}

.notes-overview__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--oc-color-role-outline-variant, #d7dde5);
  background: var(--oc-color-role-surface-container, var(--oc-color-interaction-hover));
  font-size: 0.85rem;
  font-weight: 600;
}

.notes-overview__lede,
.notes-overview__muted {
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-overview__aside,
.notes-overview__card {
  border-color: var(--oc-color-role-outline-variant, #d7dde5);
}

.notes-overview__label,
.notes-overview__stack-title {
  margin: 0;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-overview__stack {
  display: grid;
  gap: 0.85rem;
}

.notes-overview__stack-card {
  display: grid;
  gap: 0.45rem;
  padding: 1rem;
  border-radius: 1.1rem;
  border: 1px solid var(--oc-color-role-outline-variant, #d7dde5);
  background: var(--oc-color-role-surface-container);
}

.notes-overview__stack-card--nested {
  margin-left: 1.25rem;
}

.notes-overview__stack-copy {
  font-weight: 600;
}

.notes-overview__grid {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
}

@media (min-width: 48rem) {
  .notes-overview__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 64rem) {
  .notes-overview__hero-layout {
    grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 22rem);
    align-items: start;
  }
}
</style>
