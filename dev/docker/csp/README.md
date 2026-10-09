# Dev stack CSP rules

This folder contains app-specific CSP rules, one file per app, that are correct for the dev stack of this repository but not valid in general. They allow hosts that only the dev configuration uses, for example the sites configured for the external-sites app in `dev/docker/opencloud.apps.yaml`.

The files are not shipped with the apps. The rules that apps do ship are described in the [Content Security Policy](../../../README.md#content-security-policy) section of the top-level README.
