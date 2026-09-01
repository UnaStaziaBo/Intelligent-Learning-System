import csv
import os
import json
import random
import argparse
import sys
import time
from pathlib import Path

from query_data import query_rag
from populate_database import *


class UserVisibleError(Exception):
    """An error with a message that can be safely displayed to the user."""


def get_user_message(message: str, language: str) -> str:
    msg = (message or "").strip().lower()

    if language == "uk":
        if "selected.csv not found" in msg or "file not found" in msg:
            return "Не вдалося знайти CSV-файл із відповідями студентів."
        if "empty csv" in msg:
            return "CSV-файл порожній."
        if "missing header" in msg:
            return "CSV-файл не містить заголовка."
        if "too few columns" in msg:
            return "CSV-файл має неправильну структуру або замало стовпців."
        if "no data rows" in msg:
            return "CSV-файл не містить жодного рядка з даними."
        if "moodle format" in msg:
            return "Завантажений CSV-файл не схожий на експорт Moodle."
        if "custom format" in msg:
            return "Завантажений CSV-файл не відповідає очікуваному custom-формату."
        if "encoding" in msg or "unicode" in msg:
            return "Не вдалося прочитати CSV-файл. Ймовірно, файл має неправильне кодування."
        if "csv" in msg or "delimiter" in msg or "column" in msg:
            return "CSV-файл має неправильний формат. Перевірте тип CSV і структуру стовпців."
        return "Під час обробки файлу сталася помилка. Перевірте формат CSV і спробуйте ще раз."

    # default sk
    if "selected.csv not found" in msg or "file not found" in msg:
        return "Nepodarilo sa nájsť CSV súbor s odpoveďami študentov."
    if "empty csv" in msg:
        return "CSV súbor je prázdny."
    if "missing header" in msg:
        return "CSV súbor neobsahuje hlavičku."
    if "too few columns" in msg:
        return "CSV súbor má nesprávnu štruktúru alebo príliš málo stĺpcov."
    if "no data rows" in msg:
        return "CSV súbor neobsahuje žiadne dátové riadky."
    if "moodle format" in msg:
        return "Nahraný CSV súbor nevyzerá ako Moodle export."
    if "custom format" in msg:
        return "Nahraný CSV súbor nezodpovedá očakávanému custom formátu."
    if "encoding" in msg or "unicode" in msg:
        return "CSV súbor sa nepodarilo načítať. Pravdepodobne má nesprávne kódovanie."
    if "csv" in msg or "delimiter" in msg or "column" in msg:
        return "CSV súbor má nesprávny formát. Skontrolujte typ CSV a štruktúru stĺpcov."
    return "Počas spracovania súboru nastala chyba. Skontrolujte formát CSV a skúste to znova."


def validate_csv_or_raise(file_path: str, csv_type: str, language: str) -> None:
    if not os.path.isfile(file_path):
        raise UserVisibleError(get_user_message("selected.csv not found", language))

    try:
        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            sample = f.read(4096)
            f.seek(0)

            if not sample.strip():
                raise UserVisibleError(get_user_message("empty csv", language))

            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
            except Exception:
                dialect = csv.excel

            reader = csv.reader(f, dialect)
            rows = list(reader)

        if not rows or not rows[0]:
            raise UserVisibleError(get_user_message("missing header", language))

        header = [str(col).strip() for col in rows[0] if str(col).strip()]
        if len(header) < 2:
            raise UserVisibleError(get_user_message("too few columns", language))

        if len(rows) < 2:
            raise UserVisibleError(get_user_message("no data rows", language))

        normalized = [h.lower() for h in header]

        if csv_type == "moodle":
            moodle_markers = ["email", "surname", "firstname", "username", "meno", "priezvisko"]
            if not any(marker in col for marker in moodle_markers for col in normalized):
                raise UserVisibleError(get_user_message("moodle format", language))

        elif csv_type == "custom":
            if len(header) < 3:
                raise UserVisibleError(get_user_message("custom format", language))

    except UserVisibleError:
        raise
    except UnicodeDecodeError as e:
        raise UserVisibleError(get_user_message(str(e), language)) from e
    except Exception as e:
        raise UserVisibleError(get_user_message(str(e), language)) from e


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    parser.add_argument("--language", default="sk")
    args = parser.parse_args()

    language = (args.language or "sk").strip().lower().split("-")[0]
    if language not in ("sk", "uk"):
        language = "sk"

    if language == "uk":
        sentences = sentences_to_add_uk
    else:
        sentences = sentences_to_add_sk

    try:
        global_start = time.perf_counter()
        print("\nBATCH START")

        batch_dir = os.path.join("uploads", args.batch)

        # Input: filtered CSV produced by /filter
        file_path = os.path.join(batch_dir, "filtered", "selected.csv")

        # Output folders inside the same batch
        out_pdf_dir = os.path.join(batch_dir, "out_pdf")
        results_tasks_dir = os.path.join(batch_dir, "results_tasks")
        notes_dir = os.path.join(batch_dir, "notes")

        os.makedirs(out_pdf_dir, exist_ok=True)
        os.makedirs(results_tasks_dir, exist_ok=True)
        os.makedirs(notes_dir, exist_ok=True)

        # Materials uploaded by teacher (optional)
        materials_dir = os.path.join(batch_dir, "data")
        if not os.path.isdir(materials_dir):
            fallback_dir = Path(__file__).resolve().parent / "test_data"
            if fallback_dir.is_dir():
                materials_dir = str(fallback_dir)
            else:
                print("[main] WARNING: materials_dir not found:", materials_dir)
                print("[main] WARNING: fallback test_data not found:", fallback_dir)

        print("[main] CSV:", file_path)
        print("[main] materials:", materials_dir)
        print("[main] out_pdf:", out_pdf_dir)
        print("[main] results_tasks:", results_tasks_dir)
        print("[main] notes:", notes_dir)

        batch_id = args.batch
        chroma_path = os.path.join(batch_dir, "chroma")
        print("[main] chroma_path:", chroma_path)

        csv_type = "moodle"
        try:
            meta_path = os.path.join(batch_dir, "meta.json")
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            csv_type = str(meta.get("csvType") or "moodle").strip().lower()
        except Exception:
            csv_type = "moodle"

        print("[main] csvType:", csv_type)

        # 0) validate CSV before expensive processing
        t0 = time.perf_counter()
        validate_csv_or_raise(file_path, csv_type, language)
        print(f"[time] validate_csv: {time.perf_counter() - t0:.2f} sec")

        # 1) reset DB
        t0 = time.perf_counter()
        clear_database(chroma_path)
        print(f"[time] clear_database: {time.perf_counter() - t0:.2f} sec")

        # 2) load documents for this batch
        t0 = time.perf_counter()
        docs = load_documents(materials_dir)
        print(f"[time] load_documents: {time.perf_counter() - t0:.2f} sec")

        # 3) split into chunks
        t0 = time.perf_counter()
        chunks = split_documents(docs)
        print(f"[time] split_documents: {time.perf_counter() - t0:.2f} sec")

        # 4) index into Chroma
        t0 = time.perf_counter()
        add_to_chroma(chunks, chroma_path)
        print(f"[time] add_to_chroma: {time.perf_counter() - t0:.2f} sec")

        print(f"[main] indexed {len(chunks)} chunks into Chroma")

        t0 = time.perf_counter()
        if csv_type == "custom":
            lines = tested_responses_analysis_custom(file_path)
            print(f"[time] tested_responses_analysis_custom: {time.perf_counter() - t0:.2f} sec")
        else:
            lines = tested_responses_analysis(file_path)
            print(f"[time] tested_responses_analysis: {time.perf_counter() - t0:.2f} sec")

        if not isinstance(lines, list):
            raise UserVisibleError(get_user_message("csv format invalid", language))

        print("[main] lines:", len(lines))

        # Create per-student artifacts
        for line_id, line in enumerate(lines):
            student_start = time.perf_counter()

            if not isinstance(line, (list, tuple)) or len(line) < 3:
                raise UserVisibleError(get_user_message("csv format invalid", language))

            query_text = line[2]
            output_stem = f"{line[0]}_{line[1]}_{line_id}"

            print(f"[main] RAG: {output_stem}")

            query_rag(
                query_text=query_text,
                tasks_dir=results_tasks_dir,
                pdf_dir=out_pdf_dir,
                notes_dir=notes_dir,
                output_stem=output_stem,
                batch_id=batch_id,
                language=language,
            )

            print(f"[time] RAG for {output_stem}: {time.perf_counter() - student_start:.2f} sec")

        # Process ONLY the question JSON files
        json_folder = Path(results_tasks_dir)
        created = sorted([p.name for p in json_folder.glob("*.json")])
        print(f"[main] question JSON created: {len(created)} -> {created[:5]}{'...' if len(created) > 5 else ''}")

        NORMAL = (0, 1, 2, 3, 5, 8, 9)
        SPECIAL = {
            4: mark_part,
            6: mark_every_third,
            7: mark_second_half,
        }

        post_start = time.perf_counter()
        for json_file in json_folder.glob("*.json"):
            for i in NORMAL:
                question_processing(json_file, i, sentences[i])

            for i, fn in SPECIAL.items():
                question_answer_processing(json_file, i, sentences[i], fn)

        print(f"[time] post-processing JSON: {time.perf_counter() - post_start:.2f} sec")

        final_files = sorted([p.name for p in json_folder.glob("*.json")])
        print(f"[main] question JSON after processing: {len(final_files)}")
        print("BATCH END")
        print(f"[time] TOTAL BATCH TIME: {time.perf_counter() - global_start:.2f} sec")

    except UserVisibleError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)

    except Exception as e:
        print(get_user_message(str(e), language), file=sys.stderr)
        raise SystemExit(1)

#Analyze a CSV file
def tested_responses_analysis(file_path):
    results = []

    with open(file_path, newline='') as csvfile:
        reader = csv.reader(csvfile)

        first_row = next(reader)
        value_to_compare = float(first_row[8].split("/")[-1])

        for row_index, row in enumerate(reader, start=1):
            current_value = float(row[8].split("/")[-1]) # Grade

            all_questions = [row[i].strip() for i in range(9, len(row), 3) if row[i].strip()] #All questions

            if current_value < value_to_compare:    
                collected = [] 

                for col_index in range(11, len(row), 3):
                    response_index = col_index - 1   # Response
                    question_index = col_index - 2   # Question

                    right_answer = row[col_index]    #Right answer
                    response = row[response_index]

                    if right_answer == response:
                        continue

                    collected.append(row[question_index].strip())

                if collected:
                    combined = "; ".join(collected)
                    results.append((row[0], row[1], combined))
            else:
                total = len(all_questions)

                if total == 0:
                    continue

                if total == 1:
                    random_questions = all_questions
                else:
                    k = random.randint(1, total - 1)
                    random_questions = random.sample(all_questions, k)

                combined = "; ".join(random_questions)
                results.append((row[0], row[1], combined))
    print(results)

    return results

def _parse_num_den(s: str):
    """
    Parse:
      "7.00 / 10" -> (7.0, 10.0)
      "-- / 0"    -> (0.0, 0.0)
      "0.00 / 1"  -> (0.0, 1.0)
    """
    s = (s or "").strip()
    if "/" not in s:
        try:
            return float(s.replace(",", ".")), 0.0
        except Exception:
            return 0.0, 0.0

    left, right = s.split("/", 1)
    left = left.strip().replace(",", ".")
    right = right.strip().replace(",", ".")

    def to_float(x: str) -> float:
        x = (x or "").strip()
        if x in ("--", "-", ""):
            return 0.0
        try:
            return float(x)
        except Exception:
            return 0.0

    return to_float(left), to_float(right)


def tested_responses_analysis_custom(file_path: str):
    results = []

    with open(file_path, newline="", encoding="utf-8-sig") as csvfile:
        reader = csv.reader(csvfile)

        header = next(reader, None)        
        first_data_row = next(reader, None)  
        if not first_data_row:
            print(results)
            return results

        TOTAL_SCORE_I = 1
        LAST_I = 2
        FIRST_I = 5
        QUESTIONS_START_I = 11  # Question, Question[Score], Question[Feedback], ...

        _num, value_to_compare = _parse_num_den(
            first_data_row[TOTAL_SCORE_I] if len(first_data_row) > TOTAL_SCORE_I else ""
        )
        if value_to_compare <= 0:
            value_to_compare = 10.0  # fallback

        def process_row(row):
            nonlocal results
            if not row:
                return

            last_name = (row[LAST_I] if len(row) > LAST_I else "").strip()
            first_name = (row[FIRST_I] if len(row) > FIRST_I else "").strip()
            if not (last_name or first_name):
                return

            safe_last = last_name.replace(" ", "_")
            safe_first = first_name.replace(" ", "_")

            cur_num, _cur_den = _parse_num_den(
                row[TOTAL_SCORE_I] if len(row) > TOTAL_SCORE_I else ""
            )
            current_value = cur_num

            all_questions = [
                str(header[i]).strip()
                for i in range(QUESTIONS_START_I, len(header), 3)
                if i < len(header) and str(header[i]).strip()
            ]

            if current_value < value_to_compare:
                collected = []

                # score columns: QUESTIONS_START_I+1, +3, ...
                for score_i in range(QUESTIONS_START_I + 1, len(row), 3):
                    q_i = score_i - 1

                    score_raw = row[score_i] if score_i < len(row) else ""
                    got, need = _parse_num_den(str(score_raw))

                    if need <= 0:
                        continue

                    if got < need:
                        q_text = str(header[q_i]).strip() if q_i < len(header) else ""
                        if q_text:
                            collected.append(q_text)

                if collected:
                    combined = "; ".join(collected)
                    results.append((safe_last, safe_first, combined))
            else:
                total = len(all_questions)
                if total == 0:
                    return

                if total == 1:
                    random_questions = all_questions
                else:
                    k = random.randint(1, total - 1)
                    random_questions = random.sample(all_questions, k)

                combined = "; ".join(random_questions)
                results.append((safe_last, safe_first, combined))

        process_row(first_data_row)
        for row in reader:
            process_row(row)

    print(results)
    return results


#Add a sentence from the list to the end of the question 
def question_processing(output_dir, question_index, sentences):          
        with open(output_dir, "r") as file:
            data_json = json.load(file)
        
        questions = data_json.get("data", [])
        questions[question_index]["Otazka"] = questions[question_index]["Otazka"].rstrip() + " " + sentences

        with open(output_dir, "w") as file:
            json.dump(data_json, file, ensure_ascii=False, indent=2)

#Add a sentence from the list to the end of the question and mark answer
def question_answer_processing(output_dir, question_index, sentences, transform_answer):
        with open(output_dir, "r") as file:
            data_json = json.load(file)
        
        questions = data_json.get("data", [])
        questions[question_index]["Otazka"] = questions[question_index]["Otazka"].rstrip() + " " + sentences

        words = questions[question_index]["Odpoved"].split()
        exercise_text = transform_answer(words)

        new_item = {
            "Otazka": questions[question_index]["Otazka"],
            "Úloha": exercise_text,
            "Odpoved": questions[question_index]["Odpoved"]
        }

        questions[question_index] = new_item

        with open(output_dir, "w") as file:
            json.dump(data_json, file, ensure_ascii=False, indent=2)

def mark_every_third(words):                    #remove every third word in the answer
        for index in range(1, len(words), 3):
            words[index] = "_________"
        return " ".join(words)

def mark_second_half(words):                    #remove second_half in the answer
        midpoint = len(words) // 2
        exercise_words = words[:midpoint] + ["_________"] * (len(words) - midpoint)
        return " ".join(exercise_words)

def mark_part(words):                           #remove part of the answer
        for index in range(1, min(5, len(words))):
            words[index] = "_________"
        return " ".join(words)


sentences_to_add_sk = [
    "\n\n ◉ Odpovedzte čo najsprávnejšie, všetko vyjde!",                                                                  #Motivation 
    "\n\n ◉ Po svojej odpovedi prečítajte správnu odpoveď rýchlejšie, pomalšie, so záujmom, s iróniou, šeptom.",           #Gestalt
    "\n\n ◉ Odpovedzte na otázku a potom vymyslite jedno slovo, ktoré najlepšie vystihuje túto tému.",                     #Mnemonics Strategy
    "\n\n ◉ Odpoveď používajte iba ako základ, potom doplňte popis sami.",                                                 #Skeleton task
    "\n\n ◉ Obnovte informačný rozdiel do tejto odpovede.",                                                                #Gap task
    "\n\n ◉ Odpovedzte na otázku a vyznačte hlavné body, ako keby ste ich kreslili na schéme.",                            #Brainstorming map
    "\n\n ◉ Doplňte chýbajúce slová do odpovede.",                                                                         #Gestalt
    "\n\n ◉ Dopíšte túto odpoveď do konca.",                                                                               #Deep Cloze
    "\n\n ◉ Okrem tejto odpovede zapíšte všetky informácie, ktoré si k tejto téme pamätáte.",                              #Think-Pair-Share 
    "\n\n ◉ Prečítajte si odporúčanú literatúru ešte raz a osviežte si svoje vedomosti."                                   #Connectivism
]

sentences_to_add_uk = [
    "\n\n ◉ Відповідайте якнайточніше, все вийде!",                                                                        #Motivation 
    "\n\n ◉ Після своєї відповіді прочитайте правильну відповідь швидше, повільніше, з цікавістю, з іронією, пошепки.",    #Gestalt
    "\n\n ◉ Відповідайте на питання, а потім придумайте одне слово, яке найкраще відображає цю тему.",                     #Mnemonics Strategy
    "\n\n ◉ Використовуйте відповідь лише як основу, а потім доповніть опис самостійно.",                                  #Skeleton task
    "\n\n ◉ Оновіть інформаційну прогалину у цій відповіді.",                                                              #Gap task
    "\n\n ◉ Відповідайте на питання і позначте основні моменти, ніби ви їх малюєте на схемі.",                             #Brainstorming map
    "\n\n ◉ Доповніть пропущені слова у відповіді.",                                                                       #Gestalt
    "\n\n ◉ Допишіть цю відповідь до кінця.",                                                                              #Deep Cloze
    "\n\n ◉ Крім цієї відповіді, запишіть всю інформацію, яку ви пам'ятаєте з цієї теми.",                                 #Think-Pair-Share 
    "\n\n ◉ Перечитайте рекомендовану літературу ще раз і освіжіть свої знання."                                           #Connectivism
]

if __name__ == "__main__":
    main()