#!/usr/bin/env python3
"""One-time interactive Garmin Connect login check.

Run this YOURSELF, in your own terminal — it will prompt for your Garmin
email, password (hidden input, never echoed) and, if your account has it
on, a one-time MFA code. Nothing you type here is written anywhere except
the token cache described below; no other program (including this repo's
main app) ever sees your Garmin password.

What it does:
  1. Logs in via the same mobile SSO flow the official Garmin Connect app
     uses (see cyberjunky/python-garminconnect's README).
  2. Caches an access/refresh token pair at ~/.garminconnect/garmin_tokens.json
     (file mode 0600, directory mode 0700) so every future run — including
     import_garmin.py — reuses that session and auto-refreshes it, with no
     more logins or MFA prompts.
  3. Best-effort pushes that same token to the garmin_token_cache table (see
     db/schema.sql) so the nightly GitHub Actions job can use this
     same session immediately, without waiting on a local import run first.
     A failure here is only printed, never fatal — the local file this
     script just wrote is still the important part.
  4. Makes one read-only API call as a smoke test that the token actually
     works against the real API.

Usage:
    source scripts/garmin/.venv/bin/activate
    python scripts/garmin/login_check.py
"""

import json
import os
import sys
from datetime import date
from getpass import getpass
from pathlib import Path

from dotenv import dotenv_values
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

TOKEN_STORE = str(Path(os.getenv("GARMINTOKENS", "~/.garminconnect")).expanduser())
TOKEN_FILE = Path(TOKEN_STORE) / "garmin_tokens.json"
ENV_FILE = Path(__file__).resolve().parents[2] / ".env.local"


def login() -> Garmin | None:
    # Try cached tokens first — the whole point of this script is to only
    # ever need to run the credential path once.
    try:
        client = Garmin()
        client.login(TOKEN_STORE)
        print(f"Already logged in using cached tokens at {TOKEN_STORE}.")
        return client
    except GarminConnectTooManyRequestsError as err:
        print(f"Rate limited by Garmin: {err}")
        sys.exit(1)
    except (GarminConnectAuthenticationError, GarminConnectConnectionError):
        print("No valid cached tokens yet — logging in fresh.\n")

    while True:
        try:
            email = input("Garmin email: ").strip()
            password = getpass("Garmin password (hidden): ")

            client = Garmin(
                email=email,
                password=password,
                prompt_mfa=lambda: input("MFA code from your authenticator: ").strip(),
            )
            password = None  # don't keep the plaintext around longer than needed

            client.login(TOKEN_STORE)
            print(f"\nLogin successful. Tokens cached at {TOKEN_STORE}.")
            return client

        except GarminConnectAuthenticationError:
            print("Wrong email or password — try again.\n")
            continue
        except GarminConnectTooManyRequestsError as err:
            print(f"Rate limited by Garmin: {err}")
            sys.exit(1)
        except GarminConnectConnectionError as err:
            print(f"Could not reach Garmin: {err}")
            return None
        except KeyboardInterrupt:
            print("\nCancelled.")
            return None


def push_token_to_database() -> None:
    if not TOKEN_FILE.exists():
        return
    try:
        import psycopg
        from psycopg.types.json import Jsonb

        url = (dotenv_values(ENV_FILE) if ENV_FILE.exists() else {}).get("DATABASE_URL") or os.environ.get("DATABASE_URL")
        if not url:
            return
        tokens = json.loads(TOKEN_FILE.read_text())
        with psycopg.connect(url, prepare_threshold=None) as conn:
            conn.execute(
                """insert into garmin_token_cache (id, tokens, updated_at) values (1, %s, now())
                   on conflict (id) do update set tokens = excluded.tokens, updated_at = now()""",
                (Jsonb(tokens),),
            )
        print("Also pushed this session to garmin_token_cache for the nightly cloud job.")
    except Exception as err:  # noqa: BLE001 - best effort only, never fatal
        print(f"(Could not push the session to the database yet, not fatal: {err})")


def main() -> None:
    client = login()
    if not client:
        sys.exit(1)

    today = date.today().isoformat()
    try:
        steps = client.get_daily_steps(today, today)
        print(f"\nSmoke test OK — today's steps from Garmin: {steps}")
    except Exception as err:  # noqa: BLE001 - this is just a connectivity smoke test
        print(f"\nLogged in, but the test API call failed: {err}")
        sys.exit(1)

    push_token_to_database()


if __name__ == "__main__":
    main()
