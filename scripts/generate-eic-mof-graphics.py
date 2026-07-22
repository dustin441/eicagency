#!/usr/bin/env python3
import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "creative-review" / "eic-mof"
W = H = 1080
NAVY = "#07192c"
NAVY_2 = "#103a5a"
CYAN = "#39d5df"
WHITE = "#ffffff"
MUTED = "#c9d9e6"
DIM = "#8eabc0"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, minimum: int = 18, bold: bool = True):
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


def background() -> Image.Image:
    image = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(image)
    for y in range(H):
        t = y / (H - 1)
        draw.line((0, y, W, y), fill=(round(7 + 8*t), round(25 + 25*t), round(44 + 34*t)))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((760, -200, 1280, 320), fill=(29, 205, 218, 65))
    gd.ellipse((-220, 760, 320, 1300), fill=(36, 120, 210, 48))
    return Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(80)))


def header(canvas: Image.Image, label: str) -> ImageDraw.ImageDraw:
    draw = ImageDraw.Draw(canvas)
    logo = Image.open(ROOT / "public" / "logo-white.png").convert("RGBA")
    logo.thumbnail((190, 64), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (58, 44))
    badge = (700, 50, 1022, 106)
    draw.rounded_rectangle(badge, radius=28, fill="#0f3957", outline=CYAN, width=2)
    f = fit_font(draw, label, 280, 16, 13)
    tw = draw.textlength(label, font=f)
    draw.text((861 - tw / 2, 69), label, font=f, fill="#e6fcff")
    return draw


def footer(draw: ImageDraw.ImageDraw, cta: str) -> None:
    draw.rounded_rectangle((58, 902, 1022, 978), radius=38, fill=CYAN)
    f = fit_font(draw, cta.upper(), 860, 22, 17)
    tw = draw.textlength(cta.upper(), font=f)
    draw.text((540 - tw / 2, 928), cta.upper(), font=f, fill="#061827")
    foot = "EIC AGENCY  •  WHITE-LABEL PAID MEDIA FOR AGENCIES"
    ff = font(15, True)
    fw = draw.textlength(foot, font=ff)
    draw.text((540 - fw / 2, 1015), foot, font=ff, fill=DIM)


def save(canvas: Image.Image, filename: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / filename
    canvas.convert("RGB").save(path, quality=96, optimize=True)
    print(f"created={path} size={Image.open(path).size}")


def reporting_proof() -> None:
    canvas = background()
    draw = header(canvas, "CLIENT-READY REPORTING")
    draw.text((58, 148), "WHAT YOUR CLIENTS SEE", font=font(18, True), fill=CYAN)
    draw.multiline_text((54, 188), "Give clients reporting\nthey can actually understand.", font=font(47, True), fill=WHITE, spacing=4)
    draw.text((58, 316), "Clear performance. Clear next steps. Delivered under your brand.", font=font(20), fill=MUTED)

    screenshot = Image.open(ROOT / "public" / "proof" / "dashboard" / "dashboard-overview.jpg").convert("RGB")
    screenshot = cover(screenshot, (892, 430), focus_y=0.0)
    shadow = Image.new("RGBA", (940, 490), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((24, 24, 916, 464), radius=30, fill=(0, 0, 0, 130))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)), (46, 370))
    draw.rounded_rectangle((58, 376, 1022, 856), radius=30, fill="#f7fbfd", outline=CYAN, width=3)
    canvas.alpha_composite(rounded(screenshot, 22), (94, 402))
    draw.rounded_rectangle((94, 800, 386, 842), radius=21, fill=NAVY)
    draw.text((116, 811), "ACTUAL EIC REPORTING", font=font(16, True), fill=CYAN)
    draw.text((700, 810), "PROOF, NOT A MOCKUP", font=font(15, True), fill=NAVY_2)
    footer(draw, "See the system behind the service")
    save(canvas, "01-mof-reporting-proof.png")


def team_delivery() -> None:
    canvas = background()
    draw = header(canvas, "REAL EIC DELIVERY TEAM")
    draw.text((58, 148), "NO INTERNAL HIRING REQUIRED", font=font(18, True), fill=CYAN)
    draw.multiline_text((54, 188), "Meet the paid media department\nbehind your agency.", font=font(47, True), fill=WHITE, spacing=4)
    draw.text((58, 316), "Real specialists handling the work. Your agency stays client-facing.", font=font(20), fill=MUTED)

    members = [
        (embedded_photo("dustin-trout"), "DUSTIN", "STRATEGY", 0.5, 0.10),
        (embedded_photo("mike-patterson"), "MIKE", "CLIENT DELIVERY", 0.5, 0.10),
        (Image.open(ROOT / "public" / "team" / "gabriela-profile_2.jpg").convert("RGB"), "GABRIELA", "CREATIVE", 0.5, 0.38),
        (Image.open(ROOT / "public" / "team" / "adolfo_profile.png").convert("RGB"), "ADOLFO", "PAID MEDIA", 0.5, 0.20),
        (Image.open(ROOT / "public" / "team" / "adriel_profile.png").convert("RGB"), "ADRIEL", "EXECUTION", 0.5, 0.22),
    ]
    card_w, gap, start_x = 180, 15, 60
    for idx, (photo, name, role, fx, fy) in enumerate(members):
        x = start_x + idx * (card_w + gap)
        y = 390
        portrait = cover(photo, (card_w, 324), focus_x=fx, focus_y=fy)
        draw.rounded_rectangle((x - 3, y - 3, x + card_w + 3, y + 330), radius=23, fill=CYAN)
        canvas.alpha_composite(rounded(portrait, 20), (x, y))
        draw.rounded_rectangle((x + 8, y + 264, x + card_w - 8, y + 316), radius=18, fill=(7, 25, 44, 230))
        nf = fit_font(draw, name, card_w - 28, 15, 12)
        nw = draw.textlength(name, font=nf)
        draw.text((x + card_w / 2 - nw / 2, y + 273), name, font=nf, fill=WHITE)
        rf = fit_font(draw, role, card_w - 24, 11, 9)
        rw = draw.textlength(role, font=rf)
        draw.text((x + card_w / 2 - rw / 2, y + 294), role, font=rf, fill=CYAN)

    draw.rounded_rectangle((58, 744, 1022, 856), radius=28, fill="#0e3553", outline="#2e7286", width=2)
    functions = [("STRATEGY", 148), ("MEDIA BUYING", 351), ("CREATIVE", 594), ("REPORTING", 813)]
    for label, cx in functions:
        draw.ellipse((cx - 8, 777, cx + 8, 793), fill=CYAN)
        f = fit_font(draw, label, 180, 16, 12)
        tw = draw.textlength(label, font=f)
        draw.text((cx - tw / 2, 809), label, font=f, fill=WHITE)
    footer(draw, "Meet your behind-the-scenes team")
    save(canvas, "02-mof-real-delivery-team.png")


def client_control() -> None:
    canvas = background()
    draw = header(canvas, "YOUR BRAND STAYS FIRST")
    draw.text((58, 148), "WHITE-LABEL MEANS WHITE-LABEL", font=font(18, True), fill=CYAN)
    draw.multiline_text((54, 188), "Still your clients.\nStill your brand.\nNow with a paid media team.", font=font(49, True), fill=WHITE, spacing=5)
    draw.text((58, 394), "EIC works behind the scenes while you lead the relationship.", font=font(20), fill=MUTED)

    founders = [(embedded_photo("dustin-trout"), "DUSTIN TROUT", 58), (embedded_photo("mike-patterson"), "MIKE PATTERSON", 310)]
    for photo, name, x in founders:
        portrait = cover(photo, (224, 354), focus_y=0.10)
        draw.rounded_rectangle((x - 3, 458, x + 227, 818), radius=26, fill=CYAN)
        canvas.alpha_composite(rounded(portrait, 22), (x, 461))
        draw.rounded_rectangle((x + 10, 764, x + 214, 805), radius=20, fill=(7, 25, 44, 230))
        nf = fit_font(draw, name, 180, 14, 11)
        nw = draw.textlength(name, font=nf)
        draw.text((x + 112 - nw / 2, 776), name, font=nf, fill=WHITE)

    x0 = 590
    draw.text((x0, 474), "YOU KEEP", font=font(17, True), fill=CYAN)
    keeps = ["The client relationship", "Your agency brand", "Your pricing and margin", "Strategic visibility"]
    for i, item in enumerate(keeps):
        y = 520 + i * 67
        draw.ellipse((x0, y + 6, x0 + 22, y + 28), fill=CYAN)
        draw.text((x0 + 7, y + 5), "✓", font=font(14, True), fill=NAVY)
        draw.text((x0 + 38, y), item, font=font(21, True), fill=WHITE)
    draw.rounded_rectangle((590, 796, 1018, 856), radius=24, fill="#0f3957", outline="#2e7286", width=2)
    draw.text((616, 815), "WE HANDLE THE WORK BEHIND THE SCENES.", font=font(15, True), fill=MUTED)
    footer(draw, "See how white-label delivery works")
    save(canvas, "03-mof-client-control.png")


def main() -> None:
    reporting_proof()
    team_delivery()
    client_control()


if __name__ == "__main__":
    main()
