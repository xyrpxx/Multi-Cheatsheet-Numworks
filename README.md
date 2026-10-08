<h1 align="center">Multi-Cheatsheet NumWorks — galerie de pages</h1>
<p align="center">
    <img alt="Version" src="https://img.shields.io/badge/Version-2.2.2-blue?style=for-the-badge&color=blue">
    <img alt="Stars" src="https://img.shields.io/github/stars/xyrpxx/Multi-Cheatsheet-Numworks?style=for-the-badge&color=magenta">
    <img alt="Forks" src="https://img.shields.io/github/forks/xyrpxx/Multi-Cheatsheet-Numworks?color=cyan&style=for-the-badge&color=purple">
    <img alt="License" src="https://img.shields.io/github/license/xyrpxx/Multi-Cheatsheet-Numworks?style=for-the-badge&color=blue">
    <br>
    <a href="https://github.com/SaltyMold"><img title="Developer" src="https://img.shields.io/badge/Developer-SaltyMold-red?style=flat-square"></a>
    <img alt="Maintained" src="https://img.shields.io/badge/Maintained-Yes-blue?style=flat-square">
    <img alt="Written In" src="https://img.shields.io/badge/Written%20In-C-yellow?style=flat-square">
</p>

<!-- <img src="assets/video.gif" width="250" alt="video"> --> 

## 📕 Install the app

1. Télécharger le [NWA multi-pages](https://xyrpxx.github.io/Multi-Cheatsheet-Numworks/downloads/Multi-Cheatsheet.nwa).
2. Ouvrir [l’éditeur de galerie](https://xyrpxx.github.io/Multi-Cheatsheet-Numworks/).
3. Ajouter vos images sur une page, utiliser les outils habituels, puis ajouter et réorganiser d’autres pages. Les réglages de couleurs, de taille et d’inversion sont communs.
4. Exporter `gallery.bin`, puis installer le `.nwa` avec ce `.bin` comme données externes sur [my.numworks.com/apps](https://my.numworks.com/apps).

Les anciens `.bin` restent acceptés comme une page. Le `.bin` multi-pages exige le NWA mis à jour. L’avertissement au-delà de 2,2 Mo ne bloque pas l’export et ne garantit pas la place disponible sur la calculatrice.

Les brouillons sont sauvegardés localement dans le navigateur (IndexedDB). Attendre « Saved locally » avant de fermer l’onglet. L’ancien brouillon local est migré lors de la première ouverture; les données restent sur l’appareil.

## ⚙️ How to use the app

| Key        | Action            |
|------------|-------------------|
| All arrows | Move in the image |
| OK / Back  | Zoom +/-          |
| Hold shift | Change binding    |
| Toolbox | Previous page |
| Backspace / Effacer | Next page |
| Home | Quit |

> [!CAUTION]
> The cheetsheet is hiden inside a periodic table. To access it, hold OK + Back + Zero. You can change this binding in the app by holding shift.

## 🛠️ Build the app

I made tutorials here :
- [C-App-Guide-for-Numworks](https://github.com/SaltyMold/C-App-Guide-for-Numworks)

La navigation s’arrête aux extrémités. Le zoom et la position sont conservés par page pendant la session.

## GitHub Pages

Le workflow `.github/workflows/pages.yml` teste le format et le vrai lecteur C avant de publier `docs/` depuis `main`, uniquement sur cette fork. La source Pages doit être **GitHub Actions**. Le workflow peut aussi être lancé manuellement depuis Actions.

## Validation

Voir [le format et les commandes de test](docs/gallery-format.md) et [les résultats de vérification](docs/verification.md). Aucun téléphone, calculatrice ou USB physique n’est testé. Les résultats hôte/simulateur ne prouvent pas le fonctionnement matériel.

## Crédits

Application et outils d’édition originaux : [SaltyMold/Cheatsheet-Numworks](https://github.com/SaltyMold/Cheatsheet-Numworks). Cette fork ajoute la galerie multi-pages et ses validations.
