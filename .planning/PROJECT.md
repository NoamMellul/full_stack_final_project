# MedRDV — Plateforme de prise de rendez-vous médicaux (Israël)

## What This Is

Une plateforme web inspirée de Doctolib, adaptée au marché israélien, qui permet à un patient de rechercher un médecin privé selon la spécialité, la langue parlée (hébreu/anglais), le quartier et la disponibilité, puis de réserver un rendez-vous directement en ligne. La v1 est concentrée sur Tel-Aviv. Les profils médecins et leurs disponibilités sont des données de démonstration clairement identifiées comme telles — aucune intégration avec de vrais cabinets médicaux. C'est un projet final universitaire de développement Full-Stack.

## Core Value

Un patient doit pouvoir trouver un médecin adapté à ses critères et réserver un créneau disponible en quelques clics, avec une garantie absolue que deux patients ne réservent jamais le même créneau.

## Business Context

- **Customer**: Patients (utilisation gratuite) et médecins/cabinets privés (abonnement — non implémenté en v1)
- **Revenue model**: Abonnement mensuel médecin/cabinet, envisagé pour une version future — le modèle de données ne doit rien bloquer pour l'ajouter plus tard, mais aucune intégration de paiement n'est construite maintenant
- **Success metric**: Un parcours de réservation complet et sans faille (recherche → profil → créneau → réservation → confirmation → gestion), démontrable en soutenance
- **Strategy notes**: —

## Requirements

### Validated

(Aucune pour l'instant — projet greenfield)

### Active

- [ ] Authentification patient (inscription, connexion, déconnexion, session persistante)
- [ ] Comptes médecins créés et activés par l'administrateur (pas d'auto-inscription médecin)
- [ ] Recherche de médecins multi-critères : nom, spécialité, langue, quartier, disponibilité
- [ ] Profils publics de médecins (spécialité, description, adresse, quartier, langues, prochains créneaux, statut démo)
- [ ] Réservation de rendez-vous avec prévention garantie de la double réservation
- [ ] Annulation de rendez-vous (patient et médecin)
- [ ] Déplacement d'un rendez-vous vers un autre créneau disponible
- [ ] Historique des rendez-vous (à venir / passés) côté patient et médecin
- [ ] Gestion des disponibilités par le médecin (ajout/suppression de créneaux, blocage de périodes)
- [ ] Favoris : le patient peut enregistrer des médecins favoris
- [ ] Notifications internes (confirmation, annulation, déplacement de rendez-vous)
- [ ] Dashboard patient, dashboard médecin, dashboard administrateur
- [ ] Gestion complète des médecins par l'administrateur (créer, modifier, activer/désactiver)
- [ ] Gestion des référentiels par l'administrateur (spécialités, quartiers/localisations)
- [ ] Interface bilingue hébreu/anglais avec support RTL pour l'hébreu

### Out of Scope

- Dossier médical, diagnostic, ordonnance, résultats d'analyse — donnée médicale sensible réglementée, hors périmètre éthique/légal d'un projet démo
- Téléconsultation complète — complexité vidéo/streaming disproportionnée par rapport à la valeur pour ce projet
- Paiement de la consultation, remboursement, gestion des assurances/caisses de santé — nécessite une intégration financière/réglementaire réelle non pertinente pour la démo
- Intégration réelle avec de vrais médecins ou systèmes de santé israéliens — toutes les données sont des profils de démonstration clairement étiquetés
- IA médicale, recommandations de diagnostic — hors sujet et risque de mauvaise interprétation par un utilisateur
- Messagerie médicale détaillée entre patient et médecin — au-delà de la prise de rendez-vous

## Context

- Projet final universitaire de développement Full-Stack — doit être présentable en 10-15 minutes de soutenance et suffisamment complet pour démontrer une maîtrise du Full-Stack (CRUD, rôles, permissions, sécurité, tests, scalabilité).
- Contrainte de stack imposée par le cahier des charges : Next.js, TypeScript, Supabase (DB + Auth), déploiement sur Vercel, URL publique.
- L'utilisateur préfère explicitement des choix techniques standards et largement connus plutôt que des abstractions propres à un framework, même si cela demande un peu plus de code — priorité à la clarté et à la facilité de défense en soutenance sur l'idiomatisme Next.js. Voir décisions ci-dessous (REST plutôt que Server Actions, validation manuelle plutôt que Zod).
- La base de données est considérée par l'utilisateur comme la partie la plus critique du projet — le schéma doit être solide, bien contraint (anti-double-réservation au niveau DB, RLS pour l'isolation des rôles) et validé explicitement avant l'implémentation.
- Marché cible : Israël, v1 concentrée sur Tel-Aviv uniquement. Langues supportées : hébreu et anglais uniquement.

## Constraints

- **Tech stack**: Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Storage) + déploiement Vercel — imposé par le cahier des charges universitaire
- **Architecture API**: Routes API REST classiques (Next.js Route Handlers, `app/api/.../route.ts`) — pas de Server Actions. Choix explicite de l'utilisateur : plus standard, plus universellement compris, plus facile à défendre en soutenance
- **Validation**: fonctions de validation manuelles en TypeScript (pas de librairie de schéma type Zod) — même raison de simplicité et de familiarité
- **Tests**: Playwright uniquement (bout-en-bout) — pas de Vitest ni de React Testing Library. L'utilisateur juge que les tests de composants isolés n'apportent pas de valeur suffisante ici ; Playwright doit couvrir tous les parcours critiques (réservation, permissions, double-réservation)
- **Données médicales**: aucune donnée médicale sensible stockée (pas de diagnostic, ordonnance, dossier médical, résultat d'analyse)
- **i18n**: solution custom légère (contexte React + dictionnaires JSON, `dir="rtl"` conditionnel) — pas de librairie i18n lourde (next-intl écarté, pas de routing par locale nécessaire pour 2 langues statiques)
- **UI**: Tailwind CSS + shadcn/ui — léger, personnalisable, bon support RTL via propriétés logiques CSS, plus idiomatique avec les Server Components que Material UI ou Ant Design
- **Fuseau horaire**: tout stocké en `timestamptz` UTC en base ; conversion `Asia/Jerusalem` uniquement à l'affichage/saisie (gestion du changement d'heure/DST)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Routes API REST classiques plutôt que Server Actions | Plus standard, plus facile à expliquer/défendre en soutenance, moins de "magie" propre à Next.js | — Pending |
| Validation manuelle plutôt que Zod | Simplicité, aucune dépendance supplémentaire, logique explicite et lisible par tous | — Pending |
| Playwright seul, pas de Vitest/React Testing Library | Les tests E2E couvrent tout ce qui compte réellement (parcours, permissions, double-réservation) ; les tests de composants isolés n'apportent pas de valeur ajoutée ici | — Pending |
| Fusion de `blocked_periods` dans `availability_slots` (statut `blocked`) | Une seule table à interroger pour le planning du médecin, même logique de détection de chevauchement à appliquer | — Pending |
| Anti-double-réservation garanti au niveau base de données (contrainte d'unicité partielle + transaction) | Garantie forte contre les réservations concurrentes, pas seulement une vérification applicative | — Pending |
| Tailwind CSS + shadcn/ui | Léger, personnalisable, bon support RTL, plus idiomatique avec les Server Components que MUI/Ant Design | — Pending |
| i18n custom (pas de next-intl) | Seulement 2 langues statiques, pas besoin de routing par locale | — Pending |
| Ville v1 : Tel-Aviv uniquement | Marché plus jeune, forte densité de médecins privés anglophones simulée, cohérent avec les données de démo | — Pending |
| Création de compte médecin par mot de passe temporaire (pas d'email d'invitation) | Évite de configurer un service d'envoi d'email réel pour la démo | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-03 after initialization*
