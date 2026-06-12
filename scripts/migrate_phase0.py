#!/usr/bin/env python3
"""One-off Phase 0 migration per MIGRATION-DECISIONS.md (approved 2026-06-12).

Stages (run in order):
  schema     - add new properties; rename Expertise->Capabilities + option renames
  rows       - per-row: tag merges, Worked Together mapping, Open Questions, Entry Status
  cleanup    - delete merged/dropped options, retire CRM-era properties
  provenance - write state/provenance/<page-id>.json for every row
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import OrderedDict

KEY = os.environ['NOTION_API_KEY']
DB = os.environ['NOTION_DATABASE_ID']
H = {'Authorization': f'Bearer {KEY}', 'Notion-Version': '2022-06-28',
     'Content-Type': 'application/json'}

def api(path, body=None, method=None):
    method = method or ('PATCH' if body is not None else 'GET')
    for attempt in range(5):
        req = urllib.request.Request(f'https://api.notion.com/v1/{path}', headers=H,
                                     data=json.dumps(body).encode() if body is not None else None,
                                     method=method)
        try:
            return json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            if e.code in (409, 429, 500, 502, 503) and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            print(f'ERROR {e.code} on {method} {path}: {e.read().decode()[:500]}', file=sys.stderr)
            raise

def query_all():
    rows, cursor = [], None
    while True:
        body = {'page_size': 100}
        if cursor: body['start_cursor'] = cursor
        r = api(f'databases/{DB}/query', body, method='POST')
        rows += r['results']
        if not r.get('has_more'): return rows
        cursor = r['next_cursor']

CAP_RENAMES = {  # old option name -> new name (same option id, data preserved)
    'Developer': 'Can build websites', 'Website design': 'Web design',
    '3D / Animation': '3D & motion', 'Brand design': 'Identity systems',
    'Artist': 'Art practice', 'Creative Technologist': 'Creative technology',
    'Film / Production': 'Film & video production', 'Printer': 'Print production',
    'Strategy / Research': 'Strategy & research', 'Paper': 'Paper & materials',
    'Space': 'Spatial & exhibition design', 'Creative Direction': 'Creative direction',
    'Sound Design': 'Sound design', 'Product Design': 'Product design',
}
CAP_MERGES = {  # old tag -> target tag (per-row rewrite, then option deleted)
    'Consultant': 'Strategy & research', 'Architecture': 'Spatial & exhibition design',
    'PR/Marketing': 'Strategy & research', 'Manufacturing': 'Paper & materials',
    'Video Games': 'Creative technology', 'Data Visualisation': 'Graphic design',
}
CAP_DROPS = ['*Client', 'Advertising', 'Saas']
RATING_RENAMES = {'Fantastic!': '5', 'Great!': '4', 'Good!': '3',
                  'Only in a pinch': '2', 'Not right': '1'}
RATING_DROPS = ['Need to vet']
SIZE_RENAMES = {'<10': '2–10', '<40': '11–40', '<100': '41–100'}
REL_TO_NEVER = ['Partner-Prospect', 'Vendor-Prospect', 'Partner-Dream', 'Admirer', 'Client-Prospect']
REL_TO_ASK = ['Client', 'Vendor', 'Partner']
RETIRE = ['Relationship', 'CRM Stage', 'CRM Status', 'Last Contacted', 'Seniority', 'URL']

SELECTS = {
    'Type': ['Person', 'Studio', 'Agency', 'Foundry', 'Publication'],
    'Work Status': ['Freelance', 'Employed', 'Studio', 'Unknown'],
    'Autonomy': ['1', '2', '3', '4', '5'],
    'Worked Together': ['Never', 'Once', 'Repeatedly'],
    'Familiarity': ["Don't know them", 'Met or spoken', 'Know them well'],
    'Word of Mouth': ['None', 'Positive', 'Negative'],
    'Work With?': ['Definitely', 'Yes', 'In a pinch', 'No'],
    'Entry Status': ['New', 'Enriching', 'Needs Review', 'Verified', 'Stale', 'Rejected'],
}

def renamed_options(prop, renames):
    return [{'id': o['id'], 'name': renames.get(o['name'], o['name'])}
            for o in prop[prop['type']]['options']]

def stage_schema():
    schema = api(f'databases/{DB}')
    props = schema['properties']
    new_props = {}
    for name, options in SELECTS.items():
        if name not in props:
            new_props[name] = {'select': {'options': [{'name': o} for o in options]}}
    for name, t in [('Works At Link', 'url'), ('LinkedIn', 'url'),
                    ('Rating Notes', 'rich_text'), ('Source', 'rich_text'),
                    ('Open Questions', 'rich_text'), ('AI Notes', 'rich_text'),
                    ('Images', 'files'), ('Status Last Verified', 'date')]:
        if name not in props:
            new_props[name] = {t: {}}
    if 'Works At' not in props:
        new_props['Works At'] = {'relation': {'database_id': DB, 'type': 'dual_property',
                                              'dual_property': {}}}
    if new_props:
        api(f'databases/{DB}', {'properties': new_props})
        print(f'added {len(new_props)} properties')

    renames = {}
    if 'Expertise' in props:
        renames['Expertise'] = {'name': 'Capabilities',
                                'multi_select': {'options': renamed_options(props['Expertise'], CAP_RENAMES)}}
    if 'Rating' in props and props['Rating']['type'] == 'select':
        renames['Rating'] = {'select': {'options': renamed_options(props['Rating'], RATING_RENAMES)}}
    if 'Size' in props:
        renames['Size'] = {'select': {'options': renamed_options(props['Size'], SIZE_RENAMES)}}
    if renames:
        api(f'databases/{DB}', {'properties': renames})
        print(f'renamed: {", ".join(renames)}')
    # name the auto-created synced side of the Works At relation
    schema = api(f'databases/{DB}')
    for name, p in schema['properties'].items():
        if p['type'] == 'relation' and name.startswith('Related to'):
            api(f'databases/{DB}', {'properties': {name: {'name': 'People'}}})
            print(f'renamed synced relation "{name}" -> "People"')
    print('schema stage done')

def stage_rows():
    backup = {r['id']: r for r in json.load(open('backups/2026-06-12-raw.json'))}
    rows = query_all()
    print(f'{len(rows)} rows live')
    done = skipped = 0
    for row in rows:
        p = row['properties']
        if 'Entry Status' in p and p['Entry Status']['select'] is not None:
            skipped += 1
            continue  # already migrated (resume support)
        update, questions = {}, []
        old = backup.get(row['id'], row)['properties']

        # capability merges (live names already renamed; backup has old names)
        tags = [t['name'] for t in p.get('Capabilities', p.get('Expertise', {'multi_select': []}))['multi_select']]
        if any(t in CAP_MERGES for t in tags):
            new_tags = list(OrderedDict.fromkeys(CAP_MERGES.get(t, t) for t in tags))
            update['Capabilities'] = {'multi_select': [{'name': t} for t in new_tags]}

        rel = (old.get('Relationship', {}).get('select') or {}).get('name')
        if rel in REL_TO_NEVER:
            update['Worked Together'] = {'select': {'name': 'Never'}}
        if rel in REL_TO_ASK:
            questions.append(f"Old Relationship was '{rel}' — set Worked Together: "
                             '(a) Once (b) Repeatedly (c) Never')
        if rel == 'Partner-Dream':
            questions.append("Was 'Partner-Dream' — set Work With? yourself "
                             '(and Rating if you can judge the work)')

        legacy_url = old.get('URL', {}).get('url')
        if legacy_url:
            update['AI Notes'] = {'rich_text': [{'text': {'content': f'Legacy URL field value: {legacy_url}'}}]}

        if questions:
            text = '\n'.join(f'{i+1}. {q}' for i, q in enumerate(questions))
            update['Open Questions'] = {'rich_text': [{'text': {'content': text}}]}
            update['Entry Status'] = {'select': {'name': 'Needs Review'}}
        else:
            update['Entry Status'] = {'select': {'name': 'Stale'}}

        api(f'pages/{row["id"]}', {'properties': update})
        done += 1
        if done % 50 == 0: print(f'  {done} rows updated…')
        time.sleep(0.34)
    print(f'rows stage done: {done} updated, {skipped} already migrated')

def stage_cleanup():
    schema = api(f'databases/{DB}')
    props = schema['properties']
    upd = {}
    def keep(prop_name, drops):
        p = props[prop_name]
        return [{'id': o['id'], 'name': o['name']}
                for o in p[p['type']]['options'] if o['name'] not in drops]
    upd['Capabilities'] = {'multi_select': {'options': keep('Capabilities', list(CAP_MERGES) + CAP_DROPS)}}
    upd['Rating'] = {'select': {'options': keep('Rating', RATING_DROPS)}}
    upd['Country'] = {'multi_select': {'options': keep('Country', ['*'])}}
    api(f'databases/{DB}', {'properties': upd})
    print('options cleaned: Capabilities, Rating, Country')
    retire = {name: None for name in RETIRE if name in props}
    if retire:
        api(f'databases/{DB}', {'properties': retire})
        print(f'retired: {", ".join(retire)}')
    print('cleanup stage done')

AGENT_FIELDS = {'Entry Status', 'Open Questions', 'AI Notes'}

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

def stage_provenance():
    os.makedirs('state/provenance', exist_ok=True)
    rows = query_all()
    for row in rows:
        rec = {}
        for name, prop in row['properties'].items():
            val = plain(prop)
            if val in (None, [], '', False): continue
            rec[name] = {'value': val,
                         'source_url': None,
                         'verified_at': None,
                         'set_by': 'agent' if name in AGENT_FIELDS else 'jonathan'}
        with open(f'state/provenance/{row["id"]}.json', 'w') as f:
            json.dump({'page_id': row['id'], 'migrated_at': '2026-06-12', 'fields': rec}, f, indent=2)
    print(f'provenance stage done: {len(rows)} files')

if __name__ == '__main__':
    stage = sys.argv[1] if len(sys.argv) > 1 else None
    {'schema': stage_schema, 'rows': stage_rows,
     'cleanup': stage_cleanup, 'provenance': stage_provenance}[stage]()
