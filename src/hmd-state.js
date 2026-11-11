import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off, update, remove }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// Nouveau projet Firebase HMD Hub fourni par l'utilisateur
export const firebaseConfig = {
  apiKey: "AIzaSyCZX09Kc3TXZniSbGt9jAP_Ml0BT7Q4uR8",
  authDomain: "hmd-hub.firebaseapp.com",
  projectId: "hmd-hub",
  storageBucket: "hmd-hub.firebasestorage.app",
  messagingSenderId: "145481795853",
  appId: "1:145481795853:web:c7faffc0dffcddacc3c844",
  measurementId: "G-QJCH8CBDBG"
};

export const firebaseApp = initializeApp(firebaseConfig);

// La configuration fournie ne contient pas databaseURL.
// On gère intelligemment la disponibilité de databaseURL sans jamais bloquer.
export let db = null;
const customDbUrl = localStorage.getItem('hmd_database_url') || '';
if (customDbUrl) {
  try {
    db = getDatabase(firebaseApp, customDbUrl);
  } catch (e) {
    console.warn('Firebase RTDB avec URL personnalisée non connectée:', e);
  }
}

// État global HMD Talk
export const S = {
  me: null, users: {}, servers: {}, channels: {}, messages: {}, dms: {},
  friends: {}, pendingIn: {}, pendingOut: {},
  view: 'home', activeServer: null, activeChannel: null, activeDm: null,
  activeMinecraftGroup: null, activeMinecraftTab: 'chat',
  theme: 'theme-purple', micOn: true, deafOn: false,
  inCall: false, callTimer: null, callSec: 0,
  _listeners: [], _seenMsgToast: {}, _seenFriendToast: {},
  dmUnread: {},
  ringtoneVolume: 40,
  ringtoneEnabled: true,
  stories: {},
  storyViewerIndex: 0,
  storyViewerUserId: null,
  storyViewerTimer: null,
  pendingImage: null,
  adminToken: sessionStorage.getItem('hmd_admin_token') || null,
};

export const EMOJIS = ['😀','😂','🥹','😍','🥰','😎','🤩','🥳','😜','🤔','😴','😱','🎉','❤️','🔥','✨','👍','👎','💯','🚀','💎','🎮','🎵','🌈','⚡','🍕','🐱','🐶','🌸','💪','🙏','👀','💀','🤣','😭','😤','🥺','😏','🤯','🤩'];
export const QUICK_REACTS = ['👍','❤️','😂','😮','😢','🔥'];
export const AVATAR_COLORS = ['linear-gradient(135deg,#7c5cfc,#a855f7)','linear-gradient(135deg,#3b82f6,#06b6d4)','linear-gradient(135deg,#10b981,#22c55e)','linear-gradient(135deg,#f97316,#eab308)','linear-gradient(135deg,#ec4899,#f97316)','linear-gradient(135deg,#ef4444,#f97316)'];
export const STATUS_LABELS = {online:'🟢 En ligne',idle:'🟡 Absent',dnd:'🔴 Ne pas déranger',offline:'⚫ Invisible'};

// Fallback local/backend storage quand databaseURL n'est pas encore saisie
let localMem = JSON.parse(localStorage.getItem('hmd_local_db') || '{}');
function saveLocalMem() {
  try { localStorage.setItem('hmd_local_db', JSON.stringify(localMem)); } catch(e){}
}

function getByPath(obj, path) {
  const parts = path.split('/').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  return cur !== undefined ? cur : null;
}

function setByPath(obj, path, val) {
  const parts = path.split('/').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  if (parts.length > 0) cur[parts[parts.length - 1]] = val;
}

export function dbRef(path) {
  if (db) return ref(db, path);
  return { _path: path };
}

export async function dbGet(path) {
  if (db) {
    try {
      const snap = await get(dbRef(path));
      return snap.exists() ? snap.val() : null;
    } catch(e) {}
  }
  return getByPath(localMem, path);
}

export async function dbSet(path, val) {
  if (db) {
    try { await set(dbRef(path), val); } catch(e) {}
  }
  setByPath(localMem, path, val);
  saveLocalMem();
  triggerListeners(path, val);
}

export async function dbUpdate(path, val) {
  if (db) {
    try { await update(dbRef(path), val); } catch(e) {}
  }
  const curr = getByPath(localMem, path) || {};
  setByPath(localMem, path, { ...curr, ...val });
  saveLocalMem();
  triggerListeners(path, getByPath(localMem, path));
}

export async function dbRemove(path) {
  if (db) {
    try { await remove(dbRef(path)); } catch(e) {}
  }
  setByPath(localMem, path, undefined);
  saveLocalMem();
  triggerListeners(path, null);
}

const localListeners = [];
function triggerListeners(path, val) {
  localListeners.forEach(l => {
    if (l.path === path || path.startsWith(l.path + '/') || l.path.startsWith(path + '/')) {
      l.cb(getByPath(localMem, l.path));
    }
  });
}

export function dbListen(path, cb) {
  if (db) {
    try {
      const r = dbRef(path);
      onValue(r, snap => cb(snap.exists() ? snap.val() : null));
      S._listeners.push(r);
      return r;
    } catch (e) {}
  }
  localListeners.push({ path, cb });
  setTimeout(() => cb(getByPath(localMem, path)), 10);
  return { path };
}

export function uid() { return Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36); }
export function initials(name) { return name ? name.slice(0, 2).toUpperCase() : '??'; }
export function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + h * 31;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
export function timeAgo(ts) { return "Aujourd'hui à " + new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
export function formatTime(sec) { return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
export function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function formatMsg(txt) {
  txt = escHtml(txt);
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  txt = txt.replace(/\*(.+?)\*/g, '<em>$1</em>');
  txt = txt.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,.3);padding:2px 5px;border-radius:4px;font-family:monospace">$1</code>');
  txt = txt.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return txt;
}
export function getDmKey(a, b) { return [a, b].sort().join('__'); }
export function timeFromNow(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'min';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'j';
}
