"""Prepare item photos for the app: centre-crop to 4:3, resize to 800x600, save as WebP.

Usage (from app/):  python3 -I data/tools/prepare_menu_images.py <source-folder> menu-images

Each output keeps the source file's name (which must be the item's name) with a .webp
extension, and stays under the 400 KB limit the tests enforce. Source files are not changed.
"""
import pathlib
import sys

from PIL import Image, ImageOps

SIZE = (800, 600)
LIMIT = 400 * 1024
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def main(source: str, target: str) -> None:
    src, out = pathlib.Path(source), pathlib.Path(target)
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in EXTENSIONS)
    if not files:
        raise SystemExit(f"no images found in {src}")
    for path in files:
        image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")  # honour phone rotation
        image = ImageOps.fit(image, SIZE, Image.Resampling.LANCZOS)
        dest = out / f"{path.stem}.webp"
        for quality in (82, 74, 66, 58):
            image.save(dest, "WEBP", quality=quality, method=6)
            if dest.stat().st_size <= LIMIT:
                break
        print(f"{dest.name}: {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
