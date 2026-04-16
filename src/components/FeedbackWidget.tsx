import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useLocation } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Send,
  ChevronDown,
  Bug,
  Lightbulb,
  Palette,
  Zap,
  MessageCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { submitFeedback, type FeedbackCategory } from '../services/feedbackService';

const CATEGORIES: Array<{
  value: FeedbackCategory;
  label: string;
  icon: typeof Bug;
  color: string;
}> = [
  { value: 'bug',         label: 'Bug Report',      icon: Bug,           color: 'text-red-400'     },
  { value: 'feature',     label: 'Feature Request', icon: Lightbulb,     color: 'text-yellow-400'  },
  { value: 'ux',          label: 'UX / Design',     icon: Palette,       color: 'text-blue-400'    },
  { value: 'performance', label: 'Performance',     icon: Zap,           color: 'text-emerald-400' },
  { value: 'general',     label: 'General',         icon: MessageCircle, color: 'text-white/60'    },
];

type FormState = {
  category:    FeedbackCategory;
  message:     string;
  email:       string;
  name:        string;
  isAnonymous: boolean;
};

const INITIAL_FORM: FormState = {
  category:    'general',
  message:     '',
  email:       '',
  name:        '',
  isAnonymous: false,
};

export default function FeedbackWidget() {
  const account  = useCurrentAccount();
  const location = useLocation();

  const [isOpen,    setIsOpen]    = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [form,      setForm]      = useState<FormState>(INITIAL_FORM);
  const [errors,    setErrors]    = useState<Partial<Record<keyof FormState, string>>>({});

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.message.trim()) {
      newErrors.message = 'Message is required.';
    } else if (form.message.trim().length > 2000) {
      newErrors.message = 'Max 2000 characters.';
    }
    if (
      !form.isAnonymous &&
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      newErrors.email = 'Invalid email address.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);
    try {
      await submitFeedback({
        category:      form.category,
        message:       form.message.trim(),
        email:         (!form.isAnonymous && form.email.trim()) ? form.email.trim() : undefined,
        name:          (!form.isAnonymous && form.name.trim())  ? form.name.trim()  : undefined,
        isAnonymous:   form.isAnonymous,
        walletAddress: (!form.isAnonymous && account?.address)  ? account.address   : undefined,
        page:          location.pathname,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      if (msg.includes('Too many requests')) {
        toast.error('Slow down — too many submissions. Try again in 15 minutes.');
      } else {
        toast.error(msg || 'Failed to submit feedback.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setSubmitted(false);
      setForm(INITIAL_FORM);
      setErrors({});
    }, 300);
  };

  const charCount = form.message.length;

  return (
    /* Fixed bottom-left so it never overlaps LiveFeed which lives bottom-right */
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-start gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="feedback-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit  ={{ opacity: 0, y: 20,  scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[340px] sm:w-[380px] bg-black border border-white/20 shadow-2xl shadow-black/80 overflow-hidden"
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-white/40" />
                <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-white">
                  SEND_FEEDBACK
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 text-white/30 hover:text-white transition-colors"
                aria-label="Close feedback panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            {submitted ? (
              /* Success state */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 px-6 space-y-6 text-center"
              >
                <div className="w-14 h-14 border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-light tracking-widest uppercase text-white">
                    FEEDBACK_RECEIVED
                  </p>
                  <p className="text-[11px] text-white/40 tracking-widest font-light leading-relaxed">
                    Thank you. We'll review your submission and act on it shortly.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="px-8 py-3 border border-white/20 text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all"
                >
                  CLOSE
                </button>
              </motion.div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="p-5 space-y-4">

                {/* Category selector */}
                <div className="space-y-2">
                  <label className="text-[9px] font-medium tracking-[0.4em] uppercase text-white/30">
                    CATEGORY
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {CATEGORIES.map(cat => {
                      const Icon   = cat.icon;
                      const active = form.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => set('category', cat.value)}
                          title={cat.label}
                          className={`flex flex-col items-center gap-1.5 py-2.5 px-1 border text-[8px] font-medium tracking-widest uppercase transition-all duration-200 ${
                            active
                              ? 'border-white bg-white text-black'
                              : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${active ? 'text-black' : cat.color}`} />
                          <span
                            className="truncate w-full text-center leading-none"
                            style={{ fontSize: '7px' }}
                          >
                            {cat.value.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-medium tracking-[0.4em] uppercase text-white/30">
                      MESSAGE <span className="text-red-400">*</span>
                    </label>
                    <span
                      className={`text-[9px] tracking-widest ${
                        charCount > 1800 ? 'text-orange-400' : 'text-white/20'
                      }`}
                    >
                      {charCount}/2000
                    </span>
                  </div>
                  <textarea
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Describe the issue or suggestion..."
                    rows={4}
                    maxLength={2000}
                    className={`w-full bg-white/[0.03] border px-3 py-2.5 text-[11px] font-light text-white placeholder-white/20 focus:outline-none resize-none transition-colors ${
                      errors.message
                        ? 'border-red-500/50'
                        : 'border-white/10 focus:border-white/30'
                    }`}
                  />
                  {errors.message && (
                    <p className="flex items-center gap-1.5 text-[9px] text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Anonymous toggle */}
                <div className="flex items-center justify-between py-2 border-y border-white/5">
                  <div className="flex items-center gap-2.5">
                    {form.isAnonymous
                      ? <EyeOff className="w-3.5 h-3.5 text-white/30" />
                      : <Eye    className="w-3.5 h-3.5 text-white/40" />
                    }
                    <span className="text-[9px] font-medium tracking-[0.3em] uppercase text-white/50">
                      {form.isAnonymous ? 'ANONYMOUS MODE' : 'IDENTIFIED MODE'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('isAnonymous', !form.isAnonymous)}
                    className={`relative w-10 h-5 border transition-colors duration-200 flex items-center ${
                      form.isAnonymous
                        ? 'border-white/30 bg-white/10'
                        : 'border-white/10'
                    }`}
                    aria-label="Toggle anonymous mode"
                  >
                    <motion.div
                      animate={{ x: form.isAnonymous ? 20 : 2 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute w-3.5 h-3.5 ${form.isAnonymous ? 'bg-white' : 'bg-white/30'}`}
                    />
                  </button>
                </div>

                {/* Contact fields — hidden in anonymous mode */}
                <AnimatePresence>
                  {!form.isAnonymous && (
                    <motion.div
                      key="contact-fields"
                      initial={{ opacity: 0, height: 0   }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit  ={{ opacity: 0, height: 0   }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-medium tracking-[0.4em] uppercase text-white/30">
                          <User className="w-2.5 h-2.5 inline mr-1.5" />
                          NAME{' '}
                          <span className="text-white/20">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => set('name', e.target.value)}
                          placeholder="Your name"
                          maxLength={100}
                          className="w-full bg-white/[0.03] border border-white/10 focus:border-white/30 px-3 py-2 text-[11px] font-light text-white placeholder-white/20 focus:outline-none transition-colors"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-medium tracking-[0.4em] uppercase text-white/30">
                          <Mail className="w-2.5 h-2.5 inline mr-1.5" />
                          EMAIL{' '}
                          <span className="text-white/20">(for follow-up)</span>
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => set('email', e.target.value)}
                          placeholder="you@example.com"
                          className={`w-full bg-white/[0.03] border px-3 py-2 text-[11px] font-light text-white placeholder-white/20 focus:outline-none transition-colors ${
                            errors.email
                              ? 'border-red-500/50'
                              : 'border-white/10 focus:border-white/30'
                          }`}
                        />
                        {errors.email && (
                          <p className="flex items-center gap-1.5 text-[9px] text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {errors.email}
                          </p>
                        )}
                      </div>

                      {/* Wallet auto-fill notice */}
                      {account?.address && (
                        <p className="flex items-start gap-1.5 text-[9px] text-white/20 leading-relaxed">
                          <Eye className="w-3 h-3 shrink-0 mt-0.5" />
                          Wallet address will be included for context. Toggle anonymous to exclude it.
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !form.message.trim()}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-white text-black text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      SUBMITTING...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      SUBMIT_FEEDBACK
                    </>
                  )}
                </button>

                <p className="text-[8px] text-white/15 text-center tracking-widest uppercase leading-relaxed">
                  {form.isAnonymous
                    ? 'Submitted anonymously. No contact info stored.'
                    : 'Contact info stored only for follow-up on resolved issues.'}
                </p>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-2.5 px-4 py-3 border text-[9px] font-medium tracking-[0.3em] uppercase shadow-xl transition-all duration-300 ${
          isOpen
            ? 'bg-white text-black border-white'
            : 'bg-black text-white/50 border-white/20 hover:border-white hover:text-white'
        }`}
        aria-label={isOpen ? 'Close feedback' : 'Open feedback'}
      >
        {isOpen ? (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            CLOSE
          </>
        ) : (
          <>
            <MessageSquare className="w-3.5 h-3.5" />
            FEEDBACK
          </>
        )}
      </motion.button>
    </div>
  );
}
