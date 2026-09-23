# Garmin Connect import (setup)

Pulls real steps/weight/activity data from Garmin Connect via the unofficial
[`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
library, for a one-off or periodic import script — never a live part of the
Next.js app itself (see the memory note on why: no official personal-use
API exists, and this is a real, if actively-maintained, ToS-adjacent
dependency on Garmin's undocumented web API).

This directory is its own Python project, isolated from the rest of the
repo: its own venv, its own `requirements.txt`. Nothing here is imported by
the Next.js app; the eventual import script talks to Supabase directly with
the service-role key, the same way `scripts/seed.ts` does on the TypeScript
side.

## One-time setup

1. **Python 3.13** (already installed via `brew install python@3.13` —
   the repo's own system Python was 3.9, too old; the library needs 3.12+).

2. **Create the venv and install dependencies** (already done once; re-run
   if the venv ever gets deleted):

   ```bash
   cd scripts/garmin
   /opt/homebrew/bin/python3.13 -m venv .venv --copies
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Log in — run this yourself, interactively:**

   ```bash
   cd scripts/garmin
   source .venv/bin/activate
   python login_check.py
   ```

   This prompts for your Garmin email, your password (hidden input, never
   echoed or written anywhere), and an MFA code if your account has that
   on. On success it caches a token pair at
   `~/.garminconnect/garmin_tokens.json` (outside this repo, file mode
   0600) and prints today's step count as a smoke test. Every script after
   this reuses that cached token and auto-refreshes it — you should only
   need to type your password again if you explicitly log out or the
   refresh token itself expires.

   Nothing about this step can be scripted or run on your behalf: it needs
   your real Garmin password typed into a real terminal, which is exactly
   why it is its own separate step before any integration work.

## Status

- [x] Python 3.13 installed, venv created, `garminconnect` + `curl_cffi`
      installed (`requirements.txt` pinned).
- [x] `login_check.py` written.
- [ ] You've run `login_check.py` yourself and confirmed the smoke test
      printed a real step count.
- [ ] The actual import script (pulls a date range of steps/weight/
      activities, writes into `daily_metrics`/`weigh_ins`/`activities` with
      `source = 'garmin'`) — not started.
