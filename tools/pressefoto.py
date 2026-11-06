#!/usr/bin/env python3
"""Pressefoto in die Bildersammlung aufnehmen.

Erzeugt aus einem Quellbild drei Dateien unter assets/presse/fiedel/:
  <slug>.jpg     Download für Pressemitteilungen (max. 1920 px breit)
  <slug>.webp    Webseite (max. 1280 px breit)
  <slug>-s.webp  Vorschau (max. 560 px breit)
und trägt das Bild in data/pressefotos.json ein (bestehender Eintrag mit gleichem slug wird ersetzt).

Beispiel:
  python3 tools/pressefoto.py foto.png rede-plenum-3 bundestag \
      "Rede im Plenum des Bundestages" --en "Speech in the Bundestag" --tags "bundestag,rede,gesetz"

Benötigt Pillow (pip install pillow).
"""
import argparse, json, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'presse' / 'fiedel'
MANIFEST = ROOT / 'data' / 'pressefotos.json'
THEMEN = ['portraet', 'bundestag', 'ministerium', 'presse', 'sicherheit', 'einsatz', 'migration', 'vorort', 'berlin']


def fit(im, w):
    if im.width <= w:
        return im
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def build(src, slug):
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert('RGB')
    fit(im, 1920).save(OUT / f'{slug}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)
    fit(im, 1280).save(OUT / f'{slug}.webp', 'WEBP', quality=80, method=6)
    fit(im, 560).save(OUT / f'{slug}-s.webp', 'WEBP', quality=74, method=6)
    return im.size


def add(entry):
    data = json.loads(MANIFEST.read_text('utf-8')) if MANIFEST.exists() else []
    data = [e for e in data if e['id'] != entry['id']] + [entry]
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', 'utf-8')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('quelle'); ap.add_argument('slug'); ap.add_argument('thema', choices=THEMEN); ap.add_argument('titel')
    ap.add_argument('--en', default=''); ap.add_argument('--tags', default='')
    a = ap.parse_args()
    w, h = build(a.quelle, a.slug)
    add({'id': a.slug, 'thema': a.thema, 'titel': a.titel, 'titelEn': a.en or a.titel,
         'tags': [x.strip() for x in a.tags.split(',') if x.strip()], 'w': min(w, 1920), 'h': round(h * min(w, 1920) / w)})
    print('ok', a.slug)
