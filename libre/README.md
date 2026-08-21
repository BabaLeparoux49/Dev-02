# Libre

Application personnelle de budget : saisie des dépenses, conseils d’épargne et pistes d’investissement.

## Lancer

```bash
cd libre
npm install
npm run dev
```

Ouvre l’URL Vite (souvent `http://localhost:5173`).

## Fonctionnalités

- **Réglages** : salaire net, fonds d’urgence, profil de risque, horizon
- **Dépenses / revenus** : saisie manuelle par catégorie, historique local
- **Conseils** : capacité d’épargne, enveloppes 50/30/20, budget quotidien, alertes
- **Investir** : répartition suggérée Livret A / sécurisé / PEA ETF (éducatif)

Les données restent dans `localStorage` du navigateur — pas de compte, pas de cloud.

## Hors scope (pour l’instant)

- Sync Crédit Agricole / Trade Republic
- Conseil réglementé en investissement
