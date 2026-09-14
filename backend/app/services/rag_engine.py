import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.services.gemini_service import gemini_service
from app.services.text_splitter import LegalTextSplitter

logger = logging.getLogger(__name__)


class RAGEngine:
    """
    Motor RAG para recuperación y almacenamiento vectorial de normativas de
    arrendamientos urbanos y propiedad horizontal utilizando ChromaDB y Gemini.
    """

    def __init__(self):
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        self.collection_name = settings.CHROMA_COLLECTION_NAME
        self.text_splitter = LegalTextSplitter()
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection = None

    @property
    def client(self) -> chromadb.ClientAPI:
        if self._client is None:
            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "Corpus normativo de arriendos y propiedad horizontal"}
            )
        return self._collection

    def ingest_document(
        self,
        doc_id: str,
        title: str,
        category: str,
        content: str,
        norma_numero: str = ""
    ) -> int:
        """
        Segmenta el documento normativo, calcula embeddings y lo persiste en ChromaDB.
        """
        chunks = self.text_splitter.split_legal_text(
            text=content,
            doc_id=doc_id,
            title=title,
            category=category,
            norma_numero=norma_numero
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
                "category": c["category"],
                "norma_numero": c["norma_numero"],
                "article": c["article"] or "",
            }
            for c in chunks
        ]

        # Ingesta en ChromaDB
        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

        logger.info(f"Ingestados con éxito {len(chunks)} fragmentos del documento '{title}' (ID: {doc_id}).")
        return len(chunks)

    def retrieve_context(
        self,
        query: str,
        category: Optional[str] = None,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Recupera los fragmentos normativos más relevantes para la consulta dada.
        """
        where_filter = None
        if category and category.lower() in ["arriendo", "propiedad_horizontal"]:
            where_filter = {"category": category.lower()}

        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_filter,
            )
        except Exception as e:
            logger.error(f"Error en consulta vectorial a ChromaDB: {e}")
            return []

        formatted_results: List[Dict[str, Any]] = []

        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)

            for doc_text, meta, dist in zip(docs, metas, distances):
                # Conversión de distancia L2 o coseno a score de similitud orientativo
                sim_score = round(max(0.0, 1.0 - (dist / 2.0)), 3)
                formatted_results.append({
                    "content": doc_text,
                    "title": meta.get("title", "Norma"),
                    "category": meta.get("category", "general"),
                    "norma": meta.get("norma_numero", meta.get("title", "")),
                    "article": meta.get("article", ""),
                    "similarity_score": sim_score,
                })

        return formatted_results

    def get_collection_stats(self) -> Dict[str, Any]:
        """Retorna estadísticas de la base de conocimiento vectorial."""
        try:
            count = self.collection.count()
            return {
                "collection_name": self.collection_name,
                "total_chunks": count,
                "status": "ready"
            }
        except Exception as e:
            return {
                "collection_name": self.collection_name,
                "total_chunks": 0,
                "status": f"error: {str(e)}"
            }


rag_engine = RAGEngine()
