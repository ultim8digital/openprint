# OpenPrint

**Un répertoire ouvert des studios et ateliers d’impression. Pas d’inscription ni de modérateurs.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Trouvez un atelier de fabrication sur la carte, consultez ses compétences et contactez-le directement. Si votre atelier n’apparaît pas, ajoutez ses coordonnées et ses services : l’annonce sera affichée immédiatement. Enregistrez le lien de gestion privée pour modifier ou supprimer votre annonce ultérieurement. Le catalogue par défaut ne comporte pas de comptes, de confirmation par courriel ou de file d’attente d’approbation.

Exécutez OpenPrint avec Node.js 24 et SQLite local. Vercel, Supabase, un fournisseur de services de messagerie, l’IA payante et la connexion par un tiers ne sont pas requis. GitHub héberge le code source et les versions; un site Web partagé qui accepte les soumissions nécessite un serveur API en fonctionnement. Les [GitHub pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) seules ne peuvent pas exécuter le Node.js API ni conserver les modifications des visiteurs.

## Fonctionnalités du catalogue

- Recherchez par nom, ville et technologie. La carte affiche les lieux correspondants, indépendamment de la pagination de la liste.
- Publiez sans créer de compte. Choisissez un point sur la carte ou entrez des coordonnées; les annonces sans coordonnées restent consultables.
- Modifiez ou supprimez une annonce, ainsi que son lien privé. Les vérifications de version protègent contre les modifications contradictoires dans différents onglets.
- Recherchez les studios existants avant de publier. Les doublons exacts de nom, de ville et d’adresse sont automatiquement rejetés.
- Importez un catalogue en indiquant la source. Les importations effectuées par un opérateur ne peuvent pas remplacer les annonces publiées par l’utilisateur.
- Affichez OpenStreetMap tuiles sans clé API. Les tuiles se chargent lorsqu’une carte est affichée, y compris la page d’accueil par défaut.
- Choisissez la langue de l’interface dans le menu des langues. Consultez le fichier README complet dans votre langue en utilisant l’index des langues ci-dessus.

La publication ne vérifie pas la propriété de l’entreprise ni la qualité du service. Confirmez les équipements, les capacités et les conditions avec l’atelier. Toute personne détenant le lien de gestion privé peut contrôler cette annonce. Gardez-le confidentiel; il n’y a pas de possibilité de récupération par courriel. Consultez le [guide d’auto-publication](../../docs/OPEN_CATALOG.md).

## Exécutez votre propre instance

Installez Node.js 24, clonez ce dépôt et exécutez :

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Ouvrez `http://localhost:3000`. La configuration par défaut `APP_MODE=catalog` ne nécessite aucune configuration par un administrateur ou un utilisateur. Configurez `APP_URL`, HTTPS et les sauvegardes à l’aide du [guide d’auto-hébergement](../../docs/SELF_HOSTING.md). Docker Compose est également disponible : `docker compose up --build -d`.

La méthode de déploiement prise en charge consiste en un seul processus d’application avec SQLite sur un disque local. La publication automatique et les quotas de requêtes limitent les abus sans nécessiter une file d’attente de modération. Une adresse IP de bureau partagée peut partager un quota de publication. Consultez la section [limites et comportement du lien de gestion](../../docs/OPEN_CATALOG.md) avant d’ouvrir une instance publique.

Utilisez l’interface en ligne de commande [d’importation de catalogue](../../docs/CATALOG_IMPORT.md) pour un ensemble de données existant, après avoir vérifié ses droits d’utilisation. Les ensembles de données d’instance, les fichiers téléchargés et les sauvegardes ne sont pas inclus dans le référentiel ou les images de conteneur.

## Mode communautaire et mode Neofab (facultatifs)

Définissez explicitement `APP_MODE=community` pour activer les projets privés, les devis des fournisseurs, la bibliothèque de modèles et Neofab Studio. Ces flux de travail utilisent leurs propres comptes et autorisations. Le changement de mode conserve les données enregistrées. Le mode catalogue ne divulgue pas l’historique privé de la communauté via son API, ni ne reprend les CAD tâches en attente.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) prend en charge des cahiers des charges de fabrication versionnés, des nomenclatures et une géométrie CAD déclarative aux capacités limitées, avec export STEP/STL. CAD et IA sont facultatifs. Les propositions de l’IA doivent être vérifiées puis appliquées lors d’une étape distincte; elles ne publient pas automatiquement de commandes et ne construisent pas automatiquement la géométrie. CAM, G-code et la validation physique de l’aptitude à la fabrication ne sont pas implémentés.

## Droits sur les données et confidentialité

La licence du logiciel MIT n’accorde pas de droits sur les données commerciales importées. La simple mention de la source ne suffit pas à autoriser la copie de données provenant de Google Maps, 2GIS, Yandex Maps ou d’autres sources. Vérifiez les autorisations relatives au stockage, à la publication et à la redistribution avant d’utiliser un ensemble de données. Consultez la section [provenance et limites de la vérification des données](../../docs/DATA_PROVENANCE.md).

Les coordonnées que vous publiez vous-même sont publiques; les clés de gestion sont privées. Conservez les bases de données et les sauvegardes en dehors des répertoires accessibles au public, et fournissez un contact pour les demandes de correction et de suppression. Consultez les sections sur la [confidentialité](../../PRIVACY.md) et la [sécurité](../../SECURITY.md) avant le déploiement.

## Développement et traduction

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Actions vérifie les types, les API, les parcours dans le navigateur ainsi que les conteneurs standard et ceux avec CAD natif. Les tests utilisent des données fictives. Les résultats précis, la couverture et les limites restantes figurent dans la [documentation de validation](../../docs/VALIDATION.md) et la [description du produit](../../docs/PRODUCT.md).

Le fichier README en anglais est la référence pour les versions traduites complètes. L’[index des langues](../../docs/i18n/README.md) documente les limites de la maintenance et de la révision des traductions. La localisation de l’interface ne traduit pas les listes créées par les utilisateurs, le contenu des projets ou tous les outils de diagnostic technique externes.

## Licences et contributions

Le code source original, l’interface utilisateur, les illustrations SVG, la documentation et le générateur paramétrique sont [sous licence MIT](../../LICENSE). Les dépendances conservent leurs propres licences et mentions. Les modèles créés par les utilisateurs ont une licence distincte choisie par leurs auteurs. Les textes des profils fictifs de démonstration et des cahiers des charges de démonstration, ainsi que les trois modèles de démonstration générés, sont mis à disposition sous CC0 ; le générateur reste sous MIT. Consultez les [mentions relatives aux tiers](../../THIRD_PARTY_NOTICES.md).

Cette implémentation indépendante développe l’idée de [3d-online.app](https://3d-online.app). Les comptes de production d’origine, les clés secrètes, l’historique Git privé et les fichiers des utilisateurs ne sont pas inclus. Le compilateur MIT Neofab CAD adapté conserve sa [licence et son avis d’origine](../../cad-worker/NOTICE.md).

Les contributions peuvent comprendre du code, des corrections de traduction, des améliorations de l’ergonomie, des modèles paramétriques ouverts, des vérifications d’installation et des commentaires provenant d’ateliers réels. Commencez par [CONTRIBUTING.md](../../CONTRIBUTING.md).
