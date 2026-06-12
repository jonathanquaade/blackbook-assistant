#!/usr/bin/env python3
"""Fix-up after migrate_phase0: the Notion API ignores select-option renames passed
by id, so renames are done as per-row value rewrites + deletion of old options."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from migrate_phase0 import api, query_all, CAP_RENAMES, RATING_RENAMES, SIZE_RENAMES, DB

rows = query_all()
print(f'{len(rows)} rows')
done = 0
for row in rows:
    p = row['properties']
    update = {}
    tags = [t['name'] for t in p['Capabilities']['multi_select']]
    if any(t in CAP_RENAMES for t in tags):
        new_tags = list(dict.fromkeys(CAP_RENAMES.get(t, t) for t in tags))
        update['Capabilities'] = {'multi_select': [{'name': t} for t in new_tags]}
    for field, renames in (('Rating', RATING_RENAMES), ('Size', SIZE_RENAMES)):
        v = p[field]['select']
        if v and v['name'] in renames:
            update[field] = {'select': {'name': renames[v['name']]}}
    if update:
        api(f'pages/{row["id"]}', {'properties': update})
        done += 1
        if done % 50 == 0: print(f'  {done} rows fixed…')
        time.sleep(0.34)
print(f'row rewrites done: {done}')

schema = api(f'databases/{DB}')
props = schema['properties']
upd = {}
for prop_name, old_names in (('Capabilities', CAP_RENAMES), ('Rating', RATING_RENAMES),
                             ('Size', SIZE_RENAMES)):
    pr = props[prop_name]
    upd[prop_name] = {pr['type']: {'options': [
        {'id': o['id'], 'name': o['name']}
        for o in pr[pr['type']]['options'] if o['name'] not in old_names]}}
if 'People 1' in props and 'People' not in props:
    upd['People 1'] = {'name': 'People'}
api(f'databases/{DB}', {'properties': upd})
print('old options deleted; relation renamed to People')
