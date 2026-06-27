<template>
  <div class="cal-shell-root">
    <nav
      class="oc-sidebar-nav mt-3 px-1 cal-nav"
      :class="{ 'cal-nav-collapsed': collapsed }"
      :aria-label="$gettext('Calendar navigation')"
    >
      <ul class="cal-nav-list">
        <li
          v-for="s in sections"
          :key="s.key"
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="active === s.key ? 'page' : undefined"
        >
          <oc-button
            :appearance="active === s.key ? 'filled' : 'raw-inverse'"
            color-role="surface"
            :justify-content="collapsed ? 'center' : 'left'"
            gap-size="medium"
            class="oc-sidebar-nav-item-link relative w-full whitespace-nowrap px-2 py-3 opacity-100 select-none rounded-xl"
            :class="
              active === s.key
                ? 'active overflow-hidden outline'
                : 'hover:bg-role-surface-container-highest focus:bg-role-surface-container-highest'
            "
            @click="select(s.key)"
          >
            <oc-icon :name="s.icon" fill-type="line" />
            <span v-if="!collapsed" class="cal-nav-label">{{ s.label }}</span>
          </oc-button>
        </li>
      </ul>

      <oc-button
        appearance="raw-inverse"
        color-role="surface"
        justify-content="center"
        class="w-full rounded-xl py-3 cal-nav-toggle"
        :aria-label="collapsed ? $gettext('Expand navigation') : $gettext('Collapse navigation')"
        @click="toggle"
      >
        <oc-icon :name="collapsed ? 'arrow-right-s' : 'arrow-left-s'" fill-type="line" />
      </oc-button>
    </nav>

    <main class="cal-content">
      <CalendarView v-if="active === 'calendar'" />
      <TasksView v-else-if="active === 'tasks'" />
      <CalendarsView v-else-if="active === 'calendars'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import CalendarView from '../views/CalendarView.vue'
import TasksView from '../views/TasksView.vue'
import CalendarsView from '../views/CalendarsView.vue'

const { $gettext } = useGettext()

type Section = 'calendar' | 'tasks' | 'calendars'
const ACTIVE_KEY = 'oc-calendar-section'
const NAV_KEY = 'oc-calendar-nav-collapsed'

const active = ref<Section>((localStorage.getItem(ACTIVE_KEY) as Section) || 'calendar')
const collapsed = ref(localStorage.getItem(NAV_KEY) === '1')

const select = (s: Section) => {
  active.value = s
  localStorage.setItem(ACTIVE_KEY, s)
}
const toggle = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(NAV_KEY, collapsed.value ? '1' : '0')
}

const sections: { key: Section; label: string; icon: string }[] = [
  { key: 'calendar', label: $gettext('Calendar'), icon: 'calendar-2' },
  { key: 'tasks', label: $gettext('Tasks'), icon: 'list-check' },
  { key: 'calendars', label: $gettext('Calendars'), icon: 'settings-4' }
]
</script>

<style scoped>
.cal-shell-root {
  display: flex;
  height: 100%;
  box-sizing: border-box;
}
.cal-nav {
  width: 230px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  transition: width 0.15s ease;
}
.cal-nav-collapsed {
  width: 68px;
}
.cal-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
}
.cal-nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-nav-toggle {
  margin: 0.5rem 0.5rem 0;
}
.cal-content {
  flex: 1;
  min-width: 0;
  margin: 0.5rem 0.5rem 0.5rem 0;
  background: var(--oc-role-surface);
  border-radius: 1rem;
  overflow: hidden;
}
</style>
