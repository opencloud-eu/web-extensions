# OpenCloud Arcade

OpenCloud Arcade lets you open and play `.nes`, `.snes`, `.smc`, `.sfc`, `.gb`, `.gbc`, `.gba`, `.n64`, `.v64`, and `.z64` ROMs in your browser.

## CSP Requirements

Arcade requires the following CSP directives for EmulatorJS runtime execution:

```yaml
worker-src:
  - "'self'"
  - 'blob:'
```

```yaml
script-src:
  - "'self'"
  - "'unsafe-eval'"
  - 'blob:'
```

```yaml
connect-src:
  - "'self'"
  - 'blob:'
  - 'data:'
```
