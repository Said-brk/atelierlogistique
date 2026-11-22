// QR code en SVG (bibliothèque qrcode-generator, aucune requête réseau).
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { segments } from './qr';

export { qrModules, QR_MAX_MODULES } from './qr';

/** props : text, size (px, arrondi pour des modules nets), level ('L'|'M'|'Q'|'H') */
export default function QrCode({ text, size = 200, level = 'L', className = '' }) {
  // Sur écran : nombre entier de pixels par module si on perd peu de taille (bords nets).
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, level);
      segments(text).forEach(([part, mode]) => qr.addData(part, mode));
      qr.make();
      const n = qr.getModuleCount();
      const cell = 1;
      const margin = 4;
      const dim = n + margin * 2;
      let path = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h${cell}v${cell}h-${cell}z`;
      const whole = Math.floor(size / dim) * dim;
      const px = whole >= size * 0.85 ? whole : size;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#0F172A"/></svg>`;
    } catch {
      return null;
    }
  }, [text, size, level]);
  if (!svg) return <div className="text-xs text-red-600">QR code impossible (plan trop volumineux)</div>;
  return <div className={className} style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
