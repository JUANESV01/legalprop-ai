import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  BookOpen,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Loader2,
} from 'lucide-react';
import { BackendHealthResponse, DocumentSummary } from '../../types';

interface DocumentListProps {
  health: BackendHealthResponse | null;
  documents: DocumentSummary[];
  selectedDocIds: string[];
  onToggleSelectDoc: (docId: string) => void;
  onDeleteDoc: (docId: string) => Promise<void>;
  isAuthenticated: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  health,
  documents,
  selectedDocIds,
  onToggleSelectDoc,
  onDeleteDoc,
  isAuthenticated,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const userDocs = documents.filter((d) => !d.is_public);
  const publicDocs = documents.filter((d) => d.is_public);

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await onDeleteDoc(docId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sección 1: Documentos Privados del Usuario */}
      <div className="bg-cream-50 rounded-2xl p-5 space-y-3 border border-cream-200 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">
                Tus Archivos Cargados ({userDocs.length})
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-700" />
                <span>
                  {isAuthenticated
                    ? 'Aislados de forma privada en tu cuenta'
                    : 'Aislados en tu sesión actual (inicia sesión para conservarlos)'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {userDocs.length === 0 ? (
          <div className="p-4 rounded-xl bg-white border border-dashed border-cream-300 text-center text-xs text-slate-500">
            Aún no has cargado reglamentos, contratos ni archivos propios. Sube un <strong>PDF, Word (.docx), Excel o TXT</strong> abajo y el asistente responderá con base en su contenido real.
          </div>
        ) : (
          <div className="space-y-2.5">
            {userDocs.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              const isExpanded = expandedId === doc.id;
              return (
                <div
                  key={doc.id}
                  className={`p-3.5 bg-white border rounded-xl space-y-2 transition-all shadow-soft ${
                    isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-cream-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-900 truncate">{doc.title}</span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          .{doc.file_type}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cream-150 text-slate-600 border border-cream-200">
                          {doc.chunks_count} fragmentos
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        Archivo: {doc.filename} • {(doc.file_size_bytes / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleSelectDoc(doc.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-cream-50 text-slate-700 border-cream-300 hover:border-emerald-400'
                        }`}
                        title="Priorizar este documento al hacer preguntas en el chat"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isSelected ? 'Priorizado' : 'Priorizar'}</span>
                      </button>

                      {doc.preview && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-800 hover:bg-cream-100"
                          title="Previsualizar texto extraído"
                        >
                          {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Eliminar documento"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && doc.preview && (
                    <div className="p-2.5 rounded-lg bg-cream-50 border border-cream-200 text-[11px] text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto animate-fadeIn">
                      <span className="text-[10px] font-bold uppercase text-teal-800 block mb-1">
                        Extracto leído del archivo:
                      </span>
                      {doc.preview}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 2: Normativas Base de Colombia */}
      <div className="bg-cream-50 rounded-2xl p-5 space-y-3 border border-cream-200 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Leyes Marco Integradas</h3>
              <p className="text-[11px] text-slate-500">Legislación colombiana indexada en ChromaDB</p>
            </div>
          </div>
          {health && (
            <span className="text-[10px] font-mono text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
              {health.vector_store?.total_chunks || 0} chunks
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {publicDocs.map((norma) => (
            <div
              key={norma.id}
              className="p-3 bg-white border border-cream-200 rounded-xl space-y-1.5 shadow-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span className="font-semibold text-xs text-slate-900 truncate">{norma.title}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border text-teal-800 bg-teal-50 border-teal-200 shrink-0">
                  {norma.chunks_count} art/frag.
                </span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-teal-700 shrink-0" />
                <span>Disponible para todas las consultas • Categoría: {norma.category.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
