# Statický PDF flipbook

Složka `publikace/` je samostatná statická webová aplikace pro zobrazování PDF publikací jako flipbook.

## Struktura

- `index.html` - seznam publikací pro URL `/publikace/`
- `viewer.html` - PDF viewer pro URL `/publikace/viewer.html?file=nazev.pdf`
- `assets/` - CSS a JavaScript aplikace
- `assets/vendor/` - lokální kopie PDF.js a StPageFlip
- `publications/` - PDF soubory
- `publications.json` - jednoduchý manifest pro seznam publikací

## Přidání nové publikace

1. Nahraj PDF do složky `publications/`.
2. Přidej záznam do `publications.json`:

```json
{
  "title": "Název publikace",
  "file": "nazev-souboru.pdf",
  "description": "Krátký popis",
  "date": "2026-05"
}
```

Název souboru v poli `file` musí přesně odpovídat PDF v adresáři `publications/`.

## Nasazení přes FTP

1. Připoj se přes FTP/SFTP k hostingu pro doménu.
2. V kořeni webu vytvoř složku `publikace`, pokud tam ještě není.
3. Nahraj celý obsah této lokální složky `publikace/` do vzdálené složky `/publikace/`.
4. Ověř:
   - `https://recolor.cz/publikace/`
   - `https://recolor.cz/publikace/viewer.html?file=SeedService-KatalogOdrud_2026-05_preview2s.pdf`

## Poznámky

Aplikace nepotřebuje databázi ani serverový backend. PDF i JavaScriptové knihovny se načítají lokálně ze statické složky `publikace/`.
