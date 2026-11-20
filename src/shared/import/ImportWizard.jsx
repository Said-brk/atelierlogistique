// Assistant d'import générique (fichier ou collage) : source → correspondance → aperçu.
// Ne connaît que le schéma qu'on lui passe : réutilisable par tous les outils du site.
//
// Props :
//  - schema        : DatasetSchema
//  - store         : ProfileStore (profils de correspondance)
//  - onImport      : ({ records, options, mode, source }) => void   mode = 'replace' | 'append'
//  - onClose       : () => void
//  - extraOptions  : [{ id, label, help }] cases à cocher propres à l'outil (mémorisées dans le profil)
//  - footerLinks   : [{ label, onClick }] ex. « Télécharger le format standard »
//  - canAppend     : afficher le choix Remplacer / Ajouter

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, ClipboardPaste, Save, Trash2, Download, FileUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  applyMapping, exportProfile, importProfileJson, initialMapping, mappingFits, missingRequired,
  newProfile, readPasted, UNITS, unitFactor, downloadText,
} from './index';
import { ACCEPTED_FILES, readFile } from './readFile';

const BLUE = '#2563EB';
const btn = 'inline-flex items-center gap-1.5 font-jetbrains text-[11px] px-2.5 py-1.5 rounded-md';
const ghost = { background: '#F1F5F9', color: '#475569' };

const DELIM_LABEL = { ';': 'point-virgule', ',': 'virgule', '\t': 'tabulation', '|': 'barre verticale' };

function displayValue(field, v) {
  if (v === undefined || v === null || v === '') return '—';
  if (field.unitKind && typeof v === 'number') {
    const u = field.defaultUnit;
    const n = v / unitFactor(field.unitKind, u, u);
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${u}`;
  }
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  return String(v);
}

export default function ImportWizard({ schema, store, onImport, onClose, extraOptions = [], footerLinks = [], canAppend = true }) {
  const [table, setTable] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [file, setFile] = useState(null);
  const [paste, setPaste] = useState('');
  const [mapping, setMapping] = useState({});
  const [options, setOptions] = useState({ groupIdentical: false });
  const [mode, setMode] = useState('replace');
  const [profiles, setProfiles] = useState(() => store.list(schema.id));
  const [profileId, setProfileId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [msg, setMsg] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const profileFileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const refreshProfiles = () => setProfiles(store.list(schema.id));

  /** Applique un tableau lu : profil reconnu automatiquement, sinon suggestion. */
  const loadTable = (t) => {
    setTable(t);
    setMsg(null);
    const fit = store.list(schema.id).find((p) => mappingFits(p.mapping, t));
    if (fit) {
      setMapping(fit.mapping);
      setOptions({ groupIdentical: false, ...fit.options });
      setProfileId(fit.id);
      setProfileName(fit.name);
      setMsg({ type: 'ok', text: `Profil « ${fit.name} » reconnu et appliqué.` });
    } else {
      setMapping(initialMapping(schema, t));
      setProfileId('');
      if (t.meta.headerRow < 0) setMsg({ type: 'warn', text: 'Aucun en-tête reconnu : colonnes lues dans l’ordre du format standard. Vérifiez la correspondance.' });
    }
  };

  const onFile = async (f, sheet) => {
    if (!f) return;
    try {
      const { table: t, sheets: s } = await readFile(f, schema, sheet);
      setFile(f);
      setSheets(s);
      loadTable(t);
    } catch (err) {
      setMsg({ type: 'error', text: `Lecture impossible : ${err.message}` });
    }
  };

  const onPaste = () => {
    if (!paste.trim()) return;
    loadTable(readPasted(paste, schema));
  };

  const result = useMemo(() => (table ? applyMapping(schema, table, mapping, options) : null), [schema, table, mapping, options]);
  const missing = useMemo(() => missingRequired(schema, mapping), [schema, mapping]);
  const errors = result?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? [];
  const errorLines = new Set(errors.map((e) => e.row));
  const importable = result ? result.records.filter((r) => !errorLines.has(r.__line)) : [];

  const sampleRow = (col) => {
    if (!table || !col) return '';
    const i = table.headers.indexOf(col);
    const v = table.rows.find((r) => r[i])?.[i] ?? '';
    return v.length > 18 ? `${v.slice(0, 18)}…` : v;
  };

  const setField = (id, patch) => { setMapping((m) => ({ ...m, [id]: { ...m[id], ...patch } })); };

  const pickProfile = (id) => {
    setProfileId(id);
    const p = store.get(id);
    if (!p) return;
    setMapping(p.mapping);
    setOptions({ groupIdentical: false, ...p.options });
    setProfileName(p.name);
    if (table && !mappingFits(p.mapping, table)) setMsg({ type: 'warn', text: `Certaines colonnes du profil « ${p.name} » sont absentes de ce fichier.` });
  };

  const saveProfile = () => {
    const name = profileName.trim();
    if (!name) { setMsg({ type: 'error', text: 'Donnez un nom au profil (ex. « Export Reflex quai 3 »).' }); return; }
    const existing = profileId ? store.get(profileId) : null;
    const p = existing && existing.name === name
      ? { ...existing, mapping, options, updatedAt: new Date().toISOString() }
      : newProfile(name, schema.id, schema.version, mapping, options);
    store.save(p);
    setProfileId(p.id);
    refreshProfiles();
    setMsg({ type: 'ok', text: `Profil « ${name} » enregistré dans ce navigateur.` });
  };

  const deleteProfile = () => {
    const p = store.get(profileId);
    if (!p || !window.confirm(`Supprimer le profil « ${p.name} » ?`)) return;
    store.remove(p.id);
    setProfileId('');
    setProfileName('');
    refreshProfiles();
  };

  const shareProfile = () => {
    const p = store.get(profileId);
    if (p) downloadText(`profil-import-${p.name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`, exportProfile(p), 'application/json');
  };

  const loadProfileFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const p = importProfileJson(await f.text(), schema.id);
      store.save(p);
      refreshProfiles();
      pickProfile(p.id);
      setMsg({ type: 'ok', text: `Profil « ${p.name} » ajouté.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const confirm = () => {
    onImport({ records: importable, options, mode, source: table?.meta.source ?? '' });
  };

  const meta = table?.meta;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Importer des données" className="bg-white w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 bg-white z-10 px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-jetbrains text-xs text-slate-500">IMPORT · {schema.label.toUpperCase()}</div>
            <div className="text-sm text-slate-800 font-medium">Fichier Excel / CSV de votre ERP ou WMS, ou copier-coller</div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          {/* 1. Source */}
          <section className="grid md:grid-cols-2 gap-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors"
              style={{ borderColor: dragging ? BLUE : '#CBD5E1', background: dragging ? '#EFF6FF' : '#F8FAFC' }}
            >
              <Upload size={18} className="mx-auto text-slate-400" />
              <div className="mt-1.5 text-sm text-slate-700">{file ? file.name : 'Déposez un fichier ou cliquez'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Excel, CSV, TXT · export ERP / WMS · reste dans votre navigateur</div>
              <input ref={fileRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <div className="space-y-2">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
                placeholder={'…ou collez des lignes copiées depuis Excel (avec ou sans en-têtes)'}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base sm:text-[11px] text-slate-800 focus:border-slate-400" />
              <button onClick={onPaste} disabled={!paste.trim()} className={btn} style={{ background: paste.trim() ? BLUE : '#CBD5E1', color: '#fff' }}><ClipboardPaste size={11} /> Analyser le collage</button>
            </div>
          </section>

          {msg && (
            <div className="text-[11px] font-jetbrains px-3 py-2 rounded-md" style={
              msg.type === 'error' ? { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
                : msg.type === 'warn' ? { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }
                  : { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
              {msg.text}
            </div>
          )}

          {/* Profils */}
          <section className="rounded-xl border border-slate-200 px-3 py-2.5 flex flex-wrap items-center gap-2">
            <span className="font-jetbrains text-[11px] text-slate-500">PROFIL</span>
            <select value={profileId} onChange={(e) => (e.target.value ? pickProfile(e.target.value) : setProfileId(''))}
              className="text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white min-w-[10rem]">
              <option value="">{profiles.length ? '— Choisir un profil —' : 'Aucun profil enregistré'}</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {profileId && (
              <>
                <button onClick={shareProfile} className={btn} style={ghost} title="Exporter le profil pour un collègue ou un autre poste"><Download size={11} /> Partager</button>
                <button onClick={deleteProfile} className={btn} style={{ background: '#FEF2F2', color: '#B91C1C' }}><Trash2 size={11} /> Supprimer</button>
              </>
            )}
            <button onClick={() => profileFileRef.current?.click()} className={btn} style={ghost} title="Importer un profil partagé (.json)"><FileUp size={11} /> Charger un profil</button>
            <input ref={profileFileRef} type="file" accept=".json,application/json" className="hidden" onChange={loadProfileFile} />
          </section>

          {table && (
            <>
              <div className="text-[11px] text-slate-500 font-jetbrains">
                {meta.source} · {table.rows.length} ligne(s)
                {meta.headerRow >= 0 && ` · en-tête ligne ${meta.headerRow + 1}`}
                {meta.encoding && ` · ${meta.encoding === 'windows-1252' ? 'Windows-1252 (Excel / AS400)' : 'UTF-8'}`}
                {meta.delimiter && ` · séparateur ${DELIM_LABEL[meta.delimiter] ?? meta.delimiter}`}
                {sheets.length > 1 && (
                  <> · feuille{' '}
                    <select value={meta.sheet} onChange={(e) => onFile(file, e.target.value)} className="border border-slate-200 rounded px-1 py-0.5 bg-white">
                      {sheets.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </>
                )}
              </div>

              {/* 2. Correspondance */}
              <section className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-jetbrains text-[11px] text-slate-600">CORRESPONDANCE DES COLONNES</div>
                <div className="divide-y divide-slate-100">
                  {schema.fields.map((f) => {
                    const m = mapping[f.id] ?? { column: null };
                    const miss = f.required && !m.column;
                    return (
                      <div key={f.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-12 sm:col-span-3 text-xs text-slate-700" title={f.help}>
                          {f.label}{f.required && <span className="text-red-600"> *</span>}
                        </div>
                        <select value={m.column ?? ''} onChange={(e) => setField(f.id, { column: e.target.value || null })}
                          className="col-span-7 sm:col-span-4 text-base sm:text-xs border rounded-md px-2 py-1.5 bg-white"
                          style={{ borderColor: miss ? '#FCA5A5' : '#E2E8F0' }}>
                          <option value="">— Non importé{f.defaultValue !== undefined ? ` (défaut : ${displayValue(f, f.defaultValue)})` : ''} —</option>
                          {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <div className="col-span-5 sm:col-span-2">
                          {f.unitKind && (
                            <select value={m.unit ?? f.defaultUnit} onChange={(e) => setField(f.id, { unit: e.target.value })}
                              className="w-full text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white" aria-label={`Unité ${f.label}`}>
                              {UNITS[f.unitKind].map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="col-span-12 sm:col-span-3 font-jetbrains text-[11px] text-slate-400 truncate">{m.column ? `ex. ${sampleRow(m.column) || '—'}` : ''}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Options */}
              <section className="space-y-1.5">
                {schema.groupKey && (
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input type="checkbox" className="mt-0.5" checked={!!options.groupIdentical} onChange={(e) => setOptions((o) => ({ ...o, groupIdentical: e.target.checked }))} />
                    <span>Regrouper les lignes identiques <span className="text-slate-500">— pour un export « une ligne par colis / SSCC » : les quantités sont additionnées.</span></span>
                  </label>
                )}
                {extraOptions.map((o) => (
                  <label key={o.id} className="flex items-start gap-2 text-xs text-slate-700">
                    <input type="checkbox" className="mt-0.5" checked={!!options[o.id]} onChange={(e) => setOptions((x) => ({ ...x, [o.id]: e.target.checked }))} />
                    <span>{o.label}{o.help && <span className="text-slate-500"> — {o.help}</span>}</span>
                  </label>
                ))}
              </section>

              {/* 3. Aperçu */}
              <section className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-jetbrains text-[11px] text-slate-600 flex flex-wrap gap-x-3">
                  <span>APERÇU APRÈS CONVERSION</span>
                  <span className="text-slate-500">{result.stats.read} lue(s) · {importable.length} à importer{result.stats.grouped ? ` · ${result.stats.grouped} regroupée(s)` : ''}{result.stats.skipped ? ` · ${result.stats.skipped} ignorée(s)` : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead><tr className="text-left text-slate-500">
                      {schema.fields.filter((f) => mapping[f.id]?.column || f.defaultValue !== undefined).map((f) => <th key={f.id} className="px-2 py-1.5 font-normal whitespace-nowrap">{f.label}</th>)}
                    </tr></thead>
                    <tbody>
                      {result.records.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-slate-100" style={errorLines.has(r.__line) ? { background: '#FEF2F2' } : undefined}>
                          {schema.fields.filter((f) => mapping[f.id]?.column || f.defaultValue !== undefined).map((f) => <td key={f.id} className="px-2 py-1 whitespace-nowrap text-slate-700">{displayValue(f, r[f.id])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(errors.length > 0 || warnings.length > 0) && (
                  <div className="px-3 py-2 border-t border-slate-100 space-y-0.5 max-h-28 overflow-y-auto">
                    {[...errors, ...warnings].slice(0, 12).map((x, i) => (
                      <div key={i} className="text-[11px] flex gap-1.5" style={{ color: x.level === 'error' ? '#B91C1C' : '#B45309' }}>
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" /> Ligne {x.row} · {x.message}{x.level === 'error' ? ' (ligne écartée)' : ''}
                      </div>
                    ))}
                    {errors.length + warnings.length > 12 && <div className="text-[11px] text-slate-500">… et {errors.length + warnings.length - 12} autre(s)</div>}
                  </div>
                )}
              </section>

              {/* Enregistrer le profil */}
              <section className="flex flex-wrap items-center gap-2">
                <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Nom du profil (ex. Export Reflex quai 3)"
                  className="flex-1 min-w-[12rem] text-base sm:text-xs border border-slate-200 rounded-md px-2.5 py-1.5 outline-none focus:border-slate-400" />
                <button onClick={saveProfile} className={btn} style={ghost}><Save size={11} /> Enregistrer la correspondance</button>
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-3">
            {footerLinks.map((l) => (
              <button key={l.label} onClick={l.onClick} className="font-jetbrains text-[11px] underline text-slate-500 hover:text-slate-800">{l.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {table && canAppend && (
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                <option value="replace">Remplacer les lignes</option>
                <option value="append">Ajouter aux lignes</option>
              </select>
            )}
            <button onClick={confirm} disabled={!table || missing.length > 0 || importable.length === 0}
              className="inline-flex items-center gap-1.5 font-jetbrains text-xs px-3 py-2 rounded-md text-white"
              style={{ background: !table || missing.length > 0 || importable.length === 0 ? '#CBD5E1' : BLUE }}
              title={missing.length ? `Colonnes obligatoires à associer : ${missing.map((id) => schema.fields.find((f) => f.id === id)?.label).join(', ')}` : undefined}>
              <CheckCircle2 size={13} /> Importer {table ? `${importable.length} ligne(s)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
