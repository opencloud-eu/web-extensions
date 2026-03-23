<template>
  <header
    class="ext:flex ext:items-center ext:justify-between ext:px-5 ext:py-4 ext:border-b ext:border-[var(--oc-role-outline-variant)] ext:bg-[var(--oc-role-surface-container)]"
  >
    <nav
      aria-label="Breadcrumb"
      class="ext:m-0 ext:text-xl ext:font-semibold ext:text-[var(--oc-role-on-surface)] ext:flex ext:items-center ext:min-w-0"
    >
      <slot name="title" />
    </nav>
    <div class="ext:flex ext:items-center ext:gap-3 ext:flex-shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
