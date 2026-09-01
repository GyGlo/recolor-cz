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
- `../api/concept-upload.js` - Vercel funkce pro autorizaci uploadu PDF do Blob
- `../api/concept-publications.js` - Vercel funkce pro čtení a zápis CONCEPT manifestu

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

Na Vercelu používá editační mód Vercel Blob:

- PDF se po zadání hesla nahrává přímo z prohlížeče do Blob úložiště.
- Manifest publikací se ukládá jako `recolor/concept/publications.json` ve Vercel Blob.
- PDF soubory se ukládají pod prefix `recolor/concept/`, aby mohl stejný Blob store bezpečně sloužit více projektům.
- Viewer otevírá nové publikace přes `url` parametr, například `/publikace/viewer/?url=...&file=nazev_preview.pdf`.

Pro fungování uploadu musí být u projektu na Vercelu připojený Blob store s proměnnou `BLOB_READ_WRITE_TOKEN`. Volitelně lze nastavit `CONCEPT_EDITOR_PASSWORD_HASH`; když chybí, použije se hash hesla domluveného pro tento projekt.

Na čistě statickém FTP hostingu bez Vercel funkcí zůstává možné publikace nasazovat ručně přes soubory ve složce `publications/concept/` a manifest `concept-publications.json`.

Editační mód je chráněný heslem zadaným v klientské aplikaci. Na čistě statickém hostingu jde o jednoduchou ochranu před běžnými návštěvníky, ne o plnohodnotné serverové zabezpečení.

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
