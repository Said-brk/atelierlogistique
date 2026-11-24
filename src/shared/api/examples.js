// Exemples d'appel de l'API, prêts à copier : PowerShell (Windows) et curl (Mac, Linux).
// Partagés par l'espace (page Clés d'API) et la documentation publique (/api).

export const API_BASE = 'https://atelierlogistique.com/api/v1';

const SAMPLE = `{
  "reference": "EXP-2026-0142",
  "label": "Tournée Rhône",
  "mode": "auto",
  "vehicle": "semi",
  "lines": [
    { "id": "L1", "reference": "PAL-EUR-001", "type": "pallet", "quantity": 6,
      "length": 120, "width": 80, "height": 150, "weight": 450, "stop": 1, "destination": "Lyon" },
    { "id": "L2", "reference": "CARTON-A", "quantity": 40,
      "length": 60, "width": 40, "height": 40, "weight": 12, "stop": 2, "destination": "Macon" }
  ]
}`;

/** Création d'un chargement, dans chaque langage. */
export function createExamples(key = 'al_live_VOTRE_CLE') {
  return [
    {
      id: 'powershell', label: 'PowerShell (Windows)',
      code: `$cle = "${key}"
$corps = @'
${SAMPLE}
'@
$r = Invoke-RestMethod -Method Post -Uri "${API_BASE}/shipments" \`
  -Headers @{ Authorization = "Bearer $cle" } \`
  -ContentType "application/json; charset=utf-8" \`
  -Body ([Text.Encoding]::UTF8.GetBytes($corps))
$r | Select-Object code, reference, status, summary, links | Format-List`,
    },
    {
      id: 'curl', label: 'curl (Mac, Linux)',
      code: `curl -X POST ${API_BASE}/shipments \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '${SAMPLE}'`,
    },
  ];
}
