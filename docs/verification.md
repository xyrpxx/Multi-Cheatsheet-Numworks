# Vérification — 8 octobre 2026

## Résultats observés

- Build device ARM GNU Toolchain 15.2.Rel1, nwlink 0.0.19 : réussi.
- Build simulateur Windows GCC 16.2.0 et bibliothèque du simulateur officiel local : réussi.
- Encodeur JS : octets legacy de référence, ordre, options, seuil de 2,2 Mo et limite 255 pages : PASS.
- Parser C réel : trois fixtures legacy, v2, toutes les troncatures de la fixture v2, corruption d’en-tête et galerie de 255 pages : PASS.
- Vrai lecteur C avec EADK scripté : maintien de touche, extrémités, zoom/déplacement retrouvés après retour, limites d’affichage : PASS.
- Chromium/Playwright : outils, historiques indépendants, réorganisation, export, rechargement IndexedDB, migration, migration échouée conservant l’ancien brouillon, échec de sauvegarde visible, page vide et URL de projet : PASS.
- Simulateur officiel Epsilon : captures du fichier legacy, des pages 1 et 3 de la fixture, et des deux pages exportées par le navigateur : réussies et inspectées.
- GitHub Pages : tests et déploiement réussis via [Actions 37793185924](https://github.com/xyrpxx/Multi-Cheatsheet-Numworks/actions/runs/37793185924). Site, JS, CSS et NWA accessibles sous le chemin du projet; SHA-256 distant du NWA identique à celui livré. Chromium relancé avec succès après correction du statut initial sans brouillon.

Les contrôles hôte de touches exécutent le véritable `main.c` avec une EADK simulée. Les captures officielles emploient une entrée directe de test réservée au simulateur. Aucun appareil physique n’est testé.

## Taille et mémoire

| Mesure | Référence | Galerie | Différence |
|---|---:|---:|---:|
| NWA, octets | 182052 | 196020 | +13968 (+7.67 %) |
| Section text | 77352 | 79225 | +1873 |
| Section data | 2769 | 2769 | 0 |
| Section bss | 85905 | 89985 | +4080 |

Le NWA comprend des informations de debug. La taille du fichier n’est pas une mesure de RAM disponible. Les 4080 octets supplémentaires sont les états de lecture fixes des 255 pages. Les caches d’image restent limités à la page active.

SHA-256 livré : `992e195ad83438058c96343cdab74f6de30eae832493c54cfff3c4d0aa177e6d`.

## Reproduction

```powershell
./scripts/build.ps1 -Platform device
./scripts/build.ps1 -Platform simulator
./tests/run-host.ps1 -Compiler <chemin-vers-gcc.exe>
node tests/browser-test.cjs
python tests/capture-simulator.py --epsilon <checkout-epsilon>
```

Playwright doit être disponible pour le test navigateur. Les scripts de build acceptent `-DepsRoot`; par défaut ils utilisent la toolchain du projet voisin Numworks app. Le navigateur de test accepte `PLAYWRIGHT_CHROMIUM_EXECUTABLE` pour un Chromium déjà installé.

Deux avertissements de variables inutilisées dans periodic.c existaient dans la référence et restent présents. Le stockage communautaire de raccourcis n’est pas lié au simulateur; son comportement sur firmware réel reste non vérifié.
