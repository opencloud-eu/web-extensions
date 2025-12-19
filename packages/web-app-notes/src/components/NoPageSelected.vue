<template>
  <div class="ext:w-full ext:h-full ext:flex ext:items-center ext:justify-center">
    <div class="ext:flex ext:items-center ext:justify-center ext:gap-3">
      <OcIcon name="edit-box" size="xlarge" fill-type="line" />
      <div class="ext:max-w-[200px]">
        <h2 class="ext:my-0">{{ $gettext('Your notes') }}</h2>
        <p class="ext:mb-0">
          {{ $gettext('Please create or select a note on the left.') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()
</script>
