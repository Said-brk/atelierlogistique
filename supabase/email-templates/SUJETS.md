# Modèles d’e-mails Supabase (Authentication → Emails)

Pour chaque modèle : copier le **Sujet**, puis tout le contenu du fichier HTML dans **Message body** (onglet Source).

| Modèle Supabase | Sujet | Fichier |
|---|---|---|
| Confirm sign up | Bienvenue ! Confirmez votre adresse pour créer votre compte | `1-confirmation-inscription.html` |
| Invite user | Vous êtes invité sur Atelier Logistique | `2-invitation.html` |
| Magic link | Votre lien pour choisir votre mot de passe | `3-lien-connexion.html` |
| Change email address | Confirmez votre nouvelle adresse e-mail | `4-changement-adresse.html` |
| Reset password | Réinitialisez votre mot de passe | `5-reinitialisation-mot-de-passe.html` |
| Reauthentication | Votre code de vérification : {{ .Token }} | `6-code-verification.html` |
| Password changed (notification de sécurité) | Votre mot de passe a été modifié | `7-alerte-mot-de-passe-modifie.html` |
| Email address changed (notification de sécurité) | L’adresse e-mail de votre compte a été modifiée | `8-alerte-adresse-modifiee.html` |

Régénérer : `node supabase/email-templates/build.mjs` (logo : `public/email/logo-blanc.png`, servi par le site).
