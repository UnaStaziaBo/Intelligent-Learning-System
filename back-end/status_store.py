import os
import json
import shutil
from typing import Optional, Dict, Any

UPLOAD_ROOT = "uploads"

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def batch_dir(batch_id: str) -> str:
    return os.path.join(UPLOAD_ROOT, str(batch_id))

def status_path(batch_id: str) -> str:
    return os.path.join(batch_dir(batch_id), "status.json")

def out_pdf_dir(batch_id: str) -> str:
    return os.path.join(batch_dir(batch_id), "out_pdf")

def notes_dir(batch_id: str) -> str:
    return os.path.join(batch_dir(batch_id), "notes")

def tasks_dir(batch_id: str) -> str:
    return os.path.join(batch_dir(batch_id), "results_tasks")

def chroma_dir(batch_id: str) -> str:
    return os.path.join(batch_dir(batch_id), "chroma")

def write_status(batch_id: str, payload: Dict[str, Any]) -> None:
    ensure_dir(batch_dir(batch_id))
    with open(status_path(batch_id), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def read_status(batch_id: str) -> Optional[Dict[str, Any]]:
    p = status_path(batch_id)
    if not os.path.isfile(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)
    
def meta_path(batch_id: str) -> str:
    return os.path.join(batch_dir(batch_id), "meta.json")

def read_meta(batch_id: str) -> Dict[str, Any]:
    p = meta_path(batch_id)
    if not os.path.isfile(p):
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def write_meta(batch_id: str, payload: Dict[str, Any]) -> None:
    ensure_dir(batch_dir(batch_id))
    with open(meta_path(batch_id), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def reset_outputs(batch_id: str, *, reset_chroma: bool = True) -> None:
    for d in (out_pdf_dir(batch_id), notes_dir(batch_id), tasks_dir(batch_id)):
        if os.path.isdir(d):
            shutil.rmtree(d, ignore_errors=True)
        ensure_dir(d)

    if reset_chroma:
        cd = chroma_dir(batch_id)
        if os.path.isdir(cd):
            shutil.rmtree(cd, ignore_errors=True)
        ensure_dir(cd)
