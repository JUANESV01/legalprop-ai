import hashlib
import math
import os
import re
import logging
import unicodedata
from typing import List, Dict, Any, Optional, Set
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.services.text_splitter import LegalTextSplitter

logger = logging.getLogger(__name__)

SPANISH_STOPWORDS: Set[str] = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
    "en", "y", "o", "u", "a", "que", "es", "son", "se", "por", "para", "con",
    "sin", "sobre", "entre", "su", "sus", "mi", "mis", "tu", "tus", "me", "te",
    "le", "les", "lo", "como", "cual", "cuales", "cuando", "donde", "quien",
    "si", "no", "mas", "muy", "ya", "este", "esta", "estos", "estas", "ese",
    "esa", "puede", "pueden", "debe", "deben", "hay", "hacer", "tengo", "dice",
    "segun", "todo", "todos", "toda", "todas", "pero", "porque",
}

# Expansión semántica ligera del dominio jurídico colombiano (arriendos y propiedad horizontal)
LEGAL_SYNONYM_GROUPS: List[Set[str]] = [
    {"arriendo", "arrendamiento", "alquiler", "canon", "renta", "inquilino", "arrendatario", "arrendador", "ley820"},
    {"ipc", "inflacion", "reajuste", "incremento", "aumento", "subir", "tope", "dane"},
    {"deposito", "caucion", "garantia", "efectivo", "cheque", "prohibicion"},
    {"desalojo", "restitucion", "terminacion", "preaviso", "desahucio", "indemnizacion", "entregar"},
    {"copropiedad", "conjunto", "edificio", "propiedad", "horizontal", "ley675", "reglamento", "manual", "convivencia"},
    {"mascota", "mascotas", "perro", "perros", "gato", "gatos", "animal", "animales", "canino", "correa", "bozal"},
    {"ruido", "ruidos", "musica", "fiesta", "decibeles", "volumen", "tranquilidad", "vecino", "vecinos"},
    {"expensa", "expensas", "cuota", "cuotas", "extraordinaria", "extraordinarias", "administracion", "mora", "moroso", "intereses"},
    {"quorum", "mayoria", "calificada", "asamblea", "impugnar", "impugnacion", "coeficiente", "70"},
    {"ascensor", "escalera", "esencial", "esenciales", "comunes", "piscina", "salon", "parqueadero", "sancion", "multa"},
    {"trasteo", "trasteos", "mudanza", "mudanzas", "horario", "horarios"},
]

_SYNONYM_LOOKUP: Dict[str, str] = {}
for _idx, _grp in enumerate(LEGAL_SYNONYM_GROUPS):
    _concept_token = f"__concept_{_idx}__"
    for _word in _grp:
        _SYNONYM_LOOKUP[_word] = _concept_token


def _normalize_es(text: str) -> str:
    norm = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")


def _tokenize_es(text: str) -> Set[str]:
    norm = _normalize_es(text)
    tokens = re.findall(r"[a-z0-9]{2,}", norm)
    return {t for t in tokens if t not in SPANISH_STOPWORDS and len(t) >= 2}


class LightweightSpanishEmbeddingFunction:
    """
    Función de embeddings vectorial determinista y ultraliviana (dim=384, < 2 MB RAM).
    Evita descargas pesadas de modelos ONNX (~350 MB RAM) en Render Free Tier (512 MB),
    mantiene arranques en < 2s y soporta términos jurídicos, sinónimos legales en español,
    números de artículos, montos y subpalabras (character n-grams).
    """

    DIM = 384

    def name(self) -> str:
        return "legalprop_lightweight_es_v1"

    def _embed_one(self, text: str) -> List[float]:
        vec = [0.0] * self.DIM
        norm = _normalize_es(text)
        words = [w for w in re.findall(r"[a-z0-9]+", norm) if w not in SPANISH_STOPWORDS]

        features: List[tuple[str, float]] = []
        for idx, w in enumerate(words):
            features.append((f"w:{w}", 2.2))
            # Raíz aproximada (primeros 5 chars) para variaciones de género/número en español
            if len(w) >= 5:
                features.append((f"stem:{w[:5]}", 1.3))
            # Expansión de concepto jurídico
            concept = _SYNONYM_LOOKUP.get(w)
            if concept:
                features.append((concept, 1.8))
            # Bigramas para frases clave ("cuota extraordinaria", "salon social", "ley 820")
            if idx + 1 < len(words):
                features.append((f"bi:{w}_{words[idx + 1]}", 1.6))
            # Character 4-grams para robustez ante errores tipográficos y nombres propios
            if len(w) >= 4:
                for i in range(0, min(len(w) - 3, 8)):
                    features.append((f"ng:{w[i:i + 4]}", 0.45))

        for feat, weight in features:
            digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(digest[:4], "little") % self.DIM
            sign = 1.0 if (digest[4] & 1) == 0 else -1.0
            vec[bucket] += sign * weight

        norm_val = math.sqrt(sum(v * v for v in vec))
        if norm_val > 0.0:
            vec = [v / norm_val for v in vec]
        return vec

    def __call__(self, input: List[str]) -> List[List[float]]:  # noqa: A002
        return [self._embed_one(t) for t in input]

    def embed_query(self, input: List[str]) -> List[List[float]]:  # noqa: A002
        return self.__call__(input)

    def embed_documents(self, input: List[str]) -> List[List[float]]:  # noqa: A002
        return self.__call__(input)


class RAGEngine:
    """
    Motor RAG para recuperación y almacenamiento vectorial de normativas de
    arrendamientos urbanos, propiedad horizontal y documentos privados de usuarios
    utilizando ChromaDB con aislamiento por usuario (RNF04), bajo consumo de RAM
    (compatible con Render Free Tier) y re-ranking híbrido.
    """

    def __init__(self):
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        self.collection_name = f"{settings.CHROMA_COLLECTION_NAME}_v2"
        self.text_splitter = LegalTextSplitter()
        self.embedding_fn = LightweightSpanishEmbeddingFunction()
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection = None

    @property
    def client(self) -> chromadb.ClientAPI:
        if self._client is None:
            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_fn,
                metadata={
                    "description": "Corpus normativo y documentos de LegalProp AI",
                    "hnsw:space": "cosine",
                },
            )
        return self._collection

    def ingest_document(
        self,
        doc_id: str,
        title: str,
        category: str,
        content: str,
        norma_numero: str = "",
        owner_scope: str = "public",
        is_public: bool = True,
        filename: str = "",
    ) -> int:
        """
        Segmenta el documento normativo o privado y lo persiste en ChromaDB
        etiquetado con propietario y metadatos jurídicos (RF08 / RNF04).
        """
        self.delete_document(doc_id)

        chunks = self.text_splitter.split_legal_text(
            text=content,
            doc_id=doc_id,
            title=title,
            category=category,
            norma_numero=norma_numero or title,
        )

        if not chunks:
            logger.warning(f"No se generaron fragmentos para el documento '{title}'.")
            return 0

        ids = [c["chunk_id"] for c in chunks]
        documents = [c["content"] for c in chunks]
        metadatas = [
            {
                "doc_id": c["doc_id"],
                "title": c["title"],
                "category": (c["category"] or "general").lower(),
                "norma_numero": c["norma_numero"] or c["title"],
                "article": c["article"] or "",
                "owner_scope": owner_scope,
                "is_public": bool(is_public),
                "filename": filename or title,
            }
            for c in chunks
        ]

        batch_size = 100
        for i in range(0, len(ids), batch_size):
            self.collection.upsert(
                ids=ids[i:i + batch_size],
                documents=documents[i:i + batch_size],
                metadatas=metadatas[i:i + batch_size],
            )

        logger.info(
            f"Ingestados {len(chunks)} fragmentos de '{title}' (ID: {doc_id}, scope: {owner_scope})."
        )
        return len(chunks)

    def delete_document(self, doc_id: str) -> int:
        """Elimina todos los fragmentos de un documento del almacén vectorial."""
        try:
            existing = self.collection.get(where={"doc_id": doc_id})
            ids = existing.get("ids") if existing else []
            if ids:
                self.collection.delete(ids=ids)
                logger.info(f"Eliminados {len(ids)} fragmentos vectoriales del documento {doc_id}.")
                return len(ids)
        except Exception as e:
            logger.warning(f"No se pudieron limpiar fragmentos previos para {doc_id}: {e}")
        return 0

    def delete_owner_documents(self, owner_scope: str) -> int:
        """Elimina todos los documentos privados de un usuario (Habeas Data RNF09)."""
        if not owner_scope or owner_scope == "public":
            return 0
        try:
            existing = self.collection.get(where={"owner_scope": owner_scope})
            ids = existing.get("ids") if existing else []
            if ids:
                self.collection.delete(ids=ids)
                logger.info(f"Eliminados {len(ids)} fragmentos privados del scope {owner_scope}.")
                return len(ids)
        except Exception as e:
            logger.error(f"Error eliminando fragmentos de {owner_scope}: {e}")
        return 0

    def _query_raw(
        self,
        query: str,
        where_filter: Optional[Dict[str, Any]],
        n_results: int,
    ) -> List[Dict[str, Any]]:
        try:
            total = self.collection.count()
            if total == 0:
                return []
            safe_n = max(1, min(n_results, total))
            kwargs: Dict[str, Any] = {
                "query_texts": [query],
                "n_results": safe_n,
            }
            if where_filter:
                kwargs["where"] = where_filter
            results = self.collection.query(**kwargs)
        except Exception as e:
            logger.warning(f"Consulta ChromaDB con filtro {where_filter} retornó excepción: {e}")
            return []

        formatted: List[Dict[str, Any]] = []
        if results and results.get("documents") and results["documents"][0]:
            ids = results["ids"][0] if results.get("ids") else [""] * len(results["documents"][0])
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            distances = results["distances"][0] if results.get("distances") else [0.5] * len(docs)

            for chunk_id, doc_text, meta, dist in zip(ids, docs, metas, distances):
                vec_score = max(0.0, min(1.0, 1.0 - float(dist)))
                formatted.append({
                    "chunk_id": chunk_id,
                    "doc_id": meta.get("doc_id", ""),
                    "content": doc_text,
                    "title": meta.get("title", "Norma"),
                    "category": meta.get("category", "general"),
                    "norma": meta.get("norma_numero", meta.get("title", "")),
                    "article": meta.get("article", ""),
                    "owner_scope": meta.get("owner_scope", "public"),
                    "is_public": bool(meta.get("is_public", True)),
                    "filename": meta.get("filename", meta.get("title", "")),
                    "vector_score": vec_score,
                })
        return formatted

    def _hybrid_rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        prefer_private: bool = False,
    ) -> List[Dict[str, Any]]:
        """Combina similitud vectorial coseno con coincidencia léxica en español."""
        q_tokens = _tokenize_es(query)
        scored: List[Dict[str, Any]] = []

        ql = query.lower()
        asks_about_own_doc = any(
            kw in ql
            for kw in [
                "archivo", "documento", "pdf", "word", "docx", "subi", "subí",
                "cargue", "cargué", "adjunt", "mi contrato", "mi reglamento",
                "mi conjunto", "mi edificio", "manual", "clausula", "cláusula",
                "que dice el texto", "qué dice el texto", "resumen", "resume",
            ]
        )

        for item in candidates:
            doc_tokens = _tokenize_es(
                f"{item.get('title', '')} {item.get('article', '')} {item.get('content', '')}"
            )
            overlap_ratio = 0.0
            if q_tokens and doc_tokens:
                overlap_ratio = len(q_tokens & doc_tokens) / max(1, len(q_tokens))

            score = (item.get("vector_score", 0.4) * 0.62) + (overlap_ratio * 0.38)
            if not item.get("is_public", True):
                if prefer_private or (asks_about_own_doc and overlap_ratio > 0.0):
                    score += 0.22
                elif overlap_ratio >= 0.15:
                    score += 0.12

            item["similarity_score"] = round(min(0.99, max(0.05, score)), 3)
            scored.append(item)

        scored.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored

    def retrieve_context(
        self,
        query: str,
        category: Optional[str] = None,
        top_k: int = 6,
        owner_scope: str = "public",
        document_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Recupera los fragmentos más relevantes respetando estrictamente el aislamiento
        entre usuarios (RNF04) y combinando documentos propios del usuario con las leyes base.
        """
        candidates_by_id: Dict[str, Dict[str, Any]] = {}
        valid_categories = {"arriendo", "propiedad_horizontal", "manual_interno", "contrato"}
        cat_clean = category.lower() if category and category.lower() in valid_categories else None

        if document_ids:
            for doc_id in document_ids[:5]:
                doc_filter: Dict[str, Any] = {
                    "$and": [
                        {"doc_id": doc_id},
                        {"$or": [{"owner_scope": owner_scope}, {"is_public": True}]},
                    ]
                }
                for c in self._query_raw(query, doc_filter, n_results=5):
                    candidates_by_id[c["chunk_id"]] = c

        if owner_scope and owner_scope != "public":
            private_filter: Dict[str, Any] = {"owner_scope": owner_scope}
            if cat_clean and cat_clean not in ("manual_interno",):
                private_filter = {
                    "$and": [
                        {"owner_scope": owner_scope},
                        {"category": {"$in": [cat_clean, "manual_interno", "contrato", "general"]}},
                    ]
                }
            for c in self._query_raw(query, private_filter, n_results=5):
                candidates_by_id[c["chunk_id"]] = c

        public_filter: Dict[str, Any] = {"is_public": True}
        if cat_clean in ("arriendo", "propiedad_horizontal"):
            public_filter = {
                "$and": [
                    {"is_public": True},
                    {"category": cat_clean},
                ]
            }
        public_hits = self._query_raw(query, public_filter, n_results=5)
        if not public_hits and cat_clean in ("arriendo", "propiedad_horizontal"):
            public_hits = self._query_raw(query, {"category": cat_clean}, n_results=5)
        elif not public_hits:
            public_hits = self._query_raw(query, None, n_results=5)

        for c in public_hits:
            if c.get("is_public", True) or c.get("owner_scope") in ("public", owner_scope):
                candidates_by_id[c["chunk_id"]] = c

        all_candidates = list(candidates_by_id.values())
        if not all_candidates:
            return []

        ranked = self._hybrid_rerank(
            query=query,
            candidates=all_candidates,
            prefer_private=bool(document_ids),
        )

        private_chunks = [c for c in ranked if not c.get("is_public", True)]
        public_chunks = [c for c in ranked if c.get("is_public", True)]

        if document_ids and private_chunks:
            selected = private_chunks[:4] + public_chunks[: max(2, top_k - 4)]
        elif private_chunks:
            must_include_private = private_chunks[:3]
            remaining = [c for c in ranked if c not in must_include_private]
            selected = (must_include_private + remaining)[:top_k]
            selected.sort(key=lambda x: x["similarity_score"], reverse=True)
        else:
            selected = ranked[:top_k]

        return selected[:top_k]

    def query_similar(
        self,
        query: str,
        category: Optional[str] = None,
        top_k: int = 6,
        owner_scope: str = "public",
    ) -> List[Dict[str, Any]]:
        """Alias para retrieve_context: consulta de fragmentos por similitud vectorial."""
        return self.retrieve_context(
            query=query,
            category=category,
            top_k=top_k,
            owner_scope=owner_scope,
        )

    def get_collection_stats(self) -> Dict[str, Any]:
        """Retorna estadísticas de la base de conocimiento vectorial."""
        try:
            count = self.collection.count()
            return {
                "collection_name": self.collection_name,
                "total_chunks": count,
                "status": "ready",
            }
        except Exception as e:
            return {
                "collection_name": self.collection_name,
                "total_chunks": 0,
                "status": f"error: {str(e)}",
            }


rag_engine = RAGEngine()
