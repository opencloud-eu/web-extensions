# web-extensions

[![License](https://img.shields.io/badge/License-AGPL%203-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

This repository contains a collection of [OpenCloud Web](https://github.com/opencloud-eu/web) apps, which for different reasons are not added to the main repository.

## Apps

- [web-app-arcade](./packages/web-app-arcade/)
- [web-app-bpmn](./packages/web-app-bpmn/)
- [web-app-calculator](./packages/web-app-calculator/)
- [web-app-cast](./packages/web-app-cast/)
- [web-app-draw-io](./packages/web-app-draw-io/)
- [web-app-excalidraw](./packages/web-app-excalidraw/)
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

## Content Security Policy

Some apps need additional rules in the Content Security Policy (CSP) of OpenCloud. These apps ship their rules as files next to their `manifest.json`:

- `csp.yaml` contains the rules the app cannot work without.
- `csp.defaults.yaml` contains the rules the app needs with its default configuration, for example the default tile server of the maps app. If you configure different hosts, leave this file out and add your hosts to your own CSP file instead.
- Further files like `csp.protomaps-fonts.yaml` of the maps app cover optional setups. They are described in the README of the app and should be added to the list individually, only where you need them, instead of via a glob pattern.

OpenCloud can merge these files into its default CSP. This requires OpenCloud 9.0.0 or newer:

```yaml
PROXY_CSP_CONFIG_FILE_LOCATION: '/web/apps/*/csp.yaml,/web/apps/*/csp.defaults.yaml,/etc/opencloud/csp.yaml'
```

Replace `/web/apps` with your apps directory and append your own CSP file if you have one. The proxy service needs read access to the apps directory, and it reads the files only at startup, so restart it after installing or updating an app.

With older versions of OpenCloud, copy the rules from the files of your installed apps into your own CSP file.

## Adding a new app to this repository

New apps must be placed inside the `packages` folder and be prefixed with `web-app-`. Additionally, their `dist` folder needs to be added as volume mount of the docker `opencloud` service.
