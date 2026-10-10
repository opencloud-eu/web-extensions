import openCloudConfig from '@opencloud-eu/eslint-config'

// Module federation writes temp files into every package while building.
export default [{ ignores: ['**/.__mf__temp/**', '**/dist/**'] }, ...openCloudConfig]
