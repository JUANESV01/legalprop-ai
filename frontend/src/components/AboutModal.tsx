import React from 'react';
import { X, BookOpen, Scale, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Logo } from './Logo';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-cream-50 border border-cream-200 w-full max-w-2xl rounded-2xl shadow-elevated overflow-hidden max-h-[90vh] flex flex-col">
        {/* Cabecera del Modal */}
        <div className="p-5 border-b border-cream-200 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-3">
            <Logo size="sm" showText={true} />
            <span className="text-xs bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-2.5 py-0.5 rounded-full">
              v1.0.0
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-cream-100 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
          {/* Introducción */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2 font-display">
              Orientación Jurídica Inmobiliaria para Colombia
            </h3>
            <p className="text-slate-600">
              <strong>LegalProp AI</strong> es un asistente digital especializado en resolver consultas cotidianas sobre el régimen de arrendamiento de vivienda urbana y la convivencia en conjuntos residenciales y edificios sometidos a propiedad horizontal.
            </p>
          </div>

          {/* Pilares del Proyecto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-white border border-cream-200 rounded-xl space-y-1.5 shadow-soft">
              <div className="flex items-center space-x-2 text-teal-800 font-bold text-xs">
                <Scale className="w-4 h-4 text-teal-700" />
                <span>Ley 820 de 2003</span>
              </div>
              <p className="text-slate-600 text-xs">
                Regula derechos y deberes entre arrendador y arrendatario, causales de terminación de contrato, prohibición de depósitos ilegales y topes de incremento anual del canon de arrendamiento.
              </p>
            </div>

            <div className="p-3.5 bg-white border border-cream-200 rounded-xl space-y-1.5 shadow-soft">
              <div className="flex items-center space-x-2 text-teal-800 font-bold text-xs">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <span>Ley 675 de 2001</span>
              </div>
              <p className="text-slate-600 text-xs">
                Régimen de propiedad horizontal: funcionamiento de asambleas, cuotas de administración, facultades del administrador, sanciones por convivencia y tenencia de mascotas.
              </p>
            </div>
          </div>

          {/* Funcionalidades Clave */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Cómo funciona la plataforma:
            </h4>
            <ul className="space-y-2 text-slate-600 text-xs">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Respuestas fundamentadas:</strong> Cada explicación viene acompañada de los artículos pertinentes y citas exactas para facilitar su comprobación en la norma oficial.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Análisis de documentos propios:</strong> Puedes cargar contratos, reglamentos internos o manuales de convivencia (PDF, Word, Excel, ODT) para realizar consultas directas sobre tus documentos.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Consulta de datos económicos y jurisprudencia:</strong> Opción integrada para verificar indicadores del DANE (IPC) y sentencias tutelares de la Corte Constitucional.
                </span>
              </li>
            </ul>
          </div>

          {/* Aviso Legal Breve */}
          <div className="p-3.5 bg-cream-150 border border-cream-300 rounded-xl flex items-start space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-normal">
              Esta herramienta tiene un propósito informativo y didáctico. No constituye representación legal ni reemplaza la asesoría formal de un abogado titulado para litigios o trámites judiciales.
            </p>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="p-4 bg-white border-t border-cream-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Proyecto LegalProp AI • 2026
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-soft transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
