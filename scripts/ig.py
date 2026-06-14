#!/usr/bin/env python3
"""ig.py - Instagram capture via a persistent, Jonathan-logged-in Playwright profile.

WHY THIS EXISTS (Jonathan approved 2026-06-14): logged-out Instagram caps images at
640px and blocks reel/carousel video. Full-res images + video need a logged-in
session. The plan: Jonathan logs into a PERSISTENT Playwright profile ONCE (his
account now, a scouting account later); afterwards capture is read-only against that
saved session.

HARD RULES (SPEC §4.0 + CLAUDE.md browser rules):
- The AGENT NEVER TYPES CREDENTIALS. `ig.py login` only opens a window; Jonathan
  authenticates himself. This is his session, agent read-and-download only.
- Read-only: never like/follow/comment/DM/post. Scrolling + opening posts only.
- Caps per run: <= 10 profiles, 2-6 s between actions, <= ~30 navigations.
- Any challenge / CAPTCHA / checkpoint / logged-out state => STOP the whole run,
  log it, report. NEVER attempt to solve a challenge.
- Profile dir state/ig-profile/ is gitignored (holds session cookies). Never commit.

Usage:
  ig.py login            open a headed browser; Jonathan logs in, then presses Enter
  ig.py status           report whether the saved session is logged in
  ig.py grab PROFILE_URL --out DIR [--caption TEXT] [--limit N] [--posts] [--headed]
      capture full-res grid images (and with --posts, open each post for the
      best image / video) into DIR + manifest, read-only. Default headless.
"""
import json, os, re, sys, time, hashlib, urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILE_DIR = os.path.join(REPO, 'state', 'ig-profile')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36')

def _ctx(p, headless):
    return p.chromium.launch_persistent_context(
        PROFILE_DIR, headless=headless, user_agent=UA,
        viewport={'width': 1440, 'height': 2200})

def _dismiss(page):
    """Clear cookie/consent banner + login modal (same approach as scrape.shot)."""
    for nm in ['Allow all cookies', 'Decline optional cookies', 'Accept all', 'Accept']:
        try:
            b = page.get_by_role('button', name=nm, exact=True).first
            if b.is_visible(timeout=500):
                b.click(timeout=1500); page.wait_for_timeout(2000); break
        except Exception: pass

def _challenged(page):
    """True if Instagram is showing a login wall / checkpoint / challenge."""
    u = page.url.lower()
    if any(s in u for s in ('/accounts/login', '/challenge', '/checkpoint')):
        return True
    try:
        body = page.inner_text('body')[:3000].lower()
    except Exception:
        return False
    return any(s in body for s in (
        'log in to instagram', 'suspicious', 'we detected', 'confirm it\'s you',
        'enter the code', 'help us confirm'))

def _has_session(ctx):
    """Logged in once Instagram sets a non-empty sessionid cookie."""
    for c in ctx.cookies():
        if c.get('name') == 'sessionid' and c.get('value') and 'instagram' in c.get('domain', ''):
            return True
    return False

def cmd_login(timeout_s=360):
    """Open a headed window and POLL for the login cookie (no stdin needed, so it
    works even when launched via the harness `!` prefix). Jonathan logs in manually;
    we detect the sessionid cookie, then save + close."""
    from playwright.sync_api import sync_playwright
    os.makedirs(PROFILE_DIR, exist_ok=True)
    print('Opening a Chromium window to Instagram. Log in MANUALLY there (the agent '
          'never types your credentials). I will detect when you are logged in and '
          'save the session automatically - no need to press anything here.')
    with sync_playwright() as p:
        ctx = _ctx(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto('https://www.instagram.com/accounts/login/', wait_until='domcontentloaded', timeout=60000)
        deadline = time.time() + timeout_s
        ok = False
        while time.time() < deadline:
            if _has_session(ctx):
                ok = True
                time.sleep(3)  # let IG finish setting cookies
                break
            time.sleep(3)
        ctx.close()  # persists cookies to PROFILE_DIR
    if ok:
        print('detected login, session saved to state/ig-profile/. Run: ig.py status')
    else:
        print(f'timed out after {timeout_s}s without detecting login - re-run ig.py login '
              'and finish logging in within the window.')

def cmd_status():
    from playwright.sync_api import sync_playwright
    if not os.path.isdir(PROFILE_DIR):
        print('no saved profile - run: ig.py login'); return
    with sync_playwright() as p:
        ctx = _ctx(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto('https://www.instagram.com/', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(2500)
        print('logged OUT (re-run ig.py login)' if _challenged(page) else 'logged in, session valid')
        ctx.close()

def _download(url, out_dir, n, seen, caption, link):
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()
    except Exception:
        return None
    h = hashlib.sha256(data).hexdigest()
    if h in seen or len(data) < 30_000:
        return None
    seen.add(h)
    ext = '.mp4' if '.mp4' in url.split('?')[0] else '.jpg'
    fn = f'site-{n:02d}{ext}'
    open(os.path.join(out_dir, fn), 'wb').write(data)
    return {'file': fn, 'source_url': url.split('?')[0], 'caption': caption,
            'link': link, 'captured_at': time.strftime('%Y-%m-%d'),
            'type': 'video' if ext == '.mp4' else 'image'}

def cmd_grab(profile_url, out_dir, caption, limit, posts, headed):
    from playwright.sync_api import sync_playwright
    if not os.path.isdir(PROFILE_DIR):
        sys.exit('no saved profile - run: ig.py login first')
    os.makedirs(out_dir, exist_ok=True)
    mp = os.path.join(out_dir, 'manifest.json')
    manifest = json.load(open(mp)) if os.path.exists(mp) else []
    seen = set()
    for e in manifest:
        if not e.get('file'): continue
        fp = os.path.join(out_dir, e['file'])
        if os.path.exists(fp): seen.add(hashlib.sha256(open(fp, 'rb').read()).hexdigest())
    idxs = [int(re.match(r'site-(\d+)', f).group(1)) for f in os.listdir(out_dir) if re.match(r'site-\d+', f)]
    n = max(idxs) if idxs else 0
    added = []
    with sync_playwright() as p:
        ctx = _ctx(p, headless=not headed)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(profile_url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(3000)
        _dismiss(page)
        if _challenged(page):
            ctx.close()
            sys.exit('CHALLENGE/logged-out on Instagram - STOPPING. Re-run ig.py login, '
                     'do not retry blindly. (read-only, no challenge solving)')
        # collect post links from the grid
        for _ in range(4):
            page.mouse.wheel(0, 2000); page.wait_for_timeout(2500)  # 2-6s cadence
        post_links = page.evaluate(
            "() => [...new Set(Array.from(document.querySelectorAll('a[href]'))"
            ".map(a=>a.getAttribute('href')).filter(h=>h&&(h.includes('/p/')||h.includes('/reel/'))))]")
        if posts:
            base = 'https://www.instagram.com'
            for href in post_links:
                if len(added) >= limit: break
                page.goto(base + href, wait_until='domcontentloaded', timeout=45000)
                page.wait_for_timeout(2500)
                if _challenged(page):
                    ctx.close(); sys.exit('CHALLENGE mid-run - STOPPING, session may be flagged.')
                media = page.evaluate(r"""() => {
                  const v = document.querySelector('video');
                  if (v && (v.src||'').startsWith('http')) return {kind:'video', src:v.src};
                  let best=null,bw=0;
                  document.querySelectorAll('img').forEach(i=>{const w=i.naturalWidth||0;
                    const s=i.currentSrc||i.src||''; if(s.includes('cdninstagram')&&w>bw){bw=w;best=s}});
                  return best?{kind:'image', src:best, w:bw}:null;
                }""")
                if media:
                    rec = _download(media['src'], out_dir, n+1, seen, caption, base+href)
                    if rec: n += 1; added.append(rec); manifest.append(rec)
                time.sleep(3)
        else:
            srcs = page.evaluate(
                "() => Array.from(document.querySelectorAll('img'))"
                ".map(i=>({s:i.currentSrc||i.src,w:i.naturalWidth}))"
                ".filter(o=>o.s.includes('cdninstagram')&&o.w>=600).map(o=>o.s)")
            for s in list(dict.fromkeys(srcs)):
                if len(added) >= limit: break
                rec = _download(s, out_dir, n+1, seen, caption, profile_url)
                if rec: n += 1; added.append(rec)
                time.sleep(1)
        ctx.close()
    json.dump(manifest, open(mp, 'w'), indent=2)
    print(json.dumps({'grabbed': len(added),
                      'images': sum(1 for r in added if r['type'] == 'image'),
                      'videos': sum(1 for r in added if r['type'] == 'video'),
                      'files': [r['file'] for r in added]}, indent=1))

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    cmd = a[0]
    if cmd == 'login': cmd_login()
    elif cmd == 'status': cmd_status()
    elif cmd == 'grab':
        out = a[a.index('--out') + 1] if '--out' in a else None
        cap = a[a.index('--caption') + 1] if '--caption' in a else 'Instagram'
        lim = int(a[a.index('--limit') + 1]) if '--limit' in a else 6
        if not out: sys.exit('grab needs --out DIR')
        cmd_grab(a[1], out, cap, lim, posts='--posts' in a, headed='--headed' in a)
    else: sys.exit(__doc__)
