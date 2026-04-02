import { execSync } from 'child_process'
import path from 'path'

const projectDir = '/vercel/share/v0-project'

console.log('[v0] Installing AI SDK packages...')
try {
  const result = execSync(
    'pnpm add @ai-sdk/groq@^1.2.9 ai@^6.0.0',
    { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' }
  )
  console.log('[v0] Install output:', result)
  console.log('[v0] Successfully installed @ai-sdk/groq and ai@6')
} catch (err) {
  console.error('[v0] Install failed:', err.message)
  console.error('[v0] stderr:', err.stderr)
}
