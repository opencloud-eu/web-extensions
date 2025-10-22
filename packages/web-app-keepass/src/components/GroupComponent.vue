<template>
  <div class="group-container" :style="{ marginLeft: level * 20 + 'px' }">
    <div class="group-header" @click="toggleExpanded" :class="{ expandable: hasChildren }">
      <span v-if="hasChildren" class="expand-icon" :class="{ expanded }">▶</span>
      <span v-else class="no-expand-icon"></span>
      <span class="group-icon">📁</span>
      <span class="group-name">{{ group.name }}</span>
      <span class="group-counts">
        <span v-if="group.entries.length">({{ group.entries.length }} entries)</span>
        <span v-if="group.groups.length">({{ group.groups.length }} groups)</span>
      </span>
    </div>

    <div v-if="expanded && hasChildren" class="group-content">
      <!-- Child Groups -->
      <GroupComponent
        v-for="childGroup in group.groups"
        :key="childGroup.uuid.toString()"
        :group="childGroup"
        :level="level + 1"
      />

      <!-- Entries Table -->
      <div
        v-if="group.entries.length > 0"
        class="entries-table"
        :style="{ marginLeft: (level + 1) * 20 + 'px' }"
      >
        <div class="entries-table-header">
          <div class="col-icon"></div>
          <div class="col-title">Title</div>
          <div class="col-username">Username</div>
          <div class="col-password">Password</div>
          <div class="col-url">URL</div>
        </div>
        <div v-for="entry in group.entries" :key="entry.uuid.toString()" class="entry-row">
          <div class="col-icon">
            <span class="entry-icon">🔑</span>
          </div>
          <div class="col-title">
            <span class="entry-title">{{ getFieldText(entry, 'Title') || 'Untitled' }}</span>
          </div>
          <div class="col-username">
            <span class="entry-username">{{ getFieldText(entry, 'UserName') || '' }}</span>
          </div>
          <div class="col-password">
            <div class="password-cell">
              <span v-if="!isPasswordVisible(entry.uuid.toString())" class="password-hidden"
                >••••••••</span
              >
              <span v-else class="password-visible">{{
                getFieldText(entry, 'Password') || ''
              }}</span>
              <button
                class="password-toggle"
                @click.stop="togglePassword(entry.uuid.toString())"
                :title="
                  isPasswordVisible(entry.uuid.toString()) ? 'Hide password' : 'Show password'
                "
              >
                {{ isPasswordVisible(entry.uuid.toString()) ? '👁️' : '👁️‍🗨️' }}
              </button>
            </div>
          </div>
          <div class="col-url">
            <span class="entry-url">{{ getFieldText(entry, 'URL') || '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  group: any
  level: number
}

const props = defineProps<Props>()

const expanded = ref(props.level < 2) // Auto-expand first 2 levels
const visiblePasswords = ref(new Set<string>())

const toggleExpanded = () => {
  expanded.value = !expanded.value
}

const hasChildren = computed(() => {
  return props.group.groups.length > 0 || props.group.entries.length > 0
})

const getFieldText = (entry: any, fieldName: string): string => {
  const field = entry.fields.get(fieldName)
  if (!field) return ''

  // Handle different field types
  if (typeof field === 'string') {
    return field
  }

  // Handle ProtectedValue objects
  if (field && typeof field.getText === 'function') {
    return field.getText()
  }

  // Handle plain text values
  if (field && field.toString) {
    return field.toString()
  }

  return ''
}

const isPasswordVisible = (entryId: string): boolean => {
  return visiblePasswords.value.has(entryId)
}

const togglePassword = (entryId: string): void => {
  const newSet = new Set(visiblePasswords.value)
  if (newSet.has(entryId)) {
    newSet.delete(entryId)
  } else {
    newSet.add(entryId)
  }
  visiblePasswords.value = newSet
}
</script>
