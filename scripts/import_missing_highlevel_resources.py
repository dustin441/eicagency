#!/usr/bin/env python3
"""Import missing EIC HighLevel blog posts from the legacy HighLevel site HTML.

The current DNS now points eic.agency to Vercel, but the legacy HighLevel site is
still reachable through the old Cloudflare IP while DNS propagation/cache remains.
We use that public HTML as the source of truth for the catch-up posts and keep the
originalUrl pointing at the old /post/<slug> path.
"""
from __future__ import annotations

import html
import json
import re
import subprocess
from datetime import timezone
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from dateutil import parser as date_parser

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "src/content/resources.json"
LEGACY_IP = "162.159.140.166"
HOST = "eic.agency"
MISSING_SLUGS = [
    "b2b-lead-gen-google-ai-overviews",
    "b2b-lead-gen-ugc-influencer-content-with-ads",
    "b2b-lead-gen-marketing-from-your-CRM",
]


def curl_legacy(slug: str) -> str:
    url = f"https://{HOST}/post/{slug}"
    cmd = [
        "curl",
        "-sSL",
        "--resolve",
        f"{HOST}:443:{LEGACY_IP}",
        "--max-time",
        "90",
        "-A",
        "Mozilla/5.0 (compatible; EIC resource migration)",
        url,
    ]
    return subprocess.check_output(cmd, text=True)


def meta(soup: BeautifulSoup, *, name: str | None = None, prop: str | None = None) -> str:
    if name:
        tag = soup.find("meta", attrs={"name": name})
    else:
        tag = soup.find("meta", attrs={"property": prop})
    return html.unescape((tag.get("content") or "").strip()) if tag else ""


def parse_post(slug: str, existing_category: list[dict[str, Any]]) -> dict[str, Any]:
    page = curl_legacy(slug)
    soup = BeautifulSoup(page, "lxml")

    title = meta(soup, prop="og:title") or (soup.title.get_text(" ", strip=True) if soup.title else "")
    description = meta(soup, name="description") or meta(soup, prop="og:description")
    image_url = meta(soup, prop="og:image")
    image_alt = ""
    header_img = soup.select_one("img.blog-content-blog-image")
    if header_img:
        image_alt = html.unescape((header_img.get("alt") or "").strip())

    category_label = "B2B Marketing"
    category_tag = soup.select_one("span.blog-category a")
    if category_tag:
        category_label = category_tag.get_text(" ", strip=True)

    date_text = ""
    date_tag = soup.select_one("span.blog-date")
    if date_tag:
        date_text = date_tag.get_text(" ", strip=True)
    published = date_parser.parse(date_text).replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

    body = soup.select_one("div#blogPostContent")
    if not body:
        raise RuntimeError(f"No blogPostContent found for {slug}")
    body_html = str(body)
    body_html = body_html.replace("https://eic.agency/eic-schedule-demo", "/eic-schedule-demo")
    body_html = body_html.replace("http://eic.agency/eic-schedule-demo", "/eic-schedule-demo")

    # Keep the existing category object shape when possible, but preserve the live label.
    categories = existing_category or []
    if categories and isinstance(categories[0], dict):
        categories = [dict(categories[0])]
        categories[0]["label"] = category_label
    elif category_label:
        categories = [{"label": category_label, "urlSlug": "b2b"}]

    return {
        "title": title,
        "slug": slug,
        "description": description,
        "publishedAt": published,
        "updatedAt": published,
        "imageUrl": image_url,
        "imageAltText": image_alt or title,
        "categories": categories,
        "bodyHTML": body_html,
        "originalUrl": f"https://eic.agency/post/{slug}",
    }


def main() -> None:
    data = json.loads(RESOURCES.read_text())
    by_slug = {item["slug"]: item for item in data}
    sample_category = by_slug.get("b2b-lead-gen-dynamic-creative-optimization", {}).get("categories", [])

    imported = []
    for slug in MISSING_SLUGS:
        if slug in by_slug:
            continue
        post = parse_post(slug, sample_category)
        imported.append(post)
        data.append(post)

    data.sort(key=lambda item: item.get("publishedAt") or "", reverse=True)
    RESOURCES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    print(json.dumps({
        "imported_count": len(imported),
        "imported": [{"slug": p["slug"], "publishedAt": p["publishedAt"], "title": p["title"]} for p in imported],
        "total": len(data),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
