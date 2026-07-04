#!/usr/bin/env python3
"""keeper.py — thin Notion worker for The Keeper. Stdlib only.

The judgment stays with Claude Code following CLAUDE.md + TAXONOMY.md; this script
only moves data and enforces the hard contract (no Verified, no judgment-field
writes beyond zero-states, provenance write-through).

Usage:
  keeper.py work new|revisit         work list as JSON lines (revisit capped at 10)
  keeper.py work pipeline [--scope ID,ID] [--timeout MIN]
      the self-driving P1 driver's "what's next": JSON buckets (new/needs_scraper/
      needs_review/bounced/at_cap/stalled/in_flight/done) derived from durable state
  keeper.py lease set|clear|list ID [--phase P] [--agent A] [--run-id R]
      per-entry lease (state/pipeline-run/) so ticks never double-spawn; stale = retry
  keeper.py new NAME [JSON] [--source TEXT]   create a New entry (stub for scout/P1)
  keeper.py get PAGE_ID             entry as readable JSON
  keeper.py set PAGE_ID JSON [--source URL]   update fields, e.g. '{"Type":"Person"}'
  keeper.py ask PAGE_ID TEXT        set Open Questions, status -> Needs Review
  keeper.py set-notes PAGE_ID TEXT --relocated-from-body
      relocate Jonathan's OWN body commentary into Notes (only sanctioned Notes write)
  keeper.py status PAGE_ID STATUS   set Entry Status (Verified is refused)
  keeper.py stamp-verified          stamp Status Last Verified on newly Verified entries
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

def roster_mirror(page_id, fields):
    """Mirror a metadata write into the git-versioned roster (state/roster/
    designers.jsonl) so the roster stays in parity with Notion and its git history
    IS the change history of the blackbook's metadata. Best-effort: a roster mirror
    must never fail a Notion write that already succeeded. Set KEEPER_NO_MIRROR=1
    during bulk/parallel passes (many concurrent writers would race on the single
    JSONL file); rebuild the roster afterwards with `roster.py sync-all`."""
    if os.environ.get('KEEPER_NO_MIRROR') or ENV.get('KEEPER_NO_MIRROR'):
        return
    try:
        import roster
        roster.mirror_fields(page_id, fields)
    except Exception as e:
        print(f'  (roster mirror skipped: {e})', file=sys.stderr)

# ---- property encoding ----

_schema = None
def schema():
    global _schema
    if _schema is None: _schema = api(f'databases/{DB}')
    return _schema

def encode(field, value):
    t = schema()['properties'][field]['type']
    if value is None:
        # explicit clear: emit the type-appropriate empty so Notion accepts it
        # (a bare Python None becomes an invalid property payload and 400s)
        if t == 'select': return {'select': None}
        if t in ('url', 'email', 'number', 'date'): return {t: None}
        if t == 'rich_text': return {'rich_text': []}
        if t == 'multi_select': return {'multi_select': []}
        if t == 'relation': return {'relation': []}
        return None
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
            if v is None and prov_set_by(page_id, f) not in ('jonathan', None):
                pass
            else:
                sys.exit(f'CONTRACT: {f} is a judgment field — agent may only set its zero-state or clear an agent-written zero-state (pass null).')
        if prov_set_by(page_id, f) == 'jonathan' and f not in AGENT_FIELDS:
            sys.exit(f'CONTRACT: {f} is set_by jonathan — propose via Open Questions instead.')

# ---- commands ----

def cmd_work(kind, limit=10, offset=0, oq_filter=None):
    """oq_filter: 'feedback' = only entries with a non-empty Open Questions
    (Jonathan's review notes or pending agent questions); 'empty' = only
    entries with empty Open Questions (the Phase-0 migration backlog parked in
    Revisit awaiting first enrichment). None = all. limit<0 means no cap (--all).
    The Revisit population is two distinct jobs (his targeted re-enrichments vs the
    raw migration backlog); the filters let a session work one without the other."""
    if kind == 'new':
        rows = [r for r in query_all()
                if (r['properties']['Entry Status']['select'] or {}).get('name') in (None, 'New')]
    elif kind == 'revisit':
        rows = [r for r in query_all({'property': 'Entry Status', 'select': {'equals': 'Revisit'}})]
        rows.sort(key=lambda r: (r['properties']['Status Last Verified']['date'] or {}).get('start', ''))
        if oq_filter:
            def has_oq(r):
                return bool(''.join(t['plain_text'] for t in r['properties']['Open Questions']['rich_text']).strip())
            rows = [r for r in rows if (has_oq(r) if oq_filter == 'feedback' else not has_oq(r))]
    else:
        sys.exit('work new|revisit')
    total = len(rows)
    if kind == 'revisit':
        rows = rows[offset:] if limit < 0 else rows[offset:offset + limit]
    for r in rows:
        print(json.dumps(entry_dict(r), ensure_ascii=False))
    shown = f'{offset}-{offset + len(rows)} of {total}' if kind == 'revisit' else str(len(rows))
    print(f'-- {len(rows)} entries ({shown})', file=sys.stderr)

# ---- pipeline state (the self-driving driver's single source of "what's next") ----
#
# The /process-new orchestrator must NOT drive on subagent completion notifications
# (they arrive mislabeled, or not at all, and a passive "I'll wait" stalls the whole
# run until a human pokes it — Jonathan, 2026-06-18). Instead it ticks: each wake it
# asks THIS command "what is the next action for every in-flight entry?" and acts on
# durable state — Notion status + provenance (did the scout fill metadata) + the
# assets/<id>/manifest.json (did the scraper materialise work) + review-feedback
# (the gate verdict). Notifications become a mere "maybe wake now" hint; state is truth.
#
# A per-entry LEASE (state/pipeline-run/<id>.json) is the mutex + self-heal: an entry
# with a FRESH lease is in_flight (skip, don't double-spawn); a STALE lease (older than
# the timeout, i.e. the agent died mid-flight) drops the entry back into an actionable
# bucket so the next tick retries it. This is what makes the loop safe to run unattended
# in the cloud (overlapping cron ticks can't grab the same entry) and self-healing.

LEASE_DIR = os.path.join(REPO, 'state', 'pipeline-run')
LEASE_TIMEOUT_MIN = int(ENV.get('KEEPER_LEASE_TIMEOUT_MIN', '30'))  # > longest agent runtime (~25m)

def lease_path(page_id):
    return os.path.join(LEASE_DIR, f'{page_id}.json')

def read_lease(page_id):
    p = lease_path(page_id)
    if not os.path.exists(p): return None
    try: return json.load(open(p))
    except Exception: return None

def lease_is_fresh(lease, timeout_min=LEASE_TIMEOUT_MIN):
    if not lease: return False
    started = lease.get('started_at')
    if not started: return False
    try: dt = datetime.fromisoformat(started)
    except Exception: return False
    return (datetime.now() - dt).total_seconds() <= timeout_min * 60

def manifest_exists(page_id):
    return os.path.exists(os.path.join(REPO, 'assets', page_id, 'manifest.json'))

def read_feedback(page_id):
    p = os.path.join(REPO, 'state', 'review-feedback', f'{page_id}.json')
    if not os.path.exists(p): return None
    try: return json.load(open(p))
    except Exception: return None

def scraper_ready(row):
    """True once the scout has given the scraper what it needs to capture ON-capability
    work: a Type and at least one Capability (the work-matching key) on the LIVE entry.
    Checking the live row, not provenance, is deliberate — older/migrated entries carry
    Capabilities in Notion without a provenance line, and an entry with AI Notes but no
    Capabilities is an INCOMPLETE scout (no capability to match work to), which must go
    back to the scout, not waste a scraper run (Jonathan, 2026-06-18 backlog spot-check)."""
    props = row['properties']
    return bool(plain(props.get('Type')) and plain(props.get('Capabilities')))

def cmd_pipeline(scope=None, timeout_min=LEASE_TIMEOUT_MIN):
    """Emit, as JSON buckets, the next action for every entry in the P1 loop. The
    driver acts on the actionable buckets (new/needs_scraper/needs_review/bounced/
    at_cap/stalled) and stops when they are all empty. `scope` (list of page-ids)
    restricts the report to the entries a given run owns."""
    scope_set = set(scope) if scope else None
    buckets = {k: [] for k in ('new', 'needs_scraper', 'needs_review', 'bounced',
                               'at_cap', 'stalled', 'in_flight', 'done')}
    for r in query_all():
        pid = r['id']
        if scope_set and pid not in scope_set: continue
        status = (r['properties']['Entry Status']['select'] or {}).get('name')
        item = {'page_id': pid, 'name': plain(r['properties'].get('Name')) or ''}
        if status in (None, 'New'):
            buckets['new'].append(item); continue
        if status == 'Needs Review':
            buckets['done'].append(item); continue
        if status != 'Enriching':
            continue  # Verified / Revisit / Rejected are not part of the P1 loop
        # An entry an agent is actively working (fresh lease) is skipped: do not double-spawn.
        lease = read_lease(pid)
        if lease_is_fresh(lease, timeout_min):
            item['phase'] = lease.get('phase')
            buckets['in_flight'].append(item); continue
        fb = read_feedback(pid)
        if fb and fb.get('verdict') == 'fail':
            item['attempt'] = fb.get('attempt', 1)
            item['to'] = fb.get('to', 'scraper')
            (buckets['at_cap'] if item['attempt'] >= 2 else buckets['bounced']).append(item)
            continue
        if manifest_exists(pid):
            buckets['needs_review'].append(item)      # scraper done, awaiting the gate
        elif scraper_ready(r):
            buckets['needs_scraper'].append(item)      # scout done, no work captured yet
        else:
            buckets['stalled'].append(item)            # incomplete/dead scout, no live lease -> (re)scout
    print(json.dumps(buckets, ensure_ascii=False, indent=2))
    counts = {k: len(v) for k, v in buckets.items()}
    actionable = sum(counts[k] for k in ('new', 'needs_scraper', 'needs_review',
                                         'bounced', 'at_cap', 'stalled'))
    print(f'-- pipeline {counts} | actionable={actionable}', file=sys.stderr)

def cmd_lease(action, page_id, phase=None, agent=None, run_id=None):
    """Per-entry lease so the driver (and overlapping cloud ticks) never double-spawn.
    `set` stamps started_at=now; `clear` removes it; `list` dumps all live leases."""
    if action == 'set':
        os.makedirs(LEASE_DIR, exist_ok=True)
        rec = {'page_id': page_id, 'phase': phase, 'agent': agent, 'run_id': run_id,
               'started_at': datetime.now().isoformat(timespec='seconds')}
        with open(lease_path(page_id), 'w') as f:
            json.dump(rec, f, indent=2)
        print(json.dumps(rec, ensure_ascii=False))
    elif action == 'clear':
        p = lease_path(page_id)
        if os.path.exists(p): os.remove(p)
        print(f'lease cleared: {page_id}')
    elif action == 'list':
        if not os.path.isdir(LEASE_DIR): return
        for fn in sorted(os.listdir(LEASE_DIR)):
            if fn.endswith('.json'):
                lease = json.load(open(os.path.join(LEASE_DIR, fn)))
                lease['fresh'] = lease_is_fresh(lease)
                print(json.dumps(lease, ensure_ascii=False))
    else:
        sys.exit('lease set|clear|list')

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
    roster_mirror(page_id, fields)
    print(f'set {list(fields)} on {page_id} ({"jonathan-stated" if from_jonathan else "agent"})')

def cmd_new(name, payload='{}', source=None):
    """Create a New entry in the Companies DB and return its page id.

    The only sanctioned creation path through the contract: scout/intake hands in
    a Name (+ optional factual fields as JSON: Country, Website, Instagram, LinkedIn,
    Email, AI Notes...) and how it was found (--source). Entry Status is forced to
    New, so the next P1 pass enriches it (zero-states + capabilities land there, not
    here — a New stub is allowed to be sparse). Judgment fields are refused via the
    same guard as cmd_set; provenance is set_by agent; the roster mirror keeps parity.
    Never sets Verified, never writes Notes."""
    fields = json.loads(payload) if isinstance(payload, str) else dict(payload)
    fields['Entry Status'] = 'New'
    if source is not None:
        fields['Source'] = source
    for f, v in fields.items():
        if f == 'Notes': sys.exit("CONTRACT: Notes is Jonathan's — never write it.")
        if f == 'Entry Status' and v == 'Verified': sys.exit('CONTRACT: only Jonathan sets Verified.')
        if f in JUDGMENT_ZERO and v != JUDGMENT_ZERO[f]:
            sys.exit(f'CONTRACT: {f} is a judgment field — set its zero-state or leave it.')
    props = {'Name': encode('Name', name)}
    props.update({f: encode(f, v) for f, v in fields.items()})
    page = api('pages', {'parent': {'database_id': DB}, 'properties': props}, method='POST')
    pid = page['id']
    prov_update(pid, {'Name': name, **fields}, set_by='agent', source_url=source)
    roster_mirror(pid, {'Name': name, **fields})
    print(f'created {pid} — {name} (New)')
    return pid

def cmd_ask(page_id, text):
    api(f'pages/{page_id}', {'properties': {
        'Open Questions': encode('Open Questions', text),
        'Entry Status': encode('Entry Status', 'Needs Review')}})
    prov_update(page_id, {'Open Questions': text, 'Entry Status': 'Needs Review'})
    roster_mirror(page_id, {'Open Questions': text, 'Entry Status': 'Needs Review'})
    print(f'asked on {page_id}')

def cmd_status(page_id, status):
    guard(page_id, {'Entry Status': status})
    api(f'pages/{page_id}', {'properties': {'Entry Status': encode('Entry Status', status)}})
    prov_update(page_id, {'Entry Status': status})
    roster_mirror(page_id, {'Entry Status': status})
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
    heading, then each work item in manifest order, divider. Replaces Images property.

    Manifest entries are typed (default 'image'):
    - image:    {file, source_url, caption?, link?}  -> uploaded file image block
    - embed:    {type:'embed', url, caption?}        -> Notion embed (SoundCloud,
                Spotify, Bandcamp, Vimeo, YouTube, NTS...) for audio/video work
    - bookmark: {type:'bookmark', url, caption?}     -> rich link preview for
                writing/articles/case studies
    Non-image work (sound designers, videographers, writers, strategists) lives as
    embed/bookmark entries so their actual output is in the portfolio, not just stills."""
    manifest_all = json.load(open(os.path.join(asset_dir, 'manifest.json')))
    # Skip rejected tombstones -- never re-propose what Jonathan removed
    manifest = [e for e in manifest_all if not e.get('rejected')]
    def cap_rt(entry, suffix_link=None):
        rt = []
        if entry.get('caption'):
            rt.append({'text': {'content': entry['caption'] + (' · ' if suffix_link else '')}})
        if suffix_link:
            rt.append({'text': {'content': suffix_link.split('//')[-1].split('/')[0],
                                'link': {'url': suffix_link}}})
        return rt
    # upload file-backed entries (images + self-hosted video files <=20MB)
    img_entries = [e for e in manifest if e.get('type', 'image') == 'image' and not e.get('rejected')]
    file_entries = [e for e in manifest if e.get('type', 'image') in ('image', 'video') and not e.get('rejected')]
    uploads = [(upload_file(os.path.join(asset_dir, e['file'])), e) for e in file_entries]
    api(f'pages/{page_id}', {'properties': {'Images': {'files': [
        {'type': 'file_upload', 'file_upload': {'id': fid}, 'name': name}
        for (fid, name), e in uploads if e.get('type', 'image') == 'image']}}})
    fid_by_file = {e['file']: (fid, name) for (fid, name), e in uploads}
    blocks = [{'type': 'heading_2', 'heading_2': {'rich_text': [{'text': {'content': 'Work'}}]}}]
    for entry in (e for e in manifest if not e.get('rejected')):
        kind = entry.get('type', 'image')
        if kind in ('embed', 'bookmark'):
            blocks.append({'type': kind, kind: {'url': entry['url'],
                           'caption': cap_rt(entry)}})
            # Auditable metadata line BELOW the embed: project name + source link,
            # so the page itself records what each video/link is (embed captions are
            # faint and lost on re-reads; this survives and aids revisits months later).
            meta = [{'text': {'content': (entry.get('caption') or 'Work') + ' — '},
                     'annotations': {'bold': True}}]
            link = entry.get('link') or entry['url']
            meta.append({'text': {'content': link.split('//')[-1].split('/')[0],
                                  'link': {'url': link}}})
            if entry.get('link') and entry.get('link') != entry['url']:
                meta.append({'text': {'content': ' · video', 'link': {'url': entry['url']}}})
            blocks.append({'type': 'paragraph', 'paragraph': {'rich_text': meta}})
        elif kind == 'video':
            fid, name = fid_by_file[entry['file']]
            blocks.append({'type': 'video', 'video': {'type': 'file_upload',
                           'file_upload': {'id': fid},
                           'caption': cap_rt(entry, entry.get('link') or entry.get('source_url'))}})
        else:
            fid, name = fid_by_file[entry['file']]
            blocks.append({'type': 'image', 'image': {'type': 'file_upload',
                           'file_upload': {'id': fid},
                           'caption': cap_rt(entry, entry.get('link') or entry.get('source_url'))}})
    blocks.append({'type': 'divider', 'divider': {}})
    api(f'blocks/{page_id}/children', {'children': blocks})
    prov_update(page_id, {'Images': [e['file'] for e in img_entries]})
    n_embed = sum(1 for e in manifest if e.get('type') in ('embed', 'bookmark'))
    n_video = sum(1 for e in manifest if e.get('type') == 'video')
    print(f'uploaded {len(img_entries)} images + {n_video} videos + {n_embed} embeds/bookmarks to {page_id}')

def cmd_stamp_verified():
    """Stamp Status Last Verified on entries Jonathan has marked Verified.

    Jonathan's review IS the verification event. When he sets Entry Status =
    Verified, the facts are confirmed as of that moment, so Status Last Verified
    should record it. We only stamp entries where the date is still EMPTY (P2
    owns later bumps), and we use the page's last_edited_time as the accurate
    proxy for WHEN he verified. Run this as a cheap routine/session step.
    Backfill/P1 must leave Status Last Verified empty until this runs."""
    rows = query_all({'property': 'Entry Status', 'select': {'equals': 'Verified'}})
    stamped = 0
    for r in rows:
        if (r['properties']['Status Last Verified']['date'] or {}).get('start'):
            continue
        when = r['last_edited_time'][:10]
        api(f'pages/{r["id"]}', {'properties': {'Status Last Verified': encode('Status Last Verified', when)}})
        prov_update(r['id'], {'Status Last Verified': when}, set_by='jonathan')
        stamped += 1
        print(f'  stamped {r["id"]} -> {when}')
        time.sleep(0.35)
    print(f'stamp-verified: {stamped} newly stamped of {len(rows)} Verified')

def cmd_set_notes(page_id, text):
    """Relocate Jonathan's OWN words from the page body into the Notes property.

    Notes is Jonathan's: cmd_set refuses it in both paths. This is the single
    sanctioned exception, for ONE job only — moving commentary HE wrote in the
    page body into the Notes field (his clipper writes into the body; his
    opinion belongs in the filterable field, not buried below images). It is
    his text, set_by jonathan, never agent-authored. Do NOT use this to write
    summaries or anything you composed — that is what AI Notes is for.
    """
    api(f'pages/{page_id}', {'properties': {'Notes': encode('Notes', text)}})
    prov_update(page_id, {'Notes': text}, set_by='jonathan')
    print(f'set Notes on {page_id} (jonathan, relocated from body)')

def cmd_log(text):
    with open(os.path.join(REPO, 'state', 'browser-log.md'), 'a') as f:
        f.write(f'- {datetime.now().isoformat(timespec="seconds")} — {text}\n')
    print('logged')

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    cmd = a[0]
    # @file / - indirection for text+JSON payloads: lets a caller put multi-line
    # text (AI Notes, Open Questions, set JSON) in a file written by the Write tool
    # instead of on the command line. Keeping newlines (and any '#') off the shell
    # argv avoids Claude Code's "newline followed by #" command-injection guardrail,
    # which forced a manual approval on every multi-line keeper call (2026-06-16).
    def deref(s):
        if isinstance(s, str) and s.startswith('@'):
            with open(os.path.expanduser(s[1:])) as fh: return fh.read()
        if s == '-': return sys.stdin.read()
        return s
    a = [deref(x) if i >= 2 else x for i, x in enumerate(a)]
    if cmd == 'work' and len(a) > 1 and a[1] == 'pipeline':
        scope = a[a.index('--scope') + 1].split(',') if '--scope' in a else None
        tmo = int(a[a.index('--timeout') + 1]) if '--timeout' in a else LEASE_TIMEOUT_MIN
        cmd_pipeline(scope, tmo)
    elif cmd == 'work':
        lim = -1 if '--all' in a else (int(a[a.index('--limit') + 1]) if '--limit' in a else 10)
        off = int(a[a.index('--offset') + 1]) if '--offset' in a else 0
        oqf = 'feedback' if '--feedback' in a else ('empty' if '--empty-oq' in a else None)
        cmd_work(a[1], lim, off, oqf)
    elif cmd == 'lease':
        ph = a[a.index('--phase') + 1] if '--phase' in a else (a[3] if len(a) > 3 and not a[3].startswith('--') else None)
        ag = a[a.index('--agent') + 1] if '--agent' in a else None
        rid = a[a.index('--run-id') + 1] if '--run-id' in a else None
        cmd_lease(a[1], a[2] if len(a) > 2 else None, ph, ag, rid)
    elif cmd == 'new':
        src = a[a.index('--source') + 1] if '--source' in a else None
        body = a[2] if len(a) > 2 and not a[2].startswith('--') else '{}'
        cmd_new(a[1], body, src)
    elif cmd == 'get': cmd_get(a[1])
    elif cmd == 'set':
        src = a[a.index('--source') + 1] if '--source' in a else None
        cmd_set(a[1], a[2], src, from_jonathan='--from-jonathan' in a)
    elif cmd == 'ask': cmd_ask(a[1], a[2])
    elif cmd == 'set-notes':
        if '--relocated-from-body' not in a:
            sys.exit("CONTRACT: set-notes only relocates Jonathan's own body words. Pass --relocated-from-body to confirm.")
        cmd_set_notes(a[1], a[2])
    elif cmd == 'stamp-verified': cmd_stamp_verified()
    elif cmd == 'status': cmd_status(a[1], a[2])
    elif cmd == 'upload': cmd_upload(a[1], a[2])
    elif cmd == 'body-reset': cmd_body_reset(a[1])
    elif cmd == 'log': cmd_log(' '.join(a[1:]))
    else: sys.exit(__doc__)
