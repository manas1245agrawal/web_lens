from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.vectorstore import get_vectorstore


def chunk_markdown(page_id: str, markdown: str) -> list[Document]:
    documents: list[Document] = []
    lines = markdown.split("\n")

    current_heading = "Introduction"
    recent_prose = ""
    table_count = 0

    prose_buffer = []
    in_table = False
    table_lines = []

    prose_splitter = RecursiveCharacterTextSplitter(
        chunk_size=900, chunk_overlap=120
    )

    def flush_prose(text: str, heading: str):
        if not text.strip():
            return
        chunks = prose_splitter.split_text(text)
        for chunk in chunks:
            documents.append(
                Document(
                    page_content=chunk,
                    metadata={
                        "page_id": page_id,
                        "type": "text",
                        "section": heading,
                    },
                )
            )

    def process_table(lines_list: list[str], heading: str, context: str, t_index: int):
        table_text = "\n".join(lines_list)
        table_id = f"{page_id}-t{t_index}"
        prefix = f"Table from section '{heading}'. Preceding text: {context[:300]}\n"

        if len(table_text) <= 1500 or len(lines_list) <= 3:
            documents.append(
                Document(
                    page_content=prefix + table_text,
                    metadata={
                        "page_id": page_id,
                        "type": "table",
                        "table_id": table_id,
                        "section": heading,
                    },
                )
            )
            return

        # Split table by rows, repeating 2-line header
        header = lines_list[:2]
        data_rows = lines_list[2:]

        chunk_rows = []
        current_len = 0

        for row in data_rows:
            chunk_rows.append(row)
            current_len += len(row)
            if current_len >= 1200:
                table_chunk = "\n".join(header + chunk_rows)
                documents.append(
                    Document(
                        page_content=prefix + table_chunk,
                        metadata={
                            "page_id": page_id,
                            "type": "table",
                            "table_id": table_id,
                            "section": heading,
                        },
                    )
                )
                chunk_rows = []
                current_len = 0

        if chunk_rows:
            table_chunk = "\n".join(header + chunk_rows)
            documents.append(
                Document(
                    page_content=prefix + table_chunk,
                    metadata={
                        "page_id": page_id,
                        "type": "table",
                        "table_id": table_id,
                        "section": heading,
                    },
                )
            )

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            current_heading = stripped.lstrip("#").strip()

        is_table_line = stripped.startswith("|")

        if is_table_line:
            if not in_table:
                # Switching into a table
                flush_prose("\n".join(prose_buffer), current_heading)
                recent_prose = "\n".join(prose_buffer)[-300:]
                prose_buffer = []
                in_table = True
                table_lines = []
            table_lines.append(line)
        else:
            if in_table:
                # Switching out of a table
                table_count += 1
                process_table(table_lines, current_heading, recent_prose, table_count)
                in_table = False
                table_lines = []
            prose_buffer.append(line)

    if in_table:
        table_count += 1
        process_table(table_lines, current_heading, recent_prose, table_count)

    if prose_buffer:
        flush_prose("\n".join(prose_buffer), current_heading)

    return documents


async def index_page_chunks(page_id: str, markdown: str) -> tuple[int, int]:
    vectorstore = get_vectorstore()

    # Delete existing chunks if re-indexing
    try:
        collection = vectorstore._collection
        existing = collection.get(where={"page_id": page_id})
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    docs = chunk_markdown(page_id, markdown)
    if not docs:
        return 0, 0

    ids = [f"{page_id}-{i}" for i in range(len(docs))]
    vectorstore.add_documents(docs, ids=ids)

    tables_count = len({d.metadata["table_id"] for d in docs if d.metadata.get("type") == "table"})
    return len(docs), tables_count
