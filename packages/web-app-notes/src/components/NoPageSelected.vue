<template>
  <div class="notes-empty ext:flex ext:h-full ext:w-full ext:items-center ext:justify-center ext:p-6">
    <div class="notes-empty__card">
      <span class="notes-empty__icon">
        <OcIcon name="edit-box" size="xlarge" fill-type="line" />
      </span>
      <div class="ext:max-w-[24rem]">
        <h2 class="ext:my-0">{{ title }}</h2>
        <p class="notes-empty__copy ext:mt-2 ext:mb-0">
          {{ message }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

const props = withDefaults(
  defineProps<{
    filterTerm?: string
    noteCount?: number
  }>(),
  {
    filterTerm: '',
    noteCount: 0
  }
)

const { $gettext } = useGettext()

const title = computed(() => {
  if (props.filterTerm.trim()) {
    return $gettext('Search is ready')
  }

  if (props.noteCount > 0) {
    return $gettext('Choose a page to continue')
  }

  return $gettext('Your notes')
})

const message = computed(() => {
  if (props.filterTerm.trim()) {
    return $gettext('Select one of the matching pages from the left to open it in the editor.')
  }

  if (props.noteCount > 0) {
    return $gettext('Your notebook is loaded. Open an existing page or create a new one from the navigator.')
  }

  return $gettext('Please create or select a note on the left.')
})
</script>

<style scoped>
.notes-empty__card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 1.6rem;
  border: 1px solid var(--oc-color-role-outline-variant, #d7dde5);
  background:
    linear-gradient(135deg, rgba(244, 187, 68, 0.12), rgba(37, 99, 235, 0.04) 55%, transparent),
    var(--oc-color-role-surface-container, var(--oc-color-role-surface, transparent));
}

.notes-empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 1.2rem;
  background: rgba(244, 187, 68, 0.16);
  color: var(--oc-color-icon-notes);
}

.notes-empty__copy {
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}
</style>
