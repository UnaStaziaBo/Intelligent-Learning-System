from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
import uuid
import csv
import json
import threading
import time
import secrets
import string
from flask import send_from_directory
from werkzeug.utils import safe_join
from flask_cors import CORS

from redis import Redis
from rq import Queue

from status_store import UPLOAD_ROOT, ensure_dir, read_status, write_status, read_meta, write_meta
from jobs import run_generation_job


app = Flask(__name__)
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
CORS(app, resources={r"/api/*": {"origins": FRONTEND_ORIGIN}})

redis_conn = Redis(host="localhost", port=6379, db=0)
q = Queue("jobs", connection=redis_conn)

def normalize_email(s: str) -> str:
    return (s or "").strip().lower()

def selected_manifest_path(batch_id: str) -> str:
    return os.path.join(UPLOAD_ROOT, batch_id, "filtered", "selected_students.json")


def generate_pin(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

def format_moodle_dt(ts: int) -> str:
    # Example: "21 June 2025 8:12 PM"
    return time.strftime("%d %B %Y %I:%M %p", time.localtime(int(ts))).lstrip("0")


def format_duration_like_sample(duration_str: str) -> str:
    # If already contains "min" -> keep
    if "min" in duration_str:
        return duration_str

    # If it's HH:MM:SS -> convert to "X min"
    parts = duration_str.split(":")
    if len(parts) == 3:
        h, m, s = [int(x) for x in parts]
        total_min = h * 60 + m + (1 if s >= 30 else 0)  # round
        return f"{total_min} min"

    return duration_str


def format_question_with_options(q_text: str, options: list) -> str:
    """
    Convert:
      question="čo znamená transakcia?"
      options=["a", "b"]
    into:
      "čo znamená transakcia? :a ; b"
    """
    q_text = (q_text or "").strip()
    q_text = " ".join(q_text.split())

    if not options:
        return q_text

    opts = [str(x).strip() for x in options if str(x).strip()]
    return f"{q_text} :{' ; '.join(opts)}"


@app.route("/upload", methods=["POST"])
def upload():
    batch_id = request.form.get("batchId") or str(uuid.uuid4())

    if "file" not in request.files:
        return jsonify({"error": "There is no file"}), 400

    file = request.files["file"]
    orig_name = (file.filename or "").strip()
    if not orig_name:
        return jsonify({"error": "Empty filename"}), 400

    orig_lower = orig_name.lower()
    is_csv = orig_lower.endswith(".csv")

    batch_path = os.path.join(UPLOAD_ROOT, batch_id)
    ensure_dir(batch_path)

    if is_csv:
        target_path = os.path.join(batch_path, "csv_data")
        ensure_dir(target_path)

        csv_type = (request.form.get("csvType") or "").strip().lower()
        if csv_type not in ("moodle", "custom"):
            return jsonify({"error": "csvType must be 'moodle' or 'custom'"}), 400

        meta = read_meta(batch_id) or {}
        meta["csvType"] = csv_type
        write_meta(batch_id, meta)

        safe_name = "students.csv"
        kind = "csv"
    else:
        # Материалы — как раньше
        target_path = os.path.join(batch_path, "data")
        ensure_dir(target_path)

        safe_name = secure_filename(orig_name) or f"file_{uuid.uuid4().hex}"
        kind = "material"

    filepath = os.path.join(target_path, safe_name)
    file.save(filepath)

    meta = read_meta(batch_id) or {}
    return jsonify(
        {
            "message": "File saved",
            "batchId": batch_id,
            "kind": kind,
            "path": filepath,
            "csvType": meta.get("csvType", ""),
            "originalFilename": orig_name,
        }
    ), 200


def find_csv(batch_id: str):
    csv_dir = os.path.join(UPLOAD_ROOT, batch_id, "csv_data")
    if not os.path.isdir(csv_dir):
        return None

    preferred = os.path.join(csv_dir, "students.csv")
    if os.path.isfile(preferred):
        return preferred

    for name in os.listdir(csv_dir):
        if name.lower().endswith(".csv"):
            return os.path.join(csv_dir, name)

    return None

def get_csv_type(batch_id: str) -> str:
    meta = read_meta(batch_id) or {}
    t = str(meta.get("csvType") or "moodle").strip().lower()
    return t if t in ("moodle", "custom") else "moodle"


def idx_by_header(header: list, name: str):
    try:
        return header.index(name)
    except ValueError:
        return None

def get_people_columns(header: list, csv_type: str):
    if csv_type == "custom":
        # Google Forms fixed structure:
        # 0 Timestamp, 1 Total, 2 Last, 3 Last[Score], 4 Last[Feedback],
        # 5 First, 6 First[Score], 7 First[Feedback],
        # 8 Email, 9 Email[Score], 10 Email[Feedback],
        # then questions...

        if not header:
            raise ValueError("CSV header is empty")

        if len(header) < 11:
            raise ValueError(
                f"Custom CSV structure is invalid: expected at least 11 columns (up to Email [Feedback]), got {len(header)}"
            )

        if len(header) < 14:
            raise ValueError(
                f"Custom CSV must contain at least 1 question (3 columns). Got only {len(header)} columns."
            )

        return 2, 5, 8

    # Moodle
    return 0, 1, 3


@app.route("/api/batch/<batch_id>/students", methods=["GET"])
def students(batch_id):
    csv_path = find_csv(batch_id)
    if not csv_path:
        return jsonify({"error": "CSV not found for this batch"}), 404

    csv_type = get_csv_type(batch_id)

    result = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            return jsonify({"error": "Empty CSV"}), 400

        try:
            last_i, first_i, _email_i = get_people_columns(header, csv_type)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        for i, row in enumerate(reader):
            if not row:
                continue

            last_name = (row[last_i] if len(row) > last_i else "").strip()
            first_name = (row[first_i] if len(row) > first_i else "").strip()

            if not (last_name or first_name):
                continue

            result.append(
                {
                    "id": i,
                    "lastName": last_name,
                    "firstName": first_name,
                    "displayName": f"{last_name} {first_name}".strip(),
                }
            )

    return jsonify({"batchId": batch_id, "count": len(result), "students": result}), 200

@app.route("/api/batch/<batch_id>/filter", methods=["POST"])
def filter_csv(batch_id):
    csv_path = find_csv(batch_id)
    if not csv_path:
        return jsonify({"error": "CSV not found for this batch"}), 404

    csv_type = get_csv_type(batch_id)

    data = request.get_json(silent=True) or {}
    if "studentIds" in data:
        student_ids = data.get("studentIds") or []
    else:
        one = data.get("studentId")
        student_ids = [one] if one is not None else []

    try:
        student_ids = [int(x) for x in student_ids]
        student_ids = sorted(set([x for x in student_ids if x >= 0]))
    except Exception:
        return jsonify({"error": "studentIds must be a list of non-negative integers"}), 400

    if not student_ids:
        return jsonify({"error": "No studentIds provided"}), 400

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as fin:
        rows = list(csv.reader(fin))

    if len(rows) < 2:
        return jsonify({"error": "CSV has no data rows"}), 400

    header = rows[0]
    data_rows = rows[1:]

    try:
        last_i, first_i, email_i = get_people_columns(header, csv_type)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    max_id = len(data_rows) - 1
    if any(i > max_id for i in student_ids):
        return jsonify({"error": f"studentIds out of range (0..{max_id})"}), 400

    selected_rows = [data_rows[i] for i in student_ids]

    out_dir = os.path.join(UPLOAD_ROOT, batch_id, "filtered")
    ensure_dir(out_dir)

    # 1) Save selected.csv
    out_path = os.path.join(out_dir, "selected.csv")
    with open(out_path, "w", encoding="utf-8", newline="") as fout:
        w = csv.writer(fout)
        w.writerow(header)
        w.writerows(selected_rows)

    # 2) Build selected_students manifest
    selected_students = []
    for local_idx, row in enumerate(selected_rows):
        last_name = (row[last_i] if len(row) > last_i else "").strip()
        first_name = (row[first_i] if len(row) > first_i else "").strip()
        email = (row[email_i] if len(row) > email_i else "").strip().lower()

        safe_last = last_name.replace(" ", "_")
        safe_first = first_name.replace(" ", "_")
        stem = f"{safe_last}_{safe_first}_{local_idx}"

        selected_students.append(
            {
                "email": email,
                "stem": stem,
                "displayName": f"{last_name} {first_name}".strip(),
            }
        )

    manifest_path = os.path.join(out_dir, "selected_students.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(
            {"batchId": batch_id, "students": selected_students},
            f,
            ensure_ascii=False,
            indent=2,
        )

    return jsonify(
        {
            "message": "filtered created",
            "batchId": batch_id,
            "selectedCount": len(selected_rows),
            "path": out_path,
            "manifest": manifest_path,
        }
    ), 200

@app.route("/api/batch/<batch_id>/generate", methods=["POST"])
def generate(batch_id):
    selected_csv = os.path.join(UPLOAD_ROOT, batch_id, "filtered", "selected.csv")
    if not os.path.isfile(selected_csv):
        return jsonify({"error": "selected.csv not found. Run /filter first."}), 404

    data = request.get_json(silent=True) or {}
    language = str(data.get("language") or "sk").strip().lower().split("-")[0]
    if language not in ("sk", "uk"):
        language = "sk"

    meta = read_meta(batch_id) or {}
    meta["language"] = language
    write_meta(batch_id, meta)

    st = read_status(batch_id) or {}
    if st.get("state") in ("queued", "running"):
        return jsonify({
            "message": f"already {st.get('state')}",
            "batchId": batch_id,
            "jobId": st.get("jobId"),
        }), 202

    lock_key = f"lock:generate:{batch_id}"
    if not redis_conn.set(lock_key, "1", nx=True, ex=60 * 60):
        st = read_status(batch_id) or {}
        return jsonify({
            "message": "already launching",
            "batchId": batch_id,
            "jobId": st.get("jobId"),
        }), 202

    write_status(
        batch_id,
        {
            "state": "queued",
            "batchId": batch_id,
            "jobId": None,
            "startedAt": None,
            "finishedAt": None,
            "error": None,
        },
    )

    job = q.enqueue(run_generation_job, batch_id, language, job_timeout=60 * 60 * 2)

    st = read_status(batch_id) or {}
    st["jobId"] = job.id
    write_status(batch_id, st)

    return jsonify({
        "message": "queued",
        "batchId": batch_id,
        "jobId": job.id,
        "language": language,
    }), 202


def batch_path(batch_id: str) -> str:
    return os.path.join(UPLOAD_ROOT, batch_id)


def out_pdf_dir(batch_id: str) -> str:
    return os.path.join(batch_path(batch_id), "out_pdf")


def notes_dir(batch_id: str) -> str:
    return os.path.join(batch_path(batch_id), "notes")


def tasks_dir(batch_id: str) -> str:
    return os.path.join(batch_path(batch_id), "results_tasks")


TEST_MAX_GRADE = 6.00

TEST_HEADER_BASE = [
    "Last name",
    "First name",
    "ID number",
    "Email address",
    "Status",
    "Started",
    "Completed",
    "Duration",
    f"Grade/{TEST_MAX_GRADE:.2f}",
]


def test_csv_dir(batch_id: str) -> str:
    return os.path.join(UPLOAD_ROOT, batch_id, "filtered")


def test_csv_path(batch_id: str) -> str:
    return os.path.join(test_csv_dir(batch_id), "selected.csv")


@app.route("/api/batch/<batch_id>/test-submit", methods=["POST"])
def test_submit(batch_id):
    data = request.get_json(silent=True) or {}

    last_name = str(data.get("lastName") or "")
    first_name = str(data.get("firstName") or "")
    id_number = str(data.get("idNumber") or "")
    email = str(data.get("email") or "")

    status = "Finished"

    started_ts = data.get("started")
    completed_ts = data.get("completed")
    duration = data.get("duration")

    now = int(time.time())
    if started_ts is None:
        started_ts = now
    if completed_ts is None:
        completed_ts = now

    started_str = format_moodle_dt(started_ts)
    completed_str = format_moodle_dt(completed_ts)

    if duration is None:
        dur_s = max(0, int(completed_ts) - int(started_ts))
        h = dur_s // 3600
        m = (dur_s % 3600) // 60
        s = dur_s % 60
        duration_str = f"{h:02d}:{m:02d}:{s:02d}"
    else:
        duration_str = str(duration)

    duration_out = format_duration_like_sample(duration_str)

    try:
        grade = float(data.get("grade", 0))
    except Exception:
        grade = 0.0

    questions = data.get("questions") or []
    if not isinstance(questions, list):
        return jsonify({"error": "questions must be a list"}), 400

    out_dir = test_csv_dir(batch_id)
    ensure_dir(out_dir)
    path = test_csv_path(batch_id)

    if not hasattr(app, "TEST_SUBMIT_LOCK"):
        app.TEST_SUBMIT_LOCK = threading.Lock()

    with app.TEST_SUBMIT_LOCK:
        existing_header = None
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8", newline="") as f:
                r = csv.reader(f)
                existing_header = next(r, None)

        existing_q_count = 0
        if existing_header and len(existing_header) > len(TEST_HEADER_BASE):
            existing_q_count = (len(existing_header) - len(TEST_HEADER_BASE)) // 3

        current_q_count = len(questions)
        max_q = max(existing_q_count, current_q_count)

        header = TEST_HEADER_BASE[:]
        for i in range(1, max_q + 1):
            header += [f"Question {i}", f"Response {i}", f"Right answer {i}"]

        if existing_header and len(existing_header) != len(header):
            with open(path, "r", encoding="utf-8", newline="") as f:
                rows = list(csv.reader(f))
            old_rows = rows[1:]

            with open(path, "w", encoding="utf-8", newline="") as f:
                w = csv.writer(f)
                w.writerow(header)
                for row in old_rows:
                    row = row + [""] * (len(header) - len(row))
                    w.writerow(row)

        if not os.path.isfile(path):
            with open(path, "w", encoding="utf-8", newline="") as f:
                w = csv.writer(f)
                w.writerow(header)

        grade_val = max(0.0, min(float(grade), TEST_MAX_GRADE))

        row = [
            last_name,
            first_name,
            id_number,
            email,
            status,
            started_str,
            completed_str,
            duration_out,
            f"{grade_val:.2f}",
        ]

        for i in range(max_q):
            if i < len(questions):
                q = questions[i] or {}
                q_text = str(q.get("question") or "")
                opts = q.get("options") or []
                if not isinstance(opts, list):
                    opts = []

                question_cell = format_question_with_options(q_text, opts)

                row += [
                    question_cell,
                    str(q.get("response") or ""),
                    str(q.get("rightAnswer") or ""),
                ]
            else:
                row += ["", "", ""]

        with open(path, "a", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(row)

    return jsonify({"message": "saved", "batchId": batch_id, "path": path}), 200


@app.route("/api/batch/<batch_id>/results", methods=["GET"])
def results(batch_id):
    pdf_dir = out_pdf_dir(batch_id)
    n_dir = notes_dir(batch_id)
    t_dir = tasks_dir(batch_id)

    if not os.path.isdir(pdf_dir):
        return jsonify({"batchId": batch_id, "results": []}), 200

    pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.lower().endswith(".pdf")])

    results_list = []
    for pdf_name in pdf_files:
        stem = pdf_name[:-4]

        notes_name = f"{stem}_notes.json"
        task_name = f"{stem}.json"

        results_list.append(
            {
                "id": stem,
                "stem": stem,
                "displayName": stem.replace("_", " "),
                "pdf": {"filename": pdf_name, "url": f"/api/batch/{batch_id}/pdf/{pdf_name}"},
                "notes": {
                    "filename": notes_name,
                    "url": f"/api/batch/{batch_id}/notes/{notes_name}",
                    "exists": os.path.isfile(os.path.join(n_dir, notes_name)),
                },
                "task": {
                    "filename": task_name,
                    "url": f"/api/batch/{batch_id}/results_tasks/{task_name}",
                    "exists": os.path.isfile(os.path.join(t_dir, task_name)),
                },
            }
        )

    return jsonify({"batchId": batch_id, "count": len(results_list), "results": results_list}), 200


@app.route("/api/batch/<batch_id>/pdf/<path:filename>", methods=["GET"])
def view_pdf(batch_id, filename):
    directory = out_pdf_dir(batch_id)
    full_path = safe_join(directory, filename)
    if not full_path or not os.path.isfile(full_path):
        return jsonify({"error": "PDF not found"}), 404

    return send_from_directory(directory, filename, mimetype="application/pdf", as_attachment=False)


@app.route("/api/batch/<batch_id>/notes/<path:filename>", methods=["GET"])
def get_notes(batch_id, filename):
    return send_from_directory(notes_dir(batch_id), filename, as_attachment=False)


@app.route("/api/batch/<batch_id>/results_tasks/<path:filename>", methods=["GET"])
def get_result_task(batch_id, filename):
    return send_from_directory(tasks_dir(batch_id), filename, as_attachment=False)


@app.route("/api/batch/<batch_id>/tasks/<path:filename>", methods=["GET"])
def get_task_legacy(batch_id, filename):
    return send_from_directory(tasks_dir(batch_id), filename, as_attachment=False)


@app.route("/api/batch/<batch_id>/status", methods=["GET"])
def batch_status(batch_id):
    st = read_status(batch_id)
    if not st:
        return jsonify({"state": "idle", "batchId": batch_id}), 200
    return jsonify(st), 200

@app.route("/api/batch/<batch_id>/pin", methods=["GET", "POST"])
def batch_pin(batch_id):
    if request.method == "GET":
        meta = read_meta(batch_id) or {}
        return jsonify({"batchId": batch_id, "pin": meta.get("pin", "")}), 200

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    raw_pin = data.get("pin", None)

    if raw_pin is None or (isinstance(raw_pin, str) and raw_pin.strip() == ""):
        pin = generate_pin(6)
    else:
        pin = str(raw_pin).strip()

    if len(pin) < 4 or len(pin) > 12:
        return jsonify({"error": "PIN must be 4..12 chars"}), 400
    if any(ch.isspace() for ch in pin):
        return jsonify({"error": "PIN must not contain spaces"}), 400

    meta = read_meta(batch_id) or {}
    meta["pin"] = pin
    write_meta(batch_id, meta)

    return jsonify({"batchId": batch_id, "pin": pin, "message": "saved"}), 200

@app.route("/api/batch/<batch_id>/access", methods=["POST"])
def student_access(batch_id):
    data = request.get_json(silent=True) or {}
    email = normalize_email(str(data.get("email") or ""))
    pin = str(data.get("pin") or "").strip()

    if not email or "@" not in email:
        return jsonify({"error": "Invalid email"}), 400

    # 1) verify pin
    meta = read_meta(batch_id) or {}
    expected_pin = str(meta.get("pin") or "").strip()
    if not expected_pin:
        return jsonify({"error": "PIN is not set for this batch"}), 400
    if pin != expected_pin:
        return jsonify({"error": "Invalid credentials"}), 403

    # 2) load manifest
    mp = selected_manifest_path(batch_id)
    if not os.path.isfile(mp):
        return jsonify({"error": "Students list not prepared (run filter first)"}), 400

    with open(mp, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    students = manifest.get("students") or []
    match = None
    for s in students:
        if normalize_email(s.get("email")) == email:
            match = s
            break

    if not match:
        return jsonify({"error": "Invalid credentials"}), 403

    stem = match["stem"]

    pdf_name = f"{stem}.pdf"
    notes_name = f"{stem}_notes.json"
    task_name = f"{stem}.json"

    pdf_full = os.path.join(out_pdf_dir(batch_id), pdf_name)
    if not os.path.isfile(pdf_full):
        return jsonify({"error": "Materials are not ready yet. Try again later."}), 404

    return jsonify(
        {
            "batchId": batch_id,
            "displayName": match.get("displayName", stem),
            "stem": stem,
            "pdf": {"url": f"/api/batch/{batch_id}/pdf/{pdf_name}"},
            "notes": {
                "url": f"/api/batch/{batch_id}/notes/{notes_name}",
                "exists": os.path.isfile(os.path.join(notes_dir(batch_id), notes_name)),
            },
            "task": {
                "url": f"/api/batch/{batch_id}/results_tasks/{task_name}",
                "exists": os.path.isfile(os.path.join(tasks_dir(batch_id), task_name)),
            },
        }
    ), 200

if __name__ == "__main__":
    app.run(port=5000, debug=True, use_reloader=False)
