'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from 'lucide-react';

interface DeleteAccountModalProps {
  userId: string;
  userName: string;
  language: 'hi' | 'en';
  onClose: () => void;
}

const t = {
  en: {
    title: 'Delete Account',
    subtitle: 'This action is permanent and cannot be undone.',
    warningTitle: 'You will permanently lose:',
    warn1: 'All your transaction records & ledger history',
    warn2: 'All customer/retailer relationships',
    warn3: 'Your profile, inventory & chat history',
    warn4: 'Login access — you will need to register again',
    confirmLabel: 'Type DELETE to confirm',
    confirmPlaceholder: 'Type DELETE here',
    cancelBtn: 'Cancel',
    deleteBtn: 'Permanently Delete Account',
    deleting: 'Deleting account...',
    errorMatch: 'Please type DELETE exactly to confirm.',
    errorFailed: 'Failed to delete account. Please try again.',
  },
  hi: {
    title: 'खाता हटाएं',
    subtitle: 'यह क्रिया स्थायी है और इसे पूर्ववत नहीं किया जा सकता।',
    warningTitle: 'आप हमेशा के लिए खो देंगे:',
    warn1: 'सभी लेन-देन रिकॉर्ड और खाता इतिहास',
    warn2: 'सभी ग्राहक/दुकानदार संबंध',
    warn3: 'आपकी प्रोफ़ाइल, इन्वेंटरी और चैट इतिहास',
    warn4: 'लॉगिन एक्सेस — आपको दोबारा पंजीकरण करना होगा',
    confirmLabel: 'पुष्टि करने के लिए DELETE टाइप करें',
    confirmPlaceholder: 'यहाँ DELETE टाइप करें',
    cancelBtn: 'रद्द करें',
    deleteBtn: 'खाता स्थायी रूप से हटाएं',
    deleting: 'खाता हटाया जा रहा है...',
    errorMatch: 'पुष्टि करने के लिए DELETE बिल्कुल वैसे टाइप करें।',
    errorFailed: 'खाता हटाने में विफल। कृपया पुनः प्रयास करें।',
  },
};

export default function DeleteAccountModal({
  userId,
  userName,
  language,
  onClose,
}: DeleteAccountModalProps) {
  const lang = t[language] || t.en;
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText === 'DELETE';

  async function handleDelete() {
    if (!isConfirmed) {
      setError(lang.errorMatch);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || lang.errorFailed);
      }

      // Sign out locally and redirect to landing page
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : lang.errorFailed);
      setIsDeleting(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#0d0f14] border border-red-900/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Red danger gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-red-700 via-red-500 to-rose-600" />

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-5">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-950/60 border border-red-800/50 rounded-xl">
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{lang.title}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{lang.subtitle}</p>
            </div>
          </div>

          {/* User info pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-xs font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-zinc-300 font-medium">{userName}</span>
          </div>

          {/* Warning list */}
          <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lang.warningTitle}
            </p>
            {[lang.warn1, lang.warn2, lang.warn3, lang.warn4].map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-xs text-red-300/80">{w}</p>
              </div>
            ))}
          </div>

          {/* Confirm input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">{lang.confirmLabel}</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => { setConfirmText(e.target.value); setError(null); }}
              placeholder={lang.confirmPlaceholder}
              disabled={isDeleting}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-mono border bg-zinc-900/60 text-white placeholder-zinc-600 outline-none transition-all disabled:opacity-50
                ${isConfirmed
                  ? 'border-red-500 ring-1 ring-red-500/30'
                  : 'border-zinc-700 focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30'
                }`}
            />
            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {error}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all disabled:opacity-40"
            >
              {lang.cancelBtn}
            </button>
            <button
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
                ${isConfirmed && !isDeleting
                  ? 'bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white shadow-lg shadow-red-900/40 hover:shadow-red-800/50'
                  : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                }`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {lang.deleting}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {lang.deleteBtn}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
