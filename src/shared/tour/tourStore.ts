// Mémoire des visites guidées (navigateur uniquement, aucune donnée envoyée).
// État par visite : 'done' (terminée), 'never' (ne plus afficher), 'snooze' (rappel après `until`).

export type TourState = { state: 'done' | 'never' | 'snooze'; until?: number };

const KEY = (id: string) => `al.tour.${id}`;
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function readTour(id: string, s: Storage | null = storage()): TourState | null {
  try {
    const raw = s?.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch { return null; }
}

export function writeTour(id: string, value: TourState | null, s: Storage | null = storage()): void {
  try {
    if (!s) return;
    if (value) s.setItem(KEY(id), JSON.stringify(value)); else s.removeItem(KEY(id));
  } catch { /* navigation privée, quota : la visite se reproposera, sans gravité */ }
}

/** La visite doit-elle être proposée automatiquement ? */
export function shouldOffer(st: TourState | null, now = Date.now()): boolean {
  if (!st) return true;
  if (st.state === 'snooze') return !st.until || now >= st.until;
  return false;
}

export const snooze = (now = Date.now()): TourState => ({ state: 'snooze', until: now + SNOOZE_MS });
