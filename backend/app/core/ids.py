import hashlib
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_url(raw_url: str) -> str:
    try:
        parsed = urlparse(raw_url)
        # Lowercase scheme and netloc
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Remove fragment
        fragment = ""

        # Filter tracking params
        query_params = parse_qs(parsed.query, keep_blank_values=True)
        filtered_params = {}
        strip_keys = {"fbclid", "gclid", "ref", "ref_src"}

        for k, v in query_params.items():
            k_lower = k.lower()
            if not k_lower.startswith("utm_") and k_lower not in strip_keys:
                filtered_params[k] = v

        new_query = urlencode(filtered_params, doseq=True)
        path = parsed.path
        if path.endswith("/") and len(path) > 1:
            path = path[:-1]

        return urlunparse((scheme, netloc, path, parsed.params, new_query, fragment))
    except Exception:
        return raw_url.strip().lower()


def make_page_id(install_id: str, url_norm: str) -> str:
    combined = f"{install_id}|{url_norm}"
    return sha256_text(combined)


def make_content_hash(markdown: str) -> str:
    return sha256_text(markdown)
