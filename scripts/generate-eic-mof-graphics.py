#!/usr/bin/env python3
import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "creative-review" / "eic-mof"
W = H = 1080
PAPER = "#f2f8f7"
INK = "#0a1818"
COPY = "#354142"
GREEN = "#07583f"
GREEN_2 = "#0c6c4e"
TEAL = "#1f9e7e"
PALE = "#dfeceb"
ORANGE = "#f45513"
WHITE = "#ffffff"

REGULAR = "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(BOLD if bold else REGULAR, size)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, minimum: int = 16, bold: bool = True):
    for size in range(start, minimum - 1, -1):
        candidate = font(size, bold)
        if draw.textlength(text, font=candidate) <= max_width:
            return candidate
    return font(minimum, bold)


def cover(image: Image.Image, size: tuple[int, int], focus_x: float = 0.5, focus_y: float = 0.5) -> Image.Image:
    tw, th = size
    scale = max(tw / image.width, th / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = round(max(0, resized.width - tw) * focus_x)
    top = round(max(0, resized.height - th) * focus_y)
    return resized.crop((left, top, left + tw, top + th))


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


def brand_background(variant: int) -> Image.Image:
    canvas = Image.new("RGBA", (W, H), PAPER)
    shapes = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shapes)
    if variant == 1:
        draw.ellipse((680, -430, 1360, 240), fill=GREEN)
        draw.ellipse((804, -320, 1380, 210), fill=GREEN_2)
        draw.ellipse((620, 560, 1430, 1320), fill=GREEN)
        draw.ellipse((770, 650, 1370, 1210), fill=GREEN_2)
    elif variant == 2:
        draw.ellipse((770, -470, 1450, 240), fill=GREEN)
        draw.ellipse((860, -350, 1450, 190), fill=GREEN_2)
        draw.ellipse((-330, 760, 420, 1390), fill=GREEN)
        draw.ellipse((-210, 880, 330, 1320), fill=GREEN_2)
    else:
        draw.ellipse((770, -420, 1430, 230), fill=GREEN)
        draw.ellipse((840, -310, 1370, 170), fill=GREEN_2)
        draw.ellipse((720, 650, 1410, 1320), fill=GREEN)
        draw.ellipse((840, 780, 1360, 1240), fill=GREEN_2)
    canvas = Image.alpha_composite(canvas, shapes.filter(ImageFilter.GaussianBlur(2)))
    return canvas


def place_logo(canvas: Image.Image) -> None:
    logo = Image.open(ROOT / "public" / "logo.png").convert("RGBA")
    bbox = logo.getbbox()
    logo = logo.crop(bbox)
    logo.thumbnail((118, 84), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (72, 60))


def text_block(draw: ImageDraw.ImageDraw, kicker: str, first: str, second: str, y: int = 178) -> int:
    draw.text((72, y), kicker.upper(), font=font(18, True), fill=TEAL)
    draw.text((70, y + 42), first, font=font(56), fill=COPY)
    draw.text((70, y + 105), second, font=font(63, True), fill=INK)
    return y + 184


def cta(draw: ImageDraw.ImageDraw, label: str, x: int = 72, y: int = 926, width: int = 540) -> None:
    draw.rounded_rectangle((x, y, x + width, y + 78), radius=39, fill=ORANGE)
    f = fit_font(draw, label.upper(), width - 105, 27, 19)
    draw.text((x + 34, y + 23), label.upper(), font=f, fill=WHITE)
    draw.text((x + width - 58, y + 17), "→", font=font(35, True), fill=WHITE)


def dashboard_device(canvas: Image.Image, x: int, y: int, w: int, h: int) -> None:
    screenshot = Image.open(ROOT / "public" / "proof" / "dashboard" / "dashboard-overview.jpg").convert("RGB")
    screenshot = cover(screenshot, (w - 46, h - 58), focus_y=0.04)
    shadow = Image.new("RGBA", (w + 70, h + 80), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((35, 35, w + 35, h + 35), radius=26, fill=(3, 20, 15, 90))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)), (x - 35, y - 28))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=27, fill="#172120")
    draw.rounded_rectangle((x + 7, y + 7, x + w - 7, y + h - 7), radius=21, fill=WHITE)
    draw.ellipse((x + 21, y + 18, x + 31, y + 28), fill="#ff6b5f")
    draw.ellipse((x + 38, y + 18, x + 48, y + 28), fill="#f7bf47")
    draw.ellipse((x + 55, y + 18, x + 65, y + 28), fill="#2fbd74")
    canvas.alpha_composite(rounded(screenshot, 12), (x + 23, y + 42))


def portrait_card(canvas: Image.Image, photo: Image.Image, x: int, y: int, w: int, h: int, name: str, role: str, focus_y: float) -> None:
    draw = ImageDraw.Draw(canvas)
    shadow = Image.new("RGBA", (w + 30, h + 36), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((15, 15, w + 15, h + 15), radius=25, fill=(0, 30, 20, 60))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)), (x - 15, y - 9))
    portrait = cover(photo, (w, h), focus_y=focus_y)
    canvas.alpha_composite(rounded(portrait, 22), (x, y))
    draw.rounded_rectangle((x + 10, y + h - 66, x + w - 10, y + h - 10), radius=17, fill=(7, 88, 63, 230))
    nf = fit_font(draw, name, w - 30, 15, 11)
    rf = fit_font(draw, role, w - 30, 11, 9, False)
    nw = draw.textlength(name, font=nf)
    rw = draw.textlength(role, font=rf)
    draw.text((x + w / 2 - nw / 2, y + h - 58), name, font=nf, fill=WHITE)
    draw.text((x + w / 2 - rw / 2, y + h - 34), role, font=rf, fill="#d9fff2")


def reporting_proof() -> None:
    canvas = brand_background(1)
    draw = ImageDraw.Draw(canvas)
    place_logo(canvas)
    lower = text_block(draw, "Client-ready reporting", "Clear answers for clients.", "Ready before the meeting.")
    draw.text((72, lower + 10), "Actual EIC reporting, packaged so your agency can lead", font=font(24), fill=COPY)
    draw.text((72, lower + 42), "the conversation instead of rebuilding the report.", font=font(24), fill=COPY)
    dashboard_device(canvas, 154, 474, 818, 390)
    draw.rounded_rectangle((716, 820, 958, 866), radius=23, fill=GREEN)
    draw.text((743, 833), "ACTUAL EIC DASHBOARD", font=font(14, True), fill=WHITE)
    cta(draw, "See the system", width=430)
    save(canvas, "01-mof-reporting-proof.png")


def team_delivery() -> None:
    canvas = brand_background(2)
    draw = ImageDraw.Draw(canvas)
    place_logo(canvas)
    lower = text_block(draw, "Real people. Full delivery depth.", "A paid media team.", "Without five new hires.")
    draw.text((72, lower + 10), "Strategy, media buying, creative, execution, and reporting", font=font(24), fill=COPY)
    draw.text((72, lower + 42), "working behind your agency brand.", font=font(24), fill=COPY)
    members = [
        (embedded_photo("dustin-trout"), "DUSTIN", "STRATEGY", 0.10),
        (embedded_photo("mike-patterson"), "MIKE", "CLIENT DELIVERY", 0.10),
        (Image.open(ROOT / "public" / "team" / "gabriela-profile_2.jpg").convert("RGB"), "GABRIELA", "CREATIVE", 0.38),
        (Image.open(ROOT / "public" / "team" / "adolfo_profile.png").convert("RGB"), "ADOLFO", "PAID MEDIA", 0.20),
        (Image.open(ROOT / "public" / "team" / "adriel_profile.png").convert("RGB"), "ADRIEL", "EXECUTION", 0.22),
    ]
    for i, (photo, name, role, fy) in enumerate(members):
        portrait_card(canvas, photo, 70 + i * 194, 508, 172, 330, name, role, fy)
    cta(draw, "Meet your team", width=450)
    save(canvas, "02-mof-real-delivery-team.png")


def client_control() -> None:
    canvas = brand_background(3)
    draw = ImageDraw.Draw(canvas)
    place_logo(canvas)
    lower = text_block(draw, "White-label means white-label", "Your clients stay yours.", "The delivery gets stronger.")
    draw.text((72, lower + 10), "EIC stays behind the scenes while your agency owns the", font=font(24), fill=COPY)
    draw.text((72, lower + 42), "relationship, the brand, the pricing, and the strategy.", font=font(24), fill=COPY)
    portraits = [
        (embedded_photo("dustin-trout"), "DUSTIN TROUT", "STRATEGY", 78),
        (embedded_photo("mike-patterson"), "MIKE PATTERSON", "CLIENT DELIVERY", 298),
    ]
    for photo, name, role, x in portraits:
        portrait_card(canvas, photo, x, 508, 198, 330, name, role, 0.10)
    draw.text((550, 520), "YOU KEEP", font=font(18, True), fill=TEAL)
    for i, item in enumerate(["The client relationship", "Your agency brand", "Your pricing and margin", "Strategic visibility"]):
        y = 566 + i * 62
        draw.ellipse((550, y, 580, y + 30), fill=TEAL)
        draw.text((558, y + 2), "✓", font=font(18, True), fill=WHITE)
        draw.text((596, y - 1), item, font=font(24, True), fill=INK)
    draw.text((550, 818), "WE HANDLE THE WORK.", font=font(15, True), fill=GREEN)
    cta(draw, "See how it works", width=470)
    save(canvas, "03-mof-client-control.png")


def save(canvas: Image.Image, filename: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / filename
    canvas.convert("RGB").save(path, quality=96, optimize=True)
    print(f"created={path} size={Image.open(path).size}")


def main() -> None:
    reporting_proof()
    team_delivery()
    client_control()


if __name__ == "__main__":
    main()