"""
Modelos Pydantic para o microserviço de processamento de PDF
"""

from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class ProcessingStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class Alternative(BaseModel):
    letter: str
    content: str
    order: int


class ProcessedQuestion(BaseModel):
    number: int
    content: str
    alternatives: list[Alternative]
    correct_answer: Optional[str] = None
    source_page: Optional[int] = None
    source_position: Optional[int] = None
    has_image: bool = False
    image_base64: Optional[str] = None
    raw_text: Optional[str] = None
    confidence: float = 0.9
    suggested_subject: Optional[str] = None
    suggested_subject_confidence: Optional[str] = None
    suggested_subject_alternatives: Optional[list[str]] = None
    suggested_topic: Optional[str] = None
    # Novos campos v3
    base_text: Optional[str] = None              # texto-base compartilhado (questões 1-5, etc.)
    section: Optional[str] = None                # nome da matéria/disciplina detectada no bloco
    origin: Optional[dict[str, Any]] = None      # rastreabilidade completa da origem


class ProcessingResult(BaseModel):
    job_id: str
    status: ProcessingStatus
    total_extracted: int
    questions: list[ProcessedQuestion]
    original_filename: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class PDFProcessRequest(BaseModel):
    gabarito_no_mesmo_pdf: bool = False
    banca: Optional[str] = None
    concurso: Optional[str] = None
    cargo: Optional[str] = None
    cidade: Optional[str] = None
    materia: Optional[str] = None
    ano: Optional[int] = None
