#!/usr/bin/env python3
"""Offline foundation checks; no app tests or full secret/security scanner."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md',
            'AGENTS.md', '.env.example', 'docs/12-roadmap.md',
            '.github/workflows/documentation.yml']
errors = []
for name in REQUIRED:
    if not (ROOT / name).is_file():
        errors.append(f'Missing required file: {name}')
files = [p for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts
         and not any(part in {'__pycache__','node_modules','dist','data','coverage'} for part in p.parts) and (not p.name.startswith('.env') or p.name == '.env.example')]
for path in files:
    name = str(path.relative_to(ROOT))
    if path.suffix not in {'.md', '.py', '.yml', '.json'} and not path.name.startswith('.'):
        continue
    data = path.read_text(encoding='utf-8')
    if not data.endswith('\n'):
        errors.append(f'Missing final newline: {name}')
    if path.suffix == '.json':
        try:
            json.loads(data)
        except ValueError as exc:
            errors.append(f'Invalid JSON {name}: {exc}')
    # Limited high-confidence patterns. Dedicated scanning is required in M1.
    patterns = [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                r'gh[pousr]_[A-Za-z0-9]{30,}', r'github_pat_[A-Za-z0-9_]{40,}']
    for pattern in patterns:
        if re.search(pattern, data):
            errors.append(f'Possible secret: {name}')
    if path.suffix == '.md':
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', data):
            target = target.split('#')[0]
            if not target or '://' in target or target.startswith('mailto:'):
                continue
            resolved = (path.parent / target).resolve()
            if not resolved.is_relative_to(ROOT) or not resolved.exists():
                errors.append(f'Broken local link in {name}: {target}')
seen = set()
for line in (ROOT / '.env.example').read_text().splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    if not re.match(r'^[A-Z][A-Z0-9_]*=', line):
        errors.append('Invalid env catalog line')
        continue
    key, value = line.split('=', 1)
    if key in seen:
        errors.append(f'Duplicate env key: {key}')
    seen.add(key)
    if any(word in key for word in ('SECRET', 'TOKEN', 'KEY', 'PASSWORD', 'DATABASE_URL', 'REDIS_URL')) and value:
        errors.append(f'Sensitive env example must be empty: {key}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'OK: {len(files)} files; local links, required files, JSON, env catalog and limited secret patterns.')
