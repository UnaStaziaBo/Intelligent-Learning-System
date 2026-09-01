from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv

load_dotenv()

def get_embedding_function():
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small" 
    )
    return embeddings
