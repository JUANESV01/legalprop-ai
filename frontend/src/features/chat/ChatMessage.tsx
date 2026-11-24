import React, { useState } from 'react';
import {
  Copy,
  Check,
  FileDown,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
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

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    const token = match[0];

    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-slate-950">
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
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-cream-200/70 text-teal-900 font-mono text-[12px]">
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
            className="text-teal-700 hover:text-teal-900 underline underline-offset-2"
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

  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

const MarkdownProse: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-[14px] sm:text-[15px] leading-7 text-slate-800 font-sans">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-sm font-bold text-slate-900 pt-2">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-[15px] font-bold text-slate-900 pt-2">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (/^[-*•]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-2.5 pl-1">
              <span className="text-teal-700 mt-2 w-1.5 h-1.5 rounded-full bg-teal-700 shrink-0" />
              <span className="flex-1">{renderInline(trimmed.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
          if (numMatch) {
            return (
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="text-teal-800 font-semibold shrink-0">{numMatch[1]}</span>
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
  // Fuentes ocultas por defecto para no empujar ni ensuciar la respuesta;
  // se abren solo si el usuario hace clic o pidió explícitamente ver fuentes/citas.
  const askedForSources = Boolean(
    previousQuestion &&
      /\b(fuentes?|citas?|referencias?|art[ií]culos?\s+exactos?|mu[eé]strame\s+los\s+documentos)\b/i.test(
        previousQuestion
      )
  );
  const [showSources, setShowSources] = useState(askedForSources);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handlePdf = async () => {
    if (!onExportPdf) return;
    setExportingPdf(true);
    try {
      await onExportPdf(previousQuestion || 'Consulta LegalProp', message);
    } finally {
      setExportingPdf(false);
    }
  };

  // Mensaje del usuario: burbuja limpia a la derecha
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] sm:max-w-[72%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-cream-200/90 text-slate-900 text-[14px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const citations = message.citations || [];

  // Respuesta de LegalProp: prosa editorial directa y aireada
  return (
    <div className="flex items-start gap-3.5">
      <div className="shrink-0 mt-1">
        <Logo size="sm" showText={false} />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {message.content ? (
          <MarkdownProse content={message.content} />
        ) : (
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-slate-600 py-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
            <span>Consultando normativa y documentos...</span>
          </div>
        )}

        {message.isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-teal-700 animate-pulse align-middle rounded-sm" />
        )}

        {/* Opciones rápidas de aclaración solo si hay ambigüedad */}
        {!message.isStreaming &&
          message.disambiguation?.needed &&
          message.disambiguation.quick_options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 mr-1">Aclarar caso:</span>
              {message.disambiguation.quick_options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectFollowup?.(opt.followup_query)}
                  className="px-3 py-1 rounded-full bg-white hover:bg-teal-700 hover:text-white border border-cream-300 hover:border-teal-700 text-slate-700 text-xs transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

        {/* Barra discreta de acciones y botón desplegable de fuentes */}
        {!message.isStreaming && message.content && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-slate-600">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-cream-200/70 text-[11px] hover:text-slate-950 transition-colors"
              title="Copiar respuesta"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            {onExportPdf && (
              <button
                type="button"
                onClick={handlePdf}
                disabled={exportingPdf}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-cream-200/70 text-[11px] hover:text-slate-950 transition-colors"
                title="Descargar constancia en PDF"
              >
                {exportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>PDF</span>
              </button>
            )}

            {message.metadata?.provider_used && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-cream-200/70 text-slate-700 text-[10px] font-medium"
                title={
                  message.metadata?.fallback_used
                    ? `Respaldo automático activado (${message.metadata?.model_used || message.metadata.provider_used})`
                    : `Motor: ${message.metadata?.model_used || message.metadata.provider_used}`
                }
              >
                {message.metadata.provider_used === 'grok' ? 'Grok AI' : 'Gemini'}
                {message.metadata?.fallback_used ? ' (respaldo)' : ''}
              </span>
            )}

            {citations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  showSources
                    ? 'bg-teal-50 text-teal-900 border-teal-200'
                    : 'bg-white/80 hover:bg-white text-slate-700 border-cream-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  {showSources ? 'Ocultar fuentes' : `Ver fuentes (${citations.length})`}
                </span>
                {showSources ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Panel de fuentes (solo se renderiza cuando el usuario lo despliega) */}
        {!message.isStreaming && showSources && citations.length > 0 && (
          <div className="pt-2 space-y-2 animate-fadeIn">
            {citations.map((c, idx) => (
              <CitationCard key={idx} citation={c} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
