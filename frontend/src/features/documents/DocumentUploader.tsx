import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';

interface DocumentUploaderProps {
  onUploadSuccess: () => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<'arriendo' | 'propiedad_horizontal'>('arriendo');
  const [customTitle, setCustomTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!customTitle) {
        setCustomTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const res = await apiService.uploadDocument(file, category, customTitle);
      setMessage({
        type: 'success',
        text: `Norma indexada: ${res.chunks_created} fragmentos generados.`,
      });
      setFile(null);
      setCustomTitle('');
      onUploadSuccess();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Error al subir la norma.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center space-x-2">
        <Upload className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-sm text-slate-100">Cargar Nueva Norma o Reglamento</h3>
      </div>
      <p className="text-xs text-slate-400">
        Indexa contratos, reglamentos internos o acuerdos de asamblea en formato Markdown (.md) o texto plano (.txt).
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Archivo (.md o .txt)</label>
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileChange}
            disabled={isUploading}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30 file:cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              disabled={isUploading}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="arriendo">Arrendamiento Urbano</option>
              <option value="propiedad_horizontal">Propiedad Horizontal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Título / Identificador</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ej. Reglamento Torres del Parque"
              disabled={isUploading}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {message && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                : 'bg-rose-950/40 text-rose-300 border border-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || isUploading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-md"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Segmentando e Indexando...</span>
            </>
          ) : (
            <span>Ingestar al Vector Store</span>
          )}
        </button>
      </form>
    </div>
  );
};
