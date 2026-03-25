import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export default function ConfirmModal({
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'CONFIRM', 
  cancelText = 'CANCEL', 
  isDangerous = false
}: ConfirmModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`max-w-md w-full border bg-black p-8 space-y-8 ${isDangerous ? 'border-red-500/30' : 'border-white/10'}`}
          >
            <div className="flex items-start justify-between">
              <div className={`flex items-center gap-3 ${isDangerous ? 'text-red-500' : 'text-white'}`}>
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase">{title}</h3>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm font-light text-white/60 leading-relaxed uppercase tracking-widest">
              {message}
            </p>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={onClose}
                className="py-4 border border-white/10 text-[10px] font-medium tracking-[0.2em] uppercase text-white/40 hover:text-white hover:border-white transition-all"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`py-4 font-bold text-[10px] tracking-[0.2em] uppercase transition-all flex items-center justify-center ${
                  isDangerous 
                    ? 'bg-red-500 text-white hover:bg-black hover:text-red-500 border border-red-500' 
                    : 'bg-white text-black hover:bg-black hover:text-white border border-white'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
