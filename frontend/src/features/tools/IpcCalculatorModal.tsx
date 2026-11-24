import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  MessageSquare,
  Globe,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { IPCCalcResponse } from '../../types';

interface IpcCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAskInChat: (prompt: string) => void;
}

const MIN_CANON_COP = 100_000;
const MAX_CANON_COP = 200_000_000;
const MIN_COMERCIAL_COP = 10_000_000;
const MAX_COMERCIAL_COP = 50_000_000_000;

const formatCOP = (val: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(val);

const formatDigitsInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
};

const parseDigitsInput = (formatted: string): number => {
  const digits = formatted.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export const IpcCalculatorModal: React.FC<IpcCalculatorModalProps> = ({
  isOpen,
  onClose,
  onAskInChat,
}) => {
  const [canonActual, setCanonActual] = useState('1.500.000');
  const [anioReajuste, setAnioReajuste] = useState(2026);
  const [valorComercial, setValorComercial] = useState('');
  const [consultarWeb, setConsultarWeb] = useState(true);
  const [result, setResult] = useState<IPCCalcResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCanonChange = (val: string) => {
    setCanonActual(formatDigitsInput(val));
    setError(null);
    setResult(null);
  };

  const handleComercialChange = (val: string) => {
    setValorComercial(formatDigitsInput(val));
    setError(null);
    setResult(null);
  };

  const handleAnioChange = (yr: number) => {
    setAnioReajuste(yr);
    setError(null);
    setResult(null);
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const canonNum = parseDigitsInput(canonActual);
    if (!canonNum || canonNum < MIN_CANON_COP || canonNum > MAX_CANON_COP) {
      setResult(null);
      setError(
        `El canon mensual debe estar en un rango real de vivienda urbana entre ${formatCOP(
          MIN_CANON_COP
        )} y ${formatCOP(MAX_CANON_COP)}.`
      );
      return;
    }

    const hasComercial = valorComercial.trim().length > 0;
    const comercialNum = hasComercial ? parseDigitsInput(valorComercial) : null;

    if (comercialNum !== null) {
      if (comercialNum < MIN_COMERCIAL_COP || comercialNum > MAX_COMERCIAL_COP) {
        setResult(null);
        setError(
          `El valor comercial estimado del inmueble debe estar entre ${formatCOP(
            MIN_COMERCIAL_COP
          )} y ${formatCOP(MAX_COMERCIAL_COP)} (o déjalo vacío si no deseas validarlo).`
        );
        return;
      }
      if (comercialNum <= canonNum * 12) {
        setResult(null);
        setError(
          `El valor comercial (${formatCOP(
            comercialNum
          )}) no es coherente frente al canon mensual (${formatCOP(
            canonNum
          )}). Debe ser superior a 12 meses de arriendo (${formatCOP(canonNum * 12)}).`
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await apiService.calculateIpc({
        canon_actual: canonNum,
        anio_reajuste: anioReajuste,
        valor_comercial_inmueble: comercialNum,
        consultar_web: consultarWeb,
      });
      setResult(res);
    } catch (err: any) {
      setResult(null);
      setError(err.message || 'Error calculando el reajuste legal.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ipc-modal-title"
    >
      <div className="w-full max-w-lg bg-cream-50 border border-cream-200 rounded-2xl shadow-elevated overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 bg-white border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ipc-modal-title" className="text-base font-bold text-slate-900">
                Calculadora Legal de Arriendo (IPC)
              </h2>
              <p className="text-[11px] text-slate-600">
                Tope máximo permitido según Ley 820 de 2003 — Artículo 20
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-cream-100"
            aria-label="Cerrar calculadora IPC"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <form onSubmit={handleCalculate} noValidate className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ipc-canon" className="block text-xs font-semibold text-slate-700 mb-1">
                  Canon mensual actual (COP)
                </label>
                <input
                  id="ipc-canon"
                  type="text"
                  inputMode="numeric"
                  required
                  value={canonActual}
                  onChange={(e) => handleCanonChange(e.target.value)}
                  placeholder="Ej. 1.500.000"
                  className="w-full px-3 py-2.5 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                />
                <span className="text-[10px] text-slate-600 mt-0.5 block">
                  Rango válido: $100.000 – $200.000.000
                </span>
              </div>
              <div>
                <label htmlFor="ipc-anio" className="block text-xs font-semibold text-slate-700 mb-1">
                  Año del reajuste contractual
                </label>
                <select
                  id="ipc-anio"
                  value={anioReajuste}
                  onChange={(e) => handleAnioChange(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                >
                  <option value={2026}>2026 (usa IPC 2025)</option>
                  <option value={2025}>2025 (usa IPC 2024)</option>
                  <option value={2024}>2024 (usa IPC 2023)</option>
                  <option value={2023}>2023 (usa IPC 2022)</option>
                  <option value={2022}>2022 (usa IPC 2021)</option>
                  <option value={2021}>2021 (usa IPC 2020)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ipc-comercial" className="block text-xs font-semibold text-slate-700 mb-1">
                Valor comercial estimado del inmueble (opcional — valida tope 1% Art. 18)
              </label>
              <input
                id="ipc-comercial"
                type="text"
                inputMode="numeric"
                value={valorComercial}
                onChange={(e) => handleComercialChange(e.target.value)}
                placeholder="Ej. 250.000.000 (opcional)"
                className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
              />
              <span className="text-[10px] text-slate-600 mt-0.5 block">
                Si lo ingresas, mínimo $10.000.000 y mayor a 12 meses de canon
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={consultarWeb}
                onChange={(e) => setConsultarWeb(e.target.checked)}
                className="rounded border-cream-300 text-teal-700 focus:ring-teal-600"
              />
              <Globe className="w-3.5 h-3.5 text-teal-700" />
              <span>Verificar IPC oficial vigente en fuentes web del DANE</span>
            </label>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-soft flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consultando IPC oficial y calculando...</span>
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  <span>Calcular tope legal de incremento</span>
                </>
              )}
            </button>
          </form>

          {result && (
            <div className="space-y-3 pt-2 border-t border-cream-200 animate-fadeIn">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-cream-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">IPC {result.anio_ipc_base}</span>
                  <div className="text-lg font-extrabold text-teal-800 mt-0.5">{result.ipc_aplicado}%</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-cream-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Aumento máx.</span>
                  <div className="text-sm font-extrabold text-amber-800 mt-1">
                    +{formatCOP(result.incremento_maximo)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-teal-700 text-white">
                  <span className="text-[10px] font-bold text-teal-100 uppercase">Nuevo canon máx.</span>
                  <div className="text-sm font-extrabold mt-1">
                    {formatCOP(result.nuevo_canon_maximo)}
                  </div>
                </div>
              </div>

              {result.cumple_tope_valor_comercial !== null && result.cumple_tope_valor_comercial !== undefined && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    result.cumple_tope_valor_comercial
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  {result.cumple_tope_valor_comercial ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>
                    {result.cumple_tope_valor_comercial
                      ? `Cumple el tope del 1% del valor comercial (${formatCOP(result.tope_valor_comercial_1_pct || 0)}).`
                      : `Atención: el nuevo canon supera el límite legal del 1% del valor comercial (${formatCOP(result.tope_valor_comercial_1_pct || 0)}) establecido en el Art. 18 de la Ley 820.`}
                  </span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-white border border-cream-200 space-y-1.5 text-[11px] text-slate-700">
                <div className="font-semibold text-slate-900 flex items-center justify-between gap-2">
                  <span>Fuente: {result.fuente_ipc}</span>
                  {result.fuente_url && (
                    <a
                      href={result.fuente_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-700 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Ver DANE</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed">{result.fundamento_legal}</p>
              </div>

              <div className="p-3 rounded-xl bg-cream-150/70 border border-cream-200 text-[11px] space-y-1">
                <span className="font-bold text-slate-800 block">Requisitos obligatorios para aplicar el aumento:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                  {result.requisitos_notificacion.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  onAskInChat(
                    `Mi canon actual de arrendamiento de vivienda urbana es de ${formatCOP(
                      result.canon_actual
                    )} y quiero validar el reajuste para ${result.anio_reajuste} con IPC de ${
                      result.ipc_aplicado
                    }% (nuevo canon máximo ${formatCOP(
                      result.nuevo_canon_maximo
                    )}). ¿Cómo debe hacerse la notificación legal y qué pasa si me cobran más de este tope?`
                  );
                  onClose();
                }}
                className="w-full py-2 px-3 bg-white hover:bg-teal-50 border border-teal-300 text-teal-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Analizar este cálculo en el asistente</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
