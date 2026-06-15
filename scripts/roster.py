#!/usr/bin/env python3
"""roster.py — the studio/designer roster: a git-versioned mirror of the Notion
metadata that doubles as the scouting surface and the substrate for an ecosystem
visualization (who moved where, when, and who overlapped). Stdlib only; reuses
keeper.py for all Notion I/O so there is one Notion client, one contract.

Three normalized JSONL files under state/roster/ (one JSON object per line, so git
diffs are line-clean and the history of every change is legible):
  studios.jsonl   {studio_id, name, website, team_page_url, country, rating,
                   maintained, notion_page_id, last_scouted}
  designers.jsonl PARITY MIRROR of a person's Notion metadata (all fields EXCEPT
                  Images, Work With?, and the Works At relation pointer) PLUS
                  {designer_id, status, notion_page_id, first_seen, last_verified,
                   current_studio_id}
  tenures.jsonl   {designer_id, studio_id, role, start_year, end_year, source}
                  — the edge list the movement/overlap graph reads.

Two layers of studios (Jonathan, 2026-06-15):
  - MAINTAINED (Rating 4-5, maintained=true): actively cycled oldest-scouted-first
    and crawled for new hires. The Rating field IS the studio tier.
  - REFERENCE (rank <=3 or unranked): present ONLY as movement endpoints, so a
    departure from a maintained studio has a destination to point at. Never crawled.
The roster therefore contains studios that are not 4-5: we still need to mark where
a person went when they leave for a studio we do not maintain.

Movement grows the network: a name that appears at a maintained studio (vs our last
snapshot) is a new candidate; a name that disappears has left, and its destination
(once known) is added as a reference studio. A person who moves to a studio we do
not have goes to New in Notion for Jonathan to review; if he then rates that studio
4-5 it graduates to maintained (set-rating flips `maintained`).

Usage:
  roster.py studios [--maintained]          list studios (maintained: oldest-scouted first = cycle order)
  roster.py designers [--status S]          list designers (optionally filter by status)
  roster.py get ID                          studio or designer record (+ tenures) as JSON
  roster.py snapshot STUDIO_ID TEAM_JSON    diff a studio's current team vs last snapshot
  roster.py upsert-studio JSON              add/update a studio record
  roster.py set-rating STUDIO_ID N          set Rating tier; maintained := (N>=4)
  roster.py set-status DESIGNER_ID STATUS   Prospect|Surfaced|Approved|Rejected|<Notion Entry Status>
  roster.py move DESIGNER_ID STUDIO_ID [--role R] [--year Y]   close old tenure, open new
  roster.py sync PAGE_ID                    pull one Notion entry -> parity record
  roster.py sync-all                        seed the roster from the whole Notion DB
  roster.py mirror PAGE_ID JSON             merge changed fields into a parity record (used by keeper)
  roster.py promote DESIGNER_ID             create a New stub in Notion, link notion_page_id

STATUS values for a designer:
  Prospect  — discovered, not yet looked at
  Surfaced  — put in front of Jonathan in a digest, awaiting his yes/no
  Approved  — Jonathan said yes; promote() makes a New Notion entry
  Rejected  — permanent no; never re-surfaced
  (once promoted, status mirrors the Notion Entry Status: New/Enriching/Needs Review/Verified/Revisit)
"""
import json, os, re, sys
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROSTER = os.path.join(REPO, 'state', 'roster')
STUDIOS = os.path.join(ROSTER, 'studios.jsonl')
DESIGNERS = os.path.join(ROSTER, 'designers.jsonl')
TENURES = os.path.join(ROSTER, 'tenures.jsonl')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Notion metadata mirrored into a designer record. Excludes (Jonathan, 2026-06-15):
# Images (the scraper owns those, never in the roster), Work With? (his taste), and
# Works At (the Notion relation pointer — employment is modeled in tenures instead).
PARITY_FIELDS = ['Name', 'Type', 'Capabilities', 'Country', 'Size', 'Work Status',
                 'Autonomy', 'Day Rate', 'Website', 'Instagram', 'LinkedIn', 'Email',
                 'Source', 'AI Notes', 'Open Questions', 'Notes', 'Rating',
                 'Worked Together', 'Familiarity', 'Works At Link',
                 'Status Last Verified', 'Entry Status']
STUDIO_TYPES = {'Studio', 'Agency', 'Foundry'}
CANDIDATE_STATES = {'Prospect', 'Surfaced', 'Approved', 'Rejected'}

# ---- JSONL store ----

def read_jsonl(path):
    if not os.path.exists(path):
        return []
    return [json.loads(line) for line in open(path) if line.strip()]

def write_jsonl(path, records):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

def upsert(path, key, record):
    """Insert or merge a record by `key`. Merge preserves fields the caller omits,
    so an incremental metadata write does not wipe earlier-captured fields."""
    records = read_jsonl(path)
    for i, r in enumerate(records):
        if r.get(key) == record.get(key):
            records[i] = {**r, **record}
            write_jsonl(path, records)
            return records[i]
    records.append(record)
    write_jsonl(path, records)
    return record

def slug(name):
    s = re.sub(r'[^a-z0-9]+', '-', (name or '').lower()).strip('-')
    return s or 'unnamed'

def unique_id(path, key, base):
    existing = {r.get(key) for r in read_jsonl(path)}
    if base not in existing:
        return base
    n = 2
    while f'{base}-{n}' in existing:
        n += 1
    return f'{base}-{n}'

# ---- lookups ----

def find_studio(studio_id):
    for r in read_jsonl(STUDIOS):
        if r.get('studio_id') == studio_id:
            return r
    return None

def find_designer(designer_id=None, name=None, notion_page_id=None):
    for r in read_jsonl(DESIGNERS):
        if designer_id and r.get('designer_id') == designer_id:
            return r
        if notion_page_id and r.get('notion_page_id') == notion_page_id:
            return r
        if name and slug(r.get('Name')) == slug(name):
            return r
    return None

def open_tenures(studio_id):
    return [t for t in read_jsonl(TENURES)
            if t.get('studio_id') == studio_id and t.get('end_year') is None]

# ---- commands ----

def cmd_studios(maintained_only=False):
    rows = read_jsonl(STUDIOS)
    if maintained_only:
        rows = [r for r in rows if r.get('maintained')]
        rows.sort(key=lambda r: r.get('last_scouted') or '')  # oldest first = next to scout
    for r in rows:
        print(json.dumps(r, ensure_ascii=False))
    print(f'-- {len(rows)} studios', file=sys.stderr)

def cmd_designers(status=None):
    rows = read_jsonl(DESIGNERS)
    if status:
        rows = [r for r in rows if (r.get('status') or r.get('Entry Status')) == status]
    for r in rows:
        print(json.dumps(r, ensure_ascii=False))
    print(f'-- {len(rows)} designers', file=sys.stderr)

def cmd_get(rec_id):
    s = find_studio(rec_id)
    if s:
        s = dict(s)
        s['_tenures'] = [t for t in read_jsonl(TENURES) if t.get('studio_id') == rec_id]
        print(json.dumps(s, indent=2, ensure_ascii=False))
        return
    d = find_designer(designer_id=rec_id)
    if d:
        d = dict(d)
        d['_tenures'] = [t for t in read_jsonl(TENURES) if t.get('designer_id') == rec_id]
        print(json.dumps(d, indent=2, ensure_ascii=False))
        return
    sys.exit(f'no studio or designer with id {rec_id}')

def cmd_upsert_studio(payload):
    rec = json.loads(payload)
    if 'studio_id' not in rec:
        rec['studio_id'] = unique_id(STUDIOS, 'studio_id', slug(rec.get('name')))
    rec.setdefault('maintained', bool((rec.get('rating') or 0) and rec['rating'] >= 4))
    rec.setdefault('last_scouted', None)
    out = upsert(STUDIOS, 'studio_id', rec)
    print(f'studio {out["studio_id"]} upserted')

def cmd_set_rating(studio_id, n):
    s = find_studio(studio_id)
    if not s:
        sys.exit(f'no studio {studio_id}')
    n = int(n)
    upsert(STUDIOS, 'studio_id', {'studio_id': studio_id, 'rating': n, 'maintained': n >= 4})
    print(f'{studio_id} rating {n}, maintained={n >= 4}')

def cmd_set_status(designer_id, status):
    d = find_designer(designer_id=designer_id)
    if not d:
        sys.exit(f'no designer {designer_id}')
    upsert(DESIGNERS, 'designer_id', {'designer_id': designer_id, 'status': status})
    print(f'{designer_id} status -> {status}')

def _resolve_or_create_designer(name, role=None, links=None):
    """Find a designer by name slug, or create a Prospect record. Returns the record."""
    d = find_designer(name=name)
    if d:
        return d
    did = unique_id(DESIGNERS, 'designer_id', slug(name))
    rec = {'designer_id': did, 'Name': name, 'status': 'Prospect',
           'first_seen': str(date.today()), 'notion_page_id': None}
    if links:
        for k in ('Website', 'Instagram', 'LinkedIn'):
            if links.get(k):
                rec[k] = links[k]
    upsert(DESIGNERS, 'designer_id', rec)
    return rec

def cmd_snapshot(studio_id, team_path):
    """Record a maintained studio's current team and diff it against our last
    snapshot. team_json is a list of names or objects {name, role?, Website?,
    Instagram?, LinkedIn?}. Emits hires (new open tenures) and departures (closed
    tenures). We do NOT guess a departed person's destination here — that is learned
    when they surface at another studio (snapshot/sync) or via `move`."""
    studio = find_studio(studio_id)
    if not studio:
        sys.exit(f'no studio {studio_id} — add it with upsert-studio first')
    team = json.loads(open(team_path).read())
    team = [{'name': m} if isinstance(m, str) else m for m in team]
    year = date.today().year

    prior = open_tenures(studio_id)
    prior_by_did = {t['designer_id']: t for t in prior}
    current_dids = set()
    hires, departures = [], []

    for member in team:
        d = _resolve_or_create_designer(member['name'], member.get('role'), member)
        did = d['designer_id']
        current_dids.add(did)
        if did not in prior_by_did:
            tenures = read_jsonl(TENURES)
            tenures.append({'designer_id': did, 'studio_id': studio_id,
                            'role': member.get('role'), 'start_year': year,
                            'end_year': None, 'source': 'snapshot'})
            write_jsonl(TENURES, tenures)
            # a name new to a maintained studio is a fresh candidate to surface
            if studio.get('maintained') and d.get('status') == 'Prospect':
                upsert(DESIGNERS, 'designer_id', {'designer_id': did, 'status': 'Surfaced'})
            upsert(DESIGNERS, 'designer_id', {'designer_id': did, 'current_studio_id': studio_id})
            hires.append(d.get('Name'))

    for did, t in prior_by_did.items():
        if did not in current_dids:
            tenures = read_jsonl(TENURES)
            for x in tenures:
                if x is t or (x.get('designer_id') == did and x.get('studio_id') == studio_id
                              and x.get('end_year') is None):
                    x['end_year'] = year
            write_jsonl(TENURES, tenures)
            d = find_designer(designer_id=did)
            departures.append(d.get('Name') if d else did)

    upsert(STUDIOS, 'studio_id', {'studio_id': studio_id, 'last_scouted': str(date.today())})
    print(json.dumps({'studio': studio_id, 'hires': hires, 'departures': departures,
                      'team_size': len(current_dids)}, ensure_ascii=False, indent=2))

def cmd_move(designer_id, studio_id, role=None, year=None):
    """Close a designer's open tenure(s) and open one at studio_id. Adds the
    destination as a REFERENCE studio if we do not have it yet (so the movement has
    an endpoint even when the destination is not one we maintain)."""
    d = find_designer(designer_id=designer_id)
    if not d:
        sys.exit(f'no designer {designer_id}')
    if not find_studio(studio_id):
        # destination unknown -> add as reference (unranked, not maintained)
        upsert(STUDIOS, 'studio_id', {'studio_id': studio_id, 'name': studio_id,
                                      'maintained': False, 'rating': None, 'last_scouted': None})
        print(f'(added reference studio {studio_id})')
    year = int(year) if year else date.today().year
    tenures = read_jsonl(TENURES)
    for t in tenures:
        if t.get('designer_id') == designer_id and t.get('end_year') is None:
            t['end_year'] = year
    tenures.append({'designer_id': designer_id, 'studio_id': studio_id, 'role': role,
                    'start_year': year, 'end_year': None, 'source': 'move'})
    write_jsonl(TENURES, tenures)
    upsert(DESIGNERS, 'designer_id', {'designer_id': designer_id, 'current_studio_id': studio_id})
    print(f'{designer_id} moved to {studio_id} ({year})')

# ---- Notion mirror (reuses keeper) ----

def _parity_record(entry):
    rec = {k: entry[k] for k in PARITY_FIELDS if entry.get(k) is not None}
    rec['notion_page_id'] = entry['page_id']
    return rec

def mirror_fields(page_id, fields):
    """Merge changed fields (as written to Notion) into the designer parity record.
    Called by keeper.py on every metadata write so the roster stays in parity and
    its git history records the same change. Cheap: no extra Notion read. Studios
    are not mirrored here (sync-all / the scout's Type classification own those)."""
    rec = {k: v for k, v in fields.items() if k in PARITY_FIELDS}
    if not rec:
        return
    existing = find_designer(notion_page_id=page_id)
    rec['notion_page_id'] = page_id
    if existing:
        rec['designer_id'] = existing['designer_id']
    else:
        base = slug(fields.get('Name') or page_id[:8])
        rec['designer_id'] = unique_id(DESIGNERS, 'designer_id', base)
        rec['first_seen'] = str(date.today())
    if 'Entry Status' in fields:
        rec['status'] = fields['Entry Status']
    upsert(DESIGNERS, 'designer_id', rec)

def cmd_mirror(page_id, payload):
    mirror_fields(page_id, json.loads(payload))

def cmd_sync(page_id):
    import keeper
    entry = keeper.entry_dict(keeper.api(f'pages/{page_id}'))
    rec = _parity_record(entry)
    existing = find_designer(notion_page_id=page_id)
    rec['designer_id'] = existing['designer_id'] if existing else \
        unique_id(DESIGNERS, 'designer_id', slug(entry.get('Name') or page_id[:8]))
    rec.setdefault('first_seen', str(date.today()))
    rec['status'] = entry.get('Entry Status') or (existing or {}).get('status')
    upsert(DESIGNERS, 'designer_id', rec)
    print(f'synced {page_id} -> {rec["designer_id"]}')

def cmd_sync_all():
    """Seed the roster from the whole Notion DB. People -> designers.jsonl; entries
    typed Studio/Agency/Foundry -> studios.jsonl (rating carried over, maintained if
    Rating>=4). Untyped entries (most of the DB right now) are mirrored as designers
    pending the scout's classification pass."""
    import keeper
    rows = keeper.query_all()
    nd = ns = 0
    for row in rows:
        entry = keeper.entry_dict(row)
        if entry.get('Type') in STUDIO_TYPES:
            rating = entry.get('Rating')
            rating = int(rating) if rating and str(rating).isdigit() else None
            sid = unique_id(STUDIOS, 'studio_id', slug(entry.get('Name')))
            existing = next((s for s in read_jsonl(STUDIOS)
                             if s.get('notion_page_id') == entry['page_id']), None)
            if existing:
                sid = existing['studio_id']
            upsert(STUDIOS, 'studio_id', {
                'studio_id': sid, 'name': entry.get('Name'),
                'website': entry.get('Website'), 'team_page_url': None,
                'country': entry.get('Country'), 'rating': rating,
                'maintained': bool(rating and rating >= 4),
                'notion_page_id': entry['page_id'], 'last_scouted': None})
            ns += 1
        else:
            rec = _parity_record(entry)
            existing = find_designer(notion_page_id=entry['page_id'])
            rec['designer_id'] = existing['designer_id'] if existing else \
                unique_id(DESIGNERS, 'designer_id', slug(entry.get('Name') or entry['page_id'][:8]))
            rec.setdefault('first_seen', str(date.today()))
            rec['status'] = entry.get('Entry Status') or (existing or {}).get('status')
            upsert(DESIGNERS, 'designer_id', rec)
            nd += 1
    print(f'sync-all: {nd} designers, {ns} studios seeded from Notion')

def cmd_promote(designer_id):
    """Jonathan approved a candidate: create a New entry in the main Notion DB and
    link it back. The scout then enriches it like any New entry."""
    import keeper
    d = find_designer(designer_id=designer_id)
    if not d:
        sys.exit(f'no designer {designer_id}')
    if d.get('notion_page_id'):
        sys.exit(f'{designer_id} already linked to Notion {d["notion_page_id"]}')
    props = {'Name': keeper.encode('Name', d.get('Name') or designer_id),
             'Entry Status': keeper.encode('Entry Status', 'New')}
    if d.get('Website'):
        props['Website'] = keeper.encode('Website', d['Website'])
    page = keeper.api('pages', {'parent': {'database_id': keeper.DB}, 'properties': props},
                      method='POST')
    upsert(DESIGNERS, 'designer_id',
           {'designer_id': designer_id, 'notion_page_id': page['id'], 'status': 'New'})
    print(f'promoted {designer_id} -> New Notion entry {page["id"]}')

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == 'studios':
        cmd_studios('--maintained' in a)
    elif cmd == 'designers':
        cmd_designers(a[a.index('--status') + 1] if '--status' in a else None)
    elif cmd == 'get':
        cmd_get(a[1])
    elif cmd == 'snapshot':
        cmd_snapshot(a[1], a[2])
    elif cmd == 'upsert-studio':
        cmd_upsert_studio(a[1])
    elif cmd == 'set-rating':
        cmd_set_rating(a[1], a[2])
    elif cmd == 'set-status':
        cmd_set_status(a[1], a[2])
    elif cmd == 'move':
        cmd_move(a[1], a[2],
                 role=a[a.index('--role') + 1] if '--role' in a else None,
                 year=a[a.index('--year') + 1] if '--year' in a else None)
    elif cmd == 'sync':
        cmd_sync(a[1])
    elif cmd == 'sync-all':
        cmd_sync_all()
    elif cmd == 'mirror':
        cmd_mirror(a[1], a[2])
    elif cmd == 'promote':
        cmd_promote(a[1])
    else:
        sys.exit(__doc__)
