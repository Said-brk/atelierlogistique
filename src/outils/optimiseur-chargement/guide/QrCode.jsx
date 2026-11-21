// QR code en SVG (bibliothèque qrcode-generator, aucune requête réseau).
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** props : text, size (px), level ('L'|'M'|'Q'|'H') */
export default function QrCode({ text, size = 200, level = 'L', className = '' }) {
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, level);
      qr.addData(text, 'Byte');
      qr.make();
      const n = qr.getModuleCount();
      const cell = 1;
      const margin = 4;
      const dim = n + margin * 2;
      let path = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h${cell}v${cell}h-${cell}z`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#0F172A"/></svg>`;
    } catch {
      return null;
    }
  }, [text, size, level]);
  if (!svg) return <div className="text-xs text-red-600">QR code impossible (plan trop volumineux)</div>;
  return <div className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
