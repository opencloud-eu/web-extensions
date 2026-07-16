# web-extensions

[![License](https://img.shields.io/badge/License-AGPL%203-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

This repository contains a collection of [OpenCloud Web](https://github.com/opencloud-eu/web) apps, which for different reasons are not added to the main repository.

## Apps

- [web-app-arcade](./packages/web-app-arcade/)
- [web-app-bpmn](./packages/web-app-bpmn/)
- [web-app-calculator](./packages/web-app-calculator/)
- [web-app-cast](./packages/web-app-cast/)
- [web-app-draw-io](./packages/web-app-draw-io/)
- [web-app-external-sites](./packages/web-app-external-sites/)
- [web-app-importer](./packages/web-app-importer/)
- [web-app-json-viewer](./packages/web-app-json-viewer/)
- [web-app-maps](./packages/web-app-maps/)
- [web-app-notes](./packages/web-app-notes/)
- [web-app-pastebin](./packages/web-app-pastebin/)
- [web-app-progress-bars](./packages/web-app-progress-bars/)
- [web-app-unzip](./packages/web-app-unzip/)

## Installing apps in OpenCloud

Please refer to the [Web app docs](https://docs.opencloud.eu/docs/admin/configuration/web-applications) to learn how to install and configure apps in OpenCloud.

## Adding a new app to this repository

New apps must be placed inside the `packages` folder and be prefixed with `web-app-`. Additionally, their `dist` folder needs to be added as volume mount of the docker `opencloud` service.
