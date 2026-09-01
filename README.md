# Intelligent System for Supporting Personalized Learning

An AI-powered web application that turns test-response data and course materials into personalised learning support for students preparing for retake examinations.

This repository contains the practical part of the Bachelor's thesis **“Intelligent System for Supporting Personalized Learning”** by **Bc. Anastasiia Borodina**, defended at the [Technical University of Košice](https://www.linkedin.com/company/tuke/). Watch the project presentation: [YouTube video](https://youtu.be/gEvnWakidh4?si=whhpfFm5DatxxE_v).

> Building an AI application is not simply a matter of connecting a language model. It means designing a dependable software system in which AI is one component of a wider architecture. This project explores that balance: strong engineering, transparent processing, and learning support tailored to individual needs.

## Purpose

The system helps teachers identify students who need additional support after an assessment and gives those students tailored materials for further study. It analyses uploaded CSV test results, uses teacher-provided documents as a knowledge base, and produces learning outputs for each selected student.

The generated materials include:

- concise, individual study notes;
- practice questions and exercises;
- recommendations for further learning;
- structured JSON artefacts and printable PDF reports.

The interface is available in Slovak and Ukrainian.

## How it works

```text
Teacher uploads CSV results + course documents
                |
                v
       Flask REST API creates a batch
                |
                v
   Redis Queue runs processing in the background
                |
                v
 PDF documents -> chunks -> OpenAI embeddings -> Chroma
                |
                v
 Test-response analysis + RAG with relevant course content
                |
                v
 Per-student notes, tasks, recommendations, JSON and PDF
```

1. A teacher uploads test results in Moodle or custom CSV format and optionally uploads course materials.
2. The teacher selects the students for whom materials should be generated.
3. A Redis Queue worker starts an asynchronous generation job, so the web application remains responsive.
4. The backend indexes the uploaded learning materials in a batch-specific Chroma vector store.
5. Retrieval-Augmented Generation (RAG) retrieves relevant context for each student's response profile and asks an OpenAI model to produce structured learning content.
6. The system validates and post-processes the generated content, saves JSON artefacts, renders notes from an HTML template, and exports PDF reports.
7. Students access their assigned materials and submit answers; teachers can monitor results and access generated reports.

## Architecture and technologies

| Area | Implementation |
| --- | --- |
| Frontend | React, React Router, React i18next, React Spectrum |
| Backend | Python, Flask, Flask-CORS, REST API |
| Asynchronous processing | Redis and Redis Queue (RQ) |
| AI orchestration | LangChain and OpenAI models |
| Retrieval | OpenAI embeddings, Chroma vector database, RAG |
| Output generation | Pydantic-validated JSON, Jinja2 HTML, Playwright PDF export |
| Supported inputs | Moodle/custom CSV exports and PDF course materials |

The solution follows a client-server, multi-layer approach. Processing is organised around batches and background events, keeping uploaded files, vector indexes, generated tasks, notes, and PDFs isolated per batch.

## Repository structure

```text
.
├── front-end/react-frontend/  # React single-page application
└── back-end/                  # Flask API, RAG pipeline, queue jobs and PDF generation
    ├── server.py              # REST endpoints and batch management
    ├── jobs.py                # RQ background-generation job
    ├── main.py                # CSV analysis and per-student orchestration
    ├── populate_database.py   # Document loading, splitting and Chroma indexing
    ├── query_data.py          # RAG, structured notes and PDF generation
    └── templates/             # HTML template for learning notes
```

## Running locally

### Prerequisites

- Python 3.10+
- Node.js and npm
- Redis server
- An OpenAI API key
- Playwright Chromium browser binaries

### 1. Configure the backend

```bash
cd back-end
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Create `back-end/.env` with your OpenAI credentials:

```env
OPENAI_API_KEY=your_openai_api_key
# Optional; defaults are defined in the source code.
OPENAI_MODEL=gpt-4o-mini
```

Start Redis in a separate terminal, then start an RQ worker and the Flask server from `back-end`:

```bash
redis-server
rq worker jobs
python server.py
```

The API runs on `http://localhost:5000` by default.

### 2. Configure the frontend

In a second terminal:

```bash
cd front-end/react-frontend
npm install
npm start
```

The React development server uses a proxy to forward API requests to the Flask backend at port `5000`.

## Important notes

- Generated content is intended as learning support. Language-model outputs should be reviewed by a teacher before being treated as authoritative educational material.
- Use only assessment data and course materials that you are authorised to process. Student data should be handled in accordance with applicable privacy and institutional requirements.
- The repository includes sample/generated artefacts for demonstration and development purposes.

## Thesis perspective

The central conclusion behind this project is that technology should adapt to people, not the other way around. Effective personalised learning begins with an understanding of students’ goals and difficulties; the technology stack should then serve those needs while remaining maintainable, scalable, and secure.

Generative AI is powerful, but it is not the decision-maker. Reliable educational software still depends on validation, testing, monitoring, retrieval of relevant source material, and thoughtful system design. That balance is what turns a collection of technologies into a tool with practical value in everyday learning.

## Licence

This project is proprietary. No permission is granted to use, copy, modify, distribute, publish, sublicense, commercialise, or create derivative works from the source code, architecture, idea, or accompanying materials without the prior written agreement of the copyright holder. See [LICENSE](LICENSE).
