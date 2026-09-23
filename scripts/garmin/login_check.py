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
     the real import script we'll build next — reuses that session and
     auto-refreshes it, with no more logins or MFA prompts.
  3. Prints today's step count as a smoke test that the token actually
     works against the real API.

Usage:
    source scripts/garmin/.venv/bin/activate
    python scripts/garmin/login_check.py
"""

import os
import sys
from datetime import date
from getpass import getpass
from pathlib import Path

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

TOKEN_STORE = str(Path(os.getenv("GARMINTOKENS", "~/.garminconnect")).expanduser())


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


if __name__ == "__main__":
    main()
