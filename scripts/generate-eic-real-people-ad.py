#!/usr/bin/env python3
import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "creative-review" / "eic-real-people-dashboard-v1.png"
W = H = 1080


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)


def cover(image: Image.Image, size: tuple[int, int], focus_y: float = 0.5) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    max_top = max(0, resized.height - target_h)
    top = round(max_top * focus_y)
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded(image: Image.Image, radius: int) -> Image.Image:
    image = image.convert("RGBA")
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width, image.height), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def embedded_photo(name: str) -> Image.Image:
    text = (ROOT / "public" / "team" / f"{name}.svg").read_text()
    match = re.search(r"data:image/(?:jpeg|jpg|png);base64,([^\"']+)", text)
    if not match:
        raise RuntimeError(f"No embedded portrait found for {name}")
    return Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert("RGB")


def draw_spaced_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: str, fnt: ImageFont.FreeTypeFont, spacing: int = 3) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=fnt, fill=fill)
        x += draw.textlength(char, font=fnt) + spacing


def main() -> None:
    canvas = Image.new("RGB", (W, H), "#07192c")
    px = canvas.load()
    for y in range(H):
        t = y / (H - 1)
        for x in range(W):
            edge = x / (W - 1)
            px[x, y] = (
                round(7 + 6 * t),
                round(25 + 22 * t + 5 * edge),
                round(44 + 35 * t + 8 * edge),
            )

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((760, -170, 1250, 320), fill=(27, 194, 214, 60))
    gd.ellipse((-180, 790, 310, 1280), fill=(35, 119, 207, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow)
    draw = ImageDraw.Draw(canvas)

    logo = Image.open(ROOT / "public" / "logo-white.png").convert("RGBA")
    logo.thumbnail((210, 70), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (58, 48))

    badge = (720, 54, 1024, 108)
    draw.rounded_rectangle(badge, radius=27, fill="#0f3957", outline="#2ed2dd", width=2)
    label = "WHITE-LABEL PAID MEDIA"
    bf = font(17, True)
    tw = draw.textlength(label, font=bf)
    draw.text((badge[0] + (badge[2] - badge[0] - tw) / 2, 70), label, font=bf, fill="#dffbff")

    draw_spaced_text(draw, (58, 152), "YOUR AGENCY CAN", "#36d6df", font(18, True), spacing=4)
    headline = "Sell paid ads\nwithout building\nthe department."
    draw.multiline_text((54, 190), headline, font=font(48, True), fill="#ffffff", spacing=5)
    draw.multiline_text(
        (58, 382),
        "Strategy, execution, and reporting\nunder your brand.",
        font=font(20),
        fill="#c8d8e6",
        spacing=5,
    )

    # Actual public EIC dashboard screenshot, shown as a real product card.
    dashboard = Image.open(ROOT / "public" / "proof" / "dashboard" / "dashboard-overview.jpg").convert("RGB")
    dashboard = cover(dashboard, (474, 296), focus_y=0.0)
    card_shadow = Image.new("RGBA", (506, 370), (0, 0, 0, 0))
    sd = ImageDraw.Draw(card_shadow)
    sd.rounded_rectangle((18, 24, 492, 350), radius=28, fill=(0, 0, 0, 120))
    card_shadow = card_shadow.filter(ImageFilter.GaussianBlur(16))
    canvas.alpha_composite(card_shadow, (535, 124))
    draw.rounded_rectangle((552, 136, 1038, 486), radius=26, fill="#f7fbfd", outline="#61e0e7", width=2)
    canvas.alpha_composite(rounded(dashboard, 18), (558, 142))
    draw.rounded_rectangle((577, 448, 812, 478), radius=15, fill="#07192c")
    draw.text((593, 454), "ACTUAL EIC REPORTING", font=font(14, True), fill="#66e2e8")

    # Real website portraits of EIC's two co-founders.
    portrait_specs = [
        ("dustin-trout", "DUSTIN TROUT", 58),
        ("mike-patterson", "MIKE PATTERSON", 308),
    ]
    for key, name, x in portrait_specs:
        photo = cover(embedded_photo(key), (224, 342), focus_y=0.12)
        shadow = Image.new("RGBA", (246, 366), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((10, 12, 236, 356), radius=28, fill=(0, 0, 0, 115))
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)), (x - 10, 526))
        canvas.alpha_composite(rounded(photo, 24), (x, 530))
        draw.rounded_rectangle((x + 12, 833, x + 212, 863), radius=15, fill=(7, 25, 44, 225))
        nf = font(14, True)
        nw = draw.textlength(name, font=nf)
        draw.text((x + 112 - nw / 2, 839), name, font=nf, fill="#ffffff")

    draw_spaced_text(draw, (580, 550), "REAL PEOPLE. REAL DELIVERY.", "#36d6df", font(18, True), spacing=2)
    draw.multiline_text((576, 592), "The paid media team\nyour agency does not\nhave to hire.", font=font(40, True), fill="#ffffff", spacing=4)
    draw.text((580, 750), "You own the client relationship.\nWe handle the work behind the scenes.", font=font(22), fill="#c8d8e6", spacing=7)

    draw.rounded_rectangle((576, 850, 1018, 924), radius=37, fill="#35d4df")
    cta = "BOOK A 15-MINUTE FIT CHECK"
    cf = font(20, True)
    cw = draw.textlength(cta, font=cf)
    draw.text((797 - cw / 2, 876), cta, font=cf, fill="#061827")
    draw.text((580, 946), "eic.agency/white-label-digital-advertising", font=font(18, True), fill="#ffffff")
    draw.text((58, 1005), "EIC AGENCY  •  PAID MEDIA INFRASTRUCTURE FOR AGENCIES", font=font(15, True), fill="#8eabc0")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT, quality=96, optimize=True)
    print(f"created={OUT}")
    print(f"size={Image.open(OUT).size}")


if __name__ == "__main__":
    main()
