#!/usr/bin/env python3
"""
Batch process tarot card artwork with a reference style using OpenRouter API.
Generates images using ChatGPT image generation models (e.g. openai/gpt-5-image),
then automatically center-crops and resizes them to the exact 700 x 1200 px specifications.
"""

import os
import sys
import io
import time
import argparse
import base64
import requests
from pathlib import Path
from PIL import Image

DEFAULT_PROMPT = """The second image is a tarot card. The first image is an artistic style reference.
Redraw the tarot card (second image) by merging the visual aesthetic and artistic style of the reference (first image).
Aesthetic style: faceless figures, abstract"""


def load_env():
    """Load environment variables from .env.local or .env"""
    for env_file in [".env.local", ".env"]:
        path = Path(env_file)
        if path.is_file():
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        if k not in os.environ:
                            os.environ[k.strip()] = v.strip().strip("'\"")


def image_to_base64_data_url(image_path: Path, max_dimension: int = 1024) -> str:
    """Read image, optimize resolution/size, and return data URL."""
    with Image.open(image_path) as img:
        img_rgb = img.convert("RGB")
        img_rgb.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img_rgb.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"


def crop_and_resize(image: Image.Image, target_w: int = 700, target_h: int = 1200) -> Image.Image:
    """
    Center-crops the input image to exact target_w : target_h aspect ratio,
    then resizes to (target_w, target_h) with high quality Lanczos resampling.
    """
    src_w, src_h = image.size
    target_aspect = target_w / target_h
    src_aspect = src_w / src_h

    if abs(src_aspect - target_aspect) < 1e-4:
        crop_box = (0, 0, src_w, src_h)
    elif src_aspect > target_aspect:
        # Source is wider than target -> crop left and right
        new_w = int(round(src_h * target_aspect))
        offset = (src_w - new_w) // 2
        crop_box = (offset, 0, offset + new_w, src_h)
    else:
        # Source is taller than target -> crop top and bottom
        new_h = int(round(src_w / target_aspect))
        offset = (src_h - new_h) // 2
        crop_box = (0, offset, src_w, offset + new_h)

    cropped = image.crop(crop_box)
    return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)


def parse_card_selection(selection: str, src_dir: Path) -> list[str]:
    """
    Parse card selection string, e.g.:
    - 'cups01-cups05' or 'cups01-05'
    - 'cups01,cups02,cups03'
    - 'all'
    """
    if selection.lower() == "all":
        files = sorted(src_dir.glob("*.png"))
        return [f.stem for f in files]

    results = []
    tokens = [t.strip() for t in selection.split(",") if t.strip()]
    for token in tokens:
        if "-" in token:
            parts = token.split("-")
            if len(parts) == 2:
                prefix_start = parts[0]
                end_str = parts[1]
                # Determine suite prefix (e.g. 'cups') and numbers
                prefix = "".join([c for c in prefix_start if not c.isdigit()])
                start_num = int("".join([c for c in prefix_start if c.isdigit()]))
                end_num = int("".join([c for c in end_str if c.isdigit()]))
                for n in range(start_num, end_num + 1):
                    results.append(f"{prefix}{n:02d}")
                continue
        results.append(token)
    return results


def generate_single_card(
    card_id: str,
    ref_b64: str,
    src_dir: Path,
    out_dir: Path,
    api_key: str,
    model: str,
    prompt: str,
    target_w: int,
    target_h: int,
    generate_webp: bool = True,
    max_retries: int = 3,
) -> bool:
    """Generate and save styled card image."""
    # Find source card file
    possible_src = [
        src_dir / f"{card_id}.png",
        src_dir / f"{card_id}.jpg",
        src_dir / f"{card_id}.jpeg",
        src_dir / f"{card_id}.webp",
    ]
    src_file = None
    for p in possible_src:
        if p.is_file():
            src_file = p
            break

    if not src_file:
        print(f"❌ [{card_id}] Source image not found in {src_dir}")
        return False

    print(f"\n🎨 [{card_id}] Reading source image from {src_file.name}...")
    src_b64 = image_to_base64_data_url(src_file)

    payload = {
        "model": model,
        "prompt": prompt,
        "aspect_ratio": "2:3",
        "input_references": [
            {
                "type": "image_url",
                "image_url": {"url": ref_b64},
            },
            {
                "type": "image_url",
                "image_url": {"url": src_b64},
            },
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://frankie-tarot.local",
        "X-Title": "Frankie Tarot Card Generator",
    }

    print(f"🚀 [{card_id}] Calling OpenRouter model {model}...")
    for attempt in range(1, max_retries + 1):
        try:
            start_t = time.time()
            response = requests.post(
                "https://openrouter.ai/api/v1/images",
                headers=headers,
                json=payload,
                timeout=180,
            )
            elapsed = time.time() - start_t

            if response.status_code != 200:
                print(f"⚠️ [{card_id}] Attempt {attempt} failed (status {response.status_code}): {response.text[:300]}")
                if attempt < max_retries:
                    time.sleep(3 * attempt)
                    continue
                return False

            res_data = response.json()
            if "error" in res_data:
                print(f"⚠️ [{card_id}] API Error: {res_data['error']}")
                if attempt < max_retries:
                    time.sleep(3 * attempt)
                    continue
                return False

            data_list = res_data.get("data", [])
            if not data_list or "b64_json" not in data_list[0]:
                print(f"⚠️ [{card_id}] No b64_json found in response: {res_data.keys()}")
                if attempt < max_retries:
                    time.sleep(3 * attempt)
                    continue
                return False

            raw_b64 = data_list[0]["b64_json"]
            raw_bytes = base64.b64decode(raw_b64)
            raw_img = Image.open(io.BytesIO(raw_bytes))
            print(f"✅ [{card_id}] Received generation ({raw_img.size[0]}x{raw_img.size[1]}) in {elapsed:.1f}s")

            # Post-process: Center crop and resize to exact target dimensions
            out_img = crop_and_resize(raw_img, target_w, target_h)

            out_dir.mkdir(parents=True, exist_ok=True)
            png_out = out_dir / f"{card_id}.png"
            out_img.save(png_out, format="PNG", optimize=True)
            print(f"💾 [{card_id}] Saved {png_out} ({target_w}x{target_h} px)")

            if generate_webp:
                webp_out = out_dir / f"{card_id}.webp"
                out_img.save(webp_out, format="WEBP", quality=90)
                print(f"💾 [{card_id}] Saved {webp_out}")

            return True

        except Exception as e:
            print(f"⚠️ [{card_id}] Exception during generation (attempt {attempt}): {e}")
            if attempt < max_retries:
                time.sleep(3 * attempt)
            else:
                return False

    return False


def main():
    load_env()

    parser = argparse.ArgumentParser(description="Batch process tarot cards with reference style")
    parser.add_argument(
        "--cards",
        type=str,
        default="cups01-cups05",
        help="Cards to generate, e.g. 'cups01-cups05' or 'cups01,cups02' or 'all'",
    )
    parser.add_argument(
        "--ref",
        type=str,
        default="public/images/cards_dreamy/dreamy_reference.png",
        help="Path to style reference image",
    )
    parser.add_argument(
        "--src-dir",
        type=str,
        default="public/images/cards",
        help="Directory containing original tarot card images",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default="public/images/cards_dreamy",
        help="Directory to save generated styled cards",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="openai/gpt-image-2.5-sunburst",
        help="OpenRouter model (e.g. openai/gpt-image-2.5-sunburst, openai/gpt-5-image)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=700,
        help="Target output width (default: 700)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=1200,
        help="Target output height (default: 1200)",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default=DEFAULT_PROMPT,
        help="Custom prompt string to override default",
    )
    parser.add_argument(
        "--no-webp",
        action="store_true",
        help="Do not save WebP format (only PNG)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect plan and target files without making API calls",
    )

    args = parser.parse_args()

    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        print("❌ Error: OPENROUTER_API_KEY not found in environment or .env.local")
        sys.exit(1)

    ref_path = Path(args.ref)
    if not ref_path.is_file():
        print(f"❌ Error: Reference image not found at {ref_path}")
        sys.exit(1)

    src_dir = Path(args.src_dir)
    if not src_dir.is_dir():
        print(f"❌ Error: Source directory not found at {src_dir}")
        sys.exit(1)

    out_dir = Path(args.out_dir)
    card_list = parse_card_selection(args.cards, src_dir)

    print("═══════════════════════════════════════════════════════════════════════════")
    print("🔮 Tarot Card Batch Style Transfer")
    print(f"• Model:           {args.model}")
    print(f"• Style Reference: {ref_path}")
    print(f"• Source Folder:   {src_dir}")
    print(f"• Output Folder:   {out_dir}")
    print(f"• Target Canvas:   {args.width} × {args.height} px (7:12 aspect ratio)")
    print(f"• Cards to process ({len(card_list)}): {', '.join(card_list)}")
    print("═══════════════════════════════════════════════════════════════════════════")

    if args.dry_run:
        print("\n🔍 Dry-run mode enabled. No API calls will be made.")
        for cid in card_list:
            src_file = None
            for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                candidate = src_dir / f"{cid}{ext}"
                if candidate.is_file():
                    src_file = candidate
                    break
            status = f"Found: {src_file.name}" if src_file else "NOT FOUND"
            print(f"  - {cid:10} -> {status}")
        return

    print("\n📦 Encoding reference image...")
    ref_b64 = image_to_base64_data_url(ref_path)

    success_count = 0
    fail_count = 0

    for idx, card_id in enumerate(card_list, 1):
        print(f"\n[{idx}/{len(card_list)}] Processing card {card_id}...")
        ok = generate_single_card(
            card_id=card_id,
            ref_b64=ref_b64,
            src_dir=src_dir,
            out_dir=out_dir,
            api_key=api_key,
            model=args.model,
            prompt=args.prompt,
            target_w=args.width,
            target_h=args.height,
            generate_webp=not args.no_webp,
        )
        if ok:
            success_count += 1
        else:
            fail_count += 1

        # Small delay between calls
        if idx < len(card_list):
            time.sleep(2)

    print("\n═══════════════════════════════════════════════════════════════════════════")
    print(f"✨ Batch Processing Finished: {success_count} succeeded, {fail_count} failed.")
    print(f"📁 Output files saved to: {out_dir.resolve()}")
    print("═══════════════════════════════════════════════════════════════════════════")


if __name__ == "__main__":
    main()
