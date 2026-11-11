import {
  S, AVATAR_COLORS, STATUS_LABELS, EMOJIS, QUICK_REACTS,
  dbGet, dbSet, dbUpdate, dbRemove, dbListen, dbRef,
  uid, initials, avatarColor, timeAgo, formatTime, escHtml,
  getDmKey, timeFromNow
} from './hmd-state.js';

import {
  WR, playRingTone, stopRingTone, buildCallTiles, attachRemoteStream,
  setCallStatus, endCall, toggleCallMic, toggleCallCam, toggleScreenShare,
  toggleMic, toggleDeaf, createSilenceTrack, createBlackTrack, replaceTrackInPC,
  ICE_SERVERS
} from './hmd-webrtc.js';

import {
  showMinecraftView, openCreateMinecraftGroup, submitCreateMinecraftGroup,
  openMinecraftGroup, switchMinecraftTab, sendMinecraftChat, generatePairingCode,
  copyCommand, copyIp, unlinkMinecraftServer, saveMinecraftSettings,
  downloadPluginModal, copyMavenCommand, openAdminAuthModal, loginAdmin,
  renderAdminDashboard, executeAdminConsoleCmd, adminPowerAction, logoutAdmin,
  zoomMap, resetMap, setMapDimension, openWebmap
} from './hmd-minecraft.js';

const STORY_DURATION = 5000;
const TENOR_KEY = 'LIVDSRZULELA';
const TYPING_STALE_MS = 4000;

function saveSession(uid) { localStorage.setItem('hmd_session', uid || ''); }
function loadSession() { return localStorage.getItem('hmd_session') || null; }
function saveSettings() {
  localStorage.setItem('hmd_ringtone_vol', S.ringtoneVolume);
  localStorage.setItem('hmd_ringtone_on', S.ringtoneEnabled ? '1' : '0');
}
function loadSettings() {
  const vol = localStorage.getItem('hmd_ringtone_vol');
  const on = localStorage.getItem('hmd_ringtone_on');
  if (vol !== null) S.ringtoneVolume = parseInt(vol);
  if (on !== null) S.ringtoneEnabled = on === '1';
}

function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', i === (tab === 'login' ? 0 : 1)));
  document.getElementById('login-form')?.classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form')?.classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  const user = document.getElementById('login-user')?.value.trim().toLowerCase();
  const pass = document.getElementById('login-pass')?.value;
  const err = document.getElementById('login-err');
  if (!user || !pass) { if (err) err.textContent = 'Remplis tous les champs !'; return; }
  if (err) err.textContent = 'Connexion...';
  const u = await dbGet('users/' + user);
  if (!u || u.password !== pass) { if (err) err.textContent = 'Identifiants incorrects.'; return; }
  if (err) err.textContent = '';
  S.me = user;
  saveSession(user);
  await enterApp();
}

async function doRegister() {
  const user = document.getElementById('reg-user')?.value.trim();
  const pass = document.getElementById('reg-pass')?.value;
  const pass2 = document.getElementById('reg-pass2')?.value;
  const err = document.getElementById('reg-err');
  if (!user || !pass || !pass2) { if (err) err.textContent = 'Remplis tous les champs !'; return; }
  if (user.length < 2 || user.length > 24) { if (err) err.textContent = 'Pseudo 2-24 caractères.'; return; }
  if (pass.length < 4) { if (err) err.textContent = 'Mot de passe trop court (min 4).'; return; }
  if (pass !== pass2) { if (err) err.textContent = 'Mots de passe différents.'; return; }
  const key = user.toLowerCase();
  if (err) err.textContent = 'Vérification...';
  const existing = await dbGet('users/' + key);
  if (existing) { if (err) err.textContent = 'Ce pseudo est déjà pris !'; return; }

  const newUser = {
    id: key, username: user, password: pass, status: 'online', bio: '',
    banner: null, color: avatarColor(user), theme: 'theme-purple',
    joinedAt: Date.now(), nitro: true, badges: ['nitro'],
    customColor: null, nameColor: null, avatarImg: null
  };
  await dbSet('users/' + key, newUser);

  if (err) {
    err.style.color = '#22c55e';
    err.textContent = 'Compte créé ! Connexion...';
  }
  setTimeout(() => {
    S.me = key;
    saveSession(key);
    enterApp();
  }, 500);
}

async function enterApp() {
  document.getElementById('loading')?.classList.remove('hidden');
  document.getElementById('auth-screen')?.classList.add('hidden');
  const msgEl = document.getElementById('loading-msg');
  if (msgEl) msgEl.textContent = 'Chargement des données...';

  await dbUpdate('users/' + S.me, { status: 'online', lastSeen: Date.now() });
  await loadAllData();

  setTimeout(() => {
    document.getElementById('loading')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    const u = S.users[S.me];
    document.body.className = u && u.theme ? u.theme : 'theme-purple';
    S.theme = u && u.theme ? u.theme : 'theme-purple';
    renderApp();
    showView('home');
    setupListeners();
    listenIncomingCalls();
  }, 600);
}

async function loadAllData() {
  S.users = await dbGet('users') || {};
  S.servers = await dbGet('servers') || {};
  S.channels = await dbGet('channels') || {};
  S.messages = await dbGet('messages') || {};
  S.dms = await dbGet('dms') || {};
  S.friends = await dbGet('friends') || {};
  S.pendingIn = await dbGet('pendingIn') || {};
  S.pendingOut = await dbGet('pendingOut') || {};
  S.stories = await dbGet('stories') || {};
  if (Object.keys(S.servers).length === 0) await seedData();
}

async function seedData() {
  const s1 = 'hmd_official';
  const ch1 = 'ch_hmd_general';
  const ch2 = 'ch_hmd_vocal';
  const now = Date.now();
  await dbSet('servers/' + s1, { id: s1, name: 'HMD Official', icon: '🎮', owner: 'system', color: AVATAR_COLORS[0], members: { [S.me]: true }, desc: 'Serveur officiel HMD Talk' });
  await dbSet('channels/' + ch1, { id: ch1, server: s1, name: 'général', type: 'text', position: 0 });
  await dbSet('channels/' + ch2, { id: ch2, server: s1, name: 'vocal-général', type: 'voice', position: 1 });
  const m1 = uid();
  await dbSet('messages/' + ch1 + '/' + m1, { id: m1, author: 'Talk Bot', content: '👋 Bienvenue sur **HMD Talk** ! Intégration Minecraft ⛏️, Stories 24h et appels vocaux/vidéo.', ts: now - 300000, avatar: AVATAR_COLORS[0], badge: 'mod' });
  S.servers = await dbGet('servers') || {};
  S.channels = await dbGet('channels') || {};
  S.messages = await dbGet('messages') || {};
}

function setupListeners() {
  dbListen('users', val => { S.users = val || {}; renderUserBar(); renderServersBar(); });
  dbListen('servers', val => { S.servers = val || {}; renderServersBar(); });
  dbListen('channels', val => { S.channels = val || {}; if (S.activeServer) renderLeftPanel('server', S.activeServer); });
  dbListen('friends/' + S.me, val => { S.friends[S.me] = val || {}; renderLeftPanel('dm'); if (S.view === 'friends') renderFriendsView(); });
  dbListen('dms', val => {
    S.dms = val || {};
    if (S.activeDm) renderDm(S.activeDm);
    renderLeftPanel('dm');
  });
  dbListen('stories', val => {
    S.stories = val || {};
    if (S.view === 'home' || S.activeDm) renderStoriesBar();
  });
}

function listenIncomingCalls() {
  dbListen('calls/' + S.me + '/incoming', async val => {
    if (!val) return;
    if (S.inCall) {
      await dbSet('calls/' + val.from + '/answer/' + val.callId, { declined: true });
      await dbRemove('calls/' + S.me + '/incoming');
      return;
    }
    showIncomingCall(val);
  });
}

function showIncomingCall(data) {
  const fu = S.users[data.from];
  if (!fu) return;
  const typeLabel = data.type === 'video' ? 'vidéo' : 'vocal';
  playRingTone();
  const avatarContent = fu.avatarImg ?
    `<img src="${fu.avatarImg}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" alt=""/>` :
    `<span style="font-size:16px;font-weight:700;color:#fff;">${initials(fu.username)}</span>`;

  const container = document.getElementById('incoming-call-ui');
  if (!container) return;
  container.innerHTML = `<div class="incoming-call">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div class="ring-pulse" style="width:48px;height:48px;border-radius:50%;background:${fu.color || avatarColor(fu.username)};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">${avatarContent}</div>
      <div><h3>Appel ${typeLabel} entrant</h3><p style="margin:0;">${fu.username} t'appelle...</p></div>
    </div>
    <div class="incoming-call-btns">
      <button class="btn-decline" onclick="declineCall('${data.callId}','${data.from}')">✕ Refuser</button>
      <button class="btn-accept" onclick="acceptCall('${data.callId}','${data.from}','${data.type}','${encodeURIComponent(data.offer || '')}')">✓ Répondre</button>
    </div></div>`;
  container.classList.remove('hidden');
}

async function declineCall(callId, fromId) {
  stopRingTone();
  const ui = document.getElementById('incoming-call-ui');
  if (ui) ui.classList.add('hidden');
  await dbSet('calls/' + fromId + '/answer/' + callId, { declined: true });
  await dbRemove('calls/' + S.me + '/incoming');
}

async function acceptCall(callId, fromId, type, encodedOffer) {
  stopRingTone();
  const ui = document.getElementById('incoming-call-ui');
  if (ui) ui.classList.add('hidden');
  await dbRemove('calls/' + S.me + '/incoming');

  const offerStr = decodeURIComponent(encodedOffer);
  WR.isCaller = false;
  WR.remoteUserId = fromId;
  WR.callId = callId;
  WR.callType = type || 'voice';

  initWebRTCCall(false, offerStr);
}

async function startCall(userId, callType) {
  if (S.inCall) {
    showToast('Déjà en appel', 'Termine l\'appel en cours.', '#ef4444', '!');
    return;
  }
  WR.isCaller = true;
  WR.remoteUserId = userId;
  WR.callId = uid();
  WR.callType = callType || 'voice';
  initWebRTCCall(true, null);
}

async function initWebRTCCall(isCaller, remoteOffer) {
  const callType = WR.callType;
  const fu = S.users[WR.remoteUserId];
  S.inCall = true;
  S.callSec = 0;
  WR.micMuted = false;
  WR.camOff = true;

  const callUi = document.getElementById('call-ui');
  if (callUi) callUi.classList.remove('hidden');
  setCallStatus('Connexion...');
  const label = document.getElementById('call-label');
  if (label) label.textContent = `Appel ${callType === 'video' ? 'vidéo' : 'vocal'} avec ${fu ? fu.username : '...'}`;

  buildCallTiles(fu, callType);

  try {
    WR.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
    });
    setCallStatus('Connecté ✓');
    if (callType === 'video') {
      const lv = document.getElementById('local-video');
      const la = document.getElementById('local-avatar');
      if (lv) { lv.srcObject = WR.localStream; lv.style.display = 'block'; }
      if (la) la.style.display = 'none';
    }
  } catch(e) {
    showToast('Erreur média', 'Micro ou caméra inaccessible', '#ef4444', '!');
    endCall();
    return;
  }

  WR.pc = new RTCPeerConnection(ICE_SERVERS);
  WR.localStream.getTracks().forEach(t => WR.pc.addTrack(t, WR.localStream));

  WR.pc.ontrack = e => {
    attachRemoteStream(e.streams[0], e.track.kind);
    if (!S.callTimer) {
      S.callTimer = setInterval(() => {
        S.callSec++;
        const ct = document.getElementById('call-timer');
        if (ct) ct.textContent = formatTime(S.callSec);
      }, 1000);
    }
  };

  if (isCaller) {
    try {
      const offer = await WR.pc.createOffer();
      await WR.pc.setLocalDescription(offer);
      await dbSet('calls/' + WR.remoteUserId + '/incoming', {
        callId: WR.callId,
        from: S.me,
        type: callType,
        offer: JSON.stringify(offer)
      });
      setCallStatus('Sonnerie...');
    } catch(e) {
      endCall();
    }
  } else if (remoteOffer) {
    try {
      const offer = JSON.parse(remoteOffer);
      await WR.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await WR.pc.createAnswer();
      await WR.pc.setLocalDescription(answer);
      await dbSet('calls/' + WR.remoteUserId + '/answer/' + WR.callId, {
        answer: JSON.stringify(answer)
      });
      setCallStatus('Connecté ✓');
    } catch(e) {
      endCall();
    }
  }
}

function renderApp() {
  renderServersBar();
  renderUserBar();
}

function renderUserBar() {
  const u = S.users[S.me];
  if (!u) return;
  const el = document.getElementById('ub-avatar-el');
  if (el) {
    if (u.avatarImg) {
      el.innerHTML = `<img src="${u.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/><div class="status-dot ${u.status || 'online'}" style="position:absolute;bottom:-1px;right:-1px;z-index:1;"></div>`;
      el.style.background = 'transparent';
    } else {
      el.style.background = u.color || avatarColor(u.username);
      el.innerHTML = `<span>${initials(u.username)}</span><div class="status-dot ${u.status || 'online'}"></div>`;
    }
  }
  const nameEl = document.getElementById('ub-name-el');
  if (nameEl) {
    nameEl.textContent = u.username;
    if (u.nameColor) {
      nameEl.style.cssText = `background:${u.nameColor};-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;`;
    } else {
      nameEl.style.cssText = '';
    }
  }
  const stEl = document.getElementById('ub-status-el');
  if (stEl) stEl.textContent = STATUS_LABELS[u.status || 'online'] || '🟢 En ligne';
}

function renderServersBar() {
  const list = document.getElementById('srv-list');
  if (!list) return;
  list.innerHTML = '';
  const userSrvIds = Object.keys(S.servers);
  userSrvIds.forEach(sid => {
    const srv = S.servers[sid];
    if (!srv) return;
    const btn = document.createElement('div');
    btn.className = 'srv-btn tooltip' + (S.activeServer === sid ? ' active' : '');
    btn.dataset.tip = srv.name;
    btn.onclick = () => showServer(sid);
    btn.innerHTML = srv.icon || initials(srv.name);
    list.appendChild(btn);
  });
}

function showView(view) {
  S.view = view;
  S.activeServer = null;
  S.activeChannel = null;
  S.activeDm = null;
  S.activeMinecraftGroup = null;

  document.querySelectorAll('.srv-btn').forEach(b => b.classList.remove('active'));
  if (view === 'home') document.getElementById('srv-home')?.classList.add('active');

  if (view === 'home') renderHomeView();
  else if (view === 'friends') renderFriendsView();
  else if (view === 'nitro') renderNitroView();
  else if (view === 'minecraft') showMinecraftView();

  renderLeftPanel('dm');
  closeMobileNav();
}

function showServer(sid) {
  S.activeServer = sid;
  S.view = 'server';
  S.activeDm = null;
  S.activeMinecraftGroup = null;
  document.querySelectorAll('.srv-btn').forEach(b => b.classList.remove('active'));
  const chs = Object.values(S.channels).filter(c => c.server === sid).sort((a, b) => a.position - b.position);
  const firstText = chs.find(c => c.type === 'text');
  if (firstText) showChannel(firstText.id);
  renderLeftPanel('server', sid);
  closeMobileNav();
}

function showChannel(chId) {
  S.activeChannel = chId;
  const ch = S.channels[chId];
  if (!ch) return;
  renderChannel(chId);
  renderLeftPanel('server', S.activeServer);
  closeMobileNav();
}

function openDm(userId) {
  S.activeDm = userId;
  S.view = 'dm';
  S.activeServer = null;
  S.activeChannel = null;
  S.activeMinecraftGroup = null;
  renderDm(userId);
  renderLeftPanel('dm');
  closeMobileNav();
}

function renderLeftPanel(type, serverId) {
  const lp = document.getElementById('lp-content');
  if (!lp) return;

  if (type === 'server') {
    const srv = S.servers[serverId];
    const title = document.getElementById('lp-title');
    if (title && srv) title.textContent = srv.name;
    const chs = Object.values(S.channels).filter(c => c.server === serverId).sort((a, b) => a.position - b.position);
    let html = `<div class="ch-list"><div class="ch-section">`;
    html += `<div class="ch-section-hdr"><span>📝 SALONS TEXTE</span><span onclick="openModal('add-channel','${serverId}')" style="cursor:pointer;font-size:16px;">+</span></div>`;
    chs.forEach(ch => {
      html += `<div class="ch-item${S.activeChannel === ch.id ? ' active' : ''}" onclick="showChannel('${ch.id}')"><span class="ch-icon">#</span><span>${escHtml(ch.name)}</span></div>`;
    });
    html += `</div></div>`;
    lp.innerHTML = html;
  } else {
    const title = document.getElementById('lp-title');
    if (title) title.textContent = 'Messages Directs';
    let html = `<div class="dm-list">`;
    html += `<div class="ch-item" onclick="showView('friends')" style="margin:4px 8px;"><span>👥</span><span>Amis</span></div>`;
    html += `<div class="ch-item" onclick="showMinecraftView()" style="margin:4px 8px;color:var(--green);"><span>⛏️</span><span style="font-weight:700;">HMD Minecraft</span></div>`;
    html += `<div class="ch-item" onclick="showView('nitro')" style="margin:4px 8px;"><span>💎</span><span style="background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Nitro Gratuit</span></div>`;
    html += `<div class="ch-section-hdr" style="padding:8px 16px 4px;">MESSAGES DIRECTS</div>`;
    const friends = Object.keys(S.friends[S.me] || {});
    friends.forEach(fid => {
      const fu = S.users[fid];
      if (!fu) return;
      html += `<div class="dm-item${S.activeDm === fid ? ' active' : ''}" onclick="openDm('${fid}')">
        <div class="dm-avatar" style="background:${fu.color || avatarColor(fu.username)}">${initials(fu.username)}<div class="status-dot ${fu.status || 'online'}"></div></div>
        <div class="dm-info"><div class="dm-name">${escHtml(fu.username)}</div><div class="dm-preview">Discuter en direct</div></div>
      </div>`;
    });
    if (!friends.length) {
      html += `<div style="padding:20px 16px;text-align:center;color:var(--text3);font-size:13px;">Ajoutez des amis pour discuter !</div>`;
    }
    html += `</div>`;
    lp.innerHTML = html;
  }
}

function renderHomeView() {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header"><div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div><span style="font-size:20px;">🏠</span><span class="ch-name">Accueil</span></div>
    <div id="stories-bar" class="stories-bar"></div>
    <div style="flex:1;overflow-y:auto;padding:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div class="home-hero"><div class="big-logo">H</div><h1>Bienvenue sur HMD Talk</h1><p>Discute, joue sur Minecraft, partage en direct.</p></div>
      <div class="home-cards">
        <div class="home-card" onclick="showMinecraftView()" style="border-color:rgba(34,197,94,.4);"><div class="hc-icon">⛏️</div><div class="hc-title" style="color:var(--green);">HMD Minecraft</div><div class="hc-desc">Groupes, serveurs & chat en jeu</div></div>
        <div class="home-card" onclick="showView('friends')"><div class="hc-icon">👥</div><div class="hc-title">Amis</div><div class="hc-desc">Ajoute et gère tes amis</div></div>
        <div class="home-card" onclick="openModal('create-server')"><div class="hc-icon">🌐</div><div class="hc-title">Créer un serveur</div><div class="hc-desc">Lance ta communauté</div></div>
        <div class="home-card" onclick="showView('nitro')"><div class="hc-icon">💎</div><div class="hc-title">Nitro Gratuit</div><div class="hc-desc">Toutes les fonctions premium</div></div>
        <div class="home-card" onclick="openModal('my-profile')"><div class="hc-icon">✏️</div><div class="hc-title">Mon profil</div><div class="hc-desc">Personnalise ton identité</div></div>
        <div class="home-card" onclick="openAdminAuthModal()"><div class="hc-icon">🛡️</div><div class="hc-title" style="color:var(--red);">Espace Admin</div><div class="hc-desc">Gestion serveurs & console</div></div>
      </div>
    </div>
  </div>`;
  renderStoriesBar();
}

function renderFriendsView() {
  const myFriends = Object.keys(S.friends[S.me] || {});
  const mc = document.getElementById('main-content');
  if (!mc) return;

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="friends-header">
      <div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div>
      <span style="font-size:18px;font-weight:800;">👥 Amis (${myFriends.length})</span>
      <div style="margin-left:auto;display:flex;gap:8px;">
        <input type="text" id="add-friend-inp" placeholder="Pseudo d'un ami..." style="padding:6px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:13px;"/>
        <button class="btn btn-primary" style="padding:6px 14px;font-size:13px;" onclick="sendFriendRequest()">Ajouter</button>
      </div>
    </div>
    <div id="friends-list" style="flex:1;overflow-y:auto;padding:16px;">
      ${myFriends.map(fid => {
        const fu = S.users[fid];
        if (!fu) return '';
        return `<div class="friend-item">
          <div class="friend-avatar" style="background:${fu.color || avatarColor(fu.username)}">${initials(fu.username)}<div class="status-dot ${fu.status || 'online'}"></div></div>
          <div class="friend-info"><div class="friend-name">${escHtml(fu.username)}</div><div class="friend-status">${STATUS_LABELS[fu.status || 'online']}</div></div>
          <div class="friend-actions">
            <button class="btn btn-ghost" style="padding:6px 10px;" onclick="openDm('${fid}')">💬</button>
            <button class="btn btn-ghost" style="padding:6px 10px;" onclick="startCall('${fid}','voice')">📞</button>
            <button class="btn btn-ghost" style="padding:6px 10px;" onclick="startCall('${fid}','video')">📹</button>
          </div>
        </div>`;
      }).join('') || '<div style="text-align:center;padding:48px;color:var(--text3);">Aucun ami pour le moment.</div>'}
    </div>
  </div>`;
}

async function sendFriendRequest() {
  const inp = document.getElementById('add-friend-inp');
  if (!inp) return;
  const target = inp.value.trim().toLowerCase();
  if (!target || target === S.me) return;

  const u = await dbGet('users/' + target);
  if (!u) {
    showToast('Erreur', 'Utilisateur introuvable', '#ef4444', '!');
    return;
  }
  await dbUpdate('friends/' + S.me, { [target]: true });
  await dbUpdate('friends/' + target, { [S.me]: true });
  S.friends[S.me] = S.friends[S.me] || {};
  S.friends[S.me][target] = true;
  showToast('Ami ajouté !', u.username, 'var(--green)', '✓');
  renderFriendsView();
  renderLeftPanel('dm');
}

function renderNitroView() {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header"><div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div><span style="font-size:20px;">💎</span><span class="ch-name">Nitro — Gratuit pour vous</span></div>
    <div style="flex:1;overflow-y:auto;padding:24px;">
      <div class="nitro-hero"><h1>💎 HMD Nitro & Minecraft</h1><p>Toutes les fonctionnalités premium gratuites à vie.</p><span class="nitro-free-badge">✨ Actif</span></div>
      <div class="nitro-features">
        <div class="nitro-feat"><span class="nf-badge">ACTIF</span><div class="nf-icon">⛏️</div><div class="nf-title">Groupes Minecraft</div><div class="nf-desc">Chat synchronisé # minecraft-chat, radar et carte interactive.</div></div>
        <div class="nitro-feat"><span class="nf-badge">ACTIF</span><div class="nf-icon">📹</div><div class="nf-title">Appels HD & Partage d'écran</div><div class="nf-desc">Communications WebRTC illimitées en direct.</div></div>
        <div class="nitro-feat"><span class="nf-badge">ACTIF</span><div class="nf-icon">📸</div><div class="nf-title">Stories 24h</div><div class="nf-desc">Photos et vidéos partagées avec vos amis.</div></div>
        <div class="nitro-feat"><span class="nf-badge">ACTIF</span><div class="nf-icon">🛡️</div><div class="nf-title">Console Admin</div><div class="nf-desc">Contrôle distant et journal d'audit sécurisé.</div></div>
      </div>
    </div>
  </div>`;
}

function renderChannel(chId) {
  const ch = S.channels[chId];
  if (!ch) return;
  const rawMsgs = S.messages[chId] || {};
  const msgs = Object.values(rawMsgs).sort((a, b) => a.ts - b.ts);
  const mc = document.getElementById('main-content');
  if (!mc) return;

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header">
      <div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div>
      <span style="color:var(--text2);font-weight:700;">#</span>
      <span class="ch-name">${escHtml(ch.name)}</span>
    </div>
    <div class="messages-area" id="msgs-area-${chId}">
      ${msgs.map(m => {
        const authorUser = m.authorId ? S.users[m.authorId] : null;
        const avImg = authorUser?.avatarImg || m.avatarImg;
        const nameColor = authorUser?.nameColor || m.nameColor;
        const avColor = authorUser?.color || m.avatar || AVATAR_COLORS[0];
        const avContent = avImg ?
          `<img src="${avImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>` :
          initials(m.author);
        return `
        <div class="msg-group">
          <div class="msg-avatar" style="background:${avImg ? 'transparent' : avColor}" onclick="openModal('view-profile','${m.authorId || ''}')">${avContent}</div>
          <div class="msg-content">
            <div class="msg-header">
              <span class="msg-author" onclick="openModal('view-profile','${m.authorId || ''}')" style="${nameColor ? `background:${nameColor};-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;` : ''}">${escHtml(m.author)}</span>
              <span class="msg-time">${timeAgo(m.ts)}</span>
            </div>
            <div class="msg-text">${formatMsg(m.content)}</div>
          </div>
        </div>`;
      }).join('') || '<div style="padding:48px;text-align:center;color:var(--text3);">Début du salon #' + escHtml(ch.name) + '</div>'}
    </div>
    <div class="input-area">
      <div class="msg-input-wrap">
        <textarea class="msg-input" id="msg-input-${chId}" placeholder="Message #${escHtml(ch.name)}" rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage('${chId}','channel');}"></textarea>
        <button class="msg-input-btn" onclick="sendMessage('${chId}','channel')">➤</button>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const el = document.getElementById('msgs-area-' + chId);
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}

function renderDm(userId) {
  const fu = S.users[userId];
  if (!fu) return;
  const dmKey = getDmKey(S.me, userId);
  const msgs = Object.values(S.dms[dmKey] || {}).sort((a, b) => a.ts - b.ts);
  const mc = document.getElementById('main-content');
  if (!mc) return;

  const dmAvImg = fu.avatarImg;
  const dmAvContent = dmAvImg ?
    `<img src="${dmAvImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>` :
    initials(fu.username);

  mc.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="mc-header">
      <div class="hdr-btn mobile-menu-btn" onclick="toggleMobileNav()">☰</div>
      <div class="msg-avatar" style="width:30px;height:30px;background:${dmAvImg ? 'transparent' : (fu.color || avatarColor(fu.username))}" onclick="openModal('view-profile','${userId}')">${dmAvContent}</div>
      <span class="ch-name" onclick="openModal('view-profile','${userId}')" style="cursor:pointer;${fu.nameColor ? `background:${fu.nameColor};-webkit-background-clip:text;-webkit-text-fill-color:transparent;` : ''}">${escHtml(fu.username)}</span>
      <div class="mc-header-actions">
        <button class="btn btn-ghost" style="padding:4px 8px;" onclick="startCall('${userId}','voice')">📞</button>
        <button class="btn btn-ghost" style="padding:4px 8px;" onclick="startCall('${userId}','video')">📹</button>
      </div>
    </div>
    <div class="messages-area" id="msgs-area-dm_${userId}">
      ${msgs.map(m => {
        const authorUser = m.authorId ? S.users[m.authorId] : null;
        const avImg = authorUser?.avatarImg || m.avatarImg;
        const nameColor = authorUser?.nameColor || m.nameColor;
        const avColor = authorUser?.color || m.avatar || (m.authorId === S.me ? 'var(--grad)' : fu.color || avatarColor(fu.username));
        const avContent = avImg ?
          `<img src="${avImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>` :
          initials(m.author);
        return `
        <div class="msg-group">
          <div class="msg-avatar" style="background:${avImg ? 'transparent' : avColor}" onclick="openModal('view-profile','${m.authorId || ''}')">${avContent}</div>
          <div class="msg-content">
            <div class="msg-header">
              <span class="msg-author" onclick="openModal('view-profile','${m.authorId || ''}')" style="${nameColor ? `background:${nameColor};-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;` : ''}">${escHtml(m.author)}</span>
              <span class="msg-time">${timeAgo(m.ts)}</span>
            </div>
            <div class="msg-text">${formatMsg(m.content)}</div>
          </div>
        </div>`;
      }).join('') || '<div style="padding:48px;text-align:center;color:var(--text3);">Début de la discussion avec ' + escHtml(fu.username) + '</div>'}
    </div>
    <div class="input-area">
      <div class="msg-input-wrap">
        <textarea class="msg-input" id="msg-input-dm_${userId}" placeholder="Message @${escHtml(fu.username)}" rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage('dm_${userId}','dm');}"></textarea>
        <button class="msg-input-btn" onclick="sendMessage('dm_${userId}','dm')">➤</button>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const el = document.getElementById('msgs-area-dm_' + userId);
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}

async function sendMessage(id, type) {
  const inp = document.getElementById('msg-input-' + id);
  if (!inp) return;
  const content = inp.value.trim();
  if (!content) return;
  inp.value = '';

  const u = S.users[S.me];
  const msg = {
    id: uid(),
    author: u ? u.username : S.me,
    authorId: S.me,
    content,
    ts: Date.now(),
    avatar: u ? u.color : AVATAR_COLORS[0]
  };

  if (type === 'channel') {
    await dbSet('messages/' + id + '/' + msg.id, msg);
    S.messages[id] = S.messages[id] || {};
    S.messages[id][msg.id] = msg;
    renderChannel(id);
  } else {
    const userId = id.replace('dm_', '');
    const dmKey = getDmKey(S.me, userId);
    await dbSet('dms/' + dmKey + '/' + msg.id, msg);
    S.dms[dmKey] = S.dms[dmKey] || {};
    S.dms[dmKey][msg.id] = msg;
    renderDm(userId);
  }
}

function renderStoriesBar() {
  const container = document.getElementById('stories-bar');
  if (!container) return;
  container.innerHTML = `
    <div class="story-item" onclick="openAddStory()">
      <div class="story-ring add-story">
        <div class="story-avatar-wrap" style="background:var(--grad);">+</div>
      </div>
      <span class="story-name">Ajouter</span>
    </div>`;
}

function openAddStory() {
  closeAllModals();
  const container = document.getElementById('modals');
  if (!container) return;
  container.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
    <div class="modal" style="width:400px;">
      <button class="modal-close" onclick="closeAllModals()">✕</button>
      <h2>📸 Publier une story</h2>
      <div class="field"><label>Texte ou annonce</label><input type="text" id="story-caption" placeholder="Partagez un moment..."/></div>
      <div class="btn-row">
        <button class="btn btn-ghost" onclick="closeAllModals()">Annuler</button>
        <button class="btn btn-primary" onclick="publishStory()">Publier 🚀</button>
      </div>
    </div>
  </div>`;
}

async function publishStory() {
  const caption = document.getElementById('story-caption')?.value.trim();
  if (!caption) return;
  const storyId = uid();
  const story = { id: storyId, authorId: S.me, caption, ts: Date.now() };
  await dbSet('stories/' + S.me + '/' + storyId, story);
  closeAllModals();
  showToast('Story publiée !', 'Visible 24h par vos amis.', 'var(--green)', '📸');
}

function openModal(type, data) {
  closeAllModals();
  const container = document.getElementById('modals');
  if (!container) return;

  if (type === 'create-server') {
    container.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
      <div class="modal">
        <button class="modal-close" onclick="closeAllModals()">✕</button>
        <h2>🌐 Créer un serveur HMD</h2>
        <div class="field"><label>Nom</label><input type="text" id="srv-name" placeholder="Mon serveur"/></div>
        <div class="field"><label>Icône (emoji)</label><input type="text" id="srv-icon" value="🎮" maxlength="2"/></div>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="closeAllModals()">Annuler</button>
          <button class="btn btn-primary" onclick="createServer()">Créer</button>
        </div>
      </div>
    </div>`;
  } else if (type === 'add-channel') {
    container.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
      <div class="modal">
        <button class="modal-close" onclick="closeAllModals()">✕</button>
        <h2>➕ Créer un salon</h2>
        <div class="field"><label>Nom du salon</label><input type="text" id="ch-name" placeholder="général"/></div>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="closeAllModals()">Annuler</button>
          <button class="btn btn-primary" onclick="createChannel('${data}')">Créer</button>
        </div>
      </div>
    </div>`;
  } else if (type === 'my-profile' || type === 'view-profile') {
    const uid2 = type === 'view-profile' ? data : S.me;
    const u = S.users[uid2];
    if (!u) { closeAllModals(); return; }
    const isMe = uid2 === S.me;
    const isFriend = S.friends[S.me] && S.friends[S.me][uid2];
    const avBg = u.avatarImg ? 'transparent' : u.color || avatarColor(u.username);
    const avContent = u.avatarImg ?
      `<img src="${u.avatarImg}" style="width:80px;height:80px;object-fit:cover;border-radius:50%;display:block;" alt=""/>` :
      `<span style="font-size:28px;font-weight:700;color:#fff;">${initials(u.username)}</span>`;

    container.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
      <div class="modal" style="padding:0;overflow:hidden;width:380px;">
        <div class="profile-banner" style="background:${u.banner || 'var(--grad)'};">
          ${isMe ? '<div class="change-banner" onclick="changeBanner()">Changer la bannière</div>' : ''}
          <button class="modal-close" onclick="closeAllModals()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.5);border-radius:6px;width:28px;height:28px;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="padding:0 16px 16px;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;">
            <div class="avatar-upload-zone" ${isMe ? 'onclick="uploadMyAvatar()"' : ''} style="${isMe ? 'cursor:pointer' : 'cursor:default'}">
              <div class="avatar-circle" style="background:${avBg};border:5px solid var(--bg2);">${avContent}</div>
              ${isMe ? '<div class="avatar-overlay"><span>📷</span><small>Changer</small></div>' : ''}
              <div class="status-dot ${u.status || 'online'}" style="position:absolute;bottom:8px;right:8px;width:14px;height:14px;border-width:3px;border-color:var(--bg2);"></div>
            </div>
            ${!isMe && !isFriend ? `<button class="btn btn-primary" style="margin-top:8px;padding:8px 16px;font-size:13px;" onclick="sendFriendRequestQuick('${uid2}');closeAllModals()">Ajouter</button>` : ''}
            ${!isMe && isFriend ? `
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button class="btn btn-primary" style="padding:8px 12px;font-size:13px;" onclick="openDm('${uid2}');closeAllModals()">Message</button>
                <button class="btn btn-ghost" style="padding:8px 12px;font-size:13px;" onclick="startCall('${uid2}','voice');closeAllModals()">📞</button>
                <button class="btn btn-ghost" style="padding:8px 12px;font-size:13px;" onclick="startCall('${uid2}','video');closeAllModals()">📹</button>
              </div>` : ''}
          </div>
          ${isMe && u.avatarImg ? `<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px;margin-bottom:8px;" onclick="removeMyAvatar()">🗑️ Supprimer la photo</button>` : ''}
          <div class="profile-name-row">
            <span class="profile-name" style="${u.nameColor ? `background:${u.nameColor};-webkit-background-clip:text;-webkit-text-fill-color:transparent;` : ''}">${escHtml(u.username)}</span>
            ${u.nitro ? '<span class="nitro-badge">NITRO</span>' : ''}
          </div>
          <div class="profile-tag" style="color:var(--text3);font-size:13px;">#${uid2.slice(-4).toUpperCase()}</div>
          <div class="profile-badges">
            ${u.nitro ? '<div class="badge badge-nitro">💎 Nitro</div>' : ''}
            <div class="badge badge-dev">⚡ Early User</div>
          </div>
          ${u.bio ? `<div class="profile-bio">${escHtml(u.bio)}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">Membre depuis ${new Date(u.joinedAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
          ${isMe ? `<button class="btn btn-primary" style="width:100%;" onclick="closeAllModals();openModal('settings')">✏️ Modifier mon profil</button>` : ''}
        </div>
      </div>
    </div>`;
  } else if (type === 'settings') {
    const u = S.users[S.me];
    container.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeAllModals()">
      <div class="modal" style="padding:0;width:680px;height:520px;overflow:hidden;">
        <div class="settings-layout">
          <div class="settings-nav">
            <div class="settings-nav-title">Mon compte</div>
            <div class="settings-nav-item active" onclick="showSettingsSection('profile',this)">👤 Profil</div>
            <div class="settings-nav-item" onclick="showSettingsSection('appearance',this)">🎨 Apparence</div>
            <div class="settings-nav-item" onclick="showSettingsSection('notifications',this)">🔔 Notifications</div>
            <div class="settings-nav-item" onclick="showSettingsSection('audio',this)">🎤 Audio & Vidéo</div>
            <div class="sep" style="margin:8px 0;"></div>
            <div class="settings-nav-item" style="color:var(--red);" onclick="logout()">🚪 Déconnexion</div>
          </div>
          <div class="settings-content" id="settings-content">${renderSettingsProfile(u)}</div>
        </div>
      </div>
    </div>`;
  }
}

function triggerAvatarUpload(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => callback(ev.target.result);
    reader.readAsDataURL(file);
  };
  input.click();
}

async function uploadMyAvatar() {
  triggerAvatarUpload(async dataUrl => {
    await dbUpdate('users/' + S.me, { avatarImg: dataUrl });
    if (S.users[S.me]) S.users[S.me].avatarImg = dataUrl;
    renderUserBar();
    const modal = document.querySelector('.modal-overlay');
    if (modal) openModal('my-profile');
    showToast('Photo mise à jour', 'Ta photo de profil a été changée ! 🎉', 'var(--green)', '✓');
  });
}

async function removeMyAvatar() {
  await dbUpdate('users/' + S.me, { avatarImg: null });
  if (S.users[S.me]) S.users[S.me].avatarImg = null;
  renderUserBar();
  const modal = document.querySelector('.modal-overlay');
  if (modal) openModal('my-profile');
  showToast('Photo supprimée', '', 'var(--text2)', '✓');
}

async function changeBanner() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const bannerVal = 'url(' + ev.target.result + ')';
      await dbUpdate('users/' + S.me, { banner: bannerVal });
      if (S.users[S.me]) S.users[S.me].banner = bannerVal;
      openModal('my-profile');
      showToast('Bannière mise à jour', 'Nouvelle bannière enregistrée !', 'var(--green)', '🎨');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function renderSettingsProfile(u) {
  if (!u) return '<div style="padding:20px;color:var(--text3);">Utilisateur introuvable</div>';
  const avBg = u.avatarImg ? 'transparent' : u.color || avatarColor(u.username);
  const avContent = u.avatarImg ?
    `<img src="${u.avatarImg}" style="width:64px;height:64px;object-fit:cover;border-radius:50%;display:block;" alt=""/>` :
    `<span style="font-size:22px;font-weight:700;color:#fff;">${initials(u.username)}</span>`;

  const nameColorGradients = [
    'linear-gradient(135deg,#7c5cfc,#a855f7)',
    'linear-gradient(135deg,#3b82f6,#06b6d4)',
    'linear-gradient(135deg,#10b981,#22c55e)',
    'linear-gradient(135deg,#f97316,#eab308)',
    'linear-gradient(135deg,#ec4899,#f97316)',
    'linear-gradient(135deg,#06b6d4,#7c5cfc)'
  ];

  return `
  <div class="settings-section">
    <h3>Profil public</h3>
    <div class="avatar-upload-settings">
      <div class="avatar-preview-settings" style="background:${avBg};" onclick="uploadMyAvatar()">
        ${avContent}
        <div class="avatar-hover-overlay">📷</div>
      </div>
      <div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${escHtml(u.username)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="uploadMyAvatar()">📷 Changer la photo</button>
          ${u.avatarImg ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;color:var(--red);" onclick="removeMyAvatar()">🗑️ Supprimer</button>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">JPG, PNG · Aucune limite de taille</div>
      </div>
    </div>
    <div class="field"><label>Nom d'utilisateur</label><input type="text" id="set-username" value="${escHtml(u.username)}"/></div>
    <div class="field"><label>Bio</label><textarea id="set-bio" placeholder="Parle de toi...">${escHtml(u.bio || '')}</textarea></div>
    <div class="field"><label>Statut</label>
      <select id="set-status">
        <option value="online"${u.status === 'online' ? ' selected' : ''}>🟢 En ligne</option>
        <option value="idle"${u.status === 'idle' ? ' selected' : ''}>🟡 Absent</option>
        <option value="dnd"${u.status === 'dnd' ? ' selected' : ''}>🔴 Ne pas déranger</option>
        <option value="offline"${u.status === 'offline' ? ' selected' : ''}>⚫ Invisible</option>
      </select>
    </div>
    <div class="field"><label>Couleur du pseudo</label>
      <div class="color-picker-row" id="set-namecolor-row">
        ${nameColorGradients.map(c => `
          <div class="color-swatch${u.nameColor === c ? ' selected' : ''}" style="background:${c}" onclick="selectSwatch(this,'set-namecolor','${c}')"></div>
        `).join('')}
        <div class="color-swatch" style="background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text2);" onclick="document.getElementById('set-namecolor').value='';document.querySelectorAll('#set-namecolor-row .color-swatch').forEach(s=>s.classList.remove('selected'))" title="Couleur par défaut">✕</div>
      </div>
      <input type="hidden" id="set-namecolor" value="${u.nameColor || ''}"/>
    </div>
    <div class="field"><label>Couleur d'avatar</label>
      <div class="color-picker-row">
        ${AVATAR_COLORS.map(c => `
          <div class="color-swatch${u.color === c ? ' selected' : ''}" style="background:${c}" onclick="selectSwatch(this,'set-avatarcolor','${c}')"></div>
        `).join('')}
      </div>
      <input type="hidden" id="set-avatarcolor" value="${u.color || avatarColor(u.username)}"/>
    </div>
    <button class="btn btn-primary" style="margin-top:4px;" onclick="saveProfile()">Sauvegarder</button>
  </div>`;
}

function showSettingsSection(section, btn) {
  document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const u = S.users[S.me];
  const content = document.getElementById('settings-content');
  if (!content) return;

  if (section === 'profile') {
    content.innerHTML = renderSettingsProfile(u);
  } else if (section === 'appearance') {
    const themes = [
      { id: 'theme-purple', label: 'Violet', g: 'linear-gradient(135deg,#7c5cfc,#ec4899)' },
      { id: 'theme-blue', label: 'Bleu', g: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
      { id: 'theme-green', label: 'Vert', g: 'linear-gradient(135deg,#10b981,#22c55e)' },
      { id: 'theme-orange', label: 'Orange', g: 'linear-gradient(135deg,#f97316,#eab308)' },
      { id: 'theme-pink', label: 'Rose', g: 'linear-gradient(135deg,#ec4899,#f97316)' },
      { id: 'theme-cyan', label: 'Cyan', g: 'linear-gradient(135deg,#06b6d4,#7c5cfc)' }
    ];
    content.innerHTML = `
    <div class="settings-section">
      <h3>Thème de couleur</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${themes.map(t => `
          <div onclick="applyTheme('${t.id}')" style="border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid ${S.theme === t.id ? 'var(--text1)' : 'transparent'};transition:.2s;">
            <div style="height:44px;background:${t.g};"></div>
            <div style="padding:6px 8px;background:var(--bg3);font-size:12px;font-weight:600;">${t.label}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  } else if (section === 'notifications') {
    content.innerHTML = `
    <div class="settings-section">
      <h3>Sonnerie d'appel</h3>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Sonnerie activée</div>
          <div class="toggle-desc">Joue une sonnerie lors des appels entrants</div>
        </div>
        <div class="toggle${S.ringtoneEnabled ? ' on' : ''}" id="ringtone-toggle" onclick="toggleRingtone(this)"></div>
      </div>
      <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04);">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px;">Volume de la sonnerie</div>
        <div class="volume-slider-row">
          <span class="vol-icon">${S.ringtoneVolume === 0 ? '🔇' : S.ringtoneVolume < 50 ? '🔉' : '🔊'}</span>
          <input type="range" min="0" max="100" value="${S.ringtoneVolume}" id="ringtone-vol-slider" oninput="updateRingtoneVolume(this.value)" onchange="updateRingtoneVolume(this.value)"/>
          <span class="vol-val" id="vol-val-display">${S.ringtoneVolume}%</span>
        </div>
        <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px;margin-top:8px;" onclick="previewRingtone()">▶ Tester la sonnerie</button>
      </div>

      <h3 style="margin-top:20px;">Notifications push</h3>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Notifications système</div>
          <div class="toggle-desc">Reçois des alertes même en arrière-plan</div>
        </div>
        <div class="toggle${('Notification' in window && Notification.permission === 'granted') ? ' on' : ''}" onclick="toggleBrowserNotif(this)"></div>
      </div>
      <div id="notif-status" style="font-size:12px;color:var(--text2);margin-top:4px;">
        ${'Notification' in window ? (Notification.permission === 'granted' ? '✅ Notifications autorisées' : Notification.permission === 'denied' ? '❌ Bloquées' : '⏳ Non encore accordée') : '❌ Non supporté'}
      </div>
    </div>`;
  } else if (section === 'audio') {
    content.innerHTML = `
    <div class="settings-section">
      <h3>Audio & Vidéo</h3>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px;">Les appels utilisent WebRTC. Autorise micro/caméra dans ton navigateur.</p>
      <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Réduction de bruit</div></div><div class="toggle on" onclick="this.classList.toggle('on')"></div></div>
      <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Annulation d'écho</div></div><div class="toggle on" onclick="this.classList.toggle('on')"></div></div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="testMic()">🎤 Tester le micro</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="testCam()">📷 Tester la caméra</button>
      </div>
      <div id="test-video-wrap" style="display:none;margin-top:12px;border-radius:8px;overflow:hidden;background:#000;aspect-ratio:16/9;">
        <video id="test-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>
      </div>
    </div>`;
  }
}

async function saveProfile() {
  const u = S.users[S.me];
  if (!u) return;
  const username = document.getElementById('set-username')?.value.trim();
  if (!username || username.length < 2 || username.length > 24) {
    showToast('Erreur', 'Pseudo invalide (2-24 caractères)', '#ef4444', '!');
    return;
  }
  const bio = document.getElementById('set-bio')?.value.trim() || '';
  const status = document.getElementById('set-status')?.value || 'online';
  const nameColor = document.getElementById('set-namecolor')?.value || null;
  const color = document.getElementById('set-avatarcolor')?.value || avatarColor(username);

  u.username = username;
  u.bio = bio;
  u.status = status;
  u.nameColor = nameColor;
  u.color = color;

  await dbUpdate('users/' + S.me, {
    username,
    bio,
    status,
    nameColor,
    color
  });
  renderUserBar();
  closeAllModals();
  showToast('Profil sauvegardé', 'Tes modifications ont été enregistrées.', color, '✓');
}

function applyTheme(themeId) {
  S.theme = themeId;
  document.body.className = themeId;
  dbUpdate('users/' + S.me, { theme: themeId });
  const u = S.users[S.me];
  if (u) u.theme = themeId;
  showSettingsSection('appearance', document.querySelector('.settings-nav-item.active'));
}

function selectSwatch(el, inputId, value) {
  el.closest('.color-picker-row').querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  const inp = document.getElementById(inputId);
  if (inp) inp.value = value;
}

function toggleRingtone(el) {
  S.ringtoneEnabled = !S.ringtoneEnabled;
  el.classList.toggle('on', S.ringtoneEnabled);
  saveSettings();
  if (!S.ringtoneEnabled) stopRingTone();
}

function updateRingtoneVolume(val) {
  S.ringtoneVolume = parseInt(val);
  saveSettings();
  const d = document.getElementById('vol-val-display');
  if (d) d.textContent = val + '%';
  const icon = document.querySelector('.vol-icon');
  if (icon) icon.textContent = S.ringtoneVolume === 0 ? '🔇' : S.ringtoneVolume < 50 ? '🔉' : '🔊';
}

function previewRingtone() {
  playRingTone();
  setTimeout(stopRingTone, 3500);
}

async function toggleBrowserNotif(el) {
  if (!('Notification' in window)) {
    showToast('Non supporté', 'Ton navigateur ne supporte pas les notifications push', '#ef4444', '!');
    return;
  }
  const perm = await Notification.requestPermission();
  el.classList.toggle('on', perm === 'granted');
  const s = document.getElementById('notif-status');
  if (s) s.textContent = perm === 'granted' ? '✅ Notifications autorisées' : '❌ Bloquées';
}

async function testMic() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    showToast('Micro OK ✓', 'Le micro fonctionne parfaitement !', 'var(--green)', '🎤');
    setTimeout(() => s.getTracks().forEach(t => t.stop()), 1500);
  } catch(e) {
    showToast('Micro indisponible', 'Autorise le micro dans ton navigateur.', '#ef4444', '!');
  }
}

async function testCam() {
  const wrap = document.getElementById('test-video-wrap');
  const vid = document.getElementById('test-video');
  if (!wrap || !vid) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    vid.srcObject = s;
    wrap.style.display = 'block';
    showToast('Caméra OK ✓', 'La caméra fonctionne parfaitement !', 'var(--green)', '📷');
    setTimeout(() => {
      s.getTracks().forEach(t => t.stop());
      wrap.style.display = 'none';
      vid.srcObject = null;
    }, 5000);
  } catch(e) {
    showToast('Caméra indisponible', 'Autorise la caméra dans ton navigateur.', '#ef4444', '!');
  }
}

async function sendFriendRequestQuick(target) {
  if (!target || target === S.me) return;
  const u = S.users[target] || await dbGet('users/' + target);
  if (!u) return;
  await dbUpdate('friends/' + S.me, { [target]: true });
  await dbUpdate('friends/' + target, { [S.me]: true });
  S.friends[S.me] = S.friends[S.me] || {};
  S.friends[S.me][target] = true;
  showToast('Ami ajouté !', u.username, 'var(--green)', '✓');
  renderLeftPanel('dm');
  if (S.view === 'friends') renderFriendsView();
}

async function createServer() {
  const name = document.getElementById('srv-name')?.value.trim();
  const icon = document.getElementById('srv-icon')?.value.trim() || '🎮';
  if (!name) return;
  const sid = uid();
  const chId = uid();
  await dbSet('servers/' + sid, { id: sid, name, icon, owner: S.me });
  await dbSet('channels/' + chId, { id: chId, server: sid, name: 'général', type: 'text', position: 0 });
  S.servers[sid] = { id: sid, name, icon, owner: S.me };
  S.channels[chId] = { id: chId, server: sid, name: 'général', type: 'text', position: 0 };
  closeAllModals();
  renderServersBar();
  showServer(sid);
}

async function createChannel(serverId) {
  const name = document.getElementById('ch-name')?.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!name) return;
  const chId = uid();
  await dbSet('channels/' + chId, { id: chId, server: serverId, name, type: 'text', position: 1 });
  S.channels[chId] = { id: chId, server: serverId, name, type: 'text', position: 1 };
  closeAllModals();
  renderLeftPanel('server', serverId);
  showChannel(chId);
}

function saveSettingsModal() {
  const url = document.getElementById('set-rtdb-url')?.value.trim();
  if (url) localStorage.setItem('hmd_database_url', url);
  else localStorage.removeItem('hmd_database_url');
  closeAllModals();
  showToast('Paramètres', 'Enregistrés avec succès', 'var(--green)', '✓');
}

function showToast(title, body, bg, icon) {
  const container = document.getElementById('toasts');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = `
    <div class="toast-avatar" style="background:${bg || 'var(--grad)'}">${icon || 'H'}</div>
    <div class="toast-content"><div class="toast-title">${escHtml(title)}</div><div class="toast-body">${escHtml(body)}</div></div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>`;
  container.appendChild(div);
  setTimeout(() => { div.remove(); }, 4000);
}

function toggleMobileNav() { document.body.classList.toggle('mobile-nav-open'); }
function closeMobileNav() { document.body.classList.remove('mobile-nav-open'); }
function toggleLeftPanel() {
  const c = document.getElementById('lp-content');
  if (c) c.style.display = c.style.display === 'none' ? '' : 'none';
}
function closeAllModals() {
  const m = document.getElementById('modals');
  if (m) m.innerHTML = '';
}
function openLightbox(src) {
  const lb = document.getElementById('img-lightbox');
  const img = document.getElementById('lightbox-img');
  if (lb && img) { img.src = src; lb.classList.remove('hidden'); }
}
function closeLightbox() {
  document.getElementById('img-lightbox')?.classList.add('hidden');
}

async function logout() {
  endCall();
  saveSession(null);
  location.reload();
}

async function init() {
  loadSettings();
  const session = loadSession();
  if (session) {
    const u = await dbGet('users/' + session);
    if (u) {
      S.me = session;
      await enterApp();
      return;
    }
  }
  document.getElementById('loading')?.classList.add('hidden');
  document.getElementById('auth-screen')?.classList.remove('hidden');
}

// Bind everything to window for inline onclick/onkeydown handlers
Object.assign(window, {
  showAuthTab, doLogin, doRegister, showView, showServer, showChannel,
  openDm, renderFriendsView, sendFriendRequest, renderLeftPanel, toggleLeftPanel,
  sendMessage, openModal, closeAllModals, openLightbox, closeLightbox,
  startCall, endCall, toggleCallMic, toggleCallCam, toggleScreenShare,
  toggleMic, toggleDeaf, declineCall, acceptCall, logout,
  toggleMobileNav, closeMobileNav, showToast, openAddStory, publishStory,
  createServer, createChannel, saveSettingsModal,
  // Profile customization & Settings
  uploadMyAvatar, removeMyAvatar, changeBanner, saveProfile, applyTheme,
  selectSwatch, showSettingsSection, renderSettingsProfile, toggleRingtone,
  updateRingtoneVolume, previewRingtone, toggleBrowserNotif, testMic, testCam,
  sendFriendRequestQuick,
  // Minecraft features
  showMinecraftView, openCreateMinecraftGroup, submitCreateMinecraftGroup,
  openMinecraftGroup, switchMinecraftTab, sendMinecraftChat, generatePairingCode,
  copyCommand, copyIp, unlinkMinecraftServer, saveMinecraftSettings,
  downloadPluginModal, copyMavenCommand, openAdminAuthModal, loginAdmin,
  renderAdminDashboard, executeAdminConsoleCmd, adminPowerAction, logoutAdmin,
  zoomMap, resetMap, setMapDimension, openWebmap
});

init();
