#!/usr/bin/env python3
"""scrape.py - portfolio image scraper with per-platform strategies. Stdlib only.

Crystallized knowledge (2026-06-12 intake runs). When a strategy fails on a new
site: fix the STRATEGY here, retry, commit. Don't solve it inline in a session.

Platform lessons encoded:
- Squarespace: gallery images live in data-src attributes; the first plain
  <img src> is usually a site-wide banner (trap).
- Framer: content is client-side rendered; static HTML may have homepage imgs
  but project pages are empty; og:image is one site-wide asset (trap). If this
  tool returns nothing for a Framer site, use the browser (rendered DOM).
- Figma: public files yield a thumbnail + a live embed via the oEmbed API
  (needs a browser User-Agent header).
- WordPress: images under wp-content/uploads in plain src.
- Generic: og:image first, then largest <img>.
Self-checks: content-hash dedupe (catches the same-banner-N-times failure),
tiny-file filter (logos/icons), report instead of silently uploading junk.

Usage:
  scrape.py URL --out DIR [--caption TEXT] [--limit N]
      downloads images, appends to DIR/manifest.json, prints a JSON report
  scrape.py URL --probe
      no download: report platform, strategy, candidate count
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()

def detect(url, html):
    if 'figma.com' in url: return 'figma'
    if 'squarespace-cdn.com' in html or 'squarespace.com' in html: return 'squarespace'
    if 'framerusercontent.com' in html: return 'framer'
    if 'wp-content' in html: return 'wordpress'
    return 'generic'

def candidates(url, html, platform):
    if platform == 'figma':
        oembed = 'https://www.figma.com/api/oembed?url=' + urllib.parse.quote(url, safe='')
        meta = json.loads(fetch(oembed))
        return [{'src': meta['thumbnail_url'], 'link': url,
                 'hint': meta.get('title', 'Figma file'), 'embed': url}]
    if platform == 'squarespace':
        srcs = re.findall(r'data-src="(https://images\.squarespace-cdn\.com[^"]+)"', html)
        return [{'src': s, 'link': url, 'hint': None} for s in dict.fromkeys(srcs)]
    if platform == 'wordpress':
        srcs = re.findall(r'src="(https?://[^"]*wp-content/uploads/[^"]+?\.(?:jpg|jpeg|png|webp))"', html)
        return [{'src': s, 'link': url, 'hint': os.path.splitext(os.path.basename(s))[0]}
                for s in dict.fromkeys(srcs)]
    if platform == 'framer':
        srcs = re.findall(r'src="(https://framerusercontent\.com/images/[^"?]+)', html)
        return [{'src': s, 'link': url, 'hint': None} for s in dict.fromkeys(srcs)]
    # generic
    out = []
    m = re.search(r'property="og:image"\s+content="([^"]+)"', html) or \
        re.search(r'content="([^"]+)"\s+property="og:image"', html)
    if m: out.append({'src': m.group(1), 'link': url, 'hint': 'og:image (verify: may be site banner)'})
    for s in dict.fromkeys(re.findall(r'<img[^>]+src="(https?://[^"]+?\.(?:jpg|jpeg|png|webp))[^"]*"', html)):
        out.append({'src': s, 'link': url, 'hint': None})
    return out

def main():
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    url = a[0]
    probe = '--probe' in a
    out_dir = a[a.index('--out') + 1] if '--out' in a else None
    caption = a[a.index('--caption') + 1] if '--caption' in a else None
    limit = int(a[a.index('--limit') + 1]) if '--limit' in a else 6

    html = fetch(url).decode('utf-8', 'replace')
    platform = detect(url, html)
    cands = candidates(url, html, platform)
    report = {'url': url, 'platform': platform, 'candidates': len(cands)}
    if platform == 'framer' and not cands:
        report['warning'] = 'Framer with empty static HTML: use the browser (rendered DOM)'
    if probe or not out_dir:
        print(json.dumps(report, indent=1)); return

    os.makedirs(out_dir, exist_ok=True)
    mp = os.path.join(out_dir, 'manifest.json')
    manifest = json.load(open(mp)) if os.path.exists(mp) else []
    seen_hashes = set()
    for f in manifest:
        p = os.path.join(out_dir, f['file'])
        if os.path.exists(p):
            seen_hashes.add(hashlib.sha256(open(p, 'rb').read()).hexdigest())
    n_existing = len([f for f in os.listdir(out_dir) if f.startswith('site-')])
    saved, skipped = [], 0
    for c in cands:
        if len(saved) >= limit: break
        try:
            data = fetch(c['src'] if '?' in c['src'] else c['src'] + '?width=1600')
        except Exception:
            try: data = fetch(c['src'])
            except Exception: continue
        if len(data) < 40_000:  # logos, icons, favicons
            skipped += 1; continue
        h = hashlib.sha256(data).hexdigest()
        if h in seen_hashes:  # the same-banner trap
            skipped += 1; continue
        seen_hashes.add(h)
        n_existing += 1
        ext = os.path.splitext(c['src'].split('?')[0])[1] or '.jpg'
        fn = f'site-{n_existing:02d}{ext}'
        open(os.path.join(out_dir, fn), 'wb').write(data)
        entry = {'file': fn, 'source_url': c['src'].split('?')[0],
                 'caption': caption or c['hint'] or '', 'link': c['link'],
                 'captured_at': time.strftime('%Y-%m-%d')}
        if c.get('embed'): entry['embed'] = c['embed']
        manifest.append(entry)
        saved.append(fn)
        time.sleep(1)
    json.dump(manifest, open(mp, 'w'), indent=2)
    report.update({'saved': saved, 'skipped_dupes_or_tiny': skipped,
                   'needs_caption': [m['file'] for m in manifest if not m.get('caption')]})
    print(json.dumps(report, indent=1))

if __name__ == '__main__':
    main()
