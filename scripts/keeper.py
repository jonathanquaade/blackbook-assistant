#!/usr/bin/env python3
"""keeper.py — thin Notion worker for The Keeper. Stdlib only.

The judgment stays with Claude Code following CLAUDE.md + TAXONOMY.md; this script
only moves data and enforces the hard contract (no Verified, no judgment-field
writes beyond zero-states, provenance write-through).

Usage:
  keeper.py work new|revisit         work list as JSON lines (revisit capped at 10)
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
    elif kind == 'revisit':
        rows = [r for r in query_all({'property': 'Entry Status', 'select': {'equals': 'Revisit'}})]
        rows.sort(key=lambda r: (r['properties']['Status Last Verified']['date'] or {}).get('start', ''))
        rows = rows[:10]
    else:
        sys.exit('work new|revisit')
    for r in rows:
        print(json.dumps(entry_dict(r), ensure_ascii=False))
    print(f'-- {len(rows)} entries', file=sys.stderr)

def cmd_get(page_id):
    print(json.dumps(entry_dict(api(f'pages/{page_id}')), indent=2, ensure_ascii=False))

def archive_raw(page_id, label, text):
    d = os.path.join(REPO, 'assets', page_id)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'clipped.md'), 'a') as f:
        f.write(f'# {label} ({datetime.now().isoformat(timespec="seconds")})\n\n{text}\n\n')

def cmd_set(page_id, payload, source_url=None, from_jonathan=False):
    fields = json.loads(payload)
    if from_jonathan:
        # values Jonathan stated himself (clip note / chat): set_by jonathan,
        # judgment fields allowed. Notes and Verified stay forbidden.
        for f, v in fields.items():
            if f == 'Notes': sys.exit("CONTRACT: Notes is Jonathan's page-side field; his note text belongs in Source.")
            if f == 'Entry Status': sys.exit('CONTRACT: status flows stay agent-managed; he flips Verified in Notion.')
    else:
        guard(page_id, fields)
    if 'Name' in fields:
        # mechanical guarantee: the raw title (Jonathan's clip notes live there)
        # is archived verbatim BEFORE it can be overwritten
        live = plain(api(f'pages/{page_id}')['properties']['Name'])
        if live and live.strip() != fields['Name'].strip():
            archive_raw(page_id, 'Raw Name before overwrite', live)
    api(f'pages/{page_id}', {'properties': {f: encode(f, v) for f, v in fields.items()}})
    prov_update(page_id, fields, set_by='jonathan' if from_jonathan else 'agent',
                source_url=source_url)
    print(f'set {list(fields)} on {page_id} ({"jonathan-stated" if from_jonathan else "agent"})')

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

def block_text(b):
    v = b.get(b['type'], {})
    return ''.join(t.get('plain_text', '') for t in v.get('rich_text', []))

def cmd_body_reset(page_id):
    """Archive page-body text to assets/<id>/clipped.md, then delete all blocks.
    P1-only: for raw clipped entries before the agent builds the Work section."""
    blocks, cursor = [], None
    while True:
        q = f'blocks/{page_id}/children?page_size=100' + (f'&start_cursor={cursor}' if cursor else '')
        r = api(q)
        blocks += r['results']
        if not r.get('has_more'): break
        cursor = r['next_cursor']
    os.makedirs(os.path.join(REPO, 'assets', page_id), exist_ok=True)
    texts = [t for t in (block_text(b) for b in blocks) if t.strip()]
    if texts:
        with open(os.path.join(REPO, 'assets', page_id, 'clipped.md'), 'a') as f:
            f.write(f'# Archived page body ({date.today()})\n\n' + '\n\n'.join(texts) + '\n')
    for b in blocks:
        api(f'blocks/{b["id"]}', method='DELETE')
        time.sleep(0.2)
    print(f'body reset: {len(blocks)} blocks removed, {len(texts)} text blocks archived')

def cmd_upload(page_id, asset_dir):
    """Build the agent-owned Work section from asset_dir/manifest.json:
    heading, captioned images (caption = title + source link), divider.
    Replaces the Images property. Manifest entries: {file, source_url, caption?, link?}."""
    manifest = json.load(open(os.path.join(asset_dir, 'manifest.json')))
    uploads = []
    for entry in manifest:
        fid, name = upload_file(os.path.join(asset_dir, entry['file']))
        uploads.append((fid, name, entry))
    api(f'pages/{page_id}', {'properties': {'Images': {'files': [
        {'type': 'file_upload', 'file_upload': {'id': fid}, 'name': name}
        for fid, name, _ in uploads]}}})
    blocks = [{'type': 'heading_2', 'heading_2': {'rich_text': [{'text': {'content': 'Work'}}]}}]
    for fid, name, entry in uploads:
        caption = []
        if entry.get('caption'):
            caption.append({'text': {'content': entry['caption'] + ' · '}})
        link = entry.get('link') or entry.get('source_url')
        if link:
            label = link.split('//')[-1].split('/')[0]
            caption.append({'text': {'content': label, 'link': {'url': link}}})
        blocks.append({'type': 'image', 'image': {'type': 'file_upload',
                       'file_upload': {'id': fid}, 'caption': caption}})
    blocks.append({'type': 'divider', 'divider': {}})
    api(f'blocks/{page_id}/children', {'children': blocks})
    prov_update(page_id, {'Images': [e['file'] for e in manifest]})
    print(f'uploaded {len(uploads)} captioned images to {page_id}')

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
        cmd_set(a[1], a[2], src, from_jonathan='--from-jonathan' in a)
    elif cmd == 'ask': cmd_ask(a[1], a[2])
    elif cmd == 'status': cmd_status(a[1], a[2])
    elif cmd == 'upload': cmd_upload(a[1], a[2])
    elif cmd == 'body-reset': cmd_body_reset(a[1])
    elif cmd == 'log': cmd_log(' '.join(a[1:]))
    else: sys.exit(__doc__)
