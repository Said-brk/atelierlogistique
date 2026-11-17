// Bloc « À propos de l'auteur » commun à tous les articles /ressources.
// Source unique : modifier ce fichier met à jour tous les articles.
// Usage dans un article : <div id="auteur"></div> puis <script src="/ressources/auteur.js" defer></script>
(function () {
  var AUTEUR = {
    nom: 'Saïd BARKAM',
    titre: 'Consultant ERP & Supply Chain',
    photo: '/ressources/said-barkam.jpg',
    bio: "Accompagne les entreprises dans la mise en place d'ERP et la refonte de leur stratégie Supply Chain. Spécialiste ERP Microsoft Dynamics 365.",
  };

  var el = document.getElementById('auteur');
  if (!el) return;

  el.innerHTML =
    '<section class="mt-12 pt-8 border-t border-slate-200" aria-label="À propos de l\'auteur">' +
      '<div class="font-jetbrains text-[10px] tracking-widest mb-4 text-slate-400">À PROPOS DE L\'AUTEUR</div>' +
      '<div class="flex items-center gap-4 sm:gap-5 rounded-xl border border-slate-200 p-4 sm:p-5" style="background:#F8FAFC;">' +
        '<img src="' + AUTEUR.photo + '" alt="' + AUTEUR.nom + '" width="80" height="80" loading="lazy"' +
          ' class="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm" />' +
        '<div class="min-w-0">' +
          '<div class="font-bricolage font-bold text-lg text-slate-900 leading-tight">' + AUTEUR.nom + '</div>' +
          '<div class="font-jetbrains text-[11px] mt-0.5 mb-2" style="color:#2563EB;">' + AUTEUR.titre + '</div>' +
          '<p class="text-sm text-slate-600 leading-relaxed m-0">' + AUTEUR.bio + '</p>' +
        '</div>' +
      '</div>' +
    '</section>';
})();
