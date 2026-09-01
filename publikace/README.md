# Statický PDF flipbook

Složka `publikace/` je samostatná statická webová aplikace pro zobrazování PDF publikací jako flipbook.

## Struktura

- `index.html` - seznam publikací pro URL `/publikace/`
- `concept/index.html` - seznam CONCEPT publikací pro URL `/publikace/concept/`
- `viewer.html` - PDF viewer pro URL `/publikace/viewer.html?file=nazev.pdf`
- `assets/` - CSS a JavaScript aplikace
- `assets/vendor/` - lokální kopie PDF.js a StPageFlip
- `publications/` - PDF soubory
- `publications/concept/` - PDF soubory CONCEPT publikací
- `publications.json` - jednoduchý manifest pro seznam publikací
- `concept-publications.json` - manifest CONCEPT publikací

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

Veřejné názvy PDF publikací udržujeme stabilní a končí slovem `preview`, například:

```text
SeedService-KatalogOdrud_2026-05_preview.pdf
Akcni_nabidka_MDA_2_2026_sconto_preview.pdf
```

Pokud dodaný soubor končí například `preview-s.pdf`, `preview2s.pdf` nebo `preview3s.pdf`, při nasazení se uloží pod čistý název `preview.pdf`.

## CONCEPT publikace

CONCEPT stránka je dostupná na:

```text
https://www.recolor.cz/publikace/concept/
```

Jednotlivé CONCEPT publikace se otevírají přes stejný viewer s parametrem `folder=concept`:

```text
https://www.recolor.cz/publikace/viewer/?folder=concept&file=Akcni_nabidka_MDA_2_2026_sconto_preview.pdf
```

Editační mód na statickém webu zapne tlačítko `Upravit` nebo parametr:

```text
https://www.recolor.cz/publikace/concept/?edit=1
```

Protože aplikace běží bez backendu a databáze, editační mód ukládá změny jen lokálně v prohlížeči. Pro trvalé nasazení je potřeba PDF a exportovaný `concept-publications.json` uložit do repozitáře a nasadit přes GitHub/Vercel nebo FTP.

## Nasazení přes FTP

1. Připoj se přes FTP/SFTP k hostingu pro doménu.
2. V kořeni webu vytvoř složku `publikace`, pokud tam ještě není.
3. Nahraj celý obsah této lokální složky `publikace/` do vzdálené složky `/publikace/`.
4. Ověř:
   - `https://recolor.cz/publikace/`
   - `https://recolor.cz/publikace/concept/`
   - `https://recolor.cz/publikace/viewer.html?file=SeedService-KatalogOdrud_2026-05_preview.pdf`

## Poznámky

Aplikace nepotřebuje databázi ani serverový backend. PDF i JavaScriptové knihovny se načítají lokálně ze statické složky `publikace/`.
