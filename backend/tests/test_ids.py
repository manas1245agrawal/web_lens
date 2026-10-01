from app.core.ids import make_content_hash, make_page_id, normalize_url


def test_normalize_url():
    url = "HTTPS://Example.com/Docs/Page/?utm_source=news&ref=123#header"
    norm = normalize_url(url)
    assert norm == "https://example.com/Docs/Page"


def test_page_id_deterministic():
    id1 = make_page_id("install-1", "https://example.com")
    id2 = make_page_id("install-1", "https://example.com")
    assert id1 == id2


def test_content_hash():
    h = make_content_hash("Hello World")
    assert len(h) == 64
