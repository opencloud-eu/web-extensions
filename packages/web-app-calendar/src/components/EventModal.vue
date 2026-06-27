<template>
  <div class="cal-event-modal">
    <oc-text-input v-model="title" :label="$gettext('Title')" />
    <oc-text-input v-model="location" :label="$gettext('Location')" />

    <label class="cal-row">
      <input v-model="allDay" type="checkbox" />
      <span>{{ $gettext('All day') }}</span>
    </label>

    <label class="cal-field">
      <span>{{ $gettext('Start') }}</span>
      <input v-model="startStr" :type="allDay ? 'date' : 'datetime-local'" class="cal-input" />
    </label>
    <label class="cal-field">
      <span>{{ $gettext('End') }}</span>
      <input v-model="endStr" :type="allDay ? 'date' : 'datetime-local'" class="cal-input" />
    </label>

    <oc-textarea v-model="description" :label="$gettext('Notes')" />

    <p v-if="errorMsg" class="cal-error">{{ errorMsg }}</p>

    <div class="cal-actions">
      <oc-button appearance="outline" @click="close">{{ $gettext('Cancel') }}</oc-button>
      <oc-button
        v-if="event"
        appearance="outline"
        variation="danger"
        :disabled="busy"
        @click="onDelete"
      >
        {{ $gettext('Delete') }}
      </oc-button>
      <oc-button appearance="filled" :disabled="busy || !title.trim()" @click="onSave">
        {{ $gettext('Save') }}
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Modal, useModals } from '@opencloud-eu/web-pkg'
import type { CalendarEvent } from '../lib/ical'

const props = defineProps<{
  modal: Modal
  event: CalendarEvent | null
  initialStart: Date
  initialEnd: Date
  initialAllDay: boolean
  onSubmit: (input: {
    title: string
    start: Date
    end: Date
    allDay: boolean
    description: string
    location: string
  }) => Promise<void>
  onRemove: (() => Promise<void>) | null
}>()

const { $gettext } = useGettext()
const { removeModal } = useModals()

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time; date wants "YYYY-MM-DD".
const pad = (n: number) => String(n).padStart(2, '0')
const toLocal = (d: Date, dateOnly: boolean) => {
  const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return dateOnly ? s : `${s}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const title = ref(props.event?.title ?? '')
const location = ref(props.event?.location ?? '')
const description = ref(props.event?.description ?? '')
const allDay = ref(props.event?.allDay ?? props.initialAllDay)
const startStr = ref(toLocal(props.event?.start ?? props.initialStart, allDay.value))
const endStr = ref(
  toLocal(props.event?.end ?? props.event?.start ?? props.initialEnd, allDay.value)
)
const busy = ref(false)
const errorMsg = ref('')

const close = () => removeModal(props.modal.id)

const onSave = async () => {
  const start = new Date(startStr.value)
  let end = new Date(endStr.value)
  if (isNaN(start.getTime())) {
    errorMsg.value = $gettext('Please pick a start')
    return
  }
  // Require end strictly after start: an equal end gives a zero-length event
  // (DTEND==DTSTART), which is invalid for all-day events (DTEND is exclusive).
  if (isNaN(end.getTime()) || end <= start) {
    end = new Date(start.getTime() + (allDay.value ? 86400000 : 3600000))
  }
  busy.value = true
  errorMsg.value = ''
  try {
    await props.onSubmit({
      title: title.value.trim(),
      start,
      end,
      allDay: allDay.value,
      description: description.value.trim(),
      location: location.value.trim()
    })
    close()
  } catch (e) {
    errorMsg.value = (e as Error).message || $gettext('Could not save')
  } finally {
    busy.value = false
  }
}

const onDelete = async () => {
  if (!props.onRemove) {
    return
  }
  busy.value = true
  errorMsg.value = ''
  try {
    await props.onRemove()
    close()
  } catch (e) {
    errorMsg.value = (e as Error).message || $gettext('Could not delete')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.cal-event-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cal-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.cal-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cal-input {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--oc-role-outline);
  border-radius: 0.25rem;
  background: var(--oc-role-surface);
  color: var(--oc-role-on-surface);
}
.cal-error {
  margin: 0;
  color: var(--oc-role-error);
}
.cal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
