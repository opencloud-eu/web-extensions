// based on https://github.com/keeweb/keeweb/blob/b4bb8e2ca617ad2b9d5a4d210552b6482e4ff503/app/scripts/util/kdbxweb/kdbxweb-init.js
// released under MIT license

import * as kdbxweb from 'kdbxweb'
import { Logger } from './kdbx-logger'
import argon2Raw from 'argon2-browser/dist/argon2.js?raw'
import argon2WasmSIMD from 'argon2-browser/dist/argon2-simd.wasm?base64'
import argon2WasmRegular from 'argon2-browser/dist/argon2.wasm?base64'

const logger = new (Logger as any)('argon2')

const KdbxwebInit = {
  runtimeModule: null,
  init() {
    kdbxweb.CryptoEngine.setArgon2Impl((...args) => this.argon2(...args))
  },

  argon2(password, salt, memory, iterations, length, parallelism, type, version) {
    const startTime = performance.now()
    console.log(
      `[ARGON2] Starting argon2 with params: memory=${memory}, iterations=${iterations}, length=${length}, parallelism=${parallelism}, type=${type}`
    )
    const args = { password, salt, memory, iterations, length, parallelism, type, version }
    return this.loadRuntime(memory).then((runtime) => {
      const loadedTime = performance.now()
      console.log(`[ARGON2] Runtime loaded in ${loadedTime - startTime}ms`)
      const ts = logger.ts()
      return runtime.hash(args).then((hash) => {
        const completedTime = performance.now()
        console.log(
          `[ARGON2] Hash computed in ${completedTime - loadedTime}ms (total: ${completedTime - startTime}ms)`
        )
        logger.debug('Hash computed', logger.ts(ts))
        return hash
      })
    })
  },

  loadRuntime(requiredMemory) {
    const runtimeStartTime = performance.now()
    if (this.runtimeModule) {
      console.log(`[ARGON2] Using cached runtime module`)
      return Promise.resolve(this.runtimeModule)
    }
    if (!globalThis.WebAssembly) {
      return Promise.reject('WebAssembly is not supported')
    }

    console.log(`[ARGON2] Creating new runtime for memory: ${requiredMemory}KB`)
    console.log(`[ARGON2] SharedArrayBuffer supported:`, typeof SharedArrayBuffer !== 'undefined')
    console.log(`[ARGON2] Atomics supported:`, typeof Atomics !== 'undefined')
    console.log(`[ARGON2] crossOriginIsolated:`, self.crossOriginIsolated)
    return new Promise((resolve, reject) => {
      const loadTimeout = setTimeout(() => reject('timeout'), 5000)
      try {
        const ts = logger.ts()
        const argon2LoaderCode = argon2Raw

        // Detect SIMD support using a simpler, more reliable method
        const hasSIMDSupport = (() => {
          try {
            // Check if browser supports SIMD by looking for the feature in WebAssembly
            return WebAssembly.validate(
              new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x01, 0x7b,
                0x00, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x07, 0x01, 0x05, 0x00, 0x20, 0x00, 0x1a, 0x0b
              ])
            )
          } catch {
            return false
          }
        })()

        const wasmBinaryBase64 = hasSIMDSupport ? argon2WasmSIMD : argon2WasmRegular
        console.log(`[ARGON2] SIMD support detected: ${hasSIMDSupport}`)
        console.log(`[ARGON2] Using ${hasSIMDSupport ? 'SIMD' : 'regular'} WebAssembly binary`)

        console.log('memory', requiredMemory)

        const KB = 1024
        const MB = 1024 * KB
        const GB = 1024 * MB
        const WASM_PAGE_SIZE = 64 * 1024
        const totalMemory = (2 * GB - 64 * KB) / 1024 / WASM_PAGE_SIZE
        const initialMemory = Math.min(
          Math.max(Math.ceil((requiredMemory * 1024) / WASM_PAGE_SIZE), 256) + 256,
          totalMemory
        )

        console.log(
          `[ARGON2] Memory calculation: requiredMemory=${requiredMemory}KB, initialMemory=${initialMemory} pages (${(initialMemory * WASM_PAGE_SIZE) / 1024 / 1024}MB), totalMemory=${totalMemory} pages`
        )

        const memoryDecl = `var wasmMemory=new WebAssembly.Memory({initial:${initialMemory},maximum:${totalMemory}});`
        const moduleDecl =
          'var Module={' +
          'wasmJSMethod: "native-wasm",' +
          'wasmBinary: Uint8Array.from(atob("' +
          wasmBinaryBase64 +
          '"), c => c.charCodeAt(0)),' +
          'print(...args) { postMessage({op:"log",args}) },' +
          'printErr(...args) { postMessage({op:"log",args}) },' +
          'postRun:' +
          this.workerPostRun.toString() +
          ',' +
          'calcHash:' +
          this.calcHash.toString() +
          ',' +
          'wasmMemory:wasmMemory,' +
          'buffer:wasmMemory.buffer,' +
          'TOTAL_MEMORY:' +
          initialMemory * WASM_PAGE_SIZE +
          '}'
        const script = argon2LoaderCode.replace(/^var Module.*?}/, memoryDecl + moduleDecl)
        console.log('worker script', script)
        const blob = new Blob([script], { type: 'application/javascript' })
        const objectUrl = URL.createObjectURL(blob)
        const workerCreateTime = performance.now()
        console.log(`[ARGON2] Worker blob created in ${workerCreateTime - runtimeStartTime}ms`)
        const worker = new Worker(objectUrl)
        console.log(`[ARGON2] Worker instantiated in ${performance.now() - workerCreateTime}ms`)
        const onMessage = (e) => {
          switch (e.data.op) {
            case 'log':
              logger.debug(...e.data.args)
              break
            case 'postRun':
              const postRunTime = performance.now()
              console.log(
                `[ARGON2] WebAssembly runtime loaded in ${postRunTime - runtimeStartTime}ms`
              )
              logger.debug('WebAssembly runtime loaded (web worker)', logger.ts(ts))
              URL.revokeObjectURL(objectUrl)
              clearTimeout(loadTimeout)
              worker.removeEventListener('message', onMessage)
              this.runtimeModule = {
                hash(args) {
                  return new Promise((resolve, reject) => {
                    const hashStartTime = performance.now()
                    console.log(`[ARGON2] Starting hash computation`)
                    worker.postMessage(args)
                    const onHashMessage = (e) => {
                      const hashEndTime = performance.now()
                      console.log(
                        `[ARGON2] Hash message received in ${hashEndTime - hashStartTime}ms`
                      )
                      worker.removeEventListener('message', onHashMessage)
                      // worker.terminate()  // Don't terminate - keep worker alive for reuse
                      // KdbxwebInit.runtimeModule = null  // Don't null - keep runtime module for reuse
                      if (!e.data || e.data.error || !e.data.hash) {
                        const ex = (e.data && e.data.error) || 'unexpected error'
                        logger.error('Worker error', ex)
                        reject(ex)
                      } else {
                        resolve(e.data.hash)
                      }
                    }
                    worker.addEventListener('message', onHashMessage)
                  })
                }
              }
              resolve(this.runtimeModule)
              break
            default:
              logger.error('Unknown message', e.data)
              URL.revokeObjectURL(objectUrl)
              reject('Load error')
          }
        }
        worker.addEventListener('message', onMessage)
      } catch (err) {
        reject(err)
      }
    }).catch((err) => {
      logger.warn('WebAssembly error', err)
      throw new Error('WebAssembly error')
    })
  },

  // eslint-disable-next-line object-shorthand
  workerPostRun: function () {
    self.postMessage({ op: 'postRun' })
    self.onmessage = (e) => {
      try {
        /* eslint-disable-next-line no-undef */
        const hash = Module.calcHash(Module, e.data)
        self.postMessage({ hash })
      } catch (e) {
        self.postMessage({ error: e.toString() })
      }
    }
  },

  // eslint-disable-next-line object-shorthand
  calcHash: function (Module, args) {
    const startTime = performance.now()
    console.log('[WORKER] Starting calcHash with params:', {
      memory: args.memory,
      iterations: args.iterations,
      length: args.length,
      parallelism: args.parallelism,
      type: args.type
    })

    let { password, salt } = args
    const { memory, iterations, length, parallelism, type, version } = args
    const passwordLen = password.byteLength

    const allocStartTime = performance.now()
    password = Module.allocate(new Uint8Array(password), 'i8', Module.ALLOC_NORMAL)
    const saltLen = salt.byteLength
    salt = Module.allocate(new Uint8Array(salt), 'i8', Module.ALLOC_NORMAL)
    const hash = Module.allocate(new Array(length), 'i8', Module.ALLOC_NORMAL)
    const encodedLen = 512
    const encoded = Module.allocate(new Array(encodedLen), 'i8', Module.ALLOC_NORMAL)
    console.log('[WORKER] Memory allocation took:', performance.now() - allocStartTime, 'ms')

    const hashStartTime = performance.now()
    console.log('[WORKER] Starting _argon2_hash call')
    console.log('[WORKER] Module._argon2_hash type:', typeof Module._argon2_hash)
    console.log(
      '[WORKER] Module keys:',
      Object.keys(Module).filter((k) => k.includes('argon'))
    )
    const res = Module._argon2_hash(
      iterations,
      memory,
      parallelism,
      password,
      passwordLen,
      salt,
      saltLen,
      hash,
      length,
      encoded,
      encodedLen,
      type,
      version
    )
    console.log('[WORKER] _argon2_hash completed in:', performance.now() - hashStartTime, 'ms')

    if (res) {
      throw new Error('Argon2 error ' + res)
    }

    const copyStartTime = performance.now()
    const hashArr = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      hashArr[i] = Module.HEAP8[hash + i]
    }
    console.log('[WORKER] Hash copy took:', performance.now() - copyStartTime, 'ms')

    Module._free(password)
    Module._free(salt)
    Module._free(hash)
    Module._free(encoded)

    console.log('[WORKER] Total calcHash time:', performance.now() - startTime, 'ms')
    return hashArr
  }
}

export { KdbxwebInit }

import * as kdbxweb from 'kdbxweb'

const ExpectedFieldRefChars = '{REF:0@I:00000000000000000000000000000000}'.split('')
const ExpectedFieldRefByteLength = ExpectedFieldRefChars.length

kdbxweb.ProtectedValue.prototype.isProtected = true

kdbxweb.ProtectedValue.prototype.forEachChar = function (fn) {
  const value = this.value
  const salt = this.salt
  let b, b1, b2, b3
  for (let i = 0, len = value.length; i < len; i++) {
    b = value[i] ^ salt[i]
    if (b < 128) {
      if (fn(b) === false) {
        return
      }
      continue
    }
    i++
    b1 = value[i] ^ salt[i]
    if (i === len) {
      break
    }
    if (b >= 192 && b < 224) {
      if (fn(((b & 0x1f) << 6) | (b1 & 0x3f)) === false) {
        return
      }
      continue
    }
    i++
    b2 = value[i] ^ salt[i]
    if (i === len) {
      break
    }
    if (b >= 224 && b < 240) {
      if (fn(((b & 0xf) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f)) === false) {
        return
      }
    }
    i++
    b3 = value[i] ^ salt[i]
    if (i === len) {
      break
    }
    if (b >= 240 && b < 248) {
      let c = ((b & 7) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      if (c <= 0xffff) {
        if (fn(c) === false) {
          return
        }
      } else {
        c ^= 0x10000
        if (fn(0xd800 | (c >> 10)) === false) {
          return
        }
        if (fn(0xdc00 | (c & 0x3ff)) === false) {
          return
        }
      }
    }
    // skip error
  }
}

Object.defineProperty(kdbxweb.ProtectedValue.prototype, 'length', {
  get() {
    return this.textLength
  }
})

Object.defineProperty(kdbxweb.ProtectedValue.prototype, 'textLength', {
  get() {
    let textLength = 0
    this.forEachChar(() => {
      textLength++
    })
    return textLength
  }
})

kdbxweb.ProtectedValue.prototype.includesLower = function (findLower) {
  return this.indexOfLower(findLower) !== -1
}

kdbxweb.ProtectedValue.prototype.indexOfLower = function (findLower) {
  let index = -1
  const foundSeqs = []
  const len = findLower.length
  let chIndex = -1
  this.forEachChar((ch) => {
    chIndex++
    ch = String.fromCharCode(ch).toLowerCase()
    if (index !== -1) {
      return
    }
    for (let i = 0; i < foundSeqs.length; i++) {
      const seqIx = ++foundSeqs[i]
      if (findLower[seqIx] !== ch) {
        foundSeqs.splice(i, 1)
        i--
        continue
      }
      if (seqIx === len - 1) {
        index = chIndex - len + 1
        return
      }
    }
    if (findLower[0] === ch) {
      if (len === 1) {
        index = chIndex - len + 1
      } else {
        foundSeqs.push(0)
      }
    }
  })
  return index
}

kdbxweb.ProtectedValue.prototype.indexOfSelfInLower = function (targetLower) {
  let firstCharIndex = -1
  let found = false
  do {
    let chIndex = -1
    this.forEachChar((ch) => {
      chIndex++
      ch = String.fromCharCode(ch).toLowerCase()
      if (chIndex === 0) {
        firstCharIndex = targetLower.indexOf(ch, firstCharIndex + 1)
        found = firstCharIndex !== -1
        return
      }
      if (!found) {
        return
      }
      found = targetLower[firstCharIndex + chIndex] === ch
    })
  } while (!found && firstCharIndex >= 0)
  return firstCharIndex
}

kdbxweb.ProtectedValue.prototype.equals = function (other) {
  if (!other) {
    return false
  }
  if (!other.isProtected) {
    return this.textLength === other.length && this.includes(other)
  }
  if (other === this) {
    return true
  }
  const len = this.byteLength
  if (len !== other.byteLength) {
    return false
  }
  for (let i = 0; i < len; i++) {
    if ((this.value[i] ^ this.salt[i]) !== (other.value[i] ^ other.salt[i])) {
      return false
    }
  }
  return true
}

kdbxweb.ProtectedValue.prototype.isFieldReference = function () {
  if (this.byteLength !== ExpectedFieldRefByteLength) {
    return false
  }
  let ix = 0
  this.forEachChar((ch) => {
    const expected = ExpectedFieldRefChars[ix++]
    if (expected !== '0' && ch !== expected) {
      return false
    }
  })
  return true
}

const RandomSalt = kdbxweb.CryptoEngine.random(128)

kdbxweb.ProtectedValue.prototype.saltedValue = function () {
  if (!this.byteLength) {
    return 0
  }
  const value = this.value
  const salt = this.salt
  let salted = ''
  for (let i = 0, len = value.length; i < len; i++) {
    const byte = value[i] ^ salt[i]
    salted += String.fromCharCode(byte ^ RandomSalt[i % RandomSalt.length])
  }
  return salted
}

kdbxweb.ProtectedValue.prototype.dataAndSalt = function () {
  return {
    data: [...this.value],
    salt: [...this.salt]
  }
}

kdbxweb.ProtectedValue.prototype.toBase64 = function () {
  const binary = this.getBinary()
  const base64 = kdbxweb.ByteUtils.bytesToBase64(binary)
  kdbxweb.ByteUtils.zeroBuffer(binary)
  return base64
}

kdbxweb.ProtectedValue.fromBase64 = function (base64) {
  const bytes = kdbxweb.ByteUtils.base64ToBytes(base64)
  return kdbxweb.ProtectedValue.fromBinary(bytes)
}
