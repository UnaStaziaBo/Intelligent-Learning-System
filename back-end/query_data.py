import argparse
import os
import json
import time
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from get_embedding_function import get_embedding_function

from datetime import date
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from openai import OpenAI
from pydantic import BaseModel, Field
from playwright.sync_api import sync_playwright

MAX_RETRIES = 3


load_dotenv()

CHROMA_PATH = "chroma"

PROMPT_TEMPLATE = {
    "sk": """
Ste komentátor zo Slovenska. Vašou úlohou je vo slovenčine iba na základe uvedeného kontextu {context} napísať správu o uvedených otázkoch {question}.
Vymyslite zaujímavé otázky, ktoré by ste chceli položiť, a odpovedzte na každú z nich.

#Pokyny:
## Zhrnutie:
Jasným a stručným slovenským jazykom zhrňte kľúčové body a témy uvedené v otázke vo slovenčine.

## Zaujímavé otázky:
Vymyslite rovnaké množstvo odlišných a podnetných otázok vo slovenčine, ktoré možno položiť k obsahu otázky {question}. Pre každú otázku:
Nepoužívajte rovnaké alebo príbuzné slová ako v hlavnej otázke {question}.

##Výsledok musí byť iba vo formáte JSON, nepište nič JSON:
Vytvorte presne 10 otázok a k nim presne 10 odpovedí.

[
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}}
]

""",

    "uk": """
Ви коментатор з України. Ваше завдання полягає в тому, щоб, спираючись лише на наведений контекст {context}, написати повідомлення про зазначені питання {question} українською мовою.
Придумайте цікаві питання, які ви хотіли б задати, і дайте відповідь на кожне з них.

#Інструкції:
## Підсумок:
Придумайте однакову кількість різних і цікавих питань українською мовою, які можна задати щодо змісту питання {question}. Для кожного питання:
Не використовуйте ті самі або споріднені слова, що й у головному питанні {question}.

##Результат повинен бути тільки у форматі JSON, не пишіть нічого окрім JSON:
Складіть рівно 10 питань і рівно 10 відповідей на них.

[
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}},
  {{"Otazka": "?", "Odpoved": "?"}}
]
    """,
}
# Opakujte, kým počet vašich otázok a odpovedí nebude rovnaký ako počet daných otázok {question}.
# """

SYSTEM_PROMPTS = {
    "sk": (
        "Ste asistent, ktorý robí poznámky pre študentov. "
        "Na základe uvedeného kontextu {context} vráťte prísne štruktúrovaný konspekt podľa schémy. "
        "Píšte stručne, ale zrozumiteľne a vytvárajte logické oddiely. "
        "Poskytnite vzdelávacie odporúčania k daným témam, v ktorých spomeňte zdroje {sources}."
    ),
    "uk": (
        "Ти асистент, який створює навчальні конспекти для студентів. "
        "На основі наданого контексту {context} поверни строго структурований конспект відповідно до схеми. "
        "Пиши коротко, але зрозуміло, формуй логічні розділи. "
        "Додай освітні рекомендації до теми з посиланням на використані джерела {sources}."
    ),
}

USER_PROMPTS = {
    "sk": """Vytvorte poznámky k téme/textu nižšie.

TÉMA/TEXT:
{topic}

Požiadavky:
- 4–7 sekcií
- v každej sekcii: 1–3 odseky notes a/alebo bullets
- ak sú tam pojmy, preneste ich do terms
- zhrňte všetky dôležité informácie a vložte to do callout
- odporúčania týkajúce sa učebných materiálov vytvorte na základe použitých zdrojov {sources}
- pridajte odporúčania na koniec každej sekcie

NA KONCI MUSÍ BYŤ ZÁVER (Záver):
- samostatné pole `conclusion`
- 7–10 viet
- zhrnutie najdôležitejších myšlienok
- personalizované odporúčania na ďalšie štúdium
- žiadne nové pojmy
- nepridávajte Záver ako sekciu do `sections`
""",

    "uk": """Створи конспект до теми/тексту нижче.

ТЕМА/ТЕКСТ:
{topic}

Вимоги:
- 4–7 розділів
- у кожному розділі: 1–3 абзаци notes або bullets
- якщо є терміни — перенеси їх у terms
- узагальни ключові ідеї та додай їх у callout
- рекомендації щодо навчальних матеріалів сформуй на основі джерел {sources}
- додай рекомендації наприкінці кожного розділу

НАПРИКІНЦІ ОБОВʼЯЗКОВО ДОДАЙ ВИСНОВОК (Висновок):
- окреме поле `conclusion`
- 7–10 речень
- підсумок найважливіших ідей
- персоналізовані рекомендації для подальшого навчання
- не додавай нові терміни
- не додавай Висновок як секцію у `sections`
"""
}

#========================================== Creating a PDF document ==============================

# Pydantic schema (JSON assignment summary)
class Term(BaseModel):
    term: str
    definition: str


class Section(BaseModel):
    heading: str
    notes: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    terms: list[Term] = Field(default_factory=list)
    callout: str | None = None
    recommendations: str | None = None



class Meta(BaseModel):
    date: str | None = None
    sources: list[str] = Field(default_factory=list) 


class NotesDoc(BaseModel):
    title: str
    meta: Meta | None = None
    sections: list[Section]
    conclusion: str
    

# OpenAI parsing
def generate_notes_json(topic_or_text: str, sources: list[str] | None = None, language: str = "sk") -> NotesDoc:
    client = OpenAI()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    language = (language or "sk").strip().lower().split("-")[0]
    if language not in ("sk", "uk"):
        language = "sk"

    system = SYSTEM_PROMPTS[language]

    user = USER_PROMPTS[language].format(
        topic=topic_or_text,
        sources=sources,
    )

    resp = client.responses.parse(
        model=model,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        text_format=NotesDoc,
    )

    doc: NotesDoc = resp.output_parsed

    doc.meta = doc.meta or Meta()
    doc.meta.date = doc.meta.date or str(date.today())

    if sources is not None:
        doc.meta.sources = [s for s in sources if s]

    if not doc.conclusion or not doc.conclusion.strip():
        doc.conclusion = (
            "Téma zdôrazňuje kľúčové princípy a praktické využitie preberaných konceptov."
            if language == "sk"
            else "Тема підкреслює ключові принципи та практичне застосування розглянутих концепцій."
        )

    return doc


# JSON -> HTML (Jinja2)
def render_html(doc: NotesDoc) -> str:
    env = Environment(
        loader=FileSystemLoader("templates"),
        autoescape=select_autoescape(["html", "xml"]),
    )

    tpl = env.get_template("notes.html")
    return tpl.render(doc=doc.model_dump())


def _escape_for_playwright_template(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


# HTML -> PDF (Playwright)
def html_to_pdf(html: str, out_path: str, title_for_footer: str) -> None:
    safe_title = _escape_for_playwright_template(title_for_footer)

    footer_template = f"""
      <div style="font-size:9px; width:100%; padding:0 12mm; color:#666;">
        <span style="float:left;">{safe_title}</span>
        <span style="float:right;">
          <span class="pageNumber"></span>/<span class="totalPages"></span>
        </span>
      </div>
    """

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")

        page.pdf(
            path=out_path,
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template="<div></div>",
            footer_template=footer_template,
            margin={"top": "18mm", "right": "15mm", "bottom": "18mm", "left": "15mm"},
        )
        browser.close()

#==========================================================================================

def query_rag(query_text, tasks_dir, pdf_dir, notes_dir, output_stem, batch_id, language):
    tasks_dir = Path(tasks_dir)
    pdf_dir = Path(pdf_dir)
    notes_dir = Path(notes_dir)

    tasks_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)
    notes_dir.mkdir(parents=True, exist_ok=True)

    rag_json_path = tasks_dir / f"{output_stem}.json"

    # Prepare the DB.
    embedding_function = get_embedding_function()
    chroma_path = os.path.join("uploads", batch_id, "chroma")
    db = Chroma(persist_directory=chroma_path, embedding_function=embedding_function)

    
    # Search the DB.
    results = db.similarity_search_with_score(query_text, k=3)

    language = (language or "sk").strip().lower().split("-")[0]
    if language not in ("sk", "uk"):
        language = "sk"

    context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])

    prompt_template_text = PROMPT_TEMPLATE[language]
    prompt_template = ChatPromptTemplate.from_template(prompt_template_text)

    prompt = prompt_template.format(
        context=context_text,
        question=query_text,
    )
    # print(prompt)

    model = ChatOpenAI(
        model="gpt-4.1-mini", 
        temperature=0.1,      
    )
    
    attempt = 0

    while attempt < MAX_RETRIES:
        attempt += 1
        response_msg = model.invoke(prompt)


        raw_text = response_msg.content if hasattr(response_msg, "content") else str(response_msg)
        raw_text = raw_text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`").strip()
            if raw_text.lower().startswith("json"):
                raw_text = raw_text[4:].lstrip()


        try:
            data_list = json.loads(raw_text)
            break
        except json.JSONDecodeError as e:
            print("invalid JSON: ")
            print(raw_text)
            
            if attempt == MAX_RETRIES:
                raise e
            else:
                continue

    sources = [doc.metadata.get("id", None) for doc, _score in results]

    result_obj = {
        "data": data_list,  
        "sources": sources, 
    }

    with open(rag_json_path, "w", encoding="utf-8") as result_file:
        json.dump(result_obj, result_file, ensure_ascii=False, indent=2)

    print(json.dumps(result_obj, ensure_ascii=False, indent=2))

    #===PDF creating===
    notes_json_path = notes_dir / f"{output_stem}_notes.json"
    pdf_path = pdf_dir / f"{output_stem}.pdf"

    rag_payload = json.dumps(result_obj, ensure_ascii=False, indent=2)
    doc = generate_notes_json(rag_payload, sources, language)


    notes_json_path.write_text(
        doc.model_dump_json(indent=2),
        encoding="utf-8",
    )

    html = render_html(doc)
    html_to_pdf(html, str(pdf_path), title_for_footer=doc.title)

    print(f"OK: {pdf_path.resolve()}")
    print(f"JSON: {(notes_json_path / 'notes.json').resolve()}")


    return result_obj
