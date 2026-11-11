# ⛏️ Plugin & Mod HMD Minecraft pour HMD Talk

Projet officiel d'intégration Minecraft pour **HMD Talk**.
Permet de synchroniser en temps réel :
- Le chat bidirectionnel (`# minecraft-chat` ↔ Minecraft)
- La liste des joueurs connectés (pseudo, UUID, ping, vie, dimension)
- Les coordonnées en direct pour la carte interactive du monde
- Le statut du serveur (TPS, RAM, version, motd)
- Les événements (connexions, déconnexions, morts)
- La console et l'administration distante sécurisée via code admin (`1937`)

---

## 📦 1. Compilation du Plugin (.jar)

Le projet utilise **Maven** et cible Java 17+ (compatible Minecraft 1.16.5 à 1.21.4+ sur Paper, Spigot, Purpur).

### Prérequis :
- Java Development Kit (JDK) 17 ou 21 installé (`java -version`)
- Apache Maven installé (`mvn -version`)

### Commande de compilation :
```bash
cd minecraft-plugin
mvn clean package
```

Le fichier compilé sera généré dans :
`target/hmd-minecraft-1.0.0.jar`

---

## 🚀 2. Installation sur le serveur

1. Arrêtez votre serveur Minecraft ou préparez le dossier `plugins/`.
2. Déposez `hmd-minecraft-1.0.0.jar` dans le dossier `plugins/` de votre serveur (Paper, Spigot, Purpur).
3. Démarrez votre serveur. Le dossier `plugins/HMDMinecraft/` et le fichier `config.yml` sont générés automatiquement.
4. Ouvrez `plugins/HMDMinecraft/config.yml` et assurez-vous que `backend_url` correspond à l'URL de votre instance HMD Talk (ex: `https://votre-app.run.app` ou `http://localhost:3000`).

---

## 🔗 3. Appairage Sécurisé (/pair CODE)

1. Rendez-vous sur **HMD Talk** dans l'onglet **⛏️ HMD Minecraft**.
2. Créez un groupe pour votre serveur ou ouvrez un groupe existant.
3. Dans l'onglet **Paramètres & Liaison**, cliquez sur **Générer un code de jumelage**.
   Vous obtiendrez un code temporaire unique (valide 15 min), par exemple :
   `HMD-8K29-PQ`
4. Connectez-vous sur votre serveur Minecraft en tant qu'opérateur (OP) ou exécutez dans la console :
   ```
   /pair HMD-8K29-PQ
   ```
5. Le plugin contacte le backend HMD, valide le code et reçoit un jeton d'authentification révocable `X-HMD-Server-Token`.
6. Le code est instantanément invalidé et le groupe affiche **Serveur connecté** en vert !

---

## 🛠️ 4. Commandes disponibles

| Commande | Permission | Description |
|---|---|---|
| `/pair <CODE>` | `hmd.admin` (OP) | Associe le serveur au groupe HMD avec le code unique |
| `/hmd status` | `hmd.admin` | Affiche l'état de la connexion et l'URL HMD |
| `/hmd chat <message>` | `hmd.admin` | Envoie un message directement vers le salon HMD Talk |
| `/hmd unlink` | `hmd.admin` | Dissocie le serveur du groupe HMD Talk |
| `/hmd reload` | `hmd.admin` | Recharge le fichier `config.yml` |

---

## 🗺️ 5. Carte du monde & Intégration BlueMap / Dynmap

- **Carte Radar Intégrée :** HMD Talk embarque une carte interactive en direct affichant les joueurs, coordonnées X/Y/Z, dimensions (Overworld, Nether, End), et directions.
- **Intégration BlueMap / Dynmap :** Si vous avez BlueMap ou Dynmap installé sur votre serveur (ex: port 8100 ou 8123), renseignez l'URL dans les paramètres du groupe pour l'intégrer directement dans l'onglet 🗺️ Carte du monde de HMD Talk !

---

## ⚙️ 6. Compatibilité Fabric & NeoForge / Forge

Pour les serveurs Fabric ou Forge :
- **Fabric :** Utilisez le mod Fabric HMD Talk (utilisant Fabric API et les événements `ServerMessageEvents.CHAT_MESSAGE` et `ServerPlayConnectionEvents.JOIN/DISCONNECT`).
- **Paper/Spigot/Purpur :** Le plugin inclus fonctionne nativement sans dépendances supplémentaires.
