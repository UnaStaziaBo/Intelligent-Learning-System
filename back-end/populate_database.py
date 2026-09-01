import argparse
import os
import shutil
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from get_embedding_function import get_embedding_function
from langchain_chroma import Chroma

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    args = parser.parse_args()

    batch_dir = os.path.join("uploads", args.batch)
    data_path = os.path.join(batch_dir, "data")
    chroma_path = os.path.join(batch_dir, "chroma")

    clear_database(chroma_path)

    documents = load_documents(data_path)
    chunks = split_documents(documents)
    add_to_chroma(chunks, chroma_path)


def load_documents(data_path: str):
    document_loader = PyPDFDirectoryLoader(data_path)
    documents = document_loader.load()
    print(f"Loaded {len(documents)} documents from {data_path}")
    return documents


def split_documents(documents: list[Document]):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=80,
        length_function=len,
        is_separator_regex=False,
    )
    return text_splitter.split_documents(documents)

def load_documents(data_path: str):
    document_loader = PyPDFDirectoryLoader(data_path)
    documents = document_loader.load()
    print(f"Loaded {len(documents)} documents from {data_path}")
    return documents


def add_to_chroma(chunks: list[Document], chroma_path: str):
    db = Chroma(persist_directory=chroma_path, embedding_function=get_embedding_function())
    chunks_with_ids = calculate_chunk_ids(chunks)

    ids = [c.metadata["id"] for c in chunks_with_ids]
    db.add_documents(chunks_with_ids, ids=ids)
    print(f"Added {len(chunks_with_ids)} chunks to DB at {chroma_path}")


def calculate_chunk_ids(chunks):

    # This will create IDs like "data/monopoly.pdf:6:2"
    # Page Source : Page Number : Chunk Index

    last_page_id = None
    current_chunk_index = 0

    for chunk in chunks:
        source = chunk.metadata.get("source")
        page = chunk.metadata.get("page")
        current_page_id = f"{source}:{page}"

        # If the page ID is the same as the last one, increment the index.
        if current_page_id == last_page_id:
            current_chunk_index += 1
        else:
            current_chunk_index = 0

        # Calculate the chunk ID.
        chunk_id = f"{current_page_id}:{current_chunk_index}"
        last_page_id = current_page_id

        # Add it to the page meta-data.
        chunk.metadata["id"] = chunk_id

    return chunks


def clear_database(chroma_path: str):
    if os.path.exists(chroma_path):
        shutil.rmtree(chroma_path, ignore_errors=True)


if __name__ == "__main__":
    main()
