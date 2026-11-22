// Bannière Audit Flash (page d'accueil), placée avant les guides.
import { ArrowRight } from 'lucide-react';

export default function AuditBanner({ onLaunch }) {
  return (
  <section className="border-t border-slate-200" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #78350F 100%)' }}>
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
        <div className="lg:col-span-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-jetbrains tracking-widest mb-5" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            ★ NOUVEAU · AUDIT GRATUIT
          </div>
          <h2 className="font-bricolage font-bold text-3xl md:text-4xl lg:text-5xl text-white leading-tight mb-4">
            Auditez votre supply chain<br />
            <span style={{ color: '#F59E0B' }}>en 30 secondes.</span>
          </h2>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
            Importez votre historique de ventes 12 mois et votre stock actuel.
            L'outil sort automatiquement votre classification ABC × XYZ, votre stock dormant chiffré en valeur,
            vos couvertures critiques, et les chantiers prioritaires à traiter par votre approvisionneur.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-7">
            <button
              onClick={() => onLaunch('audit')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-jetbrains text-sm font-semibold shadow-xl transition-all hover:translate-y-[-2px] hover:shadow-2xl"
              style={{ background: '#F59E0B', color: '#0F172A' }}
            >
              DÉMARRER MON AUDIT GRATUIT
              <ArrowRight size={15} />
            </button>
            <div className="text-xs text-slate-400 font-jetbrains">Aucun compte requis · données traitées en local</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-700">
            {[
              { v: 'ABC × XYZ', l: 'classification automatique' },
              { v: 'Multi-magasin', l: 'détection déséquilibres' },
              { v: 'Dormants €', l: 'chiffré en valeur' },
              { v: '8 KPIs', l: 'analysés en 30 sec' },
            ].map((s, i) => (
              <div key={i}>
                <div className="font-bricolage font-bold text-base" style={{ color: '#F59E0B' }}>{s.v}</div>
                <div className="font-jetbrains text-[10px] text-slate-400 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl p-6 backdrop-blur" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div className="font-jetbrains text-[10px] tracking-widest mb-4" style={{ color: '#F59E0B' }}>EXEMPLE DE DIAGNOSTIC</div>
            <div className="space-y-3">
              {[
                { icon: '◉', text: '47 % du stock dormant (1.2 M MAD immobilisés)', color: '#DC2626' },
                { icon: '◉', text: '12 articles en risque de rupture sous 14 jours', color: '#D97706' },
                { icon: '◉', text: '23 articles déséquilibrés inter-magasins', color: '#D97706' },
                { icon: '◉', text: '8 articles "AZ" — stratégie stock à revoir', color: '#2563EB' },
                { icon: '✓', text: 'Top 5 chantiers chiffrés prioritaires', color: '#10B981' },
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span style={{ color: line.color }} className="text-base leading-none mt-0.5">{line.icon}</span>
                  <span className="text-sm text-slate-200 leading-relaxed">{line.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-700 text-[10px] text-slate-400 font-jetbrains leading-relaxed">
              Le diagnostic se base sur 2 fichiers Excel (ventes 12 mois + stock actuel). Templates fournis pour démarrer.
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  );
}
