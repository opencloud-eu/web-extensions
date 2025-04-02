# web-extensions

[![License](https://img.shields.io/badge/License-AGPL%203-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

This repository contains a collection of [OpenCloud Web](https://github.com/opencloud-eu/web) extensions, which for different reasons are not added to the main repository.

## Apps

Extensions are provided by apps. These are the apps, that are provided by this repository.

- [web-app-cast](./packages/web-app-cast/)
- [web-app-draw-io](./packages/web-app-draw-io/)
- [web-app-external-sites](./packages/web-app-external-sites/)
- [web-app-importer](./packages/web-app-importer/)
- [web-app-json-viewer](./packages/web-app-json-viewer/)
- [web-app-progress-bars](./packages/web-app-progress-bars/)
- [web-app-unzip](./packages/web-app-unzip/)

## Installing apps in OpenCloud

There are two ways installing these examples:

- You can enable the web apps in our deployment example with minimal effort.\
  For the source how it got implemented, see the [opencloud_full](https://github.com/opencloud-eu/opencloud/tree/master/deployments/examples/opencloud_full) deployment example.\
  For a detailed installation instruction using `opencloud_full` see the [admin docs, Local Production Setup](https://docs.opencloud.com/opencloud/next/depl-examples/ubuntu-compose/ubuntu-compose-prod.html).\
  (Before you start, select the opencloud version in the admin docs you want to use this example for.)
- On a general level, refer to the [Web app docs](https://docs.opencloud.eu/services/web/#loading-applications) to learn how to install apps in OpenCloud.

## Adding a new app to this repository

New apps must be placed inside the `packages` folder and be prefixed with `web-app-`. Additionally, the `dist` folder of the new app needs to be added as volume mount of the docker `opencloud` service.
