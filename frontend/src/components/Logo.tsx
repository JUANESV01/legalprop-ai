import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size];

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Isotipo: Balanza de la Justicia + Arquitectura PH + Núcleo de IA */}
      <div className={`relative flex-shrink-0 ${iconDimensions} group`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative w-full h-full drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
        >
          <defs>
            {/* Gradiente Teal Noble */}
            <linearGradient id="lp-teal-shield" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#166E69" />
              <stop offset="100%" stopColor="#0B423F" />
            </linearGradient>

            {/* Gradiente Dorado Clásico para la Balanza */}
            <linearGradient id="lp-gold" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5D061" />
              <stop offset="50%" stopColor="#E0A926" />
              <stop offset="100%" stopColor="#C4880E" />
            </linearGradient>
          </defs>

          {/* Escudo contenedor en Deep Teal con borde cálido */}
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="10"
            fill="url(#lp-teal-shield)"
            stroke="#C2B49B"
            strokeWidth="1.2"
          />

          {/* Silueta de Edificios PH de fondo */}
          <path
            d="M13 36V23L19 18V36M19 18L24 14L29 18V36M29 18L35 23V36"
            stroke="#268781"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Balanza de la Justicia (Eje vertical y Brazo horizontal) */}
          <path
            d="M24 16V35M15 21H33"
            stroke="url(#lp-gold)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Platillos de la Balanza */}
          <path
            d="M12 26C12 28.5 15.5 30 15.5 30C15.5 30 19 28.5 19 26H12ZM29 26C29 28.5 32.5 30 32.5 30C32.5 30 36 28.5 36 26H29Z"
            fill="url(#lp-gold)"
          />

          {/* Cuerdas / Tirantes de los platillos */}
          <path
            d="M15 21L12 26M15 21L19 26M33 21L29 26M33 21L36 26"
            stroke="url(#lp-gold)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Base de la Balanza */}
          <path
            d="M19 35H29"
            stroke="url(#lp-gold)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Núcleo de Inteligencia Artificial (Estrella / Nodo superior) */}
          <circle cx="24" cy="11.5" r="2.2" fill="#FDFBF7" />
          <path
            d="M24 6.5V9M24 14V16.5M19 11.5H21.5M26.5 11.5H29"
            stroke="#FDFBF7"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Tipografía LegalProp-AI */}
      {showText && (
        <div className="flex items-center tracking-tight font-display">
          <span className={`font-bold ${textSizes} text-slate-900`}>
            Legal<span className="text-teal-700">Prop</span>
          </span>
          <span className="ml-2 px-2 py-0.5 text-[11px] font-extrabold uppercase rounded-md bg-teal-700 text-white shadow-soft">
            AI
          </span>
        </div>
      )}
    </div>
  );
};
