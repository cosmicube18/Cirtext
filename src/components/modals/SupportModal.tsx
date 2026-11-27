import React, { useEffect, useState } from 'react';
import { X, Download, Heart, ExternalLink, Coffee } from 'lucide-react';

// ── Configure your donation links here ─────────────────────────────────────
const KOFI_URL = 'https://ko-fi.com/cosmicube'; // set to '' to hide the Ko-fi button

interface QrCardProps {
  title: string;
  subtitle?: string;
  imageSrc: string;
  downloadName: string;
  accentColor: string; // tailwind bg class for the top bar
}

const QrCard: React.FC<QrCardProps> = ({
  title,
  subtitle,
  imageSrc,
  downloadName,
  accentColor,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col rounded-xl bg-slate-800/70 border border-slate-700/80 overflow-hidden shadow-md">
      {/* Accent top bar */}
      <div className={`h-1 w-full ${accentColor}`} />

      {/* Card header */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs font-bold text-slate-100">{title}</p>
        {subtitle && (
          <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* QR image or placeholder */}
      <div className="flex-1 flex items-center justify-center px-4 py-3 min-h-[160px]">
        {imgError ? (
          <div className="flex flex-col items-center gap-2 text-slate-500 select-none">
            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
              <Heart className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-[10px] text-center text-slate-500">
              QR image not found.
              <br />
              Place <code className="text-slate-400">{imageSrc}</code> in <code className="text-slate-400">/public</code>.
            </p>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={`${title} QR code`}
            onError={() => setImgError(true)}
            className="max-h-44 w-auto rounded-lg border border-slate-700 object-contain shadow-sm"
          />
        )}
      </div>

      {/* Download button */}
      {!imgError && (
        <div className="px-4 pb-4">
          <a
            href={imageSrc}
            download={downloadName}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-slate-200 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            Download QR
          </a>
        </div>
      )}
    </div>
  );
};

// ── Main modal ──────────────────────────────────────────────────────────────
export interface SupportModalProps {
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel — stop backdrop click from propagating through */}
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Support Cirtext</h2>
              <p className="text-[10px] text-slate-400">Keep the schematic editor free & alive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Blurb */}
          <p className="text-xs text-slate-300 leading-relaxed">
            Cirtext is <span className="text-slate-100 font-semibold">free to use</span> in your
            browser — no account needed, no paywalls. If it helps with your{' '}
            <span className="text-sky-300">classes</span>,{' '}
            <span className="text-sky-300">labs</span>, or{' '}
            <span className="text-sky-300">prototypes</span>, consider supporting ongoing
            development and hosting. Every contribution keeps the lights on! ☕
          </p>

          {/* PH E-Wallet QR grid */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
              Philippine E-Wallet / Bank Transfer
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QrCard
                title="GCash"
                imageSrc="/qr-gcash.jpg"
                downloadName="Cirtext-GCash-QR.jpg"
                accentColor="bg-blue-500"
              />
              <QrCard
                title="MariBank (QR Ph)"
                subtitle="Works with MariBank, GCash, Maya & all PH banks"
                imageSrc="/qr-maribank.jpg"
                downloadName="Cirtext-MariBank-QR.jpg"
                accentColor="bg-violet-500"
              />
            </div>
          </div>

          {/* Ko-fi / International */}
          {KOFI_URL && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                International
              </p>
              <a
                href={KOFI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#ff5e5b]/10 hover:bg-[#ff5e5b]/20 border border-[#ff5e5b]/40 hover:border-[#ff5e5b]/70 text-[#ff7f7c] hover:text-[#ff9896] font-semibold text-sm transition-all"
              >
                <Coffee className="w-4 h-4 shrink-0" />
                <span>Buy me a Ko-fi</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
              </a>
            </div>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-slate-500 text-center leading-relaxed pb-1">
            Donations are voluntary and go directly to the developer. Thank you! 🙏
          </p>
        </div>
      </div>
    </div>
  );
};
