import subprocess, os

# Broader search with higher depth
print('[v0] Searching for package.json files...')
result = subprocess.run(['find', '/', '-name', 'package.json', '-maxdepth', '8', '-not', '-path', '*/node_modules/*'], 
    capture_output=True, text=True, timeout=20)
print('[v0] Found:', result.stdout[:3000])

# Also check /var
for path in ['/var', '/srv', '/opt', '/tmp', '/mnt', '/media']:
    if os.path.exists(path):
        print(f'[v0] {path}:', os.listdir(path)[:5])
