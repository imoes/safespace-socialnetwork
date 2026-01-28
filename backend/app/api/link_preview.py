import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
import httpx

from app.services.auth_service import get_current_user

router = APIRouter(prefix="/link-preview", tags=["Link Preview"])

# Simple regex patterns for Open Graph meta tags
OG_TITLE = re.compile(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
OG_TITLE_ALT = re.compile(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:title["\']', re.IGNORECASE)
OG_DESC = re.compile(r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
OG_DESC_ALT = re.compile(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:description["\']', re.IGNORECASE)
OG_IMAGE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
OG_IMAGE_ALT = re.compile(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:image["\']', re.IGNORECASE)
HTML_TITLE = re.compile(r'<title[^>]*>([^<]*)</title>', re.IGNORECASE)
META_DESC = re.compile(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
META_DESC_ALT = re.compile(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']', re.IGNORECASE)

ALLOWED_SCHEMES = {"http", "https"}


def _find(html: str, *patterns: re.Pattern) -> str | None:
    for pat in patterns:
        m = pat.search(html)
        if m:
            return m.group(1).strip()
    return None


@router.get("")
async def get_link_preview(
    url: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise HTTPException(status_code=400, detail="Only http/https URLs are supported")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
                "Accept": "text/html",
            })
            resp.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch URL")

    # Only parse HTML responses
    content_type = resp.headers.get("content-type", "")
    if "html" not in content_type:
        raise HTTPException(status_code=400, detail="URL does not return HTML")

    # Limit parsing to first 50KB to avoid excessive processing
    html = resp.text[:50_000]

    title = _find(html, OG_TITLE, OG_TITLE_ALT, HTML_TITLE)
    description = _find(html, OG_DESC, OG_DESC_ALT, META_DESC, META_DESC_ALT)
    image = _find(html, OG_IMAGE, OG_IMAGE_ALT)

    domain = parsed.hostname or ""

    return {
        "url": url,
        "title": title,
        "description": description,
        "image": image,
        "domain": domain,
    }
