import { S, escHtml, timeAgo, formatMsg } from './hmd-state.js';

let sseEventSource = null;
let mapCanvas = null;
let mapCtx = null;
let mapZoom = 1;
let mapPanX = 0;
let mapPanY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let selectedDimension = 'overworld';

// Fetch groups list
export async function fetchMinecraftGroups() {
  try {
    const res = await fetch('/api/minecraft/groups');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Fetch minecraft groups failed:', e);
  }
  return [];
}

// Fetch single group
export async function fetchMinecraftGroup(groupId) {
  try {
    const res = await fetch(`/api/minecraft/groups/${groupId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Fetch group failed:', e);
  }
  return null;
}

// Show the main Minecraft groups list
export async function showMinecraftView() {
  S.view = 'minecraft';
  S.activeServer = null;
  S.activeChannel = null;
  S.activeDm = null;
  S.activeMinecraftGroup = null;

  document.querySelectorAll('.srv-btn').forEach(b => b.classList.remove('active'));
  const mcBtn = document.getElementById('srv-minecraft');
  if (mcBtn) mcBtn.classList.add('active');

  const groups = await fetchMinecraftGroups();
  renderMinecraftGroupsList(groups);
  renderMinecraftLeftPanel(groups);

  if (window.closeMobileNav) window.closeMobileNav();
}

function renderMinecraftLeftPanel(groups) {
  const lp = document.getElementById('lp-content');
  const title = document.getElementById('lp-title');
  if (title) title.textContent = 'HMD Minecraft';

  let html = `<div class="ch-list">`;
  html += `<div class="ch-item active" onclick="showMinecraftView()" style="margin:4px 8px;"><span>⛏️</span><span>Tous les groupes</span></div>`;
  html += `<div class="ch-item" onclick="openCreateMinecraftGroup()" style="margin:4px 8px;color:var(--green);"><span>➕</span><span>Créer un groupe</span></div>`;
  html += `<div class="ch-item" onclick="openAdminAuthModal()" style="margin:4px 8px;color:var(--red);"><span>🛡️</span><span>Espace Admin</span></div>`;

  if (groups && groups.length > 0) {
    html += `<div class="ch-section-hdr" style="padding:10px 16px 4px;">SERVEURS CONNECTÉS (${groups.length})</div>`;
    groups.forEach(g => {
      const isOnline = g.status === 'online';
      html += `<div class="ch-item${S.activeMinecraftGroup === g.id ? ' active' : ''}" onclick="openMinecraftGroup('${g.id}')">
        <span>${g.logo || '⛏️'}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(g.name)}</span>
        <span class="mc-status-badge ${g.status}" style="margin-left:auto;padding:1px 5px;font-size:9px;">
          <span class="mc-dot"></span>
        </span>
      </div>`;
    });
  }
  html += `</div>`;
  if (lp) lp.innerHTML = html;
}

export function renderMinecraftGroupsList(groups) {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  let cardsHtml = '';
  if (!groups || groups.length === 0) {
    cardsHtml = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text2);">
      <div style="font-size:48px;margin-bottom:12px;">⛏️</div>
      <div style="font-size:18px;font-weight:700;">Aucun groupe Minecraft actif</div>
      <p style="margin-top:6px;font-size:14px;color:var(--text3);">Créez votre propre groupe et connectez votre serveur Paper/Spigot avec /pair CODE.</p>
      <button class="btn btn-mc" style="margin-top:16px;" onclick="openCreateMinecraftGroup()">+ Créer un groupe Minecraft</button>
    </div>`;
  } else {
    cardsHtml = groups.map(g => {
      const statusLabel = g.status === 'online' ? `🟢 ${g.onlineCount || 0} joueur(s)` : g.status === 'pending' ? '🟡 En attente /pair' : '🔴 Hors ligne';
      return `<div class="mc-group-card" onclick="openMinecraftGroup('${g.id}')">
        <div class="card-header">
          <div class="group-logo">${g.logo || '⛏️'}</div>
          <div style="flex:1;min-width:0;">
            <div class="group-name">${escHtml(g.name)}</div>
            <div class="group-meta" style="margin-top:4px;">
              <span class="mc-tag">${g.loader || 'Paper'} ${g.version || '1.21.4'}</span>
              <span class="mc-status-badge ${g.status}"><span class="mc-dot"></span>${statusLabel}</span>
            </div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text2);line-height:1.4;">${escHtml(g.description || 'Serveur communautaire Minecraft.')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;font-size:12px;color:var(--text3);">
          <span>IP: <code style="color:var(--text1);font-family:monospace;">${escHtml(g.ip)}:${g.port}</code></span>
          <span style="color:var(--green);font-weight:700;">Rejoindre →</span>
        </div>
      </div>`;
    }).join('');
  }

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header">
      <div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div>
      <span style="font-size:22px;">⛏️</span>
      <span class="ch-name">HMD Minecraft</span>
      <span class="ch-desc">Groupes de serveurs, chat en jeu & carte en direct</span>
      <div class="mc-header-actions">
        <button class="btn btn-mc" style="padding:6px 14px;font-size:13px;" onclick="openCreateMinecraftGroup()">+ Créer un groupe</button>
        <button class="btn btn-ghost" style="padding:6px 12px;font-size:13px;" onclick="downloadPluginModal()">📦 Plugin .JAR</button>
        <button class="btn btn-ghost" style="padding:6px 12px;font-size:13px;color:var(--red);" onclick="openAdminAuthModal()">🛡️ Admin</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:24px;">
      <div style="max-width:1000px;margin:0 auto;">
        <!-- PROMINENT DOWNLOAD BANNER -->
        <div style="background:linear-gradient(135deg, rgba(34,197,94,0.18), rgba(6,182,212,0.15));border:1.5px solid rgba(34,197,94,0.4);border-radius:16px;padding:20px;margin-bottom:24px;box-shadow:0 8px 32px rgba(0,0,0,0.25);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:260px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:24px;">📦</span>
                <h2 style="font-size:18px;font-weight:800;color:#fff;">Où télécharger le plugin / mod pour votre serveur ?</h2>
                <span class="mc-tag" style="background:var(--green);color:#000;font-weight:800;">PRÊT À L'EMPLOI</span>
              </div>
              <p style="font-size:13px;color:var(--text1);line-height:1.5;margin-bottom:10px;">
                Téléchargez directement le fichier <strong>HMDMinecraft-1.0.0.jar</strong> ci-dessous. Déposez-le dans le dossier <code>plugins/</code> de votre serveur (Paper, Spigot, Purpur) ou <code>mods/</code> (Fabric, Forge), puis redémarrez-le et associez-le avec <code>/pair CODE</code> !
              </p>
              <div style="font-size:12px;color:var(--text2);display:flex;gap:14px;flex-wrap:wrap;">
                <span>✔ Compatible versions : <strong>26.1.2</strong>, 1.21.x, 1.20.x, 1.19.x, 1.16.5</span>
                <span>✔ Loaders : <strong>Paper, Spigot, Purpur, Fabric, Forge</strong></span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <a href="/api/minecraft/download/HMDMinecraft-1.0.0.jar" download="HMDMinecraft-1.0.0.jar" class="btn btn-mc" style="text-decoration:none;padding:10px 18px;font-size:14px;font-weight:800;white-space:nowrap;">
                ⬇️ Télécharger le Plugin (.JAR)
              </a>
              <a href="/api/minecraft/download/source.zip" download="hmd-minecraft-source.zip" class="btn btn-ghost" style="text-decoration:none;padding:8px 14px;font-size:12px;text-align:center;">
                📁 Télécharger les sources (.ZIP)
              </a>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap;">
          <div>
            <h1 style="font-size:22px;font-weight:800;">Serveurs & Groupes Minecraft</h1>
            <p style="font-size:14px;color:var(--text2);margin-top:2px;">Suivez vos serveurs, discutez en jeu et visualisez la carte du monde.</p>
          </div>
          <input type="text" placeholder="Rechercher un serveur..." oninput="filterMinecraftGroups(this.value)" style="padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text1);font-size:14px;outline:none;width:240px;"/>
        </div>
        <div class="home-cards" id="mc-groups-grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));max-width:none;">
          ${cardsHtml}
        </div>
      </div>
    </div>
  </div>`;
}

// Open group detail page
export async function openMinecraftGroup(groupId) {
  S.activeMinecraftGroup = groupId;
  S.activeMinecraftTab = S.activeMinecraftTab || 'chat';
  const group = await fetchMinecraftGroup(groupId);
  if (!group) {
    if (window.showToast) window.showToast('Erreur', 'Groupe introuvable', '#ef4444', '!');
    showMinecraftView();
    return;
  }

  // Connect SSE for live updates
  if (sseEventSource) {
    sseEventSource.close();
  }
  try {
    sseEventSource = new EventSource(`/api/minecraft/groups/${groupId}/stream`);
    sseEventSource.onmessage = e => {
      try {
        const payload = JSON.parse(e.data);
        handleGroupLiveEvent(payload);
      } catch(err) {}
    };
  } catch (e) {}

  renderGroupView(group);
}

function handleGroupLiveEvent(payload) {
  if (!S.activeMinecraftGroup) return;
  if (payload.event === 'chat_message') {
    appendMinecraftChatMessage(payload.data);
  } else if (payload.event === 'server_event') {
    appendMinecraftEventNotice(payload.data);
  } else if (payload.event === 'heartbeat' || payload.event === 'server_paired') {
    updateGroupLiveMetrics(payload.data);
  }
}

export function renderGroupView(group) {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  const isOnline = group.status === 'online';
  const statusBadge = isOnline ?
    `<span class="mc-status-badge online"><span class="mc-dot"></span>En ligne (${group.players?.length || 0} joueurs)</span>` :
    group.status === 'pending' ?
    `<span class="mc-status-badge pending"><span class="mc-dot"></span>En attente /pair</span>` :
    `<span class="mc-status-badge offline"><span class="mc-dot"></span>Hors ligne</span>`;

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header">
      <div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div>
      <div style="cursor:pointer;" onclick="showMinecraftView()">⛏️</div>
      <span class="ch-name">${escHtml(group.name)}</span>
      <span class="ch-desc" onclick="copyIp('${group.ip}:${group.port}')" title="Cliquez pour copier" style="cursor:pointer;">
        📋 ${escHtml(group.ip)}:${group.port}
      </span>
      <div class="mc-header-actions">
        ${statusBadge}
        <button class="btn btn-ghost" style="padding:6px 12px;font-size:12px;" onclick="downloadPluginModal()">📦 Plugin</button>
      </div>
    </div>
    <div class="mc-nav-tabs">
      <button class="mc-tab-btn ${S.activeMinecraftTab === 'chat' ? 'active' : ''}" onclick="switchMinecraftTab('chat')">💬 # minecraft-chat</button>
      <button class="mc-tab-btn ${S.activeMinecraftTab === 'map' ? 'active' : ''}" onclick="switchMinecraftTab('map')">🗺️ Carte du monde</button>
      <button class="mc-tab-btn ${S.activeMinecraftTab === 'players' ? 'active' : ''}" onclick="switchMinecraftTab('players')">👥 Joueurs (${group.players?.length || 0})</button>
      <button class="mc-tab-btn ${S.activeMinecraftTab === 'settings' ? 'active' : ''}" onclick="switchMinecraftTab('settings')">⚙️ Paramètres & Liaison</button>
    </div>
    <div id="mc-tab-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
      <!-- Tab content loaded here -->
    </div>
  </div>`;

  renderMinecraftCurrentTab(group);
}

export function switchMinecraftTab(tab) {
  S.activeMinecraftTab = tab;
  document.querySelectorAll('.mc-tab-btn').forEach((b, i) => {
    b.classList.toggle('active',
      (tab === 'chat' && i === 0) ||
      (tab === 'map' && i === 1) ||
      (tab === 'players' && i === 2) ||
      (tab === 'settings' && i === 3)
    );
  });
  fetchMinecraftGroup(S.activeMinecraftGroup).then(group => {
    if (group) renderMinecraftCurrentTab(group);
  });
}

function renderMinecraftCurrentTab(group) {
  const container = document.getElementById('mc-tab-content');
  if (!container) return;

  if (S.activeMinecraftTab === 'chat') {
    renderMinecraftChatTab(group, container);
  } else if (S.activeMinecraftTab === 'map') {
    renderMinecraftMapTab(group, container);
  } else if (S.activeMinecraftTab === 'players') {
    renderMinecraftPlayersTab(group, container);
  } else if (S.activeMinecraftTab === 'settings') {
    renderMinecraftSettingsTab(group, container);
  }
}

// 💬 Chat Tab
async function renderMinecraftChatTab(group, container) {
  let msgs = [];
  try {
    const res = await fetch(`/api/minecraft/groups/${group.id}/messages`);
    if (res.ok) msgs = await res.json();
  } catch(e) {}

  let messagesHtml = msgs.map(m => {
    if (m.type === 'system' || m.type === 'join' || m.type === 'quit' || m.type === 'death') {
      const cls = m.type === 'join' ? 'join' : m.type === 'quit' ? 'quit' : 'death';
      const icon = m.type === 'join' ? '🟢' : m.type === 'quit' ? '🔴' : '⚔️';
      return `<div class="mc-event-notice ${cls}">${icon} <strong>${escHtml(m.author)}</strong> ${escHtml(m.content)} <span style="font-size:10px;color:var(--text3);margin-left:6px;">${timeAgo(m.timestamp)}</span></div>`;
    }

    const avatarUrl = m.isMinecraft && m.author ?
      `https://minotar.net/avatar/${encodeURIComponent(m.author)}/36.png` :
      null;

    const avatarContent = avatarUrl ?
      `<img src="${avatarUrl}" class="mc-chat-avatar" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 10%22><rect fill=%22%2322c55e%22 width=%2210%22 height=%2210%22/></svg>';" alt=""/>` :
      `<div class="msg-avatar" style="width:36px;height:36px;font-size:13px;background:var(--grad);">${escHtml((m.author || 'U').slice(0, 2).toUpperCase())}</div>`;

    return `<div class="mc-chat-msg">
      ${avatarContent}
      <div class="mc-chat-body">
        <div class="mc-chat-meta">
          <span class="mc-chat-player" style="${!m.isMinecraft ? 'color:var(--accent1)' : ''}">${escHtml(m.author)}</span>
          <span class="msg-badge ${m.isMinecraft ? 'mc' : 'nitro'}">${m.isMinecraft ? 'MINECRAFT' : 'HMD TALK'}</span>
          <span class="mc-chat-time">${timeAgo(m.timestamp)}</span>
        </div>
        <div class="mc-chat-text">${formatMsg(m.content)}</div>
      </div>
    </div>`;
  }).join('');

  if (!msgs.length) {
    messagesHtml = `<div style="padding:48px 16px;text-align:center;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:8px;">⛏️</div>
      <div style="font-size:16px;font-weight:700;">Salon # minecraft-chat synchronisé</div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px;">Les messages envoyés ici sont retransmis en jeu, et vice-versa !</div>
    </div>`;
  }

  container.innerHTML = `
    <div class="messages-area" id="mc-messages-area">${messagesHtml}</div>
    <div class="input-area" style="position:relative;">
      <div class="msg-input-wrap">
        <span style="color:var(--green);font-weight:700;font-size:13px;padding-left:4px;">⛏️ In-Game</span>
        <textarea class="msg-input" id="mc-chat-input" placeholder="Envoyer un message aux joueurs sur ${escHtml(group.name)}..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMinecraftChat('${group.id}');}"></textarea>
        <button class="msg-input-btn" style="color:var(--green);" onclick="sendMinecraftChat('${group.id}')">➤</button>
      </div>
    </div>`;

  setTimeout(() => {
    const el = document.getElementById('mc-messages-area');
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}

// Send chat message
export async function sendMinecraftChat(groupId) {
  const inp = document.getElementById('mc-chat-input');
  if (!inp) return;
  const content = inp.value.trim();
  if (!content) return;

  inp.value = '';
  try {
    const res = await fetch(`/api/minecraft/groups/${groupId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: S.users[S.me]?.username || S.me || 'Membre HMD',
        authorId: S.me,
        content
      })
    });
    if (res.ok) {
      const msg = await res.json();
      appendMinecraftChatMessage(msg);
    } else {
      const err = await res.json();
      if (window.showToast) window.showToast('Chat', err.error || 'Erreur envoi', '#ef4444', '!');
    }
  } catch (e) {
    if (window.showToast) window.showToast('Erreur', 'Impossible d\'envoyer le message.', '#ef4444', '!');
  }
}

function appendMinecraftChatMessage(m) {
  const area = document.getElementById('mc-messages-area');
  if (!area) return;

  const avatarUrl = m.isMinecraft && m.author ?
    `https://minotar.net/avatar/${encodeURIComponent(m.author)}/36.png` :
    null;

  const avatarContent = avatarUrl ?
    `<img src="${avatarUrl}" class="mc-chat-avatar" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 10%22><rect fill=%22%2322c55e%22 width=%2210%22 height=%2210%22/></svg>';" alt=""/>` :
    `<div class="msg-avatar" style="width:36px;height:36px;font-size:13px;background:var(--grad);">${escHtml((m.author || 'U').slice(0, 2).toUpperCase())}</div>`;

  const div = document.createElement('div');
  div.className = 'mc-chat-msg';
  div.innerHTML = `${avatarContent}
    <div class="mc-chat-body">
      <div class="mc-chat-meta">
        <span class="mc-chat-player" style="${!m.isMinecraft ? 'color:var(--accent1)' : ''}">${escHtml(m.author)}</span>
        <span class="msg-badge ${m.isMinecraft ? 'mc' : 'nitro'}">${m.isMinecraft ? 'MINECRAFT' : 'HMD TALK'}</span>
        <span class="mc-chat-time">${timeAgo(m.timestamp)}</span>
      </div>
      <div class="mc-chat-text">${formatMsg(m.content)}</div>
    </div>`;

  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function appendMinecraftEventNotice(m) {
  const area = document.getElementById('mc-messages-area');
  if (!area) return;
  const cls = m.type === 'join' ? 'join' : m.type === 'quit' ? 'quit' : 'death';
  const icon = m.type === 'join' ? '🟢' : m.type === 'quit' ? '🔴' : '⚔️';
  const div = document.createElement('div');
  div.className = `mc-event-notice ${cls}`;
  div.innerHTML = `${icon} <strong>${escHtml(m.author)}</strong> ${escHtml(m.content)} <span style="font-size:10px;color:var(--text3);margin-left:6px;">${timeAgo(m.timestamp)}</span>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function updateGroupLiveMetrics(data) {
  // Update player pins or metrics
  if (S.activeMinecraftTab === 'map' && data.players) {
    drawMinecraftMap(data.players);
  }
}

// 🗺️ Interactive World Map Tab
function renderMinecraftMapTab(group, container) {
  const hasWebmap = !!group.webmapUrl;
  const isOnline = group.status === 'online';

  container.innerHTML = `
  <div class="mc-map-container">
    <div class="mc-map-toolbar">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:14px;font-weight:700;">Dimension :</span>
        <select onchange="setMapDimension(this.value)" style="padding:6px 10px;border-radius:6px;background:var(--bg3);color:var(--text1);border:1px solid var(--border);font-size:13px;">
          <option value="overworld" ${selectedDimension === 'overworld' ? 'selected' : ''}>🌲 Overworld</option>
          <option value="the_nether" ${selectedDimension === 'the_nether' ? 'selected' : ''}>🔥 Nether</option>
          <option value="the_end" ${selectedDimension === 'the_end' ? 'selected' : ''}>🌌 The End</option>
        </select>
        <span style="font-size:12px;color:var(--text2);">
          ${group.players ? group.players.length : 0} joueur(s) visible(s)
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="zoomMap(1.2)">🔍 +</button>
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="zoomMap(0.8)">🔍 -</button>
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="resetMap()">⟲ Centrer</button>
        ${hasWebmap ? `<button class="btn btn-mc" style="padding:5px 10px;font-size:12px;" onclick="openWebmap('${group.webmapUrl}')">🌐 Ouvrir Webmap</button>` : ''}
      </div>
    </div>
    ${!isOnline ? `
      <div style="background:rgba(239,68,68,.12);border-bottom:1px solid rgba(239,68,68,.3);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#fca5a5;">
        <span>⚠️ Le serveur n'est pas connecté. Les positions des joueurs seront disponibles dès l'appairage.</span>
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="switchMinecraftTab('settings')">Associer /pair</button>
      </div>` : ''}
    <div class="mc-map-view" id="map-view-container">
      <canvas id="mc-map-canvas" class="mc-map-canvas"></canvas>
      <div id="map-player-tooltip" style="position:absolute;display:none;background:rgba(13,15,19,.9);border:1px solid var(--border);border-radius:8px;padding:8px 12px;pointer-events:none;z-index:20;font-size:12px;"></div>
    </div>
    <!-- Setup helper card when Dynmap/BlueMap is not configured -->
    <div style="padding:12px 16px;background:var(--bg2);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:13px;flex-wrap:wrap;gap:8px;">
      <div>
        <strong>💡 Intégration BlueMap & Dynmap :</strong> Vous pouvez intégrer une vue 3D complète de votre monde en renseignant l'URL de votre carte dans les paramètres du groupe !
      </div>
      <button class="btn btn-ghost" style="font-size:12px;padding:5px 12px;" onclick="switchMinecraftTab('settings')">Configurer l'URL Webmap</button>
    </div>
  </div>`;

  setupMapCanvas(group.players || []);
}

function setupMapCanvas(players) {
  setTimeout(() => {
    mapCanvas = document.getElementById('mc-map-canvas');
    if (!mapCanvas) return;
    const container = document.getElementById('map-view-container');
    if (!container) return;

    mapCanvas.width = container.clientWidth;
    mapCanvas.height = container.clientHeight;
    mapCtx = mapCanvas.getContext('2d');

    mapPanX = mapCanvas.width / 2;
    mapPanY = mapCanvas.height / 2;

    // Mouse interactions (pan, zoom)
    mapCanvas.onmousedown = e => {
      isPanning = true;
      startPanX = e.clientX - mapPanX;
      startPanY = e.clientY - mapPanY;
    };
    window.onmousemove = e => {
      if (isPanning) {
        mapPanX = e.clientX - startPanX;
        mapPanY = e.clientY - startPanY;
        drawMinecraftMap(players);
      }
    };
    window.onmouseup = () => { isPanning = false; };

    mapCanvas.onwheel = e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      mapZoom = Math.max(0.2, Math.min(5, mapZoom * factor));
      drawMinecraftMap(players);
    };

    drawMinecraftMap(players);
  }, 50);
}

function drawMinecraftMap(players) {
  if (!mapCanvas || !mapCtx) return;
  const ctx = mapCtx;
  const w = mapCanvas.width;
  const h = mapCanvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background grid
  ctx.save();
  ctx.translate(mapPanX, mapPanY);
  ctx.scale(mapZoom, mapZoom);

  // Axis lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1 / mapZoom;
  ctx.beginPath();
  ctx.moveTo(-2000, 0); ctx.lineTo(2000, 0);
  ctx.moveTo(0, -2000); ctx.lineTo(0, 2000);
  ctx.stroke();

  // Grid circles for radar (100 blocks, 250 blocks, 500 blocks)
  [100, 250, 500, 1000].forEach(rad => {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
    ctx.font = `${10 / mapZoom}px monospace`;
    ctx.fillText(`${rad}m`, rad + 4, -4);
  });

  // Center (Spawn 0,0)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, 4 / mapZoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${11 / mapZoom}px sans-serif`;
  ctx.fillText('Spawn (0,0)', 8 / mapZoom, 4 / mapZoom);

  // Filter players by current dimension
  const dimPlayers = (players || []).filter(p => !p.dimension || p.dimension.toLowerCase().includes(selectedDimension));

  dimPlayers.forEach(p => {
    const px = p.x || 0;
    const pz = p.z || 0;

    // Player marker
    ctx.save();
    ctx.translate(px, pz);

    // Direction indicator
    if (typeof p.yaw === 'number') {
      ctx.save();
      ctx.rotate((p.yaw * Math.PI) / 180);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, -18 / mapZoom);
      ctx.lineTo(8 / mapZoom, 0);
      ctx.lineTo(-8 / mapZoom, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Pin circle
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, 0, 7 / mapZoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / mapZoom;
    ctx.stroke();

    // Name label
    ctx.font = `bold ${12 / mapZoom}px Segoe UI, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p.name, 10 / mapZoom, 4 / mapZoom);

    // Coordinates
    ctx.font = `${10 / mapZoom}px monospace`;
    ctx.fillStyle = '#a0aec0';
    ctx.fillText(`X:${Math.round(px)} Y:${Math.round(p.y || 64)} Z:${Math.round(pz)}`, 10 / mapZoom, 16 / mapZoom);

    ctx.restore();
  });

  ctx.restore();
}

export function zoomMap(factor) {
  mapZoom = Math.max(0.2, Math.min(5, mapZoom * factor));
  fetchMinecraftGroup(S.activeMinecraftGroup).then(g => {
    if (g) drawMinecraftMap(g.players || []);
  });
}

export function resetMap() {
  if (!mapCanvas) return;
  mapZoom = 1;
  mapPanX = mapCanvas.width / 2;
  mapPanY = mapCanvas.height / 2;
  fetchMinecraftGroup(S.activeMinecraftGroup).then(g => {
    if (g) drawMinecraftMap(g.players || []);
  });
}

export function setMapDimension(dim) {
  selectedDimension = dim;
  fetchMinecraftGroup(S.activeMinecraftGroup).then(g => {
    if (g) drawMinecraftMap(g.players || []);
  });
}

export function openWebmap(url) {
  if (url) window.open(url, '_blank');
}

// 👥 Players Tab
function renderMinecraftPlayersTab(group, container) {
  const players = group.players || [];
  let html = `<div style="padding:24px;overflow-y:auto;flex:1;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <h3 style="font-size:18px;font-weight:700;">Joueurs connectés (${players.length})</h3>
        <p style="font-size:13px;color:var(--text2);">Liste en temps réel synchronisée avec le serveur Minecraft.</p>
      </div>
      <div style="display:flex;gap:8px;">
        <span class="mc-tag">TPS: ${group.tps || 20}</span>
        <span class="mc-tag">RAM: ${group.ramUsedMb || 0} / ${group.ramMaxMb || 4096} MB</span>
      </div>
    </div>`;

  if (!players.length) {
    html += `<div style="text-align:center;padding:48px;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:8px;">👤</div>
      <div>Aucun joueur actuellement connecté au serveur.</div>
    </div>`;
  } else {
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">`;
    players.forEach(p => {
      const dimLabel = p.dimension === 'the_nether' ? '🔥 Nether' : p.dimension === 'the_end' ? '🌌 The End' : '🌲 Overworld';
      const healthHearts = Math.round(p.health / 2);
      html += `<div class="mc-player-card-compact">
        <img src="https://minotar.net/avatar/${encodeURIComponent(p.name)}/40.png" style="width:40px;height:40px;border-radius:6px;image-rendering:pixelated;" alt=""/>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;">
            <span>${escHtml(p.name)}</span>
            <span style="font-size:11px;color:var(--green);">${p.ping || 0}ms</span>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px;">
            ${dimLabel} · ❤️ ${healthHearts}/10
          </div>
          <div class="mc-coord-pill" style="margin-top:4px;">
            X: ${Math.round(p.x || 0)} Y: ${Math.round(p.y || 64)} Z: ${Math.round(p.z || 0)}
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// ⚙️ Settings Tab (Pairing code generation & server configuration)
function renderMinecraftSettingsTab(group, container) {
  const isLinked = group.status === 'online';

  container.innerHTML = `
  <div style="padding:24px;overflow-y:auto;flex:1;max-width:760px;margin:0 auto;width:100%;">
    <h3 style="font-size:18px;font-weight:800;margin-bottom:4px;">Liaison & Paramètres du serveur</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:20px;">Associez votre serveur Minecraft Paper, Spigot, Purpur, Fabric ou Forge avec HMD Talk.</p>

    <!-- PAIRING CARD -->
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;">
          <span>🔑 Appairage du serveur</span>
          <span class="mc-status-badge ${group.status}"><span class="mc-dot"></span>${isLinked ? 'Connecté' : 'Non associé'}</span>
        </div>
        ${isLinked ? `<button class="btn btn-danger" style="font-size:12px;padding:5px 12px;" onclick="unlinkMinecraftServer('${group.id}')">Dissocier le serveur</button>` : ''}
      </div>

      <p style="font-size:13px;color:var(--text2);line-height:1.5;">
        Pour lier votre serveur Minecraft à ce groupe, installez le plugin HMD Minecraft, puis générez un code unique et exécutez la commande en jeu.
      </p>

      <div id="pair-code-container">
        <button class="btn btn-mc" style="margin-top:12px;" onclick="generatePairingCode('${group.id}')">⚡ Générer un code de jumelage</button>
      </div>

      <div style="margin-top:16px;background:var(--bg4);border-radius:10px;padding:14px;font-size:13px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="font-weight:700;color:var(--text1);">📥 Fichier du Plugin / Mod :</div>
          <a href="/api/minecraft/download/HMDMinecraft-1.0.0.jar" download class="btn btn-mc" style="text-decoration:none;padding:5px 12px;font-size:12px;">⬇️ Télécharger HMDMinecraft-1.0.0.jar</a>
        </div>
        <div style="font-weight:700;margin-bottom:6px;color:var(--text1);">Instructions d'installation :</div>
        <ol style="margin-left:20px;color:var(--text2);line-height:1.6;">
          <li>Téléchargez <code>HMDMinecraft-1.0.0.jar</code>.</li>
          <li>Placez le fichier dans le dossier <code>plugins/</code> (Paper/Spigot/Purpur) ou <code>mods/</code> (Fabric/Forge) de votre serveur.</li>
          <li>Redémarrez votre serveur Minecraft.</li>
          <li>En jeu (ou dans la console), exécutez la commande : <code>/pair CODE</code> avec le code ci-dessus !</li>
        </ol>
      </div>
    </div>

    <!-- SERVER DETAILS FORM -->
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px;">
      <h4 style="font-size:15px;font-weight:700;margin-bottom:16px;">Informations du serveur</h4>
      <div class="field">
        <label>Nom du groupe</label>
        <input type="text" id="set-mc-name" value="${escHtml(group.name)}"/>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="set-mc-desc">${escHtml(group.description || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
        <div class="field">
          <label>Adresse IP ou Domaine</label>
          <input type="text" id="set-mc-ip" value="${escHtml(group.ip)}"/>
        </div>
        <div class="field">
          <label>Port</label>
          <input type="number" id="set-mc-port" value="${group.port || 25565}"/>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="field">
          <label>Type de serveur (Loader)</label>
          <select id="set-mc-loader">
            <option value="Paper" ${group.loader === 'Paper' ? 'selected' : ''}>Paper (Recommandé)</option>
            <option value="Purpur" ${group.loader === 'Purpur' ? 'selected' : ''}>Purpur</option>
            <option value="Spigot" ${group.loader === 'Spigot' ? 'selected' : ''}>Spigot</option>
            <option value="Fabric" ${group.loader === 'Fabric' ? 'selected' : ''}>Fabric</option>
            <option value="Forge" ${group.loader === 'Forge' ? 'selected' : ''}>Forge</option>
            <option value="NeoForge" ${group.loader === 'NeoForge' ? 'selected' : ''}>NeoForge</option>
          </select>
        </div>
        <div class="field">
          <label>Version Minecraft</label>
          <input type="text" id="set-mc-version" value="${escHtml(group.version || '26.1.2')}"/>
        </div>
      </div>
      <div class="field">
        <label>URL Carte Dynmap / BlueMap (Optionnel)</label>
        <input type="text" id="set-mc-webmap" placeholder="http://monserveur.fr:8100/" value="${escHtml(group.webmapUrl || '')}"/>
      </div>
      <div class="btn-row">
        <button class="btn btn-mc" onclick="saveMinecraftSettings('${group.id}')">Enregistrer les modifications</button>
      </div>
    </div>
  </div>`;
}

// Generate temporary pairing code
export async function generatePairingCode(groupId) {
  const container = document.getElementById('pair-code-container');
  if (container) container.innerHTML = `<div style="color:var(--text2);padding:10px;">Génération du code sécurisé...</div>`;

  try {
    const res = await fetch('/api/minecraft/pair/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, userId: S.me })
    });
    const data = await res.json();
    if (res.ok && data.code) {
      if (container) {
        container.innerHTML = `
        <div class="pair-code-box">
          <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;">Code de connexion temporaire (valide 15 min)</div>
          <div class="pair-code-text">${data.code}</div>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button class="btn btn-mc" onclick="copyCommand('/pair ${data.code}')">📋 Copier /pair ${data.code}</button>
            <button class="btn btn-ghost" onclick="generatePairingCode('${groupId}')">⟲ Renouveler</button>
          </div>
          <div style="font-size:12px;color:var(--text3);margin-top:8px;">Usage unique. Le code sera automatiquement invalidé une fois la liaison établie.</div>
        </div>`;
      }
      if (window.showToast) window.showToast('Code généré', `Exécutez /pair ${data.code} sur votre serveur`, 'var(--green)', '🔑');
    } else {
      if (container) container.innerHTML = `<div style="color:var(--red);">${data.error || 'Erreur'}</div>`;
    }
  } catch (e) {
    if (container) container.innerHTML = `<div style="color:var(--red);">Impossible de générer le code.</div>`;
  }
}

export function copyCommand(text) {
  navigator.clipboard.writeText(text).then(() => {
    if (window.showToast) window.showToast('Copié !', text, 'var(--green)', '📋');
  });
}

export function copyIp(ip) {
  navigator.clipboard.writeText(ip).then(() => {
    if (window.showToast) window.showToast('Adresse copiée !', ip, 'var(--green)', '📋');
  });
}

export async function unlinkMinecraftServer(groupId) {
  if (!confirm('Voulez-vous vraiment déconnecter ce serveur Minecraft du groupe ?')) return;

  try {
    const res = await fetch(`/api/minecraft/groups/${groupId}/unlink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: S.me })
    });
    if (res.ok) {
      if (window.showToast) window.showToast('Serveur dissocié', 'Le serveur a été déconnecté.', 'var(--yellow)', '✓');
      openMinecraftGroup(groupId);
    }
  } catch (e) {}
}

export async function saveMinecraftSettings(groupId) {
  const name = document.getElementById('set-mc-name')?.value.trim();
  const description = document.getElementById('set-mc-desc')?.value.trim();
  const ip = document.getElementById('set-mc-ip')?.value.trim();
  const port = parseInt(document.getElementById('set-mc-port')?.value || '25565');
  const loader = document.getElementById('set-mc-loader')?.value;
  const version = document.getElementById('set-mc-version')?.value.trim();
  const webmapUrl = document.getElementById('set-mc-webmap')?.value.trim();

  if (!name) {
    if (window.showToast) window.showToast('Erreur', 'Nom requis', '#ef4444', '!');
    return;
  }

  try {
    const res = await fetch(`/api/minecraft/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, ip, port, loader, version, webmapUrl })
    });
    if (res.ok) {
      if (window.showToast) window.showToast('Succès', 'Paramètres mis à jour', 'var(--green)', '✓');
      openMinecraftGroup(groupId);
    }
  } catch (e) {}
}

// Modal : Create new Minecraft Group
export function openCreateMinecraftGroup() {
  const modals = document.getElementById('modals');
  if (!modals) return;

  modals.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
    <div class="modal">
      <button class="modal-close" onclick="closeAllModals()">✕</button>
      <h2>⛏️ Créer un groupe Minecraft</h2>
      <div class="field">
        <label>Nom du groupe</label>
        <input type="text" id="new-mc-name" placeholder="ex: Mon Serveur Survie"/>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="new-mc-desc" placeholder="Parlez de votre serveur, mode de jeu, règles..."></textarea>
      </div>
      <div class="field">
        <label>Icône / Logo (Emoji)</label>
        <input type="text" id="new-mc-logo" value="⛏️" maxlength="2"/>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
        <div class="field">
          <label>Adresse IP ou Domaine</label>
          <input type="text" id="new-mc-ip" placeholder="ex: play.monserveur.fr"/>
        </div>
        <div class="field">
          <label>Port</label>
          <input type="number" id="new-mc-port" value="25565"/>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="field">
          <label>Type de serveur</label>
          <select id="new-mc-loader">
            <option value="Paper">Paper</option>
            <option value="Purpur">Purpur</option>
            <option value="Spigot">Spigot</option>
            <option value="Fabric">Fabric</option>
            <option value="Forge">Forge</option>
            <option value="NeoForge">NeoForge</option>
          </select>
        </div>
        <div class="field">
          <label>Version Minecraft</label>
          <select id="new-mc-version">
            <option value="26.1.2" selected>26.1.2 (Recommandé / Dernière)</option>
            <option value="1.21.4">1.21.4</option>
            <option value="1.21.1">1.21.1</option>
            <option value="1.20.4">1.20.4</option>
            <option value="1.20.1">1.20.1</option>
            <option value="1.19.4">1.19.4</option>
            <option value="1.16.5">1.16.5</option>
          </select>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" onclick="closeAllModals()">Annuler</button>
        <button class="btn btn-mc" onclick="submitCreateMinecraftGroup()">Créer le groupe 🚀</button>
      </div>
    </div>
  </div>`;
}

export async function submitCreateMinecraftGroup() {
  const name = document.getElementById('new-mc-name')?.value.trim();
  const description = document.getElementById('new-mc-desc')?.value.trim();
  const logo = document.getElementById('new-mc-logo')?.value.trim() || '⛏️';
  const ip = document.getElementById('new-mc-ip')?.value.trim() || '127.0.0.1';
  const port = parseInt(document.getElementById('new-mc-port')?.value || '25565');
  const loader = document.getElementById('new-mc-loader')?.value || 'Paper';
  const version = document.getElementById('new-mc-version')?.value || '26.1.2';

  if (!name || name.length < 2) {
    if (window.showToast) window.showToast('Erreur', 'Nom invalide', '#ef4444', '!');
    return;
  }

  try {
    const res = await fetch('/api/minecraft/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, description, logo, ip, port, loader, version,
        ownerId: S.me || 'user'
      })
    });
    if (res.ok) {
      const group = await res.json();
      if (window.closeAllModals) window.closeAllModals();
      if (window.showToast) window.showToast('Groupe créé !', group.name, 'var(--green)', logo);
      openMinecraftGroup(group.id);
    }
  } catch (e) {
    if (window.showToast) window.showToast('Erreur', 'Création échouée', '#ef4444', '!');
  }
}

// Modal : Download Plugin & Source Instructions
export function downloadPluginModal() {
  const modals = document.getElementById('modals');
  if (!modals) return;

  modals.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
    <div class="modal" style="width:640px;">
      <button class="modal-close" onclick="closeAllModals()">✕</button>
      <h2>📦 Télécharger le Plugin HMD Minecraft</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px;">
        Voici le fichier prêt à être déposé directement sur votre serveur Minecraft (compatible versions <strong>26.1.2</strong>, 1.21.x, 1.20.x, 1.16.5).
      </p>

      <!-- DIRECT DOWNLOAD SECTION -->
      <div style="background:linear-gradient(135deg, rgba(34,197,94,0.18), rgba(6,182,212,0.15));border:1.5px solid rgba(34,197,94,0.4);border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:4px;">⬇️ Téléchargement direct (1 clic) :</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px;">Fichier .JAR compilé et testé, prêt à être exécuté.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="/api/minecraft/download/HMDMinecraft-1.0.0.jar" download="HMDMinecraft-1.0.0.jar" class="btn btn-mc" style="text-decoration:none;padding:10px 16px;font-size:13px;font-weight:800;">
            ⬇️ Télécharger HMDMinecraft-1.0.0.jar
          </a>
          <a href="/api/minecraft/download/source.zip" download="hmd-minecraft-source.zip" class="btn btn-ghost" style="text-decoration:none;padding:10px 14px;font-size:13px;">
            📁 Télécharger le code source (.ZIP)
          </a>
        </div>
      </div>

      <!-- WHERE TO PUT IT -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:14px;color:var(--green);margin-bottom:8px;">📁 Où mettre ce fichier sur votre serveur ?</div>
        <div style="font-size:13px;color:var(--text1);line-height:1.6;">
          <p style="margin-bottom:8px;">
            • <strong>Pour Paper, Spigot, Purpur :</strong> Déposez le fichier <code>HMDMinecraft-1.0.0.jar</code> dans le dossier <code>plugins/</code> de votre serveur.
          </p>
          <p style="margin-bottom:8px;">
            • <strong>Pour Fabric, Forge, NeoForge :</strong> Déposez le fichier dans le dossier <code>mods/</code> de votre serveur.
          </p>
          <p style="margin-bottom:0;color:var(--text2);">
            • <strong>Ensuite :</strong> Démarrez le serveur, connectez-vous avec les droits opérateur et tapez : <code>/pair CODE</code> avec le code de votre groupe HMD Talk !
          </p>
        </div>
      </div>

      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">Commandes disponibles sur le serveur :</div>
        <ul style="font-size:12px;color:var(--text2);line-height:1.6;margin-left:20px;">
          <li><code>/pair &lt;CODE&gt;</code> - Associe le serveur au groupe HMD</li>
          <li><code>/hmd status</code> - Vérifie la connexion au backend</li>
          <li><code>/hmd chat &lt;msg&gt;</code> - Envoie un message dans HMD Talk</li>
          <li><code>/hmd unlink</code> - Dissocie le serveur</li>
        </ul>
      </div>

      <div class="btn-row">
        <button class="btn btn-ghost" onclick="closeAllModals()">Fermer</button>
      </div>
    </div>
  </div>`;
}

export function copyMavenCommand() {
  copyCommand('cd minecraft-plugin && mvn clean package');
}

/* ============================================================
   ADMIN SPACE (Code 1937) - STRICTLY VERIFIED ON SERVER
============================================================ */

export function openAdminAuthModal() {
  // If already authenticated, open dashboard directly
  if (S.adminToken) {
    renderAdminDashboard();
    return;
  }

  const modals = document.getElementById('modals');
  if (!modals) return;

  modals.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
    <div class="modal" style="width:400px;text-align:center;">
      <button class="modal-close" onclick="closeAllModals()">✕</button>
      <div style="font-size:44px;margin-bottom:8px;">🛡️</div>
      <h2 style="font-size:20px;margin-bottom:6px;">Espace Administrateur</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:20px;">Entrez le code de sécurité administrateur pour accéder à la console et la gestion des serveurs.</p>
      <div class="field">
        <input type="password" id="admin-code-input" placeholder="Code secret..." style="text-align:center;font-size:22px;letter-spacing:6px;font-family:monospace;" onkeydown="if(event.key==='Enter')loginAdmin()"/>
      </div>
      <div id="admin-err-msg" style="color:var(--red);font-size:13px;margin-bottom:12px;"></div>
      <button class="btn btn-danger" style="width:100%;padding:12px;" onclick="loginAdmin()">Déverrouiller l'accès 🔐</button>
    </div>
  </div>`;

  setTimeout(() => {
    const inp = document.getElementById('admin-code-input');
    if (inp) inp.focus();
  }, 100);
}

export async function loginAdmin() {
  const inp = document.getElementById('admin-code-input');
  const errEl = document.getElementById('admin-err-msg');
  if (!inp) return;
  const code = inp.value.trim();

  if (!code) {
    if (errEl) errEl.textContent = 'Code requis.';
    return;
  }

  if (errEl) errEl.textContent = 'Vérification sécurisée en cours...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      S.adminToken = data.token;
      sessionStorage.setItem('hmd_admin_token', data.token);
      if (window.closeAllModals) window.closeAllModals();
      if (window.showToast) window.showToast('Accès Administrateur', 'Session validée avec succès.', 'var(--green)', '🛡️');
      renderAdminDashboard();
    } else {
      if (errEl) errEl.textContent = data.error || 'Code invalide.';
    }
  } catch (e) {
    if (errEl) errEl.textContent = 'Erreur de connexion.';
  }
}

export async function renderAdminDashboard() {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  let servers = [];
  let logs = [];
  try {
    const [srvRes, logRes] = await Promise.all([
      fetch('/api/admin/servers', { headers: { 'X-Admin-Token': S.adminToken } }),
      fetch('/api/admin/logs', { headers: { 'X-Admin-Token': S.adminToken } })
    ]);
    if (srvRes.ok) servers = await srvRes.json();
    if (logRes.ok) logs = await logRes.json();
  } catch (e) {}

  let serversRows = servers.map(s => {
    const isOnline = s.status === 'online';
    const statusCls = isOnline ? 'online' : s.hasToken ? 'offline' : 'pending';
    const statusText = isOnline ? 'En ligne' : s.hasToken ? 'Hors ligne' : 'Non appairé';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:180px;">
        <div style="font-weight:700;font-size:14px;">${escHtml(s.name)}</div>
        <div style="font-size:12px;color:var(--text3);">${escHtml(s.ip)}:${s.port} · ${s.loader} ${s.version}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="mc-tag">TPS: ${s.tps || 0}</span>
        <span class="mc-tag">RAM: ${s.ramUsedMb || 0}MB</span>
        <span class="mc-tag">${s.playersCount} Joueur(s)</span>
        <span class="mc-status-badge ${statusCls}"><span class="mc-dot"></span>${statusText}</span>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px;" onclick="sendAdminConsole('${s.id}')">Console</button>
        <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px;color:var(--yellow);" onclick="adminPowerAction('${s.id}','restart')">⟲ Redémarrer</button>
        <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px;color:var(--red);" onclick="adminPowerAction('${s.id}','stop')">⏹ Arrêter</button>
      </div>
    </div>`;
  }).join('');

  if (!servers.length) {
    serversRows = `<div style="padding:20px;text-align:center;color:var(--text3);">Aucun serveur répertorié.</div>`;
  }

  let logsRows = logs.slice(0, 30).map(l => {
    return `<div style="font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;gap:8px;">
      <span style="color:var(--text3);font-family:monospace;">${new Date(l.timestamp).toLocaleTimeString()}</span>
      <span style="color:var(--green);font-weight:700;">[${escHtml(l.action)}]</span>
      <span style="color:var(--text2);">${escHtml(l.details)}</span>
    </div>`;
  }).join('');

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header">
      <div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div>
      <span style="font-size:22px;">🛡️</span>
      <span class="ch-name">Panneau d'Administration HMD</span>
      <span class="admin-badge">SÉCURISÉ</span>
      <div class="mc-header-actions">
        <button class="btn btn-ghost" style="font-size:12px;" onclick="renderAdminDashboard()">⟲ Actualiser</button>
        <button class="btn btn-danger" style="font-size:12px;" onclick="logoutAdmin()">Fermer la session</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:24px;">
      <div style="max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:24px;">
        <!-- SERVERS OVERVIEW -->
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px;">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">Serveurs Minecraft connectés</h3>
          <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg2);">
            ${serversRows}
          </div>
        </div>

        <!-- CONSOLE COMMAND DISPATCH -->
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px;">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">Console du serveur à distance</h3>
          <p style="font-size:13px;color:var(--text2);margin-bottom:14px;">Envoyez des commandes aux serveurs connectés (say, kick, whitelist, time, weather...).</p>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <select id="admin-target-server" style="padding:10px;background:var(--bg4);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:13px;">
              ${servers.map(s => `<option value="${s.id}">${escHtml(s.name)} (${s.status})</option>`).join('')}
            </select>
            <input type="text" id="admin-console-cmd" placeholder="Commande (ex: say Bonjour les mineurs, kick Joueur...)" style="flex:1;padding:10px 14px;background:var(--bg4);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-family:monospace;outline:none;" onkeydown="if(event.key==='Enter')executeAdminConsoleCmd()"/>
            <button class="btn btn-mc" onclick="executeAdminConsoleCmd()">Exécuter ⚡</button>
          </div>
          <div class="console-output" id="admin-console-logs">
            <div class="console-line info">[CONSOLE READY] Prêt à recevoir les commandes administratives.</div>
          </div>
        </div>

        <!-- AUDIT LOGS -->
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px;">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">Journal d'audit & Événements système</h3>
          <div style="max-height:220px;overflow-y:auto;background:var(--bg2);padding:12px;border-radius:8px;border:1px solid var(--border);">
            ${logsRows || '<div style="color:var(--text3);">Aucun log disponible.</div>'}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export async function executeAdminConsoleCmd() {
  const target = document.getElementById('admin-target-server')?.value;
  const inp = document.getElementById('admin-console-cmd');
  const consoleBox = document.getElementById('admin-console-logs');
  if (!target || !inp) return;
  const cmd = inp.value.trim();
  if (!cmd) return;

  inp.value = '';
  if (consoleBox) {
    consoleBox.innerHTML += `<div class="console-line">&gt; ${escHtml(cmd)}</div>`;
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }

  try {
    const res = await fetch('/api/admin/console', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': S.adminToken
      },
      body: JSON.stringify({
        groupId: target,
        command: cmd,
        operator: S.me || 'admin'
      })
    });
    const data = await res.json();
    if (consoleBox) {
      if (res.ok) {
        consoleBox.innerHTML += `<div class="console-line success">✔ ${escHtml(data.message)}</div>`;
      } else {
        consoleBox.innerHTML += `<div class="console-line err">✖ ${escHtml(data.error || 'Erreur')}</div>`;
      }
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }
  } catch (e) {
    if (consoleBox) consoleBox.innerHTML += `<div class="console-line err">✖ Erreur de communication</div>`;
  }
}

export async function adminPowerAction(groupId, action) {
  if (!confirm(`Confirmer l'action "${action.toUpperCase()}" sur ce serveur ?`)) return;

  try {
    const res = await fetch('/api/admin/power', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': S.adminToken
      },
      body: JSON.stringify({
        groupId,
        action,
        operator: S.me || 'admin'
      })
    });
    const data = await res.json();
    if (window.showToast) {
      if (res.ok) window.showToast('Serveur', data.message, 'var(--green)', '⚡');
      else window.showToast('Erreur', data.error, '#ef4444', '!');
    }
    renderAdminDashboard();
  } catch (e) {}
}

export function logoutAdmin() {
  S.adminToken = null;
  sessionStorage.removeItem('hmd_admin_token');
  if (window.showToast) window.showToast('Admin', 'Session fermée', 'var(--text3)', '🔒');
  showMinecraftView();
}
