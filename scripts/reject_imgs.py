#!/usr/bin/env python3
"""Tombstone reviewer-flagged manifest images (mark rejected, never re-propose).

Usage: reject_imgs.py <assets_dir> "<reason>" <file1> [file2 ...]

Sets {"rejected": true, "reject_reason": ...} on each named manifest entry so
keeper.py upload skips it and a future pass never re-adds it. Run keeper.py
upload <page-id> <assets_dir> afterwards to rebuild the Work section.

Lesson (2026-06-17): the Mouthwash Studio Sanity CDN (project id ew1yzffi) is
SHARED across every studio project, so harvesting image IDs from a project page's
HTML source grabs wrong-project content (Mesura, Air Company, Literary Sport,
Comme des Garcons all showed up mislabeled as the target project across Jason
Annas, Sundai Johnson and Diego Martinez). NEVER trust CDN URLs scraped from page
source on a shared-CDN site; screenshot/--render and eyeball each file before
committing it. This tool cleans up after that trap.
"""
import json
import sys

if len(sys.argv) < 4:
    sys.exit(__doc__)
assets_dir = sys.argv[1].rstrip('/')
reason = sys.argv[2]
targets = set(sys.argv[3:])
path = f'{assets_dir}/manifest.json'
manifest = json.load(open(path))
hit = 0
for item in manifest:
    if item.get('file') in targets:
        item['rejected'] = True
        item['reject_reason'] = reason
        hit += 1
with open(path, 'w') as fh:
    json.dump(manifest, fh, indent=2)
missing = targets - {i.get('file') for i in manifest}
print(f'rejected {hit} of {len(targets)} in {path}')
if missing:
    print('NOT FOUND (check names):', sorted(missing))
