import React, { useState } from 'react';
import {
  User,
  Copy,
  Check,
  Printer,
  ShieldAlert,
  FileDown,
  Loader2,
  HelpCircle,
  Globe,
  FileCheck2,
} from 'lucide-react';
import { ChatMessage as MessageType } from '../../types';
import { CitationCard } from './CitationCard';
import { Logo } from '../../components/Logo';

interface ChatMessageProps {
  message: MessageType;
  previousQuestion?: string;
  onSelectFollowup?: (query: string) => void;
  onExportPdf?: (question: string, message: MessageType) => Promise<void>;
}

/** Renderizador ligero y seguro de Markdown (negritas, cursivas, listas, títulos y enlaces) */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={keyIdx++} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={keyIdx++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-cream-150 text-teal-900 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 hover:text-teal-900 underline font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed text-slate-800 font-sans">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1.5" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-sm font-bold text-teal-900 pt-2">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-sm sm:text-base font-bold text-slate-900 pt-2">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h3 key={i} className="text-base font-extrabold text-slate-900 pt-2">
              {renderInline(trimmed.slice(2))}
            </h3>
          );
        }
        if (/^[-*•]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-teal-700 font-bold mt-0.5">•</span>
              <span className="flex-1">{renderInline(trimmed.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
          if (numMatch) {
            return (
              <div key={i} className="flex items-start gap-2 pl-2">
                <span className="text-teal-800 font-bold shrink-0">{numMatch[1]}</span>
                <span className="flex-1">{renderInline(numMatch[2])}</span>
              </div>
            );
          }
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  previousQuestion,
  onSelectFollowup,
  onExportPdf,
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePdf = async () => {
    if (!onExportPdf) return;
    setExportingPdf(true);
    try {
      await onExportPdf(previousQuestion || 'Consulta jurídica LegalProp AI', message);
    } finally {
      setExportingPdf(false);
    }
  };

  const usedUserDocs = Boolean(
    message.metadata?.user_documents_used ||
      message.citations?.some((c) => c.source_type === 'documento_usuario')
  );
  const usedWeb = Boolean(
    message.metadata?.web_fallback_used ||
      message.citations?.some((c) => c.source_type === 'web' || Boolean(c.url))
  );

  return (
    <div
      className={`flex gap-3.5 p-4 sm:p-5 rounded-2xl transition-all duration-200 ${
        isUser
          ? 'bg-teal-700 text-white ml-4 sm:ml-12 shadow-soft'
          : 'bg-white border border-cream-200 mr-2 sm:mr-10 shadow-soft'
      }`}
    >
      {/* Avatar Icon */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-teal-800/80 border border-teal-600/60 flex items-center justify-center text-teal-100 shadow-soft">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <Logo size="sm" showText={false} />
        )}
      </div>

      {/* Contenido del Mensaje */}
      <div className="flex-1 space-y-3 min-w-0 overflow-hidden">
        {/* Cabecera del Mensaje */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${
            isUser ? 'border-teal-600/60' : 'border-cream-200'
          }`}
        >
          <div className="flex items-center flex-wrap gap-1.5">
            <span className={`text-xs font-bold tracking-wide ${isUser ? 'text-white' : 'text-slate-900'}`}>
              {isUser ? 'Tú (Consulta)' : 'LegalProp AI'}
            </span>
            {!isUser && usedUserDocs && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <FileCheck2 className="w-3 h-3" />
                Basado en tus archivos
              </span>
            )}
            {!isUser && usedWeb && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                <Globe className="w-3 h-3" />
                Verificado en web
              </span>
            )}
          </div>

          <div className={`flex items-center gap-1.5 text-xs ${isUser ? 'text-teal-100' : 'text-slate-500'}`}>
            <span className="text-[10px] font-mono">{message.timestamp}</span>

            {!isUser && !message.isStreaming && (
              <div className="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-cream-100 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Copiar respuesta"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-teal-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {onExportPdf && (
                  <button
                    type="button"
                    onClick={handlePdf}
                    disabled={exportingPdf}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-semibold transition-colors"
                    title="Descargar constancia legal en PDF (HU06)"
                  >
                    {exportingPdf ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileDown className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-1.5 rounded-lg hover:bg-cream-100 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Imprimir respuesta"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Texto de la Respuesta */}
        {isUser ? (
          <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-teal-50">
            {message.content}
          </div>
        ) : (
          <div>
            {message.content ? (
              <MarkdownContent content={message.content} />
            ) : (
              <div className="flex items-center gap-2 text-xs text-teal-800 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Consultando normativa, tus archivos y fuentes web...</span>
              </div>
            )}
            {message.isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-teal-600 animate-pulse ml-1 align-middle rounded-sm" />
            )}
          </div>
        )}

        {/* Desambiguación guiada (HU10 / RF09) */}
        {!isUser && !message.isStreaming && message.disambiguation?.needed && message.disambiguation.quick_options.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>Para darte una precisión exacta, aclárame tu caso:</span>
            </div>
            {message.disambiguation.reason && (
              <p className="text-[11px] text-amber-800 leading-snug">{message.disambiguation.reason}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-0.5">
              {message.disambiguation.quick_options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectFollowup?.(opt.followup_query)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-teal-700 hover:text-white border border-amber-300 hover:border-teal-700 text-amber-950 text-[11px] font-semibold transition-all shadow-soft"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bloque de Fuentes Normativas (Citas — "Normas de Respaldo") */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="pt-3 border-t border-cream-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Normas de Respaldo y Fuentes ({message.citations.length})
              </span>
              <span className="text-[10px] text-slate-500">Haz clic para previsualizar el texto</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {message.citations.map((c, idx) => (
                <CitationCard key={idx} citation={c} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* Micro-aviso de rigor ético */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 pt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="leading-tight">
              Orientación basada en las leyes 820 de 2003, 675 de 2001, tus documentos y fuentes oficiales. No reemplaza a un abogado titulado.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
