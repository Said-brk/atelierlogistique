// Génère les modèles d'e-mails Supabase Auth (HTML compatible Outlook / Gmail / Apple Mail).
// node supabase/email-templates/build.mjs  →  un fichier .html par modèle + SUJETS.md
// Une seule mise en page (layout) ; chaque modèle ne décrit que son contenu.
// Variables Supabase : {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}, {{ .NewEmail }}, {{ .OldEmail }}, {{ .SiteURL }}.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://atelierlogistique.com';
const C = { blue: '#0253FC', navy: '#162636', ink: '#0F172A', text: '#334155', muted: '#64748B', line: '#E2E8F0', bg: '#F1F5F9', amber: '#F59E0B', soft: '#EFF6FF' };
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

const p = (html, extra = '') => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};${extra}">${html}</p>`;

/** Bouton « à l'épreuve des balles » (Outlook compris, via VML). */
const button = (href, label) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px">
  <tr><td align="center" bgcolor="${C.blue}" style="border-radius:10px">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:300px" arcsize="20%" stroke="f" fillcolor="${C.blue}"><w:anchorlock/><center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:16px;font-weight:bold">${label}</center></v:roundrect><![endif]-->
    <!--[if !mso]><!--><a href="${href}" target="_blank" style="display:inline-block;padding:16px 32px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${C.blue}">${label}&nbsp;&rarr;</a><!--<![endif]-->
  </td></tr>
</table>`;

/** Lien de secours, si le bouton ne s'affiche pas. */
const fallback = (href) => `
<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted}">Le bouton ne fonctionne pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:</p>
<p style="margin:0 0 24px;font-family:${MONO};font-size:12px;line-height:1.5;word-break:break-all"><a href="${href}" style="color:${C.blue};text-decoration:underline">${href}</a></p>`;

/** Encadré d'information (bleu) ou d'alerte (ambre). */
const note = (html, tone = 'info') => {
  const [bg, bar, fg] = tone === 'warn' ? ['#FFFBEB', C.amber, '#92400E'] : [C.soft, C.blue, '#1E3A8A'];
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
  <tr><td style="background:${bg};border-left:4px solid ${bar};border-radius:8px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:1.55;color:${fg}">${html}</td></tr>
</table>`;
};

/** Code à 6 chiffres, bien lisible. */
const code = (v) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px">
  <tr><td style="background:${C.bg};border:1px solid ${C.line};border-radius:12px;padding:16px 28px;font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:8px;color:${C.ink}">${v}</td></tr>
</table>`;

/** Étapes numérotées (parcours après le clic). */
const steps = (items) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
  ${items.map((t, i) => `<tr>
    <td width="36" valign="top" style="padding:0 0 10px"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${C.soft};color:${C.blue};font-family:${FONT};font-size:13px;font-weight:700;text-align:center">${i + 1}</div></td>
    <td valign="top" style="padding:3px 0 10px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.text}">${t}</td>
  </tr>`).join('')}
</table>`;

/** Mise en page commune : en-tête bleu nuit + logo, carte blanche, pied de page. */
function layout({ preheader, eyebrow, title, body, reason }) {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${title}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse}
  img{border:0;outline:none;text-decoration:none;display:block}
  a{color:${C.blue}}
  @media (max-width:620px){
    .card{border-radius:0!important}
    .pad{padding:28px 22px!important}
    .h1{font-size:24px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:1px;line-height:1px">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.bg}">
  <tr><td align="center" style="padding:32px 12px">
    <table role="presentation" class="card" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${C.line}">
      <!-- En-tête -->
      <tr><td bgcolor="${C.navy}" style="background:${C.navy};padding:26px 36px">
        <a href="${SITE}" target="_blank" style="text-decoration:none">
          <img src="${SITE}/email/logo-blanc.png" width="268" height="44" alt="ATELIER LOGISTIQUE" style="width:268px;height:44px;color:#ffffff;font-family:${FONT};font-size:20px;font-weight:700">
        </a>
      </td></tr>
      <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${C.blue}">&nbsp;</td></tr>
      <!-- Contenu -->
      <tr><td class="pad" style="padding:40px 44px 16px">
        <p style="margin:0 0 10px;font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.blue}">${eyebrow}</p>
        <h1 class="h1" style="margin:0 0 20px;font-family:${FONT};font-size:28px;line-height:1.25;font-weight:800;color:${C.ink}">${title}</h1>
        ${body}
      </td></tr>
      <!-- Signature -->
      <tr><td class="pad" style="padding:0 44px 36px">
        <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text}">À très vite,<br><strong style="color:${C.ink}">L’équipe Atelier Logistique</strong></p>
      </td></tr>
      <!-- Pied de page -->
      <tr><td style="background:#F8FAFC;border-top:1px solid ${C.line};padding:22px 44px">
        <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">${reason}</p>
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">
          <a href="${SITE}" style="color:${C.muted};text-decoration:underline">atelierlogistique.com</a> &middot;
          Une question&nbsp;? <a href="mailto:contact@atelierlogistique.com" style="color:${C.muted};text-decoration:underline">contact@atelierlogistique.com</a>
        </p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font-family:${MONO};font-size:11px;letter-spacing:1px;color:#94A3B8">CHARGEMENT 3D &middot; PALETTISATION &middot; QR CODE CARISTE</p>
  </td></tr>
</table>
</body>
</html>
`;
}

const URL = '{{ .ConfirmationURL }}';
const notMe = 'Vous n’êtes pas à l’origine de cette demande&nbsp;? Ignorez simplement cet e-mail&nbsp;: rien ne sera modifié.';

/** Les modèles, dans l'ordre de Supabase (Authentication → Emails). */
const TEMPLATES = [
  {
    file: '1-confirmation-inscription.html', supabase: 'Confirm sign up',
    subject: 'Bienvenue ! Confirmez votre adresse pour créer votre compte',
    preheader: 'Un clic pour confirmer votre adresse et choisir votre mot de passe.',
    eyebrow: 'Création de compte', title: 'Bienvenue sur Atelier Logistique',
    body: p('Merci de votre inscription&nbsp;! Confirmez votre adresse <strong style="color:#0F172A">{{ .Email }}</strong> pour activer votre espace.')
      + button(URL, 'Confirmer mon adresse')
      + steps(['Vous choisissez votre mot de passe.', 'Vous vous connectez avec votre e-mail et ce mot de passe.', 'Vos chargements, palettisations et QR codes cariste sont enregistrés dans votre espace.'])
      + note('Ce lien est valable <strong>1&nbsp;heure</strong> et ne sert qu’une fois. Ouvrez-le <strong>sur l’appareil et dans le navigateur</strong> où vous avez demandé l’inscription.')
      + fallback(URL),
    reason: `Vous recevez cet e-mail car un compte a été demandé avec cette adresse sur atelierlogistique.com. ${notMe}`,
  },
  {
    file: '2-invitation.html', supabase: 'Invite user',
    subject: 'Vous êtes invité sur Atelier Logistique',
    preheader: 'Votre équipe vous attend : acceptez l’invitation en un clic.',
    eyebrow: 'Invitation', title: 'Votre équipe vous attend',
    body: p('Vous avez été invité à rejoindre un espace <strong style="color:#0F172A">Atelier Logistique</strong>&nbsp;: plans de chargement 3D, palettisation et guide pas à pas pour les caristes, partagés avec vos collègues.')
      + button(URL, 'Accepter l’invitation')
      + note('Ce lien est valable <strong>1&nbsp;heure</strong>. Vous choisirez ensuite votre mot de passe.')
      + fallback(URL),
    reason: `Vous recevez cet e-mail car un administrateur vous a invité avec l’adresse {{ .Email }}. ${notMe}`,
  },
  {
    file: '3-lien-connexion.html', supabase: 'Magic link',
    subject: 'Votre lien pour choisir votre mot de passe',
    preheader: 'Connectez-vous et choisissez votre (nouveau) mot de passe.',
    eyebrow: 'Mot de passe', title: 'Choisissez votre mot de passe',
    body: p('Vous avez demandé à créer ou à retrouver l’accès à votre compte <strong style="color:#0F172A">{{ .Email }}</strong>. Cliquez sur le bouton&nbsp;: vous arrivez directement sur la page pour choisir votre mot de passe.')
      + button(URL, 'Choisir mon mot de passe')
      + note('Ce lien est valable <strong>1&nbsp;heure</strong> et ne sert qu’une fois. Ouvrez-le <strong>sur l’appareil et dans le navigateur</strong> où vous l’avez demandé.')
      + fallback(URL),
    reason: `Vous recevez cet e-mail car une demande d’accès a été faite avec cette adresse sur atelierlogistique.com. ${notMe}`,
  },
  {
    file: '4-changement-adresse.html', supabase: 'Change email address',
    subject: 'Confirmez votre nouvelle adresse e-mail',
    preheader: 'Validez le changement d’adresse de votre compte Atelier Logistique.',
    eyebrow: 'Sécurité du compte', title: 'Confirmez votre nouvelle adresse',
    body: p('Vous avez demandé à changer l’adresse e-mail de votre compte&nbsp;:')
      + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;border:1px solid ${C.line};border-radius:10px">
          <tr><td style="padding:12px 16px;font-family:${FONT};font-size:14px;color:${C.muted};border-bottom:1px solid ${C.line}">Ancienne&nbsp;: <span style="color:${C.ink};text-decoration:line-through">{{ .Email }}</span></td></tr>
          <tr><td style="padding:12px 16px;font-family:${FONT};font-size:14px;color:${C.muted}">Nouvelle&nbsp;: <strong style="color:${C.ink}">{{ .NewEmail }}</strong></td></tr>
        </table>`
      + button(URL, 'Confirmer la nouvelle adresse')
      + note('Si vous n’avez pas demandé ce changement, ne cliquez pas et écrivez-nous à <a href="mailto:contact@atelierlogistique.com" style="color:#92400E">contact@atelierlogistique.com</a>.', 'warn')
      + fallback(URL),
    reason: 'Vous recevez cet e-mail car un changement d’adresse a été demandé pour votre compte Atelier Logistique.',
  },
  {
    file: '5-reinitialisation-mot-de-passe.html', supabase: 'Reset password',
    subject: 'Réinitialisez votre mot de passe',
    preheader: 'Choisissez un nouveau mot de passe pour votre compte Atelier Logistique.',
    eyebrow: 'Mot de passe', title: 'Nouveau mot de passe',
    body: p('Vous avez demandé à réinitialiser le mot de passe du compte <strong style="color:#0F172A">{{ .Email }}</strong>.')
      + button(URL, 'Choisir un nouveau mot de passe')
      + note('Ce lien est valable <strong>1&nbsp;heure</strong> et ne sert qu’une fois.')
      + fallback(URL),
    reason: `Vous recevez cet e-mail car une réinitialisation de mot de passe a été demandée. ${notMe}`,
  },
  {
    file: '6-code-verification.html', supabase: 'Reauthentication',
    subject: 'Votre code de vérification : {{ .Token }}',
    preheader: 'Votre code de vérification Atelier Logistique.',
    eyebrow: 'Vérification', title: 'Votre code de vérification',
    body: p('Saisissez ce code pour confirmer qu’il s’agit bien de vous&nbsp;:')
      + code('{{ .Token }}')
      + note('Ce code expire rapidement. Ne le communiquez à personne&nbsp;: notre équipe ne vous le demandera jamais.', 'warn'),
    reason: `Vous recevez cet e-mail car une action sensible a été demandée sur votre compte. ${notMe}`,
  },
  {
    file: '7-alerte-mot-de-passe-modifie.html', supabase: 'Password changed (notification de sécurité)',
    subject: 'Votre mot de passe a été modifié',
    preheader: 'Le mot de passe de votre compte Atelier Logistique vient d’être modifié.',
    eyebrow: 'Alerte de sécurité', title: 'Mot de passe modifié',
    body: p('Le mot de passe du compte <strong style="color:#0F172A">{{ .Email }}</strong> vient d’être modifié.')
      + p('Si c’est bien vous, il n’y a rien à faire.')
      + note('Ce n’est pas vous&nbsp;? Choisissez tout de suite un nouveau mot de passe via « Mot de passe oublié&nbsp;? » sur la page de connexion, puis prévenez-nous à <a href="mailto:contact@atelierlogistique.com" style="color:#92400E">contact@atelierlogistique.com</a>.', 'warn')
      + button(`${SITE}/connexion`, 'Aller à la connexion'),
    reason: 'Vous recevez cet e-mail de sécurité car le mot de passe de votre compte a été modifié.',
  },
  {
    file: '8-alerte-adresse-modifiee.html', supabase: 'Email address changed (notification de sécurité)',
    subject: 'L’adresse e-mail de votre compte a été modifiée',
    preheader: 'L’adresse de connexion de votre compte Atelier Logistique a changé.',
    eyebrow: 'Alerte de sécurité', title: 'Adresse e-mail modifiée',
    body: p('L’adresse de connexion de votre compte est passée de <strong style="color:#0F172A">{{ .OldEmail }}</strong> à <strong style="color:#0F172A">{{ .Email }}</strong>.')
      + note('Ce n’est pas vous&nbsp;? Écrivez-nous immédiatement à <a href="mailto:contact@atelierlogistique.com" style="color:#92400E">contact@atelierlogistique.com</a>.', 'warn'),
    reason: 'Vous recevez cet e-mail de sécurité car l’adresse de votre compte a été modifiée.',
  },
];

const readme = ['# Modèles d’e-mails Supabase (Authentication → Emails)', '',
  'Pour chaque modèle : copier le **Sujet**, puis tout le contenu du fichier HTML dans **Message body** (onglet Source).', '',
  '| Modèle Supabase | Sujet | Fichier |', '|---|---|---|',
  ...TEMPLATES.map((t) => `| ${t.supabase} | ${t.subject} | \`${t.file}\` |`), '',
  'Régénérer : `node supabase/email-templates/build.mjs` (logo : `public/email/logo-blanc.png`, servi par le site).', ''];

for (const t of TEMPLATES) writeFileSync(join(OUT, t.file), layout(t));
writeFileSync(join(OUT, 'SUJETS.md'), readme.join('\n'));
console.log(`${TEMPLATES.length} modèles écrits dans ${OUT}`);
