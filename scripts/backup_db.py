#!/usr/bin/env python3
"""Daily Notion DB backup -> git -> GitHub.

Writes backups/latest.csv + backups/latest-raw.json (full daily history lives in
git, so files are overwritten, not accumulated) and pushes if anything changed.
Run by launchd daily (com.blackbook.backup) or manually: python3 scripts/backup_db.py
"""
import csv, datetime, json, os, subprocess, sys, time, urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(REPO)

env = {}
with open('.env') as f:
    for line in f:
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v.strip().strip('"\'')
KEY, DB = env['NOTION_API_KEY'], env['NOTION_DATABASE_ID']
H = {'Authorization': f'Bearer {KEY}', 'Notion-Version': '2022-06-28',
     'Content-Type': 'application/json'}

def api(path, body=None):
    req = urllib.request.Request(f'https://api.notion.com/v1/{path}', headers=H,
                                 data=json.dumps(body).encode() if body else None,
                                 method='POST' if body else 'GET')
    for attempt in range(5):
        try:
            return json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(2 ** attempt); continue
            raise

schema = api(f'databases/{DB}')
rows, cursor = [], None
while True:
    body = {'page_size': 100}
    if cursor: body['start_cursor'] = cursor
    r = api(f'databases/{DB}/query', body)
    rows += r['results']
    if not r.get('has_more'): break
    cursor = r['next_cursor']

with open('backups/latest-raw.json', 'w') as f:
    json.dump({'schema': schema, 'rows': rows}, f, indent=2)

def plain(prop):
    t = prop['type']; v = prop.get(t)
    if v is None: return ''
    if t in ('title', 'rich_text'): return ''.join(x['plain_text'] for x in v)
    if t == 'select': return v['name']
    if t == 'multi_select': return '; '.join(o['name'] for o in v)
    if t in ('url', 'email', 'number', 'checkbox'): return str(v)
    if t == 'date': return v['start']
    if t == 'relation': return '; '.join(x['id'] for x in v)
    if t == 'files': return '; '.join(x.get('name', '') for x in v)
    return ''

props = list(schema['properties'].keys())
with open('backups/latest.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['page_id'] + props)
    for row in rows:
        w.writerow([row['id']] + [plain(row['properties'][p]) for p in props])

def git(*args):
    return subprocess.run(['git'] + list(args), capture_output=True, text=True)

stamp = datetime.datetime.now().isoformat(timespec='seconds')
git('add', 'backups/latest.csv', 'backups/latest-raw.json')
if git('diff', '--cached', '--quiet').returncode != 0:
    git('commit', '-m', f'Automated daily backup {stamp} ({len(rows)} rows)')
    push = git('push', 'origin', 'main')
    status = 'pushed' if push.returncode == 0 else f'PUSH FAILED: {push.stderr.strip()}'
else:
    status = 'no changes'
print(f'{stamp} backup: {len(rows)} rows, {status}')
if 'FAILED' in status: sys.exit(1)
