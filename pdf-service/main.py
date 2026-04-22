"""
Descomplique seu Concurso — PDF Processing Microservice
FastAPI service para extração inteligente de questões de PDFs de concursos públicos.

Pipeline:
1. Leitura do PDF com detecção de layout (1 col, 2 col, escaneado)
2. OCR com pré-processamento quando necessário
3. Parsing de questões com alternativas
4. Extração de gabarito (mesmo PDF ou separado)
5. Classificação automática de matéria por palavras-chave
6. Extração automática de metadados (banca, cidade, ano, cargo, concurso)
7. Recorte de imagem para questões com figuras
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from processors.pdf_reader import PDFReader
from processors.question_parser import QuestionParser
from processors.answer_key_extractor import AnswerKeyExtractor
from processors.image_extractor import ImageExtractor
from processors.subject_classifier import SubjectClassifier
from processors.metadata_extractor import MetadataExtractor
from models.schemas import (
    PDFProcessRequest,
    ProcessedQuestion,
    ProcessingResult,
    ProcessingStatus,
)

app = FastAPI(
    title="Descomplique seu Concurso — PDF Service",
    description="Microserviço para extração inteligente de questões de PDFs de concursos",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PDF_SERVICE_SECRET = os.getenv("PDF_SERVICE_SECRET", "secret-compartilhado")

# Instâncias globais (evita recompilar regex a cada request)
_subject_classifier = SubjectClassifier()
_metadata_extractor = MetadataExtractor()


def _export_question_content(q: dict) -> str:
    """
    Enunciado completo para o aluno: texto-base compartilhado + comando da questão.
    Sem isso, o campo content fica só com o trecho após as alternativas do bloco anterior.
    """
    import re

    def _strip_pages(s: str) -> str:
        return re.sub(r"\[PAGE:\d+\]\s*", "", s or "").strip()

    bt = _strip_pages(q.get("base_text") or "")
    stem = _strip_pages(q.get("content") or "")
    if not bt:
        return stem
    return (
        "[Texto-base para esta questão]\n\n"
        + bt
        + "\n\n————————————————————————————————————————\n\n[Enunciado]\n\n"
        + stem
    )


def _propagate_shared_images(questions: list[dict]) -> list[dict]:
    """
    Propaga imagens e conteúdo visual compartilhado entre questões relacionadas.

    Regras:
    1. Se questões compartilham o mesmo base_text, e UMA delas tem imagem,
       todas recebem a mesma imagem (era uma tabela/gráfico compartilhado).
    2. Se questões consecutivas na mesma página referenciam o mesmo elemento
       visual ("a tabela acima", "o gráfico anterior"), propagar de quem tem
       para quem não tem.
    """
    import re

    # Palavras que indicam referência a elemento visual anterior/compartilhado
    VISUAL_REF = re.compile(
        r"\b(a\s+tabela|o\s+gr[áa]fico|a\s+figura|o\s+mapa|o\s+quadro|"
        r"a\s+imagem|o\s+diagrama|os\s+dados|os\s+valores|a\s+seguinte|"
        r"o\s+seguinte|apresentad[ao]|acima|abaixo|anterior)\b",
        re.IGNORECASE,
    )

    # Agrupar por base_text (usar os primeiros 100 chars como chave para evitar
    # comparar textos enormes)
    base_text_groups: dict[str, list[int]] = {}
    for idx, q in enumerate(questions):
        bt = q.get("base_text")
        if bt:
            key = bt[:100]
            base_text_groups.setdefault(key, []).append(idx)

    # Para cada grupo com base_text: se alguma questão tem imagem, propagar
    for key, indices in base_text_groups.items():
        if len(indices) < 2:
            continue
        # Encontrar a imagem representativa do grupo
        shared_image = None
        for idx in indices:
            if questions[idx].get("has_image") and questions[idx].get("image_base64"):
                shared_image = questions[idx]["image_base64"]
                break
        if shared_image:
            for idx in indices:
                if not questions[idx].get("has_image"):
                    questions[idx]["has_image"] = True
                    questions[idx]["image_base64"] = shared_image

    # Propagação por referência visual em questões consecutivas na mesma página
    for i in range(1, len(questions)):
        q_curr = questions[i]
        q_prev = questions[i - 1]

        # Mesma página?
        if q_curr.get("page") != q_prev.get("page"):
            continue

        # Questão atual referencia elemento visual mas não tem imagem?
        content = q_curr.get("content", "") + " ".join(
            a.get("content", "") for a in q_curr.get("alternatives", [])
        )
        if not q_curr.get("has_image") and bool(VISUAL_REF.search(content)):
            # Anterior tem imagem?
            if q_prev.get("has_image") and q_prev.get("image_base64"):
                q_curr["has_image"] = True
                q_curr["image_base64"] = q_prev["image_base64"]

    return questions


def verify_secret(x_service_secret: str = Header(...)):
    if x_service_secret != PDF_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "pdf-service", "version": "2.0.0"}


@app.post("/process", response_model=ProcessingResult)
async def process_pdf(
    prova_file: UploadFile = File(...),
    gabarito_file: Optional[UploadFile] = File(None),
    gabarito_no_mesmo_pdf: bool = Form(False),
    banca: Optional[str] = Form(None),
    concurso: Optional[str] = Form(None),
    cargo: Optional[str] = Form(None),
    cidade: Optional[str] = Form(None),
    materia: Optional[str] = Form(None),
    ano: Optional[int] = Form(None),
    authorized: bool = Depends(verify_secret),
):
    """
    Processa um PDF de prova e extrai questões com metadados.
    
    Retorna questões estruturadas com:
    - Enunciado e alternativas
    - Gabarito (quando disponível)
    - Sugestão de matéria por classificação automática
    - Metadados inferidos do PDF (banca, cidade, ano, cargo)
    - Rastreabilidade da origem (página, posição)
    """
    import uuid
    job_id = str(uuid.uuid4())

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # ── 1. Salvar arquivos ──────────────────────────────────────────
            prova_path = os.path.join(tmpdir, f"prova_{job_id}.pdf")
            with open(prova_path, "wb") as f:
                f.write(await prova_file.read())

            gabarito_path = None
            if gabarito_file and gabarito_file.filename:
                gabarito_path = os.path.join(tmpdir, f"gabarito_{job_id}.pdf")
                with open(gabarito_path, "wb") as f:
                    f.write(await gabarito_file.read())

            # ── 2. Ler o PDF ────────────────────────────────────────────────
            reader = PDFReader()
            pdf_data = reader.read(prova_path)

            # ── 3. Extrair metadados do PDF (automático) ────────────────────
            inferred_meta = _metadata_extractor.extract(pdf_data["pages"])

            # Metadados finais: admin tem prioridade, inferido é fallback
            final_banca = banca or inferred_meta.get("banca")
            final_concurso = concurso or inferred_meta.get("concurso")
            final_cargo = cargo or inferred_meta.get("cargo")
            final_cidade = cidade or inferred_meta.get("cidade")
            final_ano = ano or inferred_meta.get("ano")

            # ── 4. Extrair gabarito ─────────────────────────────────────────
            answer_key: dict[int, str] = {}
            key_extractor = AnswerKeyExtractor()

            if gabarito_no_mesmo_pdf:
                answer_key = key_extractor.extract_from_text(pdf_data["full_text"])
            elif gabarito_path:
                gabarito_data = reader.read(gabarito_path)
                answer_key = key_extractor.extract_from_text(gabarito_data["full_text"])
            
            # Tentar extrair gabarito do próprio PDF mesmo que não solicitado
            # (muitas provas têm gabarito nas últimas páginas)
            if not answer_key:
                answer_key = key_extractor.extract_from_text(pdf_data["full_text"])

            # ── 5. Parse das questões ───────────────────────────────────────
            parser = QuestionParser()
            raw_questions = parser.parse(pdf_data["pages"], metadata={
                "banca": final_banca,
                "concurso": final_concurso,
                "cargo": final_cargo,
                "cidade": final_cidade,
                "materia": materia,
                "ano": final_ano,
                "filename": prova_file.filename,
            })

            # ── 6. Extrair imagens das questões ────────────────────────────
            image_extractor = ImageExtractor()
            questions_with_images = image_extractor.extract_question_images(
                prova_path, raw_questions
            )

            # ── 6b. Propagar imagens compartilhadas ────────────────────────
            # Se um elemento visual (tabela, gráfico, mapa) serve para múltiplas
            # questões que compartilham o mesmo texto-base, propagar a imagem
            # para todas as questões do grupo.
            questions_with_images = _propagate_shared_images(questions_with_images)

            # ── 7. Classificar matérias + aplicar gabarito ─────────────────
            processed_questions = []
            for i, q in enumerate(questions_with_images, start=1):
                question_num = q.get("number", i)
                correct_answer = answer_key.get(question_num)

                # Classificar matéria automaticamente (inclui texto-base no contexto)
                question_text = (
                    f"{q.get('base_text') or ''} {q.get('content', '')} "
                    + " ".join(a.get("content", "") for a in q.get("alternatives", []))
                )

                if materia:
                    # Admin especificou matéria: usar como primária
                    suggested_subject = materia
                    subject_confidence = "high"
                    subject_alts = []
                else:
                    # Classificação automática
                    classifications = _subject_classifier.classify(question_text, top_n=3)
                    if classifications:
                        suggested_subject = classifications[0]["subject"]
                        subject_confidence = classifications[0]["confidence"]
                        subject_alts = [c["subject"] for c in classifications[1:]]
                    else:
                        suggested_subject = None
                        subject_confidence = "low"
                        subject_alts = []

                processed_questions.append(
                    ProcessedQuestion(
                        number=question_num,
                        content=_export_question_content(q),
                        alternatives=q["alternatives"],
                        correct_answer=correct_answer,
                        source_page=q.get("page"),
                        source_position=q.get("position"),
                        has_image=q.get("has_image", False),
                        image_base64=q.get("image_base64"),
                        raw_text=q.get("raw_text"),
                        confidence=q.get("confidence", 0.9),
                        suggested_subject=suggested_subject,
                        suggested_subject_confidence=subject_confidence,
                        suggested_subject_alternatives=subject_alts,
                        # Novos campos
                        base_text=q.get("base_text"),
                        section=q.get("section"),
                        origin=q.get("origin"),
                    )
                )

            # ── 8. Retornar resultado ───────────────────────────────────────
            return ProcessingResult(
                job_id=job_id,
                status=ProcessingStatus.SUCCESS,
                total_extracted=len(processed_questions),
                questions=processed_questions,
                original_filename=prova_file.filename,
                metadata={
                    # Metadados finais mesclados
                    "banca": final_banca,
                    "concurso": final_concurso,
                    "cargo": final_cargo,
                    "cidade": final_cidade,
                    "estado": inferred_meta.get("estado"),
                    "materia": materia,
                    "ano": final_ano,
                    "nivel": inferred_meta.get("nivel"),
                    "tipo_prova": inferred_meta.get("tipo_prova"),
                    # Diagnóstico
                    "has_text": pdf_data.get("has_text", True),
                    "used_ocr": pdf_data.get("used_ocr", False),
                    "total_pages": pdf_data.get("total_pages", 0),
                    "answer_key_found": len(answer_key) > 0,
                    "answer_key_count": len(answer_key),
                    # Metadados inferidos brutos para debug/review
                    "inferred": inferred_meta,
                },
            )

    except Exception as e:
        return ProcessingResult(
            job_id=job_id,
            status=ProcessingStatus.FAILED,
            total_extracted=0,
            questions=[],
            original_filename=prova_file.filename,
            error=str(e),
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
