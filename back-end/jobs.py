import sys
import time
import subprocess
from rq import get_current_job

from status_store import write_status, read_status, reset_outputs

def run_generation_job(batch_id: str, language: str = "sk") -> bool:
    job = get_current_job()
    job_id = job.id if job else None

    language = (language or "sk").strip().lower().split("-")[0]
    if language not in ("sk", "uk"):
        language = "sk"

    write_status(
        batch_id,
        {
            "state": "running",
            "batchId": batch_id,
            "jobId": job_id,
            "startedAt": time.time(),
            "finishedAt": None,
            "error": None,
        },
    )

    try:
        reset_outputs(batch_id, reset_chroma=True)

        cmd = [sys.executable, "main.py", "--batch", batch_id, "--language", language]
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = p.communicate()

        print(f"[job {job_id}] [main stdout]\n{stdout}")
        print(f"[job {job_id}] [main stderr]\n{stderr}")

        if p.returncode != 0:
            raise RuntimeError(stderr or "Generation failed")

        st = read_status(batch_id) or {}
        write_status(
            batch_id,
            {
                **st,
                "state": "done",
                "finishedAt": time.time(),
                "error": None,
            },
        )
        return True

    except Exception as e:
        st = read_status(batch_id) or {}
        write_status(
            batch_id,
            {
                **st,
                "state": "error",
                "finishedAt": time.time(),
                "error": str(e),
            },
        )
        raise
