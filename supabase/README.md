# Base de données Supabase — Atelier Logistique

Fonctions **en plus** du site : comptes, « Mes chargements », API. Les outils publics
(palettisation, chargement) n'utilisent pas cette base et restent sans compte.

## Contenu

| Table | Rôle |
|---|---|
| `organizations` | entreprises clientes (durée de conservation des chargements, 90 j par défaut) |
| `organization_members` | utilisateurs de chaque entreprise : `owner`, `admin`, `member` |
| `shipments` | chargements reçus (API, fichier, site) : données, plan, statut, version, n° `PL-XXXXXX`, lien de partage |
| `shipment_versions` | historique : une ligne à chaque changement de plan ou de statut |
| `api_keys` | clés d'API (empreinte SHA-256 seulement, jamais la clé en clair) |
| `usage_events` | consommation de l'API (appels, durée, nombre d'unités) |
| `palletizations` | palettisations (n° `PZ-XXXXXX`), reliées au chargement qu'elles alimentent |
| `webhooks`, `webhook_deliveries` | notifications automatiques (adresse, secret de signature, évènements) et historique des envois (30 jours) |
| `shipment_loadings` | fins de chargement confirmées par le cariste (camion, nom, photos) ; photos dans le stockage privé `preuves` |
| `invitations` | invitations d'un collègue par adresse e-mail (14 jours), acceptées à l'entrée de l'espace |

Statuts d'un chargement : `new` → `in_progress` → `validated` → `sent` (envoyé au quai), `partially_loaded` (flotte : une partie des camions confirmés), `loaded` (chargé, confirmé par le cariste) ; au quai (envoyé, en partie, chargé), contenu figé par la base jusqu'à réouverture · `cancelled`.

Fonctions : `create_organization(nom)`, `create_api_key(org, nom)` (renvoie la clé en clair **une seule fois**),
`shipment_by_token(jeton)` (plan ouvert par lien, sans compte), `purge_expired_shipments()`,
`invite_member(org, e-mail, rôle)`, `my_invitations()`, `accept_invitation(id)`, `decline_invitation(id)`, `org_members(org)`.
Un membre n'entre dans une entreprise qu'en la créant ou en acceptant une invitation ; le propriétaire ne peut être ni retiré ni rétrogradé.

Sécurité : RLS sur toutes les tables ; un utilisateur ne voit que les données des entreprises dont il est membre.
Les clés d'API et la consommation ne sont visibles que des administrateurs / membres de l'entreprise.

## Installer ou mettre à jour

1. Supabase → **SQL Editor** → *New query*.
2. Coller le contenu de chaque fichier de `migrations/`, dans l'ordre, puis **Run**.
   Les scripts sont ré-exécutables sans danger.

## Purge automatique (une fois)

1. Supabase → **Database → Extensions** → activer `pg_cron`.
2. SQL Editor :

```sql
select cron.schedule('purge-chargements-expires', '17 3 * * *', $$select public.purge_expired_shipments()$$);
```

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Nom | Valeur | Visible par |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<projet>.supabase.co` | site |
| `VITE_SUPABASE_ANON_KEY` | clé publique `sb_publishable_…` | site |
| `SUPABASE_SERVICE_ROLE_KEY` | clé secrète `sb_secret_…` | API seulement — **jamais** dans le code ni dans un message |

## Tests

`npm test` rejoue les migrations dans un Postgres en mémoire (PGlite) et vérifie l'isolation entre
entreprises, les versions, le lien de partage, les clés d'API et la purge (`supabase/tests/schema.test.js`).

## E-mails de connexion en français (Authentication → Email Templates)

Modèles **Magic Link** et **Confirm signup** (même contenu) :

- Sujet : `Votre lien de connexion — Atelier Logistique`
- Corps :

```html
<h2>Connexion à Atelier Logistique</h2>
<p>Cliquez sur le bouton ci-dessous pour vous connecter. Le lien est valable une heure et ne sert qu'une fois.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Me connecter</a></p>
<p style="color:#64748B;font-size:13px">Vous n'avez pas demandé ce lien ? Ignorez simplement cet e-mail.</p>
<p style="color:#64748B;font-size:13px">Atelier Logistique — atelierlogistique.com</p>
```

## Notifications automatiques (webhooks)

1. Database → Extensions : activer `pg_net` (et `pg_cron`, déjà utilisé pour la purge).
2. SQL Editor : exécuter `migrations/20261124000005_webhooks.sql` (il planifie aussi `webhooks-relances`, chaque minute, pour les nouvelles tentatives).
