from pathlib import Path
import json
import re

import pymupdf


SOURCE_DIR = Path("/Users/gyglostudio/_SynchDATA/DATA/podklady Codex/publikace/publikace CONCEPT")
REPO_DIR = Path("/Users/gyglostudio/_SynchDATA/DATA/reColor")
OUT_DIR = REPO_DIR / "publikace/publications/concept"
COVER_DIR = REPO_DIR / "publikace/assets/concept/covers"
DPI = 150
JPEG_QUALITY = 82


TITLE_OVERRIDES = {
    "AN_MDA_Asko_2026-27_RGB.pdf": "Akční nabídka MDA - Asko",
    "AN_MDA_Mobelix_2026-27_RGB.pdf": "Akční nabídka MDA - Möbelix",
    "Akcni_nabidka_MDA_2_2026_REGION_RGB.pdf": "Akční nabídka MDA 2 - Region",
    "Akcni_nabidka_MDA_2_2026_drevotrust_RGB.pdf": "Akční nabídka MDA 2 - Dřevotrust",
    "Akcni_nabidka_MDA_2_2026_hornbach_RGB.pdf": "Akční nabídka MDA 2 - Hornbach",
    "Akcni_nabidka_MDA_2_2026_sconto_RGB.pdf": "Akční nabídka MDA 2 - Sconto",
    "LO7300-KitchenBookCZ_2026-09_fD_RGB.pdf": "Kitchen Book CZ",
    "LO7300-KitchenBookEN_2026-09_fD_RGB.pdf": "Kitchen Book EN",
    "LO7300-KitchenBookPL_2026-09_fD_RGB.pdf": "Kitchen Book PL",
    "LO7300-KitchenBookSK_2026-09_fD_RGB.pdf": "Kitchen Book SK",
    "SDA_katalog_2026_tisk-digital_fD_RGB.pdf": "SDA katalog 2026",
}


DATE_OVERRIDES = {
    "LO7300-KitchenBookCZ_2026-09_fD_RGB.pdf": "2026-09",
}


def preview_name(source_name: str) -> str:
    stem = re.sub(r"_RGB$", "", Path(source_name).stem)
    stem = re.sub(r"[-_]?preview[-_]?s?$", "", stem, flags=re.IGNORECASE)
    return f"{stem}_preview.pdf"


def cover_name(pdf_name: str) -> str:
    return f"{Path(pdf_name).stem}.jpg"


def infer_date(source_name: str) -> str:
    if source_name in DATE_OVERRIDES:
        return DATE_OVERRIDES[source_name]
    match = re.search(r"(20\d{2})[-_](0[1-9]|1[0-2])", source_name)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return "2026-08"


def render_pdf(source_path: Path, out_path: Path, cover_path: Path) -> dict:
    source = pymupdf.open(source_path)
    result = pymupdf.open()
    matrix = pymupdf.Matrix(DPI / 72, DPI / 72)

    for index, page in enumerate(source):
        trim = page.trimbox
        if trim.is_empty or trim.width <= 0 or trim.height <= 0:
            trim = page.cropbox
        if trim.is_empty or trim.width <= 0 or trim.height <= 0:
            trim = page.rect

        pix = page.get_pixmap(matrix=matrix, clip=trim, colorspace=pymupdf.csRGB, alpha=False)
        image = pix.tobytes("jpeg", jpg_quality=JPEG_QUALITY)
        new_page = result.new_page(width=trim.width, height=trim.height)
        new_page.insert_image(new_page.rect, stream=image)

        if index == 0:
            cover_matrix = pymupdf.Matrix(360 / trim.width, 360 / trim.width)
            cover_pix = page.get_pixmap(matrix=cover_matrix, clip=trim, colorspace=pymupdf.csRGB, alpha=False)
            cover_path.write_bytes(cover_pix.tobytes("jpeg", jpg_quality=86))

    result.save(out_path, deflate=True, garbage=4, clean=True)
    result.close()
    page_count = source.page_count
    source.close()
    return {
        "pages": page_count,
        "size": out_path.stat().st_size,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COVER_DIR.mkdir(parents=True, exist_ok=True)

    publications = []
    for source_path in sorted(SOURCE_DIR.glob("*.pdf")):
        pdf_name = preview_name(source_path.name)
        cover = cover_name(pdf_name)
        out_path = OUT_DIR / pdf_name
        cover_path = COVER_DIR / cover
        info = render_pdf(source_path, out_path, cover_path)
        publications.append(
            {
                "title": TITLE_OVERRIDES.get(source_path.name, source_path.stem.replace("_", " ")),
                "file": pdf_name,
                "folder": "concept",
                "cover": f"assets/concept/covers/{cover}",
                "date": infer_date(source_path.name),
                "pages": info["pages"],
                "source": source_path.name,
            }
        )
        print(f"{source_path.name} -> {pdf_name} ({info['pages']} pages, {info['size'] / 1024 / 1024:.1f} MB)")

    manifest_path = REPO_DIR / "publikace/concept-publications.json"
    manifest_path.write_text(json.dumps(publications, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
