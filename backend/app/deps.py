import uuid

from fastapi import Header, HTTPException, status


async def get_install_id(x_install_id: str = Header(...)) -> str:
    if not x_install_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Install-Id header",
        )
    try:
        uuid.UUID(x_install_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format for X-Install-Id",
        )
    return x_install_id


def validate_thread_ownership(thread_id: str, install_id: str, page_id: str):
    prefix = f"{install_id}:{page_id}:"
    if not thread_id.startswith(prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Thread ID does not belong to install_id and page_id",
        )
