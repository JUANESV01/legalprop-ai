import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { DocumentUploadResponse } from '../../types';

interface DocumentUploaderProps {
  onUploadSuccess: (uploaded?: DocumentUploadResponse) => void;
  isMaster?: boolean;
  defaultPublic?: boolean;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onUploadSuccess,
  isMaster = false,
  defaultPublic = false,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<'manual_interno' | 'propiedad_horizontal' | 'arriendo' | 'contrato'>('manual_interno');
  const [customTitle, setCustomTitle] = useState('');
  const [publishPublic, setPublishPublic] = useState(isMaster && defaultPublic);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setPublishPublic(isMaster && defaultPublic);
  }, [isMaster, defaultPublic]);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; preview?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    { label: 'PDF', color: 'bg-rose-50 text-rose-800 border-rose-200' },
    { label: 'DOCX', color: 'bg-blue-50 text-blue-800 border-blue-200' },
    { label: 'TXT / MD', color: 'bg-cream-150 text-slate-700 border-cream-300' },
    { label: 'XLSX', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { label: 'ODT', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    { label: 'Imágenes OCR', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  ];

  const handleSelectedFile = (selected: File) => {
    setFile(selected);
    setMessage(null);
    const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setCustomTitle(cleanName);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const res = await apiService.uploadDocument(file, category, customTitle, isMaster && publishPublic);
      setMessage({
        type: 'success',
        text: res.message || `Documento procesado e indexado (${res.chunks_created} fragmentos).`,
        preview: res.preview,
      });
      setFile(null);
      setCustomTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadSuccess(res);
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
    <div className="bg-cream-50 rounded-2xl p-5 border border-cream-200 shadow-soft space-y-4">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
          <Upload className="w-4 h-4 text-teal-700" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900">Subir Nuevo Documento o Reglamento</h3>
          <p className="text-[11px] text-slate-500">
            El sistema lee el texto real y lo usa directamente para responder tus preguntas.
          </p>
        </div>
      </div>

      {/* Formatos Aceptados */}
      <div className="flex flex-wrap gap-1.5">
        {supportedFormats.map((fmt, i) => (
          <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${fmt.color}`}>
            {fmt.label}
          </span>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Zona Drag & Drop */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleSelectedFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-150 ${
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
            accept=".pdf,.docx,.xlsx,.xls,.odt,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
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
                    {(file.size / 1024).toFixed(1)} KB • Listo para extraer e indexar
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
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-cream-100"
                title="Quitar archivo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="w-9 h-9 mx-auto rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                <Upload className="w-4 h-4 text-teal-700" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Arrastra tu archivo aquí o <span className="text-teal-700 underline">explora tu equipo</span>
              </p>
              <p className="text-[10px] text-slate-500">
                PDF, Word (.docx), TXT, MD, Excel (.xlsx), ODT o imágenes (máx. 25 MB)
              </p>
            </div>
          )}
        </div>

        {/* Campos de metadatos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tipo / Materia</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              disabled={isUploading}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
            >
              <option value="manual_interno">Manual Interno / Reglamento PH</option>
              <option value="contrato">Contrato de Arrendamiento</option>
              <option value="propiedad_horizontal">Propiedad Horizontal (Ley 675)</option>
              <option value="arriendo">Arrendamiento Urbano (Ley 820)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nombre del Documento</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ej. Manual Convivencia Conjunto El Parque"
              disabled={isUploading}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        {/* Opción exclusiva del Administrador Master: precargar a la base común global */}
        {isMaster && (
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/80 border border-teal-200 cursor-pointer">
            <input
              type="checkbox"
              checked={publishPublic}
              onChange={(e) => setPublishPublic(e.target.checked)}
              className="mt-0.5 rounded border-teal-400 text-teal-700 focus:ring-teal-600"
            />
            <div className="text-[11px]">
              <span className="font-bold text-teal-950 block">
                Precargar en la base común global (Modo Master)
              </span>
              <span className="text-teal-800/90">
                Si marcas esta opción, el documento quedará disponible para responder preguntas de todos los usuarios del proyecto.
              </span>
            </div>
          </label>
        )}

        {/* Mensaje de estado */}
        {message && (
          <div
            className={`p-3 rounded-xl text-xs space-y-1.5 animate-fadeIn ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="font-semibold text-[11px] leading-tight">{message.text}</span>
            </div>
            {message.preview && (
              <p className="text-[10px] text-emerald-800/90 bg-white/70 p-2 rounded-lg border border-emerald-200/70 line-clamp-3 font-mono">
                Vista previa leída: {message.preview}
              </p>
            )}
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
              <span>Leyendo archivo e indexando...</span>
            </>
          ) : (
            <span>Incorporar y analizar en el chat</span>
          )}
        </button>
      </form>
    </div>
  );
};
