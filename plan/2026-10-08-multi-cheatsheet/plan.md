# Galerie multi-pages — plan d’implémentation
Plan ID: 2026-10-08-multi-cheatsheet
Revision: 1
Créé: 2026-10-08
## Objectif et critères
Galerie de 1 à 255 pages, canevas et outils actuels sur chaque page, un BIN multi-pages avec compatibilité des anciens BIN. Toolbox précédent, Effacer suivant, une page par pression, extrémités bornées, zoom/déplacement par page. Réglages d’export globaux, avertissement non bloquant au-delà de 2,2 * 1024² octets. Augmentation mesurée du NWA. Site GitHub Pages sur xyrpxx/Multi-Cheatsheet-Numworks via Actions.
## Contexte et approche
Sources: src/main.c (RLE et lecteur), docs/app.js (éditeur), Makefile (build device et simulateur). Origin local encore SaltyMold. Conteneur v2 little-endian, signature, offsets/longueurs/dimensions, validation stricte avant affichage. Lecture sans copie des données; caches uniquement page active. IndexedDB pour brouillons; migration localStorage Cheatsheet:session:v2, clé conservée jusqu’à succès. Toutes les pages doivent contenir une image avant export. Supprimer la dernière recrée une page vide.
## Phases et contrôles
1A: toolchain et build de référence, taille/SHA256. 1B: fixtures anciennes et inventaire outils. Sortie: référence documentée.
2A: parser v2/legacy et tests hôte de corruption/bornes. 2B: navigation, état par page, invalidation caches, simulateur configurable; tests commandes et restauration. Dépendance: phase 1. Sortie: ancien BIN et galerie lisibles.
3A: gestion de pages, outils/historiques isolés, IndexedDB/migration/erreurs visibles, tests navigateur. 3B: export ordonné, options globales, taille réelle et seuil, lecture simulateur. Dépendance: phase 2. Sortie: parcours galerie complet.
4A: workflow Pages branche par défaut ou manuel, liens README et crédits; vérifier déploiement/assets. 4B: builds device/simulateur, régressions, comparaison taille. Dépendance: phases 2 et 3. Sortie: livraison vérifiée.
## Limites
Aucun test physique téléphone/calculatrice/USB. Simulateur/hôte ne prouvent pas fonctionnement matériel. 2,2 Mo est un conseil, pas une garantie installable. Une impossibilité de build ou de publication doit être signalée, jamais considérée validée.
## Historique
Révision 1: plan fourni explicitement par l’utilisateur et autorisé à l’exécution.
