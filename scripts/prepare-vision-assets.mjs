import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = dirname(require.resolve('@mediapipe/tasks-vision'))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (pkg.version !== '0.10.35')
  throw new Error('Update the vision asset version before upgrading MediaPipe.')
const destination = join(process.cwd(), 'public', 'vision', pkg.version)
await mkdir(destination, { recursive: true })
await copyFile(
  join(root, 'vision_bundle.mjs'),
  join(destination, 'vision_bundle.mjs')
)
// Cloud treats .wasm files as executable Worker modules. These are browser data
// assets, so publish them as .bin and supply explicit WasmFileset URLs instead.
for (const name of ['vision_wasm_internal', 'vision_wasm_nosimd_internal']) {
  await copyFile(
    join(root, 'wasm', `${name}.js`),
    join(destination, `${name}.js`)
  )
  await copyFile(
    join(root, 'wasm', `${name}.wasm`),
    join(destination, `${name}.bin`)
  )
}
await copyFile(
  new URL('./licenses/mediapipe-apache-2.0.txt', import.meta.url),
  join(destination, 'LICENSE.txt')
)
await writeFile(
  join(destination, 'NOTICE.txt'),
  `MediaPipe Tasks Vision ${pkg.version}\nCopyright Google LLC\nApache License 2.0\nBrowser binaries are unchanged; only their extension is renamed from .wasm to .bin.\n`
)
console.log(`Prepared local MediaPipe ${pkg.version} browser assets`)
