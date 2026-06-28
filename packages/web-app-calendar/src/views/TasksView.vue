<template>
  <div class="tasks-page">
    <h2 class="tasks-title">{{ $gettext('Tasks') }}</h2>

    <form class="tasks-add" @submit.prevent="addTask">
      <oc-text-input
        v-model="newTitle"
        class="tasks-add-title"
        :label="$gettext('Add a task')"
        :placeholder="$gettext('What needs doing?')"
      />
      <label class="tasks-field">
        <span class="tasks-field-label">{{ $gettext('Due') }}</span>
        <input v-model="newDue" type="date" class="tasks-date" />
      </label>
      <oc-button submit="submit" appearance="filled" :disabled="busy || !newTitle.trim()">
        {{ $gettext('Add') }}
      </oc-button>
    </form>

    <p v-if="error" class="tasks-error" role="alert">{{ error }}</p>
    <p v-if="!loading && tasks.length === 0" class="tasks-empty">{{ $gettext('No tasks yet.') }}</p>

    <ul class="tasks-list">
      <li v-for="t in sorted" :key="t.uid" class="tasks-item">
        <oc-checkbox
          class="tasks-item-check"
          :model-value="t.completed"
          :label="t.title || $gettext('(no title)')"
          :disabled="toggling.has(t.url)"
          @update:model-value="toggle(t)"
        />
        <span v-if="t.due" class="tasks-item-due">{{ formatDue(t.due) }}</span>
        <oc-button
          appearance="raw"
          :title="$gettext('Delete task')"
          :aria-label="$gettext('Delete task')"
          @click="remove(t)"
        >
          <oc-icon name="delete-bin-5" fill-type="line" />
        </oc-button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useCalDav } from '../composables/useCalDav'
import { taskFromObject, buildTaskIcs, newUid, type TaskItem } from '../lib/ical'

const language = useGettext()
const { $gettext } = language
const { client, ensureReady, calendarsFor } = useCalDav()

const tasks = ref<TaskItem[]>([])
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const newTitle = ref('')
const newDue = ref('')
// URLs of tasks whose completed-toggle is in flight, so a double-click can't fire
// a second PUT with the now-stale etag (which the server would reject with 412).
const toggling = ref<Set<string>>(new Set())

// Parse a <input type=date> value as local midnight (new Date("YYYY-MM-DD") would
// be UTC midnight and could land on the previous day in non-UTC timezones).
const parseDueLocal = (s: string): Date | null => {
  if (!s) {
    return null
  }
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const sorted = computed(() =>
  [...tasks.value].sort((a, b) => Number(a.completed) - Number(b.completed))
)

const formatDue = (d: Date) => d.toLocaleDateString(language.current)

const collection = () => calendarsFor('VTODO')[0]

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    await ensureReady()
    const col = collection()
    if (!col) {
      tasks.value = []
      return
    }
    const objs = await client.listObjects(col.url, 'VTODO')
    tasks.value = objs.map(taskFromObject).filter((t): t is TaskItem => t !== null)
  } catch (e) {
    error.value = (e as Error).message || $gettext('Could not load tasks')
  } finally {
    loading.value = false
  }
}

const addTask = async () => {
  const col = collection()
  if (!col || !newTitle.value.trim()) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const uid = newUid()
    const ics = buildTaskIcs({
      uid,
      title: newTitle.value.trim(),
      due: parseDueLocal(newDue.value),
      completed: false
    })
    await client.putObject(col.url + encodeURIComponent(uid) + '.ics', ics)
    newTitle.value = ''
    newDue.value = ''
    await load()
  } catch (e) {
    error.value = (e as Error).message || $gettext('Could not add task')
  } finally {
    busy.value = false
  }
}

const toggle = async (t: TaskItem) => {
  if (toggling.value.has(t.url)) {
    return
  }
  toggling.value = new Set(toggling.value).add(t.url)
  try {
    const ics = buildTaskIcs({
      uid: t.uid,
      title: t.title,
      due: t.due,
      completed: !t.completed,
      description: t.description
    })
    await client.putObject(t.url, ics, t.etag)
    await load()
  } catch (e) {
    error.value = (e as Error).message || $gettext('Could not update task')
  } finally {
    const next = new Set(toggling.value)
    next.delete(t.url)
    toggling.value = next
  }
}

const remove = async (t: TaskItem) => {
  // Optimistically drop it from the list so it disappears immediately, then
  // reconcile with the server. Delete unconditionally (no If-Match): an explicit
  // user delete should always succeed even if our cached etag is stale (e.g. the
  // task was just toggled), rather than fail with 412 and appear to "stay".
  const prev = tasks.value
  tasks.value = tasks.value.filter((x) => x.url !== t.url)
  try {
    await client.deleteObject(t.url)
    await load()
  } catch (e) {
    tasks.value = prev
    error.value = (e as Error).message || $gettext('Could not delete task')
  }
}

onMounted(load)
</script>

<style scoped>
.tasks-page {
  padding: 1rem;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.tasks-title {
  margin: 0;
}
.tasks-add {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  padding: 1rem;
  background: var(--oc-role-surface-container);
  border-radius: 1rem;
}
.tasks-add-title {
  flex: 1;
}
.tasks-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.tasks-field-label {
  font-size: 0.8em;
  color: var(--oc-role-on-surface-variant);
}
.tasks-date {
  padding: 0.5rem;
  border: 1px solid var(--oc-role-outline-variant);
  border-radius: 0.5rem;
  background: var(--oc-role-surface);
  color: var(--oc-role-on-surface);
}
.tasks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.tasks-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--oc-role-surface-container);
  border-radius: 0.5rem;
}
.tasks-item-check {
  flex: 1;
  min-width: 0;
}
.tasks-item-due {
  color: var(--oc-role-on-surface-variant);
  font-variant-numeric: tabular-nums;
}
.tasks-error {
  color: var(--oc-role-error);
  margin: 0;
}
.tasks-empty {
  color: var(--oc-role-on-surface-variant);
  margin: 0;
}
</style>
