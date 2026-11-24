import hashlib
import logging
import math
import os
import re
import unicodedata
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Set, Tuple
import chromadb
from chromadb.config import Settings as ChromaSettings
from google import genai
from google.genai import types as genai_types
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
    {"contrato", "clausula", "prestacion", "servicios", "laboral", "subordinacion", "honorarios", "contratista"},
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


class GeminiHybridEmbeddingFunction:
    """
    Función de embeddings semánticos reales usando Google `gemini-embedding-001`
    (output_dimensionality=768) vía API HTTPS de Google GenAI:
    - Consume 0 MB de RAM en modelos locales (ideal para Render 512 MB).
    - Soporta `task_type` diferenciado (`RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`).
    - Procesa documentos por lotes (hasta 100 fragmentos por petición) y cachea consultas en LRU.
    - Incluye respaldo determinista local de la misma dimensión (768) únicamente para entornos
      sin conexión o pruebas unitarias offline sin API key.
    """

    DIM = settings.EMBEDDING_DIM  # 768

    def __init__(self) -> None:
        self._client: Optional[genai.Client] = None
        self._query_cache: OrderedDict[str, List[float]] = OrderedDict()
        self._cache_max = 256
        self.last_mode: str = "gemini-embedding-001" if settings.is_gemini_configured else "local_fallback"

    def name(self) -> str:
        return f"legalprop_gemini_emb_{self.DIM}_v3"

    @staticmethod
    def is_legacy() -> bool:
        return False

    def get_config(self) -> Dict[str, Any]:
        return {"dim": self.DIM, "model": settings.GEMINI_EMBEDDING_MODEL}

    @property
    def client(self) -> Optional[genai.Client]:
        if self._client is None and settings.is_gemini_configured:
            try:
                self._client = genai.Client(
                    api_key=settings.GEMINI_API_KEY,
                    http_options={"timeout": 15000},
                )
            except Exception as e:
                logger.warning(f"No se pudo inicializar cliente de embeddings Gemini: {e}")
                self._client = None
        return self._client

    def _fallback_embed_one(self, text: str) -> List[float]:
        """Respaldo vectorial local determinista (dim=768) para ejecución offline / pruebas sin API key."""
        vec = [0.0] * self.DIM
        norm = _normalize_es(text)
        words = [w for w in re.findall(r"[a-z0-9]+", norm) if w not in SPANISH_STOPWORDS]

        features: List[Tuple[str, float]] = []
        for idx, w in enumerate(words):
            features.append((f"w:{w}", 2.2))
            if len(w) >= 5:
                features.append((f"stem:{w[:5]}", 1.3))
            concept = _SYNONYM_LOOKUP.get(w)
            if concept:
                features.append((concept, 1.8))
            if idx + 1 < len(words):
                features.append((f"bi:{w}_{words[idx + 1]}", 1.6))
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

    def _embed_batch_gemini(self, texts: List[str], task_type: str) -> Optional[List[List[float]]]:
        """Genera embeddings reales en lotes usando `gemini-embedding-001` (dim=768)."""
        if not self.client or not texts:
            return None
        try:
            all_vectors: List[List[float]] = []
            batch_size = 96
            for i in range(0, len(texts), batch_size):
                batch = [(t[:6000] if t and t.strip() else "documento") for t in texts[i:i + batch_size]]
                res = self.client.models.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    contents=batch,
                    config=genai_types.EmbedContentConfig(
                        output_dimensionality=self.DIM,
                        task_type=task_type,
                    ),
                )
                embeddings = getattr(res, "embeddings", None) or []
                if len(embeddings) != len(batch):
                    return None
                for emb in embeddings:
                    vals = list(emb.values)
                    norm_val = math.sqrt(sum(v * v for v in vals)) or 1.0
                    all_vectors.append([v / norm_val for v in vals])
            self.last_mode = settings.GEMINI_EMBEDDING_MODEL
            return all_vectors
        except Exception as e:
            logger.warning(f"Embeddings Gemini no disponibles ({e}); usando respaldo local determinista.")
            self.last_mode = "local_fallback"
            return None

    def embed_documents(self, input: List[str]) -> List[List[float]]:  # noqa: A002
        vecs = self._embed_batch_gemini(list(input), task_type="RETRIEVAL_DOCUMENT")
        if vecs is not None:
            return vecs
        self.last_mode = "local_fallback"
        return [self._fallback_embed_one(t) for t in input]

    def embed_query(self, input: List[str]) -> List[List[float]]:  # noqa: A002
        results: List[Optional[List[float]]] = [None] * len(input)
        missing_indices: List[int] = []
        missing_texts: List[str] = []

        for idx, text in enumerate(input):
            cache_key = f"{self.last_mode}:{text.strip().lower()}"
            cached = self._query_cache.get(cache_key)
            if cached is not None:
                self._query_cache.move_to_end(cache_key)
                results[idx] = cached
            else:
                missing_indices.append(idx)
                missing_texts.append(text)

        if missing_texts:
            vecs = self._embed_batch_gemini(missing_texts, task_type="RETRIEVAL_QUERY")
            if vecs is None:
                self.last_mode = "local_fallback"
                vecs = [self._fallback_embed_one(t) for t in missing_texts]

            for idx, text, vec in zip(missing_indices, missing_texts, vecs):
                results[idx] = vec
                cache_key = f"{self.last_mode}:{text.strip().lower()}"
                self._query_cache[cache_key] = vec
                if len(self._query_cache) > self._cache_max:
                    self._query_cache.popitem(last=False)

        return [r for r in results if r is not None]

    def __call__(self, input: List[str]) -> List[List[float]]:  # noqa: A002
        return self.embed_documents(input)


class RAGEngine:
    """
    Motor RAG con embeddings semánticos reales (`gemini-embedding-001`, 768 dims)
    sobre ChromaDB, aislamiento estricto por usuario (`owner_scope`, RNF04),
    re-ranking híbrido y recuperación garantizada de documentos adjuntos por el usuario.
    """

    def __init__(self) -> None:
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        self.collection_name = f"{settings.CHROMA_COLLECTION_NAME}_emb{settings.EMBEDDING_DIM}"
        self.text_splitter = LegalTextSplitter()
        self.embedding_fn = GeminiHybridEmbeddingFunction()
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
                    "description": "Corpus normativo y documentos de LegalProp AI (Gemini Embeddings 768d)",
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
        """Segmenta el documento y lo persiste en ChromaDB con embeddings semánticos (RF08 / RNF04 / RNF10)."""
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
                "chunk_order": idx,
                "title": c["title"],
                "category": (c["category"] or "general").lower(),
                "norma_numero": c["norma_numero"] or c["title"],
                "article": c["article"] or "",
                "owner_scope": owner_scope,
                "is_public": bool(is_public),
                "filename": filename or title,
            }
            for idx, c in enumerate(chunks)
        ]

        # Pre-calcular embeddings en lote para velocidad óptima (RNF10: 50 páginas en < 15 s)
        embeddings = self.embedding_fn.embed_documents(documents)

        batch_size = 100
        for i in range(0, len(ids), batch_size):
            self.collection.upsert(
                ids=ids[i:i + batch_size],
                embeddings=embeddings[i:i + batch_size],
                documents=documents[i:i + batch_size],
                metadatas=metadatas[i:i + batch_size],
            )

        logger.info(
            f"Ingestados {len(chunks)} fragmentos de '{title}' (ID: {doc_id}, scope: {owner_scope}, emb: {self.embedding_fn.last_mode})."
        )
        return len(chunks)

    def delete_document(self, doc_id: str) -> int:
        """Elimina todos los fragmentos de un documento del almacén vectorial."""
        try:
            existing = self.collection.get(where={"doc_id": doc_id})
            ids = existing.get("ids") if existing else []
            if ids:
                self.collection.delete(ids=ids)
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
                return len(ids)
        except Exception as e:
            logger.error(f"Error eliminando fragmentos de {owner_scope}: {e}")
        return 0

    def get_document_ordered_chunks(
        self,
        doc_id: str,
        owner_scope: str,
        max_chunks: int = 8,
    ) -> List[Dict[str, Any]]:
        """
        Recupera en orden secuencial los fragmentos de un documento explícitamente adjuntado
        por el usuario, garantizando que consultas generales ('¿es válido este contrato?')
        siempre dispongan del contenido real del contrato (respetando aislamiento RNF04).
        """
        try:
            where_filter: Dict[str, Any] = {
                "$and": [
                    {"doc_id": doc_id},
                    {"$or": [{"owner_scope": owner_scope}, {"is_public": True}]},
                ]
            }
            res = self.collection.get(where=where_filter, include=["documents", "metadatas"])
            ids = res.get("ids") or []
            docs = res.get("documents") or []
            metas = res.get("metadatas") or []

            items: List[Dict[str, Any]] = []
            for chunk_id, doc_text, meta in zip(ids, docs, metas):
                order = meta.get("chunk_order")
                if order is None:
                    # Extraer sufijo numérico del chunk_id si proviene de colección previa
                    m = re.search(r"_(\d+)$", chunk_id)
                    order = int(m.group(1)) if m else 9999
                items.append({
                    "chunk_id": chunk_id,
                    "chunk_order": int(order),
                    "doc_id": meta.get("doc_id", doc_id),
                    "content": doc_text,
                    "title": meta.get("title", "Documento del usuario"),
                    "category": meta.get("category", "contrato"),
                    "norma": meta.get("norma_numero", meta.get("title", "Documento")),
                    "article": meta.get("article", "Sección"),
                    "owner_scope": meta.get("owner_scope", owner_scope),
                    "is_public": bool(meta.get("is_public", False)),
                    "filename": meta.get("filename", meta.get("title", "")),
                    "vector_score": 0.92,
                    "similarity_score": 0.92,
                })
            items.sort(key=lambda x: x["chunk_order"])
            return items[:max_chunks]
        except Exception as e:
            logger.warning(f"No se pudieron leer fragmentos ordenados de {doc_id}: {e}")
            return []

    def _query_raw(
        self,
        query: str,
        where_filter: Optional[Dict[str, Any]],
        n_results: int,
        query_embedding: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        try:
            total = self.collection.count()
            if total == 0:
                return []
            safe_n = max(1, min(n_results, total))
            kwargs: Dict[str, Any] = {"n_results": safe_n}
            if query_embedding is not None:
                kwargs["query_embeddings"] = [query_embedding]
            else:
                kwargs["query_texts"] = [query]
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
                "cargue", "cargué", "adjunt", "contrato", "reglamento",
                "mi conjunto", "mi edificio", "manual", "clausula", "cláusula",
                "valido", "válido", "revisa", "analiza", "resumen", "resume",
            ]
        )

        for item in candidates:
            doc_tokens = _tokenize_es(
                f"{item.get('title', '')} {item.get('article', '')} {item.get('content', '')}"
            )
            overlap_ratio = 0.0
            if q_tokens and doc_tokens:
                overlap_ratio = len(q_tokens & doc_tokens) / max(1, len(q_tokens))

            score = (item.get("vector_score", 0.4) * 0.72) + (overlap_ratio * 0.28)
            if not item.get("is_public", True):
                if prefer_private or asks_about_own_doc:
                    score += 0.20
                elif overlap_ratio >= 0.15:
                    score += 0.10

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
        Recupera fragmentos semánticos respetando aislamiento por usuario (RNF04).
        Calcula el embedding de la consulta UNA sola vez para todas las sub-consultas.
        """
        candidates_by_id: Dict[str, Dict[str, Any]] = {}
        ordered_attached: List[Dict[str, Any]] = []
        valid_categories = {"arriendo", "propiedad_horizontal", "manual_interno", "contrato"}
        cat_clean = category.lower() if category and category.lower() in valid_categories else None

        query_vec = self.embedding_fn.embed_query([query])[0]

        # 1. Documentos explícitamente seleccionados/adjuntados: incluir vista ordenada + matches vectoriales
        if document_ids:
            for doc_id in document_ids[:3]:
                for c in self.get_document_ordered_chunks(doc_id, owner_scope=owner_scope, max_chunks=6):
                    ordered_attached.append(c)
                    candidates_by_id[c["chunk_id"]] = c
                doc_filter: Dict[str, Any] = {
                    "$and": [
                        {"doc_id": doc_id},
                        {"$or": [{"owner_scope": owner_scope}, {"is_public": True}]},
                    ]
                }
                for c in self._query_raw(query, doc_filter, n_results=4, query_embedding=query_vec):
                    candidates_by_id[c["chunk_id"]] = c

        # 2. Otros documentos privados del propio usuario
        if owner_scope and owner_scope != "public":
            private_filter: Dict[str, Any] = {"owner_scope": owner_scope}
            if cat_clean and cat_clean not in ("manual_interno",):
                private_filter = {
                    "$and": [
                        {"owner_scope": owner_scope},
                        {"category": {"$in": [cat_clean, "manual_interno", "contrato", "general"]}},
                    ]
                }
            for c in self._query_raw(query, private_filter, n_results=4, query_embedding=query_vec):
                candidates_by_id[c["chunk_id"]] = c

        # 3. Corpus normativo público oficial
        public_filter: Dict[str, Any] = {"is_public": True}
        if cat_clean in ("arriendo", "propiedad_horizontal"):
            public_filter = {
                "$and": [
                    {"is_public": True},
                    {"category": cat_clean},
                ]
            }
        public_hits = self._query_raw(query, public_filter, n_results=5, query_embedding=query_vec)
        if not public_hits and cat_clean in ("arriendo", "propiedad_horizontal"):
            public_hits = self._query_raw(query, {"category": cat_clean}, n_results=5, query_embedding=query_vec)
        elif not public_hits:
            public_hits = self._query_raw(query, None, n_results=5, query_embedding=query_vec)

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

        if document_ids and ordered_attached:
            # Preservar el orden natural del contrato adjunto + mejores artículos normativos de respaldo
            seen_ids = set()
            selected: List[Dict[str, Any]] = []
            for c in ordered_attached[:6]:
                if c["chunk_id"] not in seen_ids:
                    seen_ids.add(c["chunk_id"])
                    selected.append(c)
            for c in public_chunks[:3]:
                if c["chunk_id"] not in seen_ids:
                    seen_ids.add(c["chunk_id"])
                    selected.append(c)
            return selected[: max(top_k, 8)]

        if private_chunks:
            must_include_private = private_chunks[:3]
            remaining = [c for c in ranked if c not in must_include_private]
            selected = (must_include_private + remaining)[:top_k]
            selected.sort(key=lambda x: x["similarity_score"], reverse=True)
            return selected[:top_k]

        return ranked[:top_k]

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
        """Retorna estadísticas reales del almacén vectorial y del modelo de embeddings."""
        try:
            count = self.collection.count()
            return {
                "collection_name": self.collection_name,
                "total_chunks": count,
                "embedding_model": self.embedding_fn.last_mode,
                "embedding_dimensions": self.embedding_fn.DIM,
                "status": "ready",
            }
        except Exception as e:
            return {
                "collection_name": self.collection_name,
                "total_chunks": 0,
                "embedding_model": self.embedding_fn.last_mode,
                "embedding_dimensions": self.embedding_fn.DIM,
                "status": f"error: {str(e)}",
            }


rag_engine = RAGEngine()
