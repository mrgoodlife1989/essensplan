# Essensplan – Wochenplan & Einkaufsliste

Eine installierbare Web-App (PWA) für Android und iPhone: Wochenplan mit Fotos und Rezepten, Wechsel zwischen den Wochen und eine gemeinsame, abhakbare Einkaufsliste. Kein App Store nötig – ein Link, den ihr beide als App-Icon auf den Homescreen legt.

## Aufbau

- `index.html`, `styles.css`, `app.js` – die App
- `sync.js` + `config.js` – Speicher der Einkaufsliste (Firebase für beide gemeinsam, sonst nur lokal)
- `weeks/index.json` + `weeks/<Montag>.json` – die Wochenpläne (werden jede Woche automatisch ergänzt)
- `img/` – Fotos der Gerichte
- `sw.js`, `manifest.webmanifest`, `icons/` – Offline-Fähigkeit und App-Icon

## Veröffentlichen auf GitHub Pages

1. Auf GitHub ein neues Repository anlegen (z. B. `essensplan`) und alle Dateien dieses Ordners hochladen.
2. Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)` → Speichern.
3. Nach 1–2 Minuten ist die App unter `https://<dein-name>.github.io/essensplan/` erreichbar.

## Gemeinsame Einkaufsliste mit Firebase einrichten (einmalig, kostenlos)

1. Auf <https://console.firebase.google.com> ein Projekt anlegen (Google Analytics kann aus bleiben).
2. **Build → Authentication → Get started → Sign-in method → „Anonymous“** aktivieren.
3. **Build → Firestore Database → Datenbank erstellen** (Produktionsmodus, Standort z. B. `europe-west3`).
4. Unter **Firestore → Regeln** den Inhalt von `firestore.rules` einfügen und **Veröffentlichen**.
5. **Projekteinstellungen (Zahnrad) → Deine Apps → Web-App (</>)** hinzufügen und das angezeigte `firebaseConfig`-Objekt kopieren.
6. In `config.js` `window.FIREBASE_CONFIG = { ... }` mit diesen Werten setzen und `window.HOUSEHOLD_ID` auf eine lange zufällige Zeichenkette (z. B. `kueche-7f3k9q2xw8`).
7. Unter **Authentication → Settings → Authorized domains** die Domain `<dein-name>.github.io` hinzufügen.

Danach sehen beide Handys Häkchen und eigene Artikel in Echtzeit. Ohne Firebase funktioniert die App auch, speichert die Häkchen aber nur auf dem jeweiligen Gerät (Hinweisbanner oben).

## Auf dem Handy installieren

- **Android (Chrome):** Link öffnen → Menü ⋮ → **„Zum Startbildschirm hinzufügen“** bzw. **„App installieren“**.
- **iPhone (Safari):** Link öffnen → **Teilen-Symbol** → **„Zum Home-Bildschirm“**.

## Neue Woche hinzufügen

Eine neue Datei `weeks/JJJJ-MM-TT.json` (Datum = Montag) im gleichen Format ablegen und den Eintrag in `weeks/index.json` ergänzen. Das übernimmt künftig der wöchentliche automatische Plan.
