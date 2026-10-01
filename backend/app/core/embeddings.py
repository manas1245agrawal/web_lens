from langchain_community.embeddings import FastEmbedEmbeddings

from app.config import get_settings


def get_embeddings():
    settings = get_settings()
    if settings.EMBEDDINGS_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            api_key=settings.OPENAI_API_KEY, model=settings.EMBEDDING_MODEL
        )

    # Default to FastEmbed local embeddings
    return FastEmbedEmbeddings(model_name=settings.EMBEDDING_MODEL)
