#!/usr/bin/env python3
"""Normalisiert die Wochendateien für die App.

- hängt Einkaufslisten aus tools/shop-<id>.txt an (falls vorhanden)
- ergänzt Gerichte, die nur in anderen Wochen definiert sind (Meal-Prep-Reste)
- übernimmt Fotos + Bildnachweise aus img/credits.json
- schreibt weeks/index.json
- bricht mit Fehler ab, wenn ein Gericht fehlt oder keine Zutaten/Schritte hat
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEEKS = ROOT / "weeks"
QTY = re.compile(r"^((?:ca\.\s*)?[\d½¼¾/,.\-–]+\s*(?:g|kg|ml|l|EL|TL|Stück|Stk\.?|Dosen?|Bund|Gläser?|Glas|Packungen?|Pck\.?|Zehen?|Knollen?|Stangen?|Zweige?|Becher|Scheiben)?\b\.?)\s+(.*)$")
CATS = {"OBST & GEMÜSE": "Obst & Gemüse", "MILCHPRODUKTE": "Milchprodukte",
        "TROCKENWAREN & GRUNDNAHRUNGSMITTEL": "Trockenwaren & Grundnahrungsmittel",
        "FLEISCH & FISCH": "Fleisch & Fisch", "SONSTIGES": "Sonstiges"}


def parse_shop(text):
    cats, cur = [], None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        key = line.rstrip(":").upper()
        norm = next((v for k, v in CATS.items() if key.startswith(k.split(" ")[0]) and k.split(" & ")[0] in key), None)
        if not line.startswith("-") and norm:
            cur = {"cat": norm, "items": []}
            cats.append(cur)
            continue
        if line.startswith("-") and cur is not None:
            body = line[1:].strip()
            if " – " in body:
                name, qty = body.split(" – ", 1)
            else:
                m = QTY.match(body)
                qty, name = (m.group(1), m.group(2)) if m else ("", body)
            cur["items"].append({"name": name.strip(), "qty": qty.strip()})
    return cats


def main():
    files = sorted(p for p in WEEKS.glob("2*.json"))
    weeks = {p.stem: json.loads(p.read_text()) for p in files}
    credits = {}
    cp = ROOT / "img" / "credits.json"
    if cp.exists():
        credits = json.loads(cp.read_text())
    pool = {}
    for w in weeks.values():
        pool.update(w.get("dishes", {}))
    errors = []
    for wid, w in weeks.items():
        shop = ROOT / "tools" / f"shop-{wid}.txt"
        if shop.exists():
            w["shopping"] = parse_shop(shop.read_text())
        w.setdefault("shopping", [])
        refs = []
        for d in w["days"]:
            for meal in ("lunch", "dinner"):
                refs.append(d[meal]["dish"])
                refs += d[meal].get("cookDay", [])
        for r in refs:
            if r not in w["dishes"]:
                if r in pool:
                    w["dishes"][r] = json.loads(json.dumps(pool[r]))
                else:
                    errors.append(f"{wid}: Gericht '{r}' fehlt")
        for did, dish in w["dishes"].items():
            if did in credits:
                dish["img"] = credits[did]["img"]
                dish["credit"] = credits[did]["credit"]
            if not dish.get("ingredients") or not dish.get("steps"):
                errors.append(f"{wid}: '{did}' ohne Zutaten/Zubereitung")
            if not (ROOT / dish.get("img", "-")).exists():
                print(f"  Hinweis: {wid}/{did} ohne Foto")
        if not w["shopping"]:
            print(f"  Hinweis: {wid} ohne Einkaufsliste")
        (WEEKS / f"{wid}.json").write_text(json.dumps(w, ensure_ascii=False, indent=1))
        n = sum(len(c["items"]) for c in w["shopping"])
        print(f"{wid}: {len(w['days'])} Tage, {len(w['dishes'])} Gerichte, {n} Einkaufsartikel")
    index = {"weeks": [{"id": wid, "label": w["label"]} for wid, w in sorted(weeks.items())]}
    (WEEKS / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    if errors:
        print("FEHLER:\n" + "\n".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
