# 🤖 BETPAWA AI AGENT v4 — Guide Complet

## Architecture

```
index.js           → Point d'entrée + scheduler 6h
src/
  agent.js         → Orchestrateur (6 sous-agents)
  optimizer.js     → Intelligence causale (autopsie, remédiation)
  contextAnalyzer.js→ 9 dimensions d'analyse par match
  dataFetcher.js   → APIs gratuites (Odds, football-data, Open-Meteo)
  storage.js       → Persistance (bets, stats, mémoire causale, scores)
  telegram.js      → Notifications Bot Telegram
  server.js        → Dashboard web + API REST
  logger.js        → Journaux quotidiens
data/
  bets.json              → Historique des paris
  stats.json             → Statistiques globales
  memory.json            → Paramètres dynamiques + capacités
  causal_journal.json    → Journal d'autopsies des pertes
  dimension_scores.json  → Précision par marché/ligue/tranche cote
  capabilities.json      → Capacités acquises
```

## 9 Dimensions analysées par match

| # | Dimension | Source |
|---|---|---|
| 1 | Forme récente (6 matchs) | football-data.org |
| 2 | Capacités individuelles/collectives | API-Football |
| 3 | Plan émotionnel et psychologique | Heuristique + IA |
| 4 | Historique H2H | football-data.org |
| 5 | Enjeux (CAN/UCL/relégation/derby) | Heuristique |
| 6 | Intégrité (cotes anormales/fixing) | Analyse cotes |
| 7 | Météo | Open-Meteo (gratuit, sans clé) |
| 8 | Styles de jeu | Base de données intégrée |
| 9 | Facteurs X imprévisibles | Heuristique |

## Intelligence causale (v4)

À chaque pari perdu:
1. **Autopsie** — identification des causes racines sélection par sélection
2. **Dimensions fautives** — quelle dimension a failli (météo? intégrité? cote trop haute?)
3. **Remédiation progressive** — ajustement mesuré des paramètres (pas de blacklist brutale)
4. **Score par dimension** — précision mesurée par marché, ligue, tranche de cote
5. **Cycle suivant** — le prompt intègre les leçons causales acquises

## APIs gratuites utilisées

| API | Usage | Limite gratuite | Clé requise |
|---|---|---|---|
| The Odds API | Cotes en temps réel | 500 req/mois | `ODDS_API_KEY` |
| football-data.org | Matchs, résultats, H2H | 10 req/min | `FOOTBALL_DATA_KEY` |
| Open-Meteo | Météo des stades | Illimitée | ❌ Aucune |
| API-Football | Stats joueurs/équipes | 100 req/jour | `API_FOOTBALL_KEY` |
| Anthropic Claude | Décision IA | Selon solde | `ANTHROPIC_API_KEY` |
| Telegram Bot | Notifications | Illimitée | `TELEGRAM_TOKEN` |

## Déploiement sur Render.com (gratuit, 24/7)

### Étape 1 — Clés gratuites
1. **Telegram** (GRATUIT):
   - Écrire à @BotFather → `/newbot` → copier le token
   - Écrire à votre bot → aller sur `https://api.telegram.org/bot<TOKEN>/getUpdates` → copier `chat.id`

2. **The Odds API** (GRATUIT): https://the-odds-api.com → S'inscrire → Dashboard

3. **football-data.org** (GRATUIT): https://football-data.org/client/register → Email → Clé dans le profil

4. **API-Football** (GRATUIT 100/jour): https://dashboard.api-football.com/register

5. **Anthropic** (payant ~5$): https://console.anthropic.com → API Keys

### Étape 2 — GitHub
Créer un repo `betpawa-ai-agent` et uploader tous les fichiers.

### Étape 3 — Render.com
1. render.com → New → Web Service → Connecter GitHub
2. Le `render.yaml` configure tout automatiquement
3. Environment Variables → ajouter les 6 clés
4. Deploy → URL: `https://betpawa-ai-agent.onrender.com`

## Dashboard et endpoints

| URL | Contenu |
|---|---|
| `/` | Dashboard complet avec courbe bankroll |
| `/api/stats` | Statistiques JSON |
| `/api/bets` | Historique des paris |
| `/api/memory` | Mémoire causale + paramètres dynamiques |
| `/api/causal` | Journal des autopsies de pertes |
| `/api/scores` | Scores de précision par dimension |
| `/health` | État du service |

## Notifications Telegram

**À chaque nouveau pari:**
- Sélections détaillées avec justifications
- Taux de fiabilité estimé (%)
- Analyse émotionnelle, météo, enjeux, intégrité
- Facteurs X à surveiller

**À chaque résultat:**
- Gagné/Perdu avec gain ou perte
- Précision sélection par sélection
- Cause racine identifiée si perdu
- Remédiation appliquée au cycle suivant

**Rapport de cycle (toutes les 6h):**
- Bankroll, ROI, win rate
- Optimisations actives
- Capacités acquises

## Paramètres

| Paramètre | Valeur par défaut | Ajustable |
|---|---|---|
| Cote ticket min | 400 | Non |
| Cote ticket max | 400 000 | Non |
| Max événements | 18 | Oui (par optimizer) |
| Min événements | 8 | Oui (par optimizer) |
| Cote individuelle max | 10.0 | Oui (par optimizer) |
| Bankroll initiale | 5 000 FCFA | Non |
| Intervalle cycles | 6 heures | Configurable |
| Mise max | 5% bankroll | Kelly fractionnel |
