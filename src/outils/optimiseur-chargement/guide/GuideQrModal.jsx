// Fenêtre « Guide cariste » : QR code + lien vers le plan pas à pas sur téléphone.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, ExternalLink, Check } from 'lucide-react';
import QrCode from './QrCode';
import { QR_MAX_URL } from './planLink';

const BLUE = '#2563EB';

export default function GuideQrModal({ url, onClose }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* presse-papiers indisponible */ } };
  const qrOk = url.length <= QR_MAX_URL;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Guide cariste" className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-jetbrains text-[10px] text-slate-500">GUIDE CARISTE</div>
            <div className="font-bricolage font-semibold text-slate-900">Le plan pas à pas sur le téléphone du cariste</div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        {qrOk ? (
          <div className="flex justify-center"><QrCode text={url} size={240} /></div>
        ) : (
          <div className="text-xs rounded-md px-3 py-2" style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
            Plan trop volumineux pour un QR code lisible : envoyez le lien (SMS, WhatsApp, e-mail).
          </div>
        )}
        <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
          <li>Le cariste scanne le QR code (aussi imprimé sur la fiche PDF).</li>
          <li>Il suit le plan colis par colis ou mur par mur, en 3D.</li>
          <li>À la fin, il prend une photo du camion chargé et l’envoie.</li>
        </ol>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copy} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-jetbrains text-xs" style={{ background: '#EFF6FF', color: BLUE }}>
            {copied ? <><Check size={13} /> Lien copié</> : <><Copy size={13} /> Copier le lien</>}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-jetbrains text-xs text-white" style={{ background: BLUE }}>
            <ExternalLink size={13} /> Ouvrir le guide
          </a>
        </div>
        <p className="font-jetbrains text-[10px] text-slate-400">Le plan est contenu dans le lien : aucune donnée n’est envoyée à un serveur.</p>
      </div>
    </div>,
    document.body,
  );
}
