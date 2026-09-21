import React, { useState, useRef } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText, X } from 'lucide-react';
import { apiService } from '../../services/api';

interface DocumentUploaderProps {
  onUploadSuccess: () => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<'arriendo' | 'propiedad_horizontal'>('propiedad_horizontal');
  const [customTitle, setCustomTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    { label: 'PDF', ext: '.pdf', color: 'bg-rose-50 text-rose-800 border-rose-200' },
    { label: 'Word', ext: '.docx', color: 'bg-blue-50 text-blue-800 border-blue-200' },
    { label: 'Excel', ext: '.xlsx', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { label: 'ODT', ext: '.odt', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    { label: 'Texto', ext: '.txt,.md', color: 'bg-cream-150 text-slate-700 border-cream-300' },
    { label: 'Imágenes', ext: '.png,.jpg,.webp', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  ];

  const handleSelectedFile = (selected: File) => {
    setFile(selected);
    setMessage(null);
    if (!customTitle) {
      const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setCustomTitle(cleanName);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    try {
      await apiService.uploadDocument(file, category, customTitle);
      setMessage({
        type: 'success',
        text: 'Documento procesado e incorporado con éxito a la base de consulta.',
      });
      setFile(null);
      setCustomTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadSuccess();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'No fue posible procesar el archivo. Revisa el formato e intenta de nuevo.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-cream-50 rounded-2xl p-5 sm:p-6 border border-cream-200 shadow-soft space-y-4">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
          <Upload className="w-4 h-4 text-teal-700" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900">Cargar Documento o Reglamento</h3>
          <p className="text-[11px] text-slate-500">
            Analiza reglamentos internos, manuales de convivencia o contratos en formato PDF, Word, Excel u ODT.
          </p>
        </div>
      </div>

      {/* Formatos Aceptados */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {supportedFormats.map((fmt, i) => (
          <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${fmt.color}`}>
            {fmt.label}
          </span>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Zona Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all duration-150 ${
            isDragging
              ? 'border-teal-600 bg-teal-50/70 scale-[1.01]'
              : file
              ? 'border-teal-500 bg-white'
              : 'border-cream-300 hover:border-teal-500 bg-white hover:bg-cream-100/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.odt,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50 border border-teal-200">
              <div className="flex items-center space-x-3 truncate">
                <FileText className="w-6 h-6 text-teal-700 shrink-0" />
                <div className="text-left truncate">
                  <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-teal-800 font-mono">
                    {(file.size / 1024).toFixed(1)} KB • Listo para procesar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-cream-100 transition-colors"
                title="Quitar archivo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                <Upload className="w-5 h-5 text-teal-700" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Arrastra tu archivo aquí o <span className="text-teal-700 underline font-medium">haz clic para explorar</span>
              </p>
              <p className="text-[10px] text-slate-500">
                Archivos PDF, Word, Excel, ODT o imágenes (máx. 25 MB)
              </p>
            </div>
          )}
        </div>

        {/* Campos de metadatos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Materia
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              disabled={isUploading}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-600 font-sans"
            >
              <option value="propiedad_horizontal">Propiedad Horizontal (PH)</option>
              <option value="arriendo">Arrendamiento Urbano</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nombre o Título del Documento
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ej. Reglamento de Copropiedad Torres del Parque"
              disabled={isUploading}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 font-sans"
            />
          </div>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium text-[11px] leading-tight">{message.text}</span>
          </div>
        )}

        {/* Botón de Ingesta */}
        <button
          type="submit"
          disabled={!file || isUploading}
          className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-all duration-150 shadow-soft flex items-center justify-center space-x-2 active:scale-95"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Procesando e incorporando documento...</span>
            </>
          ) : (
            <span>Incorporar a la base de consulta</span>
          )}
        </button>
      </form>
    </div>
  );
};
