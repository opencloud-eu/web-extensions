# OpenCloud Arcade

OpenCloud Arcade lets you open and play `.nes`, `.snes`, `.smc`, `.sfc`, `.gb`, `.gbc`, `.gba`, `.n64`, `.v64`, and `.z64` ROMs in your browser.

## CSP requirements

This app needs additional CSP rules, which it ships in the following files:

| File                            | Purpose                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`csp.yaml`](./public/csp.yaml) | Always required. Allows the EmulatorJS runtime to use `blob:` workers and scripts, `eval` and `data:` requests. |

See [Content Security Policy](../../README.md#content-security-policy) for how to load them.
