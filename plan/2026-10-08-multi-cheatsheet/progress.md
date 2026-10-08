# Progression — Galerie multi-pages
Plan revision: 1
Authorization: APPROVED — demande explicite « PLEASE IMPLEMENT THIS PLAN »
Execution status: IN_PROGRESS
Current phase: 4A — publication
| ID | Status | Evidence | Difficulty |
|---|---|---|---|
| 1A | DONE | Build ARM: 182052 octets, output/baseline.nwa | Moyenne: MSYS2 exige accès objets Windows |
| 1B | IN_PROGRESS | Inventaire source effectué | Not assessed |
| 2A | TODO | Non vérifié | Not assessed |
| 2B | TODO | Non vérifié | Not assessed |
| 3A | TODO | Non vérifié | Not assessed |
| 3B | TODO | Non vérifié | Not assessed |
| 4A | TODO | Non vérifié | Not assessed |
| 4B | DONE | Builds device/sim, C/JS/Chromium et captures PASS; NWA 196020 octets, SHA dans downloads | Medium: correction Make $< puis relance réussie |
## Événements
- Build initial MSYS2 refusé par sandbox; build autorisé réussi. Deux avertissements existants dans periodic.c.
## Prochaine action
Fixtures de référence et tests parser.

- Le simulateur fourni ne génère pas de captures; simulateur officiel local utilisé avec shim ABI split. Capture NWS exige event_get.
- Premier test JS corrigé: comparaison Buffer/Uint8Array (octets identiques).

- Test navigateur initial bloqué localhost; lancement autorisé et Chromium local: PASS.
- Export historique appliquait inversion deux fois: corrigé pour que BIN corresponde à aperçu.

- Pages activé via Chrome connecté: « GitHub Pages source saved », source GitHub Actions. Aucun nouveau secret/token créé.

- Build final échoué après suivi des headers: règle utilisait $^ (incluant headers); remplacé par $<, contrôles à relancer.

## Dernier contrôle
Tous les contrôles locaux passent. Publication GitHub à effectuer et vérifier.
