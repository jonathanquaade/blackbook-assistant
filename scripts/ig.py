#!/usr/bin/env python3
"""ig.py - Instagram capture via persistent, Jonathan-logged-in Playwright profiles.

WHY THIS EXISTS (Jonathan approved 2026-06-14): logged-out Instagram caps images at
640px and blocks reel/carousel video. Full-res images + video need a logged-in
session. The plan: Jonathan logs into a PERSISTENT Playwright profile ONCE; afterwards
capture is read-only against that saved session.

MULTI-PROFILE (2026-06-16): two saved sessions, selected with --profile:
  - scout    -> state/ig-profile-scout/   (DEFAULT; the disposable scouting account)
  - personal -> state/ig-profile/          (Jonathan's real account; FALLBACK only)
The default is `scout` ON PURPOSE: an accidental run hits the disposable account, never
his personal one. Use --profile personal only when a target blocks the scout account.

HARD RULES (SPEC §4.0 + CLAUDE.md browser rules):
- The AGENT NEVER TYPES CREDENTIALS. `ig.py login` only opens a window; Jonathan
  authenticates himself. These are his sessions, agent read-and-download only.
- Read-only: never like/follow/comment/DM/post. Scrolling + opening posts only.
- Any challenge / CAPTCHA / checkpoint / logged-out state => STOP the whole run,
  log it, report. NEVER attempt to solve a challenge.
- Profile dirs are gitignored (they hold session cookies). Never commit.

THROTTLE DISCIPLINE (2026-06-16, after the fernandaruiz soft-throttle on 06-14:
full-res served ONCE, then the grid degraded to avatars-only). The tool now polices
itself from disk so even a fresh, context-free session cannot hammer a profile:
  - state/ig-throttle.json (gitignored) records, per profile-account: last run, runs
    today, per-target last-grab + result, and an escalating cooldown after any
    degradation. `grab` REFUSES to run while a gate is active and prints when it is
    next allowed.
  - Conservative caps for a real-ish account: <=3 grabs/day, >=20 min between any two
    grabs, a target not re-grabbed within 24h.
  - Human-paced + jittered: randomized scroll waits, scroll distances, download
    spacing. No metronome intervals (uniform timing is an automation fingerprint).
  - Scrolls only as far as --limit needs, then stops.
  - EARLY degradation bail: if the grid serves only sub-30KB avatars (no full-res
    after a streak of tries), stop immediately, record a degradation, and extend the
    next cooldown. Never push through degradation.
  - grab runs HEADED by default (a real window is less detectable; you are watching).
  - --force bypasses the SPACING/daily gates for a supervised run; it still records and
    still honours an active degradation cooldown. Use only when Jonathan is present.

Usage:
  ig.py login   [--profile scout|personal]    open a headed browser; Jonathan logs in
  ig.py status  [--profile scout|personal]     report whether the saved session is live
  ig.py grab PROFILE_URL --out DIR [--caption TEXT] [--limit N] [--posts]
             [--profile scout|personal] [--headless] [--force]
      capture full-res grid images (and with --posts, open each post for the best
      image / video) into DIR + manifest, read-only. Default headed, profile scout.
"""
import json, os, re, sys, time, random, hashlib
from datetime import datetime, timezone, timedelta

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THROTTLE_FILE = os.path.join(REPO, 'state', 'ig-throttle.json')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36')

# --- throttle caps (deliberately conservative; a flagged account is a real cost) ---
DAILY_CAP = 3                 # grabs per profile-account per day
MIN_RUN_SPACING_MIN = 20      # between any two grabs on a profile
MIN_TARGET_SPACING_H = 24     # do not re-grab the same target within this window
COOLDOWN_BASE_MIN = 60        # first degradation -> 1h; doubles each consecutive one
COOLDOWN_MAX_MIN = 24 * 60    # capped at 24h
SCROLL_STEPS_MAX = 12         # hard ceiling on grid scrolls
DEGRADE_REJECT_STREAK = 5     # consecutive sub-floor downloads w/ 0 kept -> degraded


def profile_dir(name):
    """personal -> the legacy state/ig-profile (already logged in); anything else ->
    state/ig-profile-<name>. Keeps Jonathan's existing personal session in place."""
    if name == 'personal':
        return os.path.join(REPO, 'state', 'ig-profile')
    return os.path.join(REPO, 'state', f'ig-profile-{name}')


def _ctx(p, pdir, headless):
    return p.chromium.launch_persistent_context(
        pdir, headless=headless, user_agent=UA,
        viewport={'width': 1440, 'height': 2200})


def _now():
    return datetime.now(timezone.utc)


def _parse(ts):
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def _jsleep(lo, hi):
    """Jittered sleep. Uniform intervals are an automation fingerprint; randomise."""
    time.sleep(random.uniform(lo, hi))


# --- throttle state -------------------------------------------------------------
def _load_throttle():
    if os.path.exists(THROTTLE_FILE):
        try:
            return json.load(open(THROTTLE_FILE))
        except Exception:
            pass
    return {}


def _save_throttle(d):
    os.makedirs(os.path.dirname(THROTTLE_FILE), exist_ok=True)
    json.dump(d, open(THROTTLE_FILE, 'w'), indent=2)


def _gate(profile, target_url, force):
    """Return (None) if the grab is allowed, or a refusal string if a gate is active.
    The degradation cooldown is ALWAYS honoured, even under --force."""
    st = _load_throttle().get(profile, {})
    now = _now()

    cd = _parse(st.get('cooldown_until') or '')
    if cd and now < cd:
        mins = int((cd - now).total_seconds() // 60) + 1
        return (f'COOLDOWN active for profile "{profile}" after a prior degradation: '
                f'~{mins} min left (until {cd.isoformat()}). Not running. This gate '
                f'holds even under --force; let the account rest.')

    if force:
        return None  # spacing + daily caps waived for a supervised run

    last = _parse(st.get('last_run') or '')
    if last and now - last < timedelta(minutes=MIN_RUN_SPACING_MIN):
        mins = int((timedelta(minutes=MIN_RUN_SPACING_MIN) - (now - last)).total_seconds() // 60) + 1
        return (f'Too soon: last grab on "{profile}" was {int((now-last).total_seconds()//60)} '
                f'min ago; min spacing is {MIN_RUN_SPACING_MIN} min (~{mins} more). '
                f'Use --force only if you are supervising.')

    rt = st.get('runs_today', {})
    today = now.strftime('%Y-%m-%d')
    if rt.get('date') == today and rt.get('count', 0) >= DAILY_CAP:
        return (f'Daily cap reached for "{profile}": {rt["count"]}/{DAILY_CAP} grabs '
                f'today. Resume tomorrow (or --force if supervising).')

    tgt = st.get('targets', {}).get(target_url.split('?')[0])
    if tgt:
        lg = _parse(tgt.get('last_grabbed') or '')
        if lg and now - lg < timedelta(hours=MIN_TARGET_SPACING_H):
            hrs = int((timedelta(hours=MIN_TARGET_SPACING_H) - (now - lg)).total_seconds() // 3600) + 1
            return (f'Target already grabbed {int((now-lg).total_seconds()//3600)}h ago '
                    f'(min re-grab spacing {MIN_TARGET_SPACING_H}h, ~{hrs}h left). '
                    f'Skipping to avoid re-hitting it.')
    return None


def _record(profile, target_url, degraded, got):
    """Persist the outcome: bump run counters; on degradation escalate the cooldown,
    on success reset the degradation streak."""
    d = _load_throttle()
    st = d.setdefault(profile, {})
    now = _now()
    today = now.strftime('%Y-%m-%d')

    st['last_run'] = now.isoformat()
    rt = st.get('runs_today', {})
    st['runs_today'] = {'date': today,
                        'count': (rt.get('count', 0) + 1) if rt.get('date') == today else 1}

    tgts = st.setdefault('targets', {})
    key = target_url.split('?')[0]
    tgt = tgts.setdefault(key, {})
    tgt['last_grabbed'] = now.isoformat()
    tgt['last_result'] = 'avatars' if degraded else ('full' if got else 'empty')

    if degraded:
        n = tgt.get('degradations', 0) + 1
        tgt['degradations'] = n
        back = min(COOLDOWN_BASE_MIN * (2 ** (n - 1)), COOLDOWN_MAX_MIN)
        st['cooldown_until'] = (now + timedelta(minutes=back)).isoformat()
        print(f'DEGRADATION recorded for {key} (#{n}); cooldown {back} min set on '
              f'profile "{profile}".', file=sys.stderr)
    else:
        tgt['degradations'] = 0
    _save_throttle(d)


# --- browser helpers ------------------------------------------------------------
def _dismiss(page):
    """Clear cookie/consent banner + login modal (same approach as scrape.shot)."""
    for nm in ['Allow all cookies', 'Decline optional cookies', 'Accept all', 'Accept']:
        try:
            b = page.get_by_role('button', name=nm, exact=True).first
            if b.is_visible(timeout=500):
                b.click(timeout=1500); page.wait_for_timeout(2000); break
        except Exception:
            pass


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


def cmd_login(profile, timeout_s=360):
    """Open a headed window and POLL for the login cookie (no stdin needed, so it
    works even when launched via the harness `!` prefix). Jonathan logs in manually;
    we detect the sessionid cookie, then save + close."""
    from playwright.sync_api import sync_playwright
    pdir = profile_dir(profile)
    os.makedirs(pdir, exist_ok=True)
    print(f'Opening a Chromium window to Instagram for profile "{profile}". Log in '
          'MANUALLY there (the agent never types your credentials). I will detect when '
          'you are logged in and save the session automatically.')
    with sync_playwright() as p:
        ctx = _ctx(p, pdir, headless=False)
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
        ctx.close()  # persists cookies to pdir
    if ok:
        print(f'detected login, session saved to {os.path.relpath(pdir, REPO)}/. '
              f'Run: ig.py status --profile {profile}')
    else:
        print(f'timed out after {timeout_s}s without detecting login - re-run '
              f'ig.py login --profile {profile} and finish logging in within the window.')


def cmd_status(profile):
    from playwright.sync_api import sync_playwright
    pdir = profile_dir(profile)
    if not os.path.isdir(pdir):
        print(f'no saved profile "{profile}" - run: ig.py login --profile {profile}'); return
    with sync_playwright() as p:
        ctx = _ctx(p, pdir, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto('https://www.instagram.com/', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(2500)
        print(f'[{profile}] ' + ('logged OUT (re-run ig.py login)' if _challenged(page)
                                  else 'logged in, session valid'))
        ctx.close()


def _download(req, url, out_dir, n, seen, caption, link):
    # fetch THROUGH the browser context (carries the logged-in session + headers);
    # urllib gets 403'd by Instagram's CDN.
    try:
        r = req.get(url, timeout=30000)
        if r.status != 200:
            return None
        data = r.body()
    except Exception:
        return None
    h = hashlib.sha256(data).hexdigest()
    if h in seen or len(data) < 30_000:   # <30KB = avatar/profile pic, drop it
        return None
    seen.add(h)
    ext = '.mp4' if '.mp4' in url.split('?')[0] else '.jpg'
    fn = f'site-{n:02d}{ext}'
    open(os.path.join(out_dir, fn), 'wb').write(data)
    return {'file': fn, 'source_url': url.split('?')[0], 'caption': caption,
            'link': link, 'captured_at': time.strftime('%Y-%m-%d'),
            'type': 'video' if ext == '.mp4' else 'image'}


def cmd_grab(profile_url, out_dir, caption, limit, posts, headless, profile, force):
    from playwright.sync_api import sync_playwright
    pdir = profile_dir(profile)
    if not os.path.isdir(pdir):
        sys.exit(f'no saved profile "{profile}" - run: ig.py login --profile {profile} first')

    refusal = _gate(profile, profile_url, force)
    if refusal:
        sys.exit('THROTTLE GATE: ' + refusal)

    os.makedirs(out_dir, exist_ok=True)
    mp = os.path.join(out_dir, 'manifest.json')
    manifest = json.load(open(mp)) if os.path.exists(mp) else []
    seen = set()
    for e in manifest:
        if not e.get('file'):
            continue
        fp = os.path.join(out_dir, e['file'])
        if os.path.exists(fp):
            seen.add(hashlib.sha256(open(fp, 'rb').read()).hexdigest())
    idxs = [int(re.match(r'site-(\d+)', f).group(1)) for f in os.listdir(out_dir) if re.match(r'site-\d+', f)]
    n = max(idxs) if idxs else 0

    added = []
    degraded = False
    with sync_playwright() as p:
        ctx = _ctx(p, pdir, headless=headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(profile_url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(3000)
        _dismiss(page)
        if _challenged(page):
            ctx.close()
            _record(profile, profile_url, degraded=False, got=False)
            sys.exit('CHALLENGE/logged-out on Instagram - STOPPING. Re-run '
                     f'ig.py login --profile {profile}, do not retry blindly.')
        # The grid is VIRTUALISED: off-screen thumbnails unload, so collect srcs at
        # EACH scroll step and accumulate (a single end-of-scroll snapshot misses
        # most). The logged-in grid serves full-res (~1080px); the 30KB floor in
        # _download drops the small avatar/profile pics. Scroll only as far as --limit
        # needs (aim for ~3x candidates), jittered + human-paced; bail on challenge.
        acc = {}
        for step in range(SCROLL_STEPS_MAX):
            cur = page.evaluate(
                "() => Array.from(document.querySelectorAll('img'))"
                ".map(i=>i.currentSrc||i.src).filter(s=>s.includes('cdninstagram'))")
            for s in cur:
                acc[s.split('?')[0]] = s
            if len(acc) >= limit * 3:   # enough candidates; stop scrolling
                break
            page.mouse.wheel(0, random.randint(700, 1200))
            _jsleep(2.5, 5.0)
            if _challenged(page):
                ctx.close()
                _record(profile, profile_url, degraded=False, got=False)
                sys.exit('CHALLENGE mid-scroll - STOPPING.')

        # Download with EARLY degradation bail: if the grid is serving only avatars
        # (everything fails the 30KB floor) and nothing has been kept after a streak
        # of tries, conclude soft-throttle and STOP rather than hammering on.
        tried = 0
        reject_streak = 0
        for s in acc.values():
            if len(added) >= limit:
                break
            tried += 1
            rec = _download(ctx.request, s, out_dir, n + 1, seen, caption, profile_url)
            if rec:
                n += 1
                added.append(rec)
                reject_streak = 0
            else:
                reject_streak += 1
            if not added and reject_streak >= DEGRADE_REJECT_STREAK:
                degraded = True
                print('EARLY BAIL: grid served only avatars/sub-floor images - soft '
                      'throttle. Stopping before hammering.', file=sys.stderr)
                break
            _jsleep(3.0, 8.0)

        if not added and not degraded and acc:
            # had candidate URLs but kept nothing = degraded grid
            degraded = True
        if not added:
            print('WARNING: no images >=30KB captured - grid soft-throttled or only '
                  'avatars loaded. Let the session rest; cooldown applied.', file=sys.stderr)
        ctx.close()

    json.dump(manifest, open(mp, 'w'), indent=2)
    _record(profile, profile_url, degraded=degraded, got=bool(added))
    print(json.dumps({'profile': profile,
                      'grabbed': len(added),
                      'images': sum(1 for r in added if r['type'] == 'image'),
                      'videos': sum(1 for r in added if r['type'] == 'video'),
                      'degraded': degraded,
                      'files': [r['file'] for r in added]}, indent=1))


def _opt(a, flag, default=None):
    return a[a.index(flag) + 1] if flag in a else default


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    profile = _opt(a, '--profile', 'scout')
    if cmd == 'login':
        cmd_login(profile)
    elif cmd == 'status':
        cmd_status(profile)
    elif cmd == 'grab':
        out = _opt(a, '--out')
        if not out:
            sys.exit('grab needs --out DIR')
        cap = _opt(a, '--caption', 'Instagram')
        lim = int(_opt(a, '--limit', 6))
        cmd_grab(a[1], out, cap, lim,
                 posts='--posts' in a,
                 headless='--headless' in a,
                 profile=profile,
                 force='--force' in a)
    else:
        sys.exit(__doc__)
