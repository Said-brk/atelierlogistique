// /api : documentation publique de l'API v1 (chargements). Exemples prêts à copier, format des lignes,
// véhicules, flotte, plan renvoyé, erreurs. Spécification OpenAPI : /openapi.json.

import { useEffect, useState } from 'react';
import ExampleTabs from '../shared/api/ExampleTabs';
import { createExamples } from '../shared/api/examples';
import { Bell, Copy, Check, KeyRound, Send, Download, ListChecks, Ban, AlertTriangle, Truck, Boxes, FileJson } from 'lucide-react';

const BASE = 'https://atelierlogistique.com/api/v1';
const BLUE = '#0253FC';

function Code({ children, lang = '' }) {
  const [ok, setOk] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(children); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* indisponible */ } };
  return (
    <div className="relative group my-3">
      <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 pr-14 text-[12.5px] leading-relaxed overflow-x-auto font-jetbrains" data-lang={lang}>{children}</pre>
      <button onClick={copy} className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] text-slate-200">
        {ok ? <Check size={12} /> : <Copy size={12} />}{ok ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}
const Field = ({ name, type, children, req }) => (
  <tr className="align-top">
    <td className="py-2.5 pr-3 font-jetbrains text-[13px] text-slate-900 whitespace-nowrap">{name}{req && <span className="text-red-600"> *</span>}</td>
    <td className="py-2.5 pr-3 font-jetbrains text-[12px] text-slate-500 whitespace-nowrap">{type}</td>
    <td className="py-2.5 text-sm text-slate-700">{children}</td>
  </tr>
);
const Table = ({ children }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 my-3">
    <table className="w-full"><tbody className="divide-y divide-slate-100">{children}</tbody></table>
  </div>
);
const H2 = ({ id, icon: Icon, children }) => (
  <h2 id={id} className="scroll-mt-24 font-bricolage font-bold text-2xl text-slate-900 mt-12 mb-3 flex items-center gap-2.5">
    <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF', color: BLUE }}><Icon size={17} /></span>{children}
  </h2>
);
const Endpoint = ({ method, path }) => (
  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-jetbrains text-[13px] my-2">
    <span className={`font-bold ${method === 'GET' ? 'text-emerald-700' : 'text-blue-700'}`}>{method}</span><span className="text-slate-800">{path}</span>
  </div>
);

const EX_RESPONSE = `{
  "code": "PL-K4G86R",
  "reference": "EXP-2026-0142",
  "status": "in_progress",
  "version": 1,
  "summary": { "vehicles": 1, "vehicle": "Semi-remorque standard", "units_loaded": 46,
               "units_not_loaded": 0, "fill_rate_pct": 13.9, "weight_kg": 3180 },
  "links": {
    "app":  "https://atelierlogistique.com/app/chargements/PL-K4G86R",
    "dock": "https://atelierlogistique.com/q/3f9a1c…"
  },
  "plan": {
    "vehicles": [{
      "index": 1,
      "vehicle": { "id": "semi", "length": 13600, "width": 2450, "height": 2700, "max_weight_kg": 24000 },
      "fill_rate_pct": 13.9, "weight_kg": 3180, "dock_url": "https://atelierlogistique.com/q/3f9a1c…",
      "items": [
        { "sequence": 1, "line_id": "L2", "reference": "CARTON-A", "stop": 2, "destination": "Mâcon",
          "x": 0, "y": 0, "z": 0, "length": 600, "width": 400, "height": 400, "rotated": false, "weight_kg": 12 }
      ]
    }],
    "not_loaded": []
  }
}`;

const EX_FLEET = `{
  "reference": "EXP-2026-0150",
  "mode": "auto",
  "fleet": [
    { "vehicle": "fourgon20", "cost": 250 },
    { "vehicle": "porteur19", "cost": 480 },
    { "vehicle": { "label": "Caisse mobile", "length": 720, "width": 245, "height": 260, "max_weight": 8000 }, "cost": 420 }
  ],
  "lines": [ … ]
}`;

const EX_POLL = `# Plans validés par le planificateur depuis le dernier passage
curl "${BASE}/shipments?status=validated&updated_since=2026-11-24T08:00:00Z" \\
  -H "Authorization: Bearer al_live_VOTRE_CLE"

# Détail et plan d'un chargement (n° PL-… ou votre référence)
curl ${BASE}/shipments/EXP-2026-0142 -H "Authorization: Bearer al_live_VOTRE_CLE"`;

const EX_POLL_PS = `$h = @{ Authorization = "Bearer al_live_VOTRE_CLE" }
# Plans validés par le planificateur depuis le dernier passage
Invoke-RestMethod "${BASE}/shipments?status=validated&updated_since=2026-11-24T08:00:00Z" -Headers $h

# Détail et plan d'un chargement (n° PL-… ou votre référence)
Invoke-RestMethod "${BASE}/shipments/EXP-2026-0142" -Headers $h`;

const EX_WEBHOOK = `POST https://wms.mon-entreprise.fr/atelier-logistique
Content-Type: application/json
X-AL-Event: shipment.validated
X-AL-Delivery: 5b0c…
X-AL-Signature: t=1764000000,v1=9f3a…

{
  "id": "evt_5b0c…",
  "event": "shipment.validated",
  "created_at": "2026-11-24T14:02:11Z",
  "data": {
    "code": "PL-K4G86R", "reference": "EXP-2026-0142", "label": "Tournée Rhône",
    "status": "validated", "version": 4, "validated_at": "2026-11-24T14:02:11Z",
    "summary": { "vehicles": 1, "vehicle": "Semi-remorque standard", "units_loaded": 46,
                 "units_not_loaded": 0, "fill_rate_pct": 13.9, "weight_kg": 3180 },
    "links": {
      "app":  "https://atelierlogistique.com/app/chargements/PL-K4G86R",
      "api":  "https://atelierlogistique.com/api/v1/shipments/PL-K4G86R",
      "dock": "https://atelierlogistique.com/q/3f9a1c…"
    }
  }
}`;

const VERIFY = [
  { id: 'node', label: 'Node.js', code: `import { createHmac, timingSafeEqual } from 'node:crypto';

// corps = texte brut reçu (avant JSON.parse) ; secret = secret du webhook (espace → Clés d'API)
function signatureValide(corps, entete, secret) {
  const [, t, v1] = entete.match(/^t=(\\d+),v1=([0-9a-f]{64})$/) ?? [];
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5 min max
  const attendu = createHmac('sha256', secret).update(\`\${t}.\${corps}\`).digest('hex');
  return timingSafeEqual(Buffer.from(attendu), Buffer.from(v1));
}` },
  { id: 'python', label: 'Python', code: `import hmac, hashlib, re, time

def signature_valide(corps: bytes, entete: str, secret: str) -> bool:
    m = re.fullmatch(r"t=(\\d+),v1=([0-9a-f]{64})", entete or "")
    if not m or abs(time.time() - int(m[1])) > 300:
        return False
    attendu = hmac.new(secret.encode(), m[1].encode() + b"." + corps, hashlib.sha256).hexdigest()
    return hmac.compare_digest(attendu, m[2])` },
  { id: 'csharp', label: 'C# (.NET)', code: `using System.Security.Cryptography; using System.Text; using System.Text.RegularExpressions;

static bool SignatureValide(string corps, string entete, string secret) {
    var m = Regex.Match(entete ?? "", @"^t=(\\d+),v1=([0-9a-f]{64})$");
    if (!m.Success || Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - long.Parse(m.Groups[1].Value)) > 300) return false;
    using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var attendu = Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(m.Groups[1].Value + "." + corps))).ToLowerInvariant();
    return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(attendu), Encoding.UTF8.GetBytes(m.Groups[2].Value));
}` },
];

const EX_ERROR = `HTTP 422
{
  "error": {
    "code": "invalid_request",
    "message": "Chargement invalide : voir details.",
    "details": [
      { "path": "lines[3].height", "message": "Obligatoire, > 0 (cm)." },
      { "path": "vehicle", "message": "Véhicule inconnu « navette »…" }
    ]
  }
}`;

const TOC = [
  ['demarrer', 'Démarrer'], ['creer', 'Envoyer un chargement'], ['lignes', 'Lignes'], ['vehicules', 'Véhicules et flotte'],
  ['reponse', 'Plan renvoyé'], ['lire', 'Lire et suivre'], ['notifications', 'Notifications'], ['annuler', 'Annuler'], ['erreurs', 'Erreurs'], ['bonnes', 'Bonnes pratiques'],
];

export default function ApiDocsPage() {
  useEffect(() => {
    document.title = 'API plan de chargement et palettisation | Atelier Logistique';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'API REST pour connecter un WMS ou un ERP : envoyez vos colis et palettes, recevez le plan de chargement 3D, la flotte de véhicules et le lien cariste.');
  }, []);
  return (
    <div className="bg-slate-50">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
        <nav className="hidden lg:block sticky top-24 self-start text-sm space-y-1.5">
          <div className="font-jetbrains text-[11px] tracking-wider text-slate-400 mb-2">API v1</div>
          {TOC.map(([id, l]) => <a key={id} href={`#${id}`} className="block text-slate-600 hover:text-blue-700">{l}</a>)}
          <a href="/openapi.json" className="flex items-center gap-1.5 pt-3 text-blue-700"><FileJson size={14} /> openapi.json</a>
        </nav>

        <main className="min-w-0">
          <div className="font-jetbrains text-xs tracking-wider" style={{ color: BLUE }}>API · VERSION 1</div>
          <h1 className="font-bricolage font-bold text-3xl sm:text-4xl text-slate-900 mt-2">Connectez votre WMS ou votre ERP</h1>
          <p className="text-lg text-slate-600 mt-3 max-w-3xl">Votre système envoie les colis et palettes d’une expédition ; Atelier Logistique renvoie le plan de chargement 3D (position de chaque colis, ordre de chargement), la flotte de véhicules si besoin, et le lien du guide pas à pas pour le cariste.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1">REST · JSON</span>
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1">Clé d’API par entreprise</span>
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1">Même moteur que l’outil en ligne</span>
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1">Gratuit pendant la phase pilote</span>
          </div>

          <H2 id="demarrer" icon={KeyRound}>Démarrer</H2>
          <ol className="list-decimal pl-5 space-y-1.5 text-slate-700">
            <li>Créez un compte gratuit, puis votre entreprise.</li>
            <li>Dans votre espace : <b>Clés d’API → Créer la clé</b>. Elle n’est affichée qu’une fois : rangez-la dans le coffre de votre WMS / ERP.</li>
            <li>Envoyez-la dans chaque appel : <code className="font-jetbrains text-[13px] bg-white border border-slate-200 rounded px-1.5">Authorization: Bearer al_live_…</code></li>
          </ol>
          <p className="text-slate-700 mt-3">Adresse de base : <code className="font-jetbrains text-[13px] bg-white border border-slate-200 rounded px-1.5">{BASE}</code> · Test : <a className="text-blue-700 underline" href={`${BASE}/health`}>GET /health</a></p>
          <a href="/connexion?mode=inscription" className="inline-flex mt-4 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}><KeyRound size={15} /> Obtenir une clé</a>

          <H2 id="creer" icon={Send}>Envoyer un chargement</H2>
          <Endpoint method="POST" path="/shipments" />
          <p className="text-slate-700">Crée le chargement, ou le met à jour s’il existe déjà avec la même <code className="font-jetbrains text-[13px]">reference</code> (renvoyer la même expédition ne crée pas de doublon). Réponse <b>201</b> (créé) ou <b>200</b> (mis à jour).</p>
          <ExampleTabs examples={createExamples()} />
          <Table>
            <Field name="reference" type="texte" req>Votre référence (n° d’expédition, de commande…) : clé unique dans votre entreprise.</Field>
            <Field name="mode" type="draft | auto"><b>draft</b> (défaut) : le chargement arrive en « Nouveau » dans l’espace, le planificateur vérifie et valide. <b>auto</b> : le plan est calculé tout de suite et renvoyé.</Field>
            <Field name="validate" type="booléen">Avec <code>auto</code> : valider directement le plan (sinon « En cours », à valider dans l’espace).</Field>
            <Field name="vehicle" type="id | objet">Véhicule unique (défaut <code>semi</code>). Voir <a href="#vehicules" className="text-blue-700 underline">Véhicules</a>.</Field>
            <Field name="fleet" type="liste">À la place de <code>vehicle</code> : véhicules disponibles et coût par voyage ; l’outil choisit la combinaison la moins chère.</Field>
            <Field name="delivery" type="strict | soft"><b>strict</b> (défaut) : chaque arrêt accessible sans déplacer les colis des arrêts suivants. <b>soft</b> : charge au maximum, signale les colis à manipuler.</Field>
            <Field name="units" type="cm | mm | m">Unité des dimensions (défaut <b>cm</b>). Poids toujours en <b>kg</b>.</Field>
            <Field name="label" type="texte">Libellé affiché dans l’espace.</Field>
            <Field name="departure_date" type="date ISO">Date de départ.</Field>
            <Field name="tour" type="texte">Code de la tournée (Paramètres › Tables de référence › Tournées).</Field>
            <Field name="carrier / carrier_cost" type="texte / nombre">En sortie : transporteur choisi et coût théorique (€) d’après sa grille.</Field>
            <Field name="lines" type="liste" req>Colis et palettes (2 000 lignes, 5 000 unités au maximum).</Field>
          </Table>

          <H2 id="lignes" icon={Boxes}>Lignes</H2>
          <Table>
            <Field name="reference" type="texte" req>Article, SSCC, n° de palette…</Field>
            <Field name="id" type="texte">Votre identifiant de ligne : renvoyé dans le plan (<code>line_id</code>) pour relier chaque position à votre ligne.</Field>
            <Field name="type" type="case | pallet | unit"><b>case</b> (défaut) : colis. <b>pallet</b> / <b>unit</b> : palette ou unité de manutention (par défaut : au sol, rotation horizontale).</Field>
            <Field name="quantity" type="entier">Défaut 1.</Field>
            <Field name="length, width, height" type="nombre" req>Dimensions d’une unité, dans l’unité choisie.</Field>
            <Field name="weight" type="kg">Poids d’une unité.</Field>
            <Field name="rotation" type="free | horizontal | none"><b>free</b> : toutes orientations. <b>horizontal</b> : reste debout, peut tourner sur le plancher. <b>none</b> : orientation imposée.</Field>
            <Field name="stacking" type="free | top_only | floor | floor_no_top"><b>free</b> : peut être posé sur un colis et en recevoir. <b>top_only</b> : rien dessus (fragile). <b>floor</b> : au sol. <b>floor_no_top</b> : au sol, rien dessus.</Field>
            <Field name="stop" type="1 à 99">Ordre de livraison : 1 = livré en premier (chargé côté portes).</Field>
            <Field name="destination" type="texte">Client, ville… (affiché sur le plan et le guide cariste).</Field>
          </Table>

          <H2 id="vehicules" icon={Truck}>Véhicules et flotte</H2>
          <p className="text-slate-700">Identifiants connus (dimensions intérieures, charge utile) :</p>
          <div className="grid sm:grid-cols-2 gap-x-6 text-sm text-slate-700 my-3 font-jetbrains">
            {[['semi', 'Semi-remorque 13,6 m · 24 t'], ['porteur19', 'Porteur 19 t · 7,3 m'], ['porteur12', 'Porteur 12 t · 6,2 m'], ['fourgon20', 'Fourgon 20 m³ · 1,1 t'], ['20ft', 'Conteneur 20 pieds'], ['40ft', 'Conteneur 40 pieds'], ['40hc', 'Conteneur 40 pieds High Cube']].map(([id, l]) => (
              <div key={id} className="py-1.5 border-b border-slate-200"><b className="text-slate-900">{id}</b> <span className="text-slate-500 font-sans">{l}</span></div>
            ))}
          </div>
          <p className="text-slate-700">Ou sur mesure : <code className="font-jetbrains text-[13px]">{'{ "label", "length", "width", "height", "max_weight" }'}</code> (dimensions intérieures dans l’unité choisie, charge en kg). Flotte :</p>
          <Code lang="json">{EX_FLEET}</Code>
          <p className="text-sm text-slate-500">Chaque véhicule livre ses arrêts dans l’ordre de la tournée ; un arrêt trop gros est partagé entre plusieurs véhicules.</p>

          <H2 id="reponse" icon={Download}>Plan renvoyé</H2>
          <Code lang="json">{EX_RESPONSE}</Code>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>Positions en <b>mm</b> : <b>x</b> depuis le fond (cabine) vers les portes, <b>y</b> depuis la paroi de droite (vue depuis les portes, face à la cabine), <b>z</b> depuis le plancher ; dimensions après rotation.</li>
            <li><b>sequence</b> : ordre de chargement (1 = premier colis chargé, au fond).</li>
            <li><b>links.dock</b> / <b>dock_url</b> : guide pas à pas pour le cariste, sans compte (à imprimer en QR code ou à envoyer). Toujours la dernière version enregistrée.</li>
            <li><b>plan</b> est <code>null</code> tant que le plan n’est pas calculé (mode <code>draft</code>, avant le passage du planificateur).</li>
            <li>Flotte : un élément par véhicule dans <b>vehicles</b>, avec son coût et ses arrêts ; <b>total_cost</b>.</li>
          </ul>

          <H2 id="lire" icon={ListChecks}>Lire et suivre</H2>
          <Endpoint method="GET" path="/shipments/{ref}" /> <Endpoint method="GET" path="/shipments?status=…&updated_since=…&limit=50" />
          <p className="text-slate-700"><code>ref</code> = n° <code>PL-…</code> ou votre référence. Statuts : <code>new</code>, <code>in_progress</code>, <code>validated</code>, <code>sent</code> (envoyé au quai), <code>partially_loaded</code> (flotte : une partie des camions confirmés), <code>loaded</code> (chargé, confirmé par le cariste, <code>loaded_at</code>), <code>cancelled</code>. Pour récupérer les plans validés : <a href="#notifications" className="text-blue-700 underline">notifications automatiques</a> (recommandé), ou interrogez la liste régulièrement (toutes les 1 à 5 minutes) avec <code>updated_since</code>.</p>
          <ExampleTabs examples={[
            { id: 'powershell', label: 'PowerShell (Windows)', code: EX_POLL_PS },
            { id: 'curl', label: 'curl (Mac, Linux)', code: EX_POLL },
          ]} />

          <H2 id="notifications" icon={Bell}>Notifications automatiques (webhooks)</H2>
          <p className="text-slate-700">Plutôt que d’interroger l’API, déclarez l’adresse de votre WMS / ERP dans votre espace (<b>Clés d’API → Notifications automatiques</b>) : elle reçoit un <code>POST</code> JSON dès qu’un chargement change de statut.</p>
          <Table>
            <Field name="shipment.validated" type="">Le planificateur a validé le plan : récupérez-le avec <code>links.api</code>.</Field>
            <Field name="shipment.sent" type="">Envoyé au quai (QR code cariste).</Field>
            <Field name="shipment.partially_loaded" type="">Flotte : un premier camion est confirmé chargé (les autres pas encore).</Field>
            <Field name="shipment.loaded" type="">Le cariste a confirmé la fin du chargement (photos de preuve dans l’espace). Flotte : quand tous les camions sont confirmés.</Field>
            <Field name="shipment.cancelled" type="">Annulé.</Field>
            <Field name="shipment.reopened" type="">Rouvert après validation : le plan va changer.</Field>
            <Field name="ping" type="">Test envoyé depuis l’espace.</Field>
          </Table>
          <Code lang="http">{EX_WEBHOOK}</Code>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>Répondez <b>2xx en moins de 10 secondes</b> (traitez ensuite, en arrière-plan). Sinon : nouvel essai après 1 min, 5 min, 30 min, 2 h et 6 h.</li>
            <li>Un même évènement peut arriver deux fois : dédoublonnez avec <code>id</code> (ou l’en-tête <code>X-AL-Delivery</code>).</li>
            <li>Le plan détaillé n’est pas dans la notification : appelez <code>links.api</code> avec votre clé.</li>
            <li><b>Vérifiez la signature</b> : <code>X-AL-Signature: t=&lt;horodatage&gt;,v1=&lt;HMAC-SHA256(secret, "horodatage.corps")&gt;</code>, calculée sur le corps brut reçu.</li>
          </ul>
          <ExampleTabs examples={VERIFY} />

          <H2 id="annuler" icon={Ban}>Annuler</H2>
          <Endpoint method="POST" path="/shipments/{ref}/cancel" />
          <p className="text-slate-700">Le chargement passe en <code>cancelled</code> ; son lien cariste ne s’ouvre plus.</p>

          <H2 id="erreurs" icon={AlertTriangle}>Erreurs</H2>
          <Code lang="json">{EX_ERROR}</Code>
          <Table>
            <Field name="401 unauthorized" type="">Clé absente, invalide ou révoquée.</Field>
            <Field name="404 not_found" type="">Chargement ou route inconnus.</Field>
            <Field name="409 already_validated" type="">Le chargement est déjà validé, envoyé au quai ou chargé : il ne peut plus être remplacé par l’API (rouvrez-le dans l’espace, ou envoyez une nouvelle référence).</Field>
            <Field name="422 invalid_request" type="">Données invalides : <b>toutes</b> les erreurs sont listées dans <code>details</code>, avec le chemin du champ.</Field>
            <Field name="500 server_error" type="">Erreur interne : réessayez, puis écrivez-nous si elle persiste.</Field>
          </Table>

          <H2 id="bonnes" icon={Check}>Bonnes pratiques</H2>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>Une clé par système connecté (WMS, ERP, test) : vous pouvez en révoquer une sans couper les autres.</li>
            <li>Gardez la clé côté serveur, jamais dans une page web ou une application mobile.</li>
            <li>Renvoyer une expédition modifiée avec la même <code>reference</code> la met à jour (tant qu’elle n’est pas validée).</li>
            <li>Commencez en <code>draft</code> : le planificateur contrôle les premiers plans dans l’espace, puis passez en <code>auto</code>.</li>
          </ul>
          <p className="text-slate-700 mt-6">Une question, un format de fichier à brancher (CSV, XML, export Reflex…) ? <a className="text-blue-700 underline" href="mailto:contact@atelierlogistique.com">contact@atelierlogistique.com</a></p>
        </main>
      </div>
    </div>
  );
}
