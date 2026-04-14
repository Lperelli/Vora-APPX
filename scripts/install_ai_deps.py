import subprocess, sys, os

project_dir = '/vercel/share/v0-project'

print('[v0] Installing AI SDK packages...')
result = subprocess.run(
    ['pnpm', 'add', '@ai-sdk/groq@^1.2.9', 'ai@^6.0.0'],
    cwd=project_dir,
    capture_output=True,
    text=True
)

print('[v0] stdout:', result.stdout)
print('[v0] stderr:', result.stderr)
print('[v0] return code:', result.returncode)

if result.returncode == 0:
    print('[v0] SUCCESS: packages installed')
else:
    print('[v0] FAILED: check stderr above')
    sys.exit(1)
