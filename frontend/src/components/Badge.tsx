import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'gold' | 'emerald' | 'slate';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'slate', className = '' }) => {
  const styles = {
    primary: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
    gold: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
    emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
