<template>
  <div class="ext:flex ext:flex-col ext:gap-4">
    <div class="ext:flex ext:items-center ext:justify-between">
      <span class="ext:text-sm ext:font-medium ext:text-role-on-surface">
        {{ $gettext('Which photos belong in this album?') }}
      </span>
      <oc-button
        appearance="raw"
        size="small"
        :disabled="rawMode && !canUseBuilder"
        :title="
          rawMode && !canUseBuilder
            ? $gettext('This query uses features the simple editor does not cover')
            : undefined
        "
        @click="toggleMode"
      >
        {{ rawMode ? $gettext('Use the simple editor') : $gettext('Edit as KQL') }}
      </oc-button>
    </div>

    <template v-if="!rawMode">
      <div class="ext:grid ext:grid-cols-1 ext:gap-4 ext:sm:grid-cols-2">
        <oc-select
          v-model="typeModel"
          :label="$gettext('Type')"
          :options="typeOptions"
          :clearable="false"
        />

        <oc-select
          v-model="cameraModel"
          :label="$gettext('Camera')"
          :options="cameraOptions"
          :placeholder="$gettext('Any camera')"
        />

        <oc-datepicker
          :label="$gettext('Taken after')"
          :current-date="toDateTime(fields.from)"
          :is-clearable="true"
          @date-changed="onDateChanged('from', $event)"
        />

        <oc-datepicker
          :label="$gettext('Taken before')"
          :current-date="toDateTime(fields.to)"
          :is-clearable="true"
          @date-changed="onDateChanged('to', $event)"
        />

        <oc-select
          v-model="spaceModel"
          :label="$gettext('Space')"
          :options="spaceOptions"
          :placeholder="$gettext('All spaces')"
        />

        <div class="ext:flex ext:items-end ext:gap-2">
          <oc-text-input
            v-model="fields.path"
            :label="$gettext('Folder path')"
            :placeholder="$gettext('e.g. Photos/2019')"
            :disabled="!fields.driveId"
            class="ext:min-w-0 ext:flex-1"
          />
          <oc-button appearance="outline" @click="openFolderPicker">
            <oc-icon name="folder-open" size="small" class="ext:mr-1" />
            {{ $gettext('Browse') }}
          </oc-button>
        </div>
      </div>

      <oc-select
        v-if="tagOptions.length"
        v-model="tagModel"
        :label="$gettext('Tag')"
        :options="tagOptions"
        :placeholder="$gettext('Any tag')"
      />

      <p
        class="ext:m-0 ext:rounded-md ext:bg-role-surface-container ext:px-3 ext:py-2 ext:font-mono ext:text-xs ext:break-all ext:text-role-on-surface-variant"
      >
        {{ modelValue || $gettext('Empty query') }}
      </p>
    </template>

    <oc-textarea
      v-else
      :model-value="modelValue"
      :label="$gettext('KQL query')"
      :rows="3"
      class="ext:font-mono"
      :placeholder="$gettext('e.g. mediatype:image AND photo.takenDateTime>=2026-01-01')"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { DateTime } from 'luxon'
import { useGettext } from 'vue3-gettext'
import {
  createFileRouteOptions,
  createLocationSpaces,
  LocationPickerModal,
  useModals,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import { useGraphSearch } from '../composables/useGraphSearch'

const { modelValue } = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { $gettext } = useGettext()
const { search } = useGraphSearch()

const rawMode = ref(false)
const cameraOptions = ref<string[]>([])
const tagOptions = ref<string[]>([])

const fields = reactive({
  type: 'image',
  camera: '',
  tag: '',
  from: '',
  to: '',
  driveId: '',
  path: ''
})

interface SelectOption {
  label: string
  value: string
}

const typeOptions = computed<SelectOption[]>(() => [
  { label: $gettext('Photos'), value: 'image' },
  { label: $gettext('Videos'), value: 'video' },
  { label: $gettext('Everything'), value: '' }
])

const typeModel = computed({
  get: () => typeOptions.value.find((o) => o.value === fields.type),
  set: (option: SelectOption | null) => {
    fields.type = option?.value ?? ''
  }
})

const cameraModel = computed({
  get: () => fields.camera || null,
  set: (value: string | null) => {
    fields.camera = value ?? ''
  }
})

const tagModel = computed({
  get: () => fields.tag || null,
  set: (value: string | null) => {
    fields.tag = value ?? ''
  }
})

const spacesStore = useSpacesStore()
const spaceOptions = computed<SelectOption[]>(() =>
  spacesStore.spaces
    .filter((s) => ['personal', 'project'].includes(s.driveType ?? ''))
    .map((s) => ({ label: s.name, value: String(s.id) }))
)

const spaceModel = computed({
  get: () => spaceOptions.value.find((o) => o.value === fields.driveId) ?? null,
  set: (option: SelectOption | null) => {
    fields.driveId = option?.value ?? ''
  }
})

function toDateTime(value: string): DateTime | undefined {
  return value ? DateTime.fromISO(value) : undefined
}

function onDateChanged(field: 'from' | 'to', { date }: { date: DateTime | null }) {
  fields[field] = date?.toISODate() ?? ''
}

function compile(): string {
  const parts: string[] = []
  if (fields.type) {
    parts.push(`mediatype:${fields.type}`)
  }
  if (fields.camera) {
    parts.push(`photo.cameraModel:"${fields.camera}"`)
  }
  if (fields.tag) {
    parts.push(`Tags:"${fields.tag}"`)
  }
  if (fields.from) {
    parts.push(`photo.takenDateTime>=${fields.from}`)
  }
  if (fields.to) {
    parts.push(`photo.takenDateTime<${fields.to}`)
  }
  if (fields.driveId) {
    parts.push(`driveId:"${fields.driveId}"`)
    if (fields.path) {
      parts.push(`path:"${fields.path}"`)
    }
  }
  return parts.join(' AND ')
}

/**
 * Inverse of compile(): maps a query back onto builder fields. Returns null
 * when any part uses syntax the builder cannot represent (geo, ...).
 */
function tryParse(query: string): typeof fields | null {
  const parsed = { type: '', camera: '', tag: '', from: '', to: '', driveId: '', path: '' }
  if (!query.trim()) {
    return { ...parsed, type: 'image' }
  }
  for (const part of query.split(' AND ')) {
    const p = part.trim()
    let match
    if ((match = p.match(/^mediatype:(image|video)$/))) {
      parsed.type = match[1]
    } else if ((match = p.match(/^photo\.cameraModel:"([^"]+)"$/))) {
      parsed.camera = match[1]
    } else if ((match = p.match(/^Tags:"([^"]+)"$/))) {
      parsed.tag = match[1]
    } else if ((match = p.match(/^photo\.takenDateTime>=(\d{4}-\d{2}-\d{2})$/))) {
      parsed.from = match[1]
    } else if ((match = p.match(/^photo\.takenDateTime<(\d{4}-\d{2}-\d{2})$/))) {
      parsed.to = match[1]
    } else if ((match = p.match(/^driveId:"([^"]+)"$/))) {
      parsed.driveId = match[1]
    } else if ((match = p.match(/^path:"([^"]+)"$/))) {
      parsed.path = match[1]
    } else {
      return null
    }
  }
  if (parsed.path && !parsed.driveId) {
    // a bare path token is a field query, not a location scope
    return null
  }
  return parsed
}

const canUseBuilder = computed(() => tryParse(modelValue) !== null)

watch(
  () => fields.driveId,
  (driveId) => {
    if (!driveId) {
      fields.path = ''
    }
  }
)

watch(fields, () => {
  if (!rawMode.value) {
    emit('update:modelValue', compile())
  }
})

function toggleMode() {
  if (rawMode.value) {
    const parsed = tryParse(modelValue)
    if (!parsed) {
      return
    }
    Object.assign(fields, parsed)
    ensureOption(cameraOptions, parsed.camera)
    ensureOption(tagOptions, parsed.tag)
  }
  rawMode.value = !rawMode.value
}

/** keeps a parsed value selectable even when the live options lack it */
function ensureOption(options: Ref<string[]>, value: string) {
  if (value && !options.value.includes(value)) {
    options.value = [value, ...options.value]
  }
}

const { dispatchModal } = useModals()

function openFolderPicker() {
  const startSpace =
    spacesStore.spaces.find((s) => s.id === fields.driveId) ?? spacesStore.personalSpace
  if (!startSpace) {
    return
  }
  dispatchModal({
    title: $gettext('Choose a folder'),
    elementClass: 'photos-location-picker',
    hideActions: true,
    customComponent: LocationPickerModal,
    customComponentAttrs: () => ({
      parentFolderLink: createLocationSpaces(
        'files-spaces-generic',
        createFileRouteOptions(startSpace, { path: '/', fileId: startSpace.fileId })
      ),
      submitButtonTitle: $gettext('Choose folder'),
      callbackFn: (resources: Resource[]) => {
        const target = resources?.[0]
        if (!target?.id) {
          return
        }
        const driveId = target.storageId ?? String(target.id).split('!')[0]
        fields.driveId = String(driveId)
        fields.path = String(target.path ?? '').replace(/^\/+/, '')
      }
    })
  })
}

onMounted(async () => {
  const parsed = tryParse(modelValue)
  if (parsed) {
    Object.assign(fields, parsed)
    ensureOption(cameraOptions, parsed.camera)
    ensureOption(tagOptions, parsed.tag)
    if (!modelValue) {
      emit('update:modelValue', compile())
    }
  } else {
    rawMode.value = true
  }
  try {
    const container = await search({
      queryString: 'mediatype:image OR mediatype:video',
      size: 0,
      aggregations: [
        { field: 'photo.cameraModel', size: 50 },
        { field: 'Tags', size: 50 }
      ]
    })
    for (const agg of container.aggregations ?? []) {
      const keys = (agg.buckets ?? []).map((b) => b.key)
      if (agg.field === 'photo.cameraModel') {
        cameraOptions.value = keys
      }
      if (agg.field === 'Tags') {
        tagOptions.value = keys
      }
    }
    ensureOption(cameraOptions, fields.camera)
    ensureOption(tagOptions, fields.tag)
  } catch {
    // builder still works without options
  }
})
</script>
