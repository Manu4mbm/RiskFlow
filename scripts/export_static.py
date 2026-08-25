"""
Exports a server-free static bundle of the scheduler app into mobile/www/,
for Capacitor to wrap as a native iOS shell.

RiskFlow's Django backend only ever renders one template and serves static
files -- there are no server calls after the initial page load (simulation,
persistence, and export/import are all client-side). So "export" here just
means: render index.html with STATIC_URL='/static/' (so {% static %} tags
produce root-relative paths against the bundle root -- which is exactly how
Capacitor serves webDir -- instead of Django's dev-server URLs), then copy
the static tree into a matching static/ subfolder. No Django process runs
inside the native app.

Run with: .venv/Scripts/python scripts/export_static.py
"""

import os
import shutil
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'riskflow.settings')

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.template.loader import render_to_string  # noqa: E402

settings.STATIC_URL = '/static/'

MOBILE_WWW = BASE_DIR / 'mobile' / 'www'
STATIC_SRC = BASE_DIR / 'scheduler' / 'static' / 'scheduler'

# PWA-only concerns with no equivalent in a locally-bundled native shell.
EXCLUDE = {'manifest.json', 'sw.js'}


def main():
    if MOBILE_WWW.exists():
        shutil.rmtree(MOBILE_WWW)
    MOBILE_WWW.mkdir(parents=True)

    html = render_to_string('scheduler/index.html')
    (MOBILE_WWW / 'index.html').write_text(html, encoding='utf-8')

    shutil.copytree(
        STATIC_SRC,
        MOBILE_WWW / 'static' / 'scheduler',
        ignore=lambda dir_, names: [n for n in names if n in EXCLUDE],
    )

    print('Exported static bundle to', MOBILE_WWW)


if __name__ == '__main__':
    main()
