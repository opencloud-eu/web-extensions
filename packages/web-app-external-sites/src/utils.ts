import { useUserStore } from '@opencloud-eu/web-pkg'
import {
  VisibilityControl,
  ExternalSiteOrSiteGroup,
  isExternalSiteGroup,
  isExternalSite,
  ExternalSite
} from './types'
import { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'

// Helper function to check visibility requirements
export const shouldDisplay = (visibilityConfig?: VisibilityControl): boolean => {
  const userStore = useUserStore()

  if (!visibilityConfig?.groups) return true
  if (!userStore.user?.memberOf) return false

  const userGroups = userStore.user.memberOf.map((g) => g.displayName)
  const { any, all, none } = visibilityConfig.groups

  // Check if the user has none of the forbidden groups
  if (none && none.some((group) => userGroups.includes(group))) {
    return false
  }

  // Check if a user has all required groups
  if (all && !all.every((group) => userGroups.includes(group))) {
    return false
  }

  // Check if a user has any of the allowed groups
  return !(any && !any.some((group) => userGroups.includes(group)))
}

// Recursive function to filter sites and site groups based on visibility
export const filterVisibleSites = (
  sitesOrGroups: ExternalSiteOrSiteGroup[]
): ExternalSiteOrSiteGroup[] => {
  if (!sitesOrGroups || !Array.isArray(sitesOrGroups)) {
    return []
  }

  return sitesOrGroups.reduce<ExternalSiteOrSiteGroup[]>((acc, item) => {
    if (isExternalSiteGroup(item)) {
      // It's a site group - filter its nested sites
      const filteredSites = filterVisibleSites(item.sites) as ExternalSite[]
      if (filteredSites.length > 0) {
        // Only include the group if it has visible sites
        acc.push({
          ...item,
          sites: filteredSites
        })
      }
    } else {
      const siteItem = item as ExternalSite
      // It's a site - check its visibility
      if (shouldDisplay(siteItem.visibility)) {
        acc.push(item)
      }
    }
    return acc
  }, [])
}

// Route guard for visibility-based checking
export const createVisibilityGuard = (visibilityConfig?: VisibilityControl) => {
  return (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
  ) => {
    if (shouldDisplay(visibilityConfig)) {
      next()
    } else {
      next('/')
    }
  }
}

// Flatten Dashboard Sites
export const flattenSites = (sitesOrGroups: ExternalSiteOrSiteGroup[]) => {
  let flattened: ExternalSite[] = []
  sitesOrGroups.forEach((item) => {
    if (isExternalSite(item)) {
      flattened.push(item)
    } else {
      flattened = flattened.concat(flattenSites(item.sites))
    }
  })

  return flattened
}

export const makeSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}
