#!/usr/bin/env python3
"""keeper.py — thin Notion worker for The Keeper. Stdlib only.

The judgment stays with Claude Code following CLAUDE.md + TAXONOMY.md; this script
only moves data and enforces the hard contract (no Verified, no judgment-field
writes beyond zero-states, provenance write-through).

Usage:
  keeper.py work new|stale          work list as JSON lines (stale capped at 10)
  keeper.py get PAGE_ID             entry as readable JSON
  keeper.py set PAGE_ID JSON [--source URL]   update fields, e.g. '{"Type":"Person"}'
  keeper.py ask PAGE_ID TEXT        set Open Questions, status -> Needs Review
  keeper.py status PAGE_ID STATUS   set Entry Status (Verified is refused)
  keeper.py upload PAGE_ID FILE...  upload images: Images property + page-body blocks
  keeper.py log TEXT                append timestamped line to state/browser-log.md
"""
import json, mimetypes, os, sys, time, urllib.error, urllib.request, uuid
from datetime import date, datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_env():
    env = dict(os.environ)
    path = os.path.join(REPO, '.env')
    if os.path.exists(path):
        for line in open(path):
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                env.setdefault(k, v.strip().strip('"\''))
    return env

ENV = load_env()
KEY, DB = ENV['NOTION_API_KEY'], ENV['NOTION_DATABASE_ID']
H = {'Authorization': f'Bearer {KEY}', 'Notion-Version': '2022-06-28'}

JUDGMENT_ZERO = {'Work With?': 'Unvetted', 'Worked Together': 'Never',
                 'Familiarity': "Don't know them", 'Rating': None}
AGENT_FIELDS = {'Entry Status', 'Open Questions', 'AI Notes'}

def api(path, body=None, method=None):
    method = method or ('PATCH' if body is not None else 'GET')
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(H, **{'Content-Type': 'application/json'})
    for attempt in range(5):
        req = urllib.request.Request(f'https://api.notion.com/v1/{path}',
                                     headers=headers, data=data, method=method)
        try:
            return json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            if e.code in (409, 429, 500, 502, 503) and attempt < 4:
                time.sleep(2 ** attempt); continue
            sys.exit(f'API error {e.code} on {method} {path}: {e.read().decode()[:400]}')

def query_all(filt=None):
    rows, cursor = [], None
    while True:
        body = {'page_size': 100}
        if filt: body['filter'] = filt
        if cursor: body['start_cursor'] = cursor
        r = api(f'databases/{DB}/query', body, method='POST')
        rows += r['results']
        if not r.get('has_more'): return rows
        cursor = r['next_cursor']

def plain(prop):
    t = prop['type']; v = prop.get(t)
    if v is None: return None
    if t in ('title', 'rich_text'): return ''.join(x['plain_text'] for x in v) or None
    if t == 'select': return v['name']
    if t == 'multi_select': return [o['name'] for o in v] or None
    if t in ('url', 'email', 'number', 'checkbox'): return v
    if t == 'date': return v['start']
    if t == 'relation': return [x['id'] for x in v] or None
    if t == 'files': return [f.get('name') for f in v] or None
    return None

def entry_dict(row):
    d = {name: plain(p) for name, p in row['properties'].items()}
    return {'page_id': row['id'], **{k: v for k, v in d.items() if v is not None}}

# ---- provenance ----

def prov_path(page_id):
    return os.path.join(REPO, 'state', 'provenance', f'{page_id}.json')

def prov_update(page_id, fields, set_by='agent', source_url=None):
    path = prov_path(page_id)
    rec = json.load(open(path)) if os.path.exists(path) else \
        {'page_id': page_id, 'migrated_at': None, 'fields': {}}
    for name, value in fields.items():
        rec['fields'][name] = {'value': value, 'source_url': source_url,
                               'verified_at': datetime.now().isoformat(timespec='seconds'),
                               'set_by': set_by}
    with open(path, 'w') as f:
        json.dump(rec, f, indent=2)

def prov_set_by(page_id, field):
    path = prov_path(page_id)
    if not os.path.exists(path): return None
    return json.load(open(path))['fields'].get(field, {}).get('set_by')

# ---- property encoding ----

_schema = None
def schema():
    global _schema
    if _schema is None: _schema = api(f'databases/{DB}')
    return _schema

def encode(field, value):
    t = schema()['properties'][field]['type']
    if t == 'select': return {'select': {'name': value}}
    if t == 'multi_select': return {'multi_select': [{'name': v} for v in value]}
    if t in ('url', 'email', 'number'): return {t: value}
    if t == 'rich_text': return {'rich_text': [{'text': {'content': value}}]}
    if t == 'title': return {'title': [{'text': {'content': value}}]}
    if t == 'date': return {'date': {'start': value}}
    if t == 'relation': return {'relation': [{'id': v} for v in value]}
    sys.exit(f'cannot encode property type {t} ({field})')

# ---- contract guards ----

def guard(page_id, fields):
    for f, v in fields.items():
        if f == 'Notes':
            sys.exit("CONTRACT: Notes is Jonathan's — never write it.")
        if f == 'Entry Status' and v == 'Verified':
            sys.exit('CONTRACT: only Jonathan sets Verified.')
        if f in JUDGMENT_ZERO and v != JUDGMENT_ZERO[f]:
            sys.exit(f'CONTRACT: {f} is a judgment field — agent may only set its zero-state.')
        if prov_set_by(page_id, f) == 'jonathan' and f not in AGENT_FIELDS:
            sys.exit(f'CONTRACT: {f} is set_by jonathan — propose via Open Questions instead.')

# ---- commands ----

def cmd_work(kind):
    if kind == 'new':
        rows = [r for r in query_all()
                if (r['properties']['Entry Status']['select'] or {}).get('name') in (None, 'New')]
    elif kind == 'stale':
        rows = [r for r in query_all({'property': 'Entry Status', 'select': {'equals': 'Stale'}})]
        rows.sort(key=lambda r: (r['properties']['Status Last Verified']['date'] or {}).get('start', ''))
        rows = rows[:10]
    else:
        sys.exit('work new|stale')
    for r in rows:
        print(json.dumps(entry_dict(r), ensure_ascii=False))
    print(f'-- {len(rows)} entries', file=sys.stderr)

def cmd_get(page_id):
    print(json.dumps(entry_dict(api(f'pages/{page_id}')), indent=2, ensure_ascii=False))

def cmd_set(page_id, payload, source_url=None):
    fields = json.loads(payload)
    guard(page_id, fields)
    api(f'pages/{page_id}', {'properties': {f: encode(f, v) for f, v in fields.items()}})
    prov_update(page_id, fields, set_by='agent', source_url=source_url)
    print(f'set {list(fields)} on {page_id}')

def cmd_ask(page_id, text):
    api(f'pages/{page_id}', {'properties': {
        'Open Questions': encode('Open Questions', text),
        'Entry Status': encode('Entry Status', 'Needs Review')}})
    prov_update(page_id, {'Open Questions': text, 'Entry Status': 'Needs Review'})
    print(f'asked on {page_id}')

def cmd_status(page_id, status):
    guard(page_id, {'Entry Status': status})
    api(f'pages/{page_id}', {'properties': {'Entry Status': encode('Entry Status', status)}})
    prov_update(page_id, {'Entry Status': status})
    print(f'{page_id} -> {status}')

def upload_file(path):
    name = os.path.basename(path)
    ctype = mimetypes.guess_type(name)[0] or 'application/octet-stream'
    size = os.path.getsize(path)
    if size > 20 * 1024 * 1024:
        sys.exit(f'{name} is {size//1024//1024} MB > 20 MB single-part limit — compress or use a thumbnail.')
    fu = api('file_uploads', {'filename': name, 'content_type': ctype}, method='POST')
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n').encode() \
        + open(path, 'rb').read() + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(
        f'https://api.notion.com/v1/file_uploads/{fu["id"]}/send',
        headers=dict(H, **{'Content-Type': f'multipart/form-data; boundary={boundary}'}),
        data=body, method='POST')
    json.load(urllib.request.urlopen(req))
    return fu['id'], name

def cmd_upload(page_id, paths):
    page = api(f'pages/{page_id}')
    existing = page['properties']['Images']['files']
    uploads = [upload_file(p) for p in paths]
    files = existing + [{'type': 'file_upload', 'file_upload': {'id': fid}, 'name': name}
                        for fid, name in uploads]
    api(f'pages/{page_id}', {'properties': {'Images': {'files': files}}})
    blocks = [{'type': 'image', 'image': {'type': 'file_upload', 'file_upload': {'id': fid}}}
              for fid, name in uploads]
    # agent-owned section sits at the top; divider separates it from Jonathan's space
    children = api(f'blocks/{page_id}/children?page_size=20')['results']
    if not any(b['type'] == 'divider' for b in children):
        blocks.append({'type': 'divider', 'divider': {}})
    api(f'blocks/{page_id}/children', {'children': blocks})
    prov_update(page_id, {'Images': [n for _, n in uploads]})
    print(f'uploaded {len(uploads)} files to {page_id}')

def cmd_log(text):
    with open(os.path.join(REPO, 'state', 'browser-log.md'), 'a') as f:
        f.write(f'- {datetime.now().isoformat(timespec="seconds")} — {text}\n')
    print('logged')

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    cmd = a[0]
    if cmd == 'work': cmd_work(a[1])
    elif cmd == 'get': cmd_get(a[1])
    elif cmd == 'set':
        src = a[a.index('--source') + 1] if '--source' in a else None
        cmd_set(a[1], a[2], src)
    elif cmd == 'ask': cmd_ask(a[1], a[2])
    elif cmd == 'status': cmd_status(a[1], a[2])
    elif cmd == 'upload': cmd_upload(a[1], a[2:])
    elif cmd == 'log': cmd_log(' '.join(a[1:]))
    else: sys.exit(__doc__)
