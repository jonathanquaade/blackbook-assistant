#!/usr/bin/env python3
"""scrape.py - portfolio image scraper with per-platform strategies.

Stdlib only, EXCEPT --render which needs playwright (pip install playwright;
python3 -m playwright install chromium). Installed 2026-06-12.

Crystallized knowledge (2026-06-12 intake runs). When a strategy fails on a new
site: fix the STRATEGY here, retry, commit. Don't solve it inline in a session.

Platform lessons encoded:
- Squarespace: gallery images live in data-src attributes; the first plain
  <img src> is usually a site-wide banner (trap).
- Framer: content is client-side rendered; static HTML may have homepage imgs
  but project pages are empty; og:image is one site-wide asset (trap). Use
  --render for Framer project pages: the rendered DOM has the real imgs with
  width queries (keep them, they are already full-res, e.g. ?width=2880).
- Passcoded case studies (--render --passcode CODE): fill input[type=password],
  Enter first, then fall back to clicking a view/enter/continue button (sites
  like branevsky.com use a styled VIEW CASE STUDY div, Enter alone may not
  submit). Codes live in state/passcodes.json, Jonathan-provided only.
- Figma: designers use SECTIONS to organise work; actual screens are FRAME
  nodes nested inside sections, sometimes 3-4 levels deep. Never export the
  section itself (huge canvas, unintelligible image). Strategy: (1) get file
  at depth=2 to list pages and top-level sections, (2) query each section
  with /files/{key}/nodes to find FRAME children (375x812 = mobile, 1440x900
  = desktop), (3) export those frames via /images/{key}?ids=...&scale=2.
  Frames can sit at any depth inside sections — traverse until you find FRAME
  nodes; do not assume a fixed nesting level. The oEmbed thumbnail is one
  low-res canvas overview — useful as a single context image, not the primary
  source. Figma CDN blocks headless Playwright
  (CloudFront 403); use the REST API with FIGMA_API_KEY in .env instead.
  FIGMA_API_KEY is a personal access token (Figma Settings > Security), stored
  in .env, read-only access to files the account can see.
- WordPress: images under wp-content/uploads in plain src.
- Generic: og:image first, then largest <img>.
Self-checks: content-hash dedupe (catches the same-banner-N-times failure),
tiny-file filter (logos/icons), report instead of silently uploading junk.

Usage:
  scrape.py URL --out DIR [--caption TEXT] [--limit N]
      downloads images, appends to DIR/manifest.json, prints a JSON report
  scrape.py URL --probe
      no download: report platform, strategy, candidate count
  scrape.py URL --render [--passcode CODE] [--text-out FILE] [--probe|--out DIR ...]
      Playwright-rendered DOM: JS sites (Framer), passcoded case studies.
      --text-out also saves the page's rendered text (case study copy).
  scrape.py shot URL --out DIR --caption TEXT [--full]
      screenshot a page (website homepage / IG profile) as a body memory-anchor;
      appends to manifest as a context_shot image.
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

def rendered_candidates(url, passcode=None, text_out=None):
    """Playwright path: real DOM after JS render and optional passcode entry."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={'width': 1440, 'height': 2400})
        # domcontentloaded + fixed settle, NOT networkidle: media-heavy portfolios
        # (3D, video, autoplay) keep the network busy forever and networkidle times
        # out (vmragona.com, 2026-06-13). Lesson: never wait for networkidle here.
        page.goto(url, wait_until='domcontentloaded', timeout=45000)
        page.wait_for_timeout(3000)
        if passcode and page.locator('input[type=password]').count():
            pw = page.locator('input[type=password]').first
            pw.fill(passcode)
            pw.press('Enter')
            page.wait_for_timeout(1500)
            if page.locator('input[type=password]').count():
                btn = page.locator('button, [role=button], a, div[class*=framer]').filter(
                    has_text=re.compile(r'view|enter|continue|unlock|submit', re.I))
                if btn.count():
                    btn.first.click()
            try: page.wait_for_load_state('networkidle', timeout=20000)
            except Exception: pass
            page.wait_for_timeout(1500)
        for _ in range(8):  # trigger lazy loads
            page.mouse.wheel(0, 1600)
            page.wait_for_timeout(350)
        # currentSrc, not the src attribute: lazy-loaded galleries keep a tiny
        # placeholder in src and the real full-res URL in currentSrc/srcset
        # (salazraki.com, 2026-06-13). Reading src missed every full image.
        srcs = page.evaluate(
            "() => Array.from(document.querySelectorAll('img'))"
            ".map(i => i.currentSrc || i.src).filter(Boolean)")
        if text_out:
            open(text_out, 'w').write(page.inner_text('body'))
        b.close()
    return [{'src': s, 'link': url, 'hint': None}
            for s in dict.fromkeys(srcs) if s.startswith('http')]

def shot(url, out_dir, caption, full=False):
    """Screenshot a page (website homepage or IG profile) as a memory anchor.

    Jonathan (2026-06-13): every entry should carry a screenshot of the person's
    website AND their Instagram profile in the body — it helps him remember who
    they are and what their work looks like at a glance. Viewport shot by default
    (the hero/grid), --full for the whole page. Saved as the next site-NN, appended
    to manifest with the caption + link back to the page."""
    from playwright.sync_api import sync_playwright
    import hashlib
    os.makedirs(out_dir, exist_ok=True)
    mp = os.path.join(out_dir, 'manifest.json')
    manifest = json.load(open(mp)) if os.path.exists(mp) else []
    # max existing index + 1, extension-agnostic, so a .png shot never collides
    # with an existing site-NN.jpg (counting files breaks across extensions)
    idxs = [int(re.match(r'site-(\d+)', f).group(1))
            for f in os.listdir(out_dir) if re.match(r'site-\d+', f)]
    n = max(idxs) if idxs else 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(url, wait_until='domcontentloaded', timeout=45000)
        page.wait_for_timeout(3500)
        # ALWAYS clear the cookie/consent banner + login modal BEFORE the shot, then
        # WAIT for it to animate away (Jonathan 2026-06-14: IG shots still showed the
        # banner). Try exact known button names first (IG: "Allow all cookies" /
        # "Decline optional cookies"), then a generic text fallback.
        names = ['Allow all cookies', 'Decline optional cookies', 'Accept all',
                 'Accept All Cookies', 'Accept', 'Allow all', 'Decline', 'Only allow essential',
                 'I accept', 'Got it', 'Agree']
        dismissed = False
        for nm in names:
            try:
                btn = page.get_by_role('button', name=nm, exact=True).first
                if btn.is_visible(timeout=500):
                    btn.click(timeout=1500); dismissed = True
                    page.wait_for_timeout(2500)  # let the banner animate out
                    break
            except Exception: pass
        if not dismissed:  # generic fallback: any button whose text looks like consent
            consent = re.compile(r'(allow all|accept all|accept|decline|agree|got it)', re.I)
            for btn in page.get_by_role('button').all():
                try:
                    t = (btn.inner_text(timeout=300) or '').strip()
                    if t and consent.search(t) and btn.is_visible():
                        btn.click(timeout=1000); page.wait_for_timeout(2500); break
                except Exception: pass
        try: page.keyboard.press('Escape')  # close IG login modal
        except Exception: pass
        page.wait_for_timeout(2000)  # settle before screenshot
        n += 1
        fn = f'site-{n:02d}.png'
        page.screenshot(path=os.path.join(out_dir, fn), full_page=full)
        b.close()
    manifest.append({'file': fn, 'source_url': url, 'caption': caption,
                     'link': url, 'captured_at': time.strftime('%Y-%m-%d'),
                     'context_shot': True})
    json.dump(manifest, open(mp, 'w'), indent=2)
    print(json.dumps({'shot': fn, 'url': url, 'caption': caption}, indent=1))

def main():
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == 'shot':
        out_dir = a[a.index('--out') + 1] if '--out' in a else None
        caption = a[a.index('--caption') + 1] if '--caption' in a else 'Screenshot'
        shot(a[1], out_dir, caption, full='--full' in a)
        return
    url = a[0]
    probe = '--probe' in a
    out_dir = a[a.index('--out') + 1] if '--out' in a else None
    caption = a[a.index('--caption') + 1] if '--caption' in a else None
    limit = int(a[a.index('--limit') + 1]) if '--limit' in a else 6
    render = '--render' in a
    passcode = a[a.index('--passcode') + 1] if '--passcode' in a else None
    text_out = a[a.index('--text-out') + 1] if '--text-out' in a else None

    if render:
        platform = 'rendered'
        cands = rendered_candidates(url, passcode, text_out)
    else:
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
        if not f.get('file'): continue  # embeds/bookmarks have no local file
        p = os.path.join(out_dir, f['file'])
        if os.path.exists(p):
            seen_hashes.add(hashlib.sha256(open(p, 'rb').read()).hexdigest())
    _idxs = [int(re.match(r'site-(\d+)', f).group(1))
             for f in os.listdir(out_dir) if re.match(r'site-\d+', f)]
    n_existing = max(_idxs) if _idxs else 0  # max index, not count (ext-agnostic)
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
