import React from 'react';
import { cn } from '../lib/utils.js';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl transition-all',
          className
        )}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          {title ? <h3 className="text-lg font-semibold text-slate-100">{title}</h3> : <div />}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
