# OpenCloud Arcade

OpenCloud Arcade lets you open and play `.nes`, `.snes`, `.smc`, `.sfc`, `.gb`, `.gbc`, `.gba`, `.n64`, `.v64`, and `.z64` ROMs in your browser.

## CSP requirements

Arcade needs the following CSP rules for the EmulatorJS runtime. They are shipped in `csp.yaml`, see [CSP files](../../README.md#content-security-policy) for how to load them:

```yaml
directives:
  worker-src:
    - "'self'"
    - 'blob:'
  script-src:
    - "'unsafe-eval'"
    - 'blob:'
  connect-src:
    - 'data:'
```
