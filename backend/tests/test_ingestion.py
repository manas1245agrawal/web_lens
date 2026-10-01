from app.core.ingestion import chunk_markdown


def test_table_chunking_preserves_headers():
    sample_md = """# Pricing

Here is our pricing structure:

| Plan | Monthly | Yearly |
| --- | --- | --- |
| Basic | $10 | $100 |
| Pro | $20 | $200 |

Footer text here.
"""
    docs = chunk_markdown("test_page_1", sample_md)
    assert len(docs) > 0

    table_docs = [d for d in docs if d.metadata.get("type") == "table"]
    assert len(table_docs) == 1
    assert "| Plan | Monthly | Yearly |" in table_docs[0].page_content
    assert "Here is our pricing structure:" in table_docs[0].page_content
