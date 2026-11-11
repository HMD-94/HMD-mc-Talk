import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// In-memory data structures with local persistence
interface MinecraftPlayer {
  name: string;
  uuid: string;
  ping: number;
  health: number;
  dimension: 'overworld' | 'the_nether' | 'the_end' | string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

interface MinecraftGroup {
  id: string;
  name: string;
  description: string;
  logo: string;
  ip: string;
  port: number;
  loader: 'Paper' | 'Spigot' | 'Purpur' | 'Fabric' | 'Forge' | 'NeoForge' | string;
  version: string;
  isPublic: boolean;
  inviteCode: string;
  ownerId: string;
  createdAt: number;
  serverToken?: string;
  status: 'online' | 'offline' | 'pending';
  lastSeen?: number;
  webmapUrl?: string;
  hidePlayerCoords?: boolean;
  tps?: number;
  ramUsedMb?: number;
  ramMaxMb?: number;
  motd?: string;
  players: MinecraftPlayer[];
  members: Record<string, { role: 'owner' | 'admin' | 'member'; joinedAt: number }>;
}

interface PairingCode {
  code: string;
  groupId: string;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
}

interface MinecraftChatMessage {
  id: string;
  groupId: string;
  author: string;
  authorId?: string;
  isMinecraft: boolean;
  uuid?: string;
  content: string;
  timestamp: number;
  type?: 'chat' | 'system' | 'join' | 'quit' | 'death';
}

interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  operator: string;
  details: string;
  ip?: string;
}

// State storage
const DATA_DIR = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

const GROUPS_FILE = path.join(DATA_DIR, 'minecraft_groups.json');
const LOGS_FILE = path.join(DATA_DIR, 'minecraft_logs.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'minecraft_messages.json');

function loadJSON<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error loading ${file}:`, e);
  }
  return fallback;
}

function saveJSON(file: string, data: any) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving ${file}:`, e);
  }
}

let groups: Record<string, MinecraftGroup> = loadJSON(GROUPS_FILE, {
  'demo-survival': {
    id: 'demo-survival',
    name: 'HMD Survival Vanilla',
    description: 'Serveur de survie communautaire avec économie et claims.',
    logo: '⛏️',
    ip: 'play.hmdtalk.fr',
    port: 25565,
    loader: 'Paper',
    version: '26.1.2',
    isPublic: true,
    inviteCode: 'HMD-SURV-2026',
    ownerId: 'system',
    createdAt: Date.now() - 86400000 * 3,
    serverToken: 'hmd_sec_demo_survival_token',
    status: 'online',
    lastSeen: Date.now(),
    webmapUrl: '',
    hidePlayerCoords: false,
    tps: 19.98,
    ramUsedMb: 2450,
    ramMaxMb: 6144,
    motd: '§6Bienvenue sur le serveur §bHMD Talk Survival§r',
    players: [
      { name: 'AlexCraft', uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', ping: 24, health: 20, dimension: 'overworld', x: 124, y: 64, z: -350, yaw: 180, pitch: 0 },
      { name: 'SteveMiner', uuid: '853c80ef-3c37-49fd-aa49-938b674adae6', ping: 38, health: 18, dimension: 'the_nether', x: 45, y: 72, z: 88, yaw: 45, pitch: -10 },
      { name: 'NotchFan', uuid: '92110c71-331d-4eb0-80ea-323e9c403323', ping: 42, health: 20, dimension: 'overworld', x: -210, y: 68, z: 412, yaw: 270, pitch: 5 }
    ],
    members: {
      'system': { role: 'owner', joinedAt: Date.now() - 86400000 * 3 }
    }
  }
});

let pairingCodes: Record<string, PairingCode> = {};
let messages: Record<string, MinecraftChatMessage[]> = loadJSON(MESSAGES_FILE, {
  'demo-survival': [
    {
      id: 'msg-init-1',
      groupId: 'demo-survival',
      author: 'AlexCraft',
      isMinecraft: true,
      uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
      content: 'Salut tout le monde ! On avance bien sur la base.',
      timestamp: Date.now() - 3600000 * 2
    },
    {
      id: 'msg-init-2',
      groupId: 'demo-survival',
      author: 'SteveMiner',
      isMinecraft: true,
      uuid: '853c80ef-3c37-49fd-aa49-938b674adae6',
      content: 'Je cherche du Netherite dans le Nether !',
      timestamp: Date.now() - 1800000
    }
  ]
});

let auditLogs: AuditLog[] = loadJSON(LOGS_FILE, [
  {
    id: 'log-0',
    timestamp: Date.now() - 3600000 * 24,
    action: 'SYSTEM_BOOT',
    operator: 'system',
    details: 'Initialisation du backend HMD Minecraft'
  }
]);

// Pending outgoing commands from web admin console to Minecraft servers
let pendingServerCommands: Record<string, Array<{ id: string; command: string; issuedAt: number; operator: string }>> = {};
// Pending messages to send into Minecraft from web chat
let pendingOutboundChat: Record<string, Array<{ id: string; author: string; content: string; timestamp: number }>> = {};

// SSE Client Connections for real-time live group updates
const sseClients: Record<string, Response[]> = {};

function notifyGroupUpdate(groupId: string, eventType: string, payload: any) {
  const clients = sseClients[groupId] || [];
  const data = JSON.stringify({ event: eventType, data: payload, timestamp: Date.now() });
  clients.forEach(res => {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
}

function addAuditLog(action: string, operator: string, details: string, ip?: string) {
  const log: AuditLog = {
    id: 'log-' + Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    action,
    operator,
    details,
    ip
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 500) auditLogs.pop();
  saveJSON(LOGS_FILE, auditLogs);
}

// Admin Security (1937) - Verification strictly on backend with rate limiting
const ADMIN_CODE = process.env.ADMIN_SECRET_CODE || '1937';
const adminSessions = new Set<string>();
const loginAttempts: Record<string, { count: number; lastAttempt: number }> = {};

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = loginAttempts[ip];
  if (!rec) return true;
  if (now - rec.lastAttempt > 300000) {
    // 5 minutes reset
    delete loginAttempts[ip];
    return true;
  }
  return rec.count < 5;
}

function recordLoginAttempt(ip: string, success: boolean) {
  const now = Date.now();
  if (success) {
    delete loginAttempts[ip];
    return;
  }
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { count: 1, lastAttempt: now };
  } else {
    loginAttempts[ip].count++;
    loginAttempts[ip].lastAttempt = now;
  }
}

// Middleware to authenticate Minecraft Plugin via X-HMD-Server-Token
function authenticatePlugin(req: Request, res: Response, next: () => void) {
  const token = req.headers['x-hmd-server-token'] as string;
  if (!token) {
    res.status(401).json({ error: 'Token manquant (X-HMD-Server-Token)' });
    return;
  }
  const group = Object.values(groups).find(g => g.serverToken === token);
  if (!group) {
    res.status(403).json({ error: 'Token de serveur invalide ou révoqué' });
    return;
  }
  (req as any).minecraftGroup = group;
  next();
}

// Middleware to authenticate Admin Session
function authenticateAdmin(req: Request, res: Response, next: () => void) {
  const token = req.headers['x-admin-token'] as string;
  if (!token || !adminSessions.has(token)) {
    res.status(403).json({ error: 'Session administrateur expirée ou non autorisée' });
    return;
  }
  next();
}

/* ============================================================
   API ENDPOINTS : PAIRING & PLUGIN CONNECTION
============================================================ */

// 1. Generate pairing code for a group (from Web UI)
app.post('/api/minecraft/pair/generate', (req: Request, res: Response) => {
  const { groupId, userId } = req.body;
  if (!groupId || !groups[groupId]) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  // Generate random secure code: HMD-XXXX-YY
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand1 = '';
  let rand2 = '';
  for (let i = 0; i < 4; i++) rand1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 2; i++) rand2 += chars[Math.floor(Math.random() * chars.length)];
  const code = `HMD-${rand1}-${rand2}`;

  const now = Date.now();
  const pairing: PairingCode = {
    code,
    groupId,
    createdAt: now,
    expiresAt: now + 15 * 60 * 1000, // 15 minutes
    createdBy: userId || 'anonymous'
  };

  // Clean old pairing codes for this group
  for (const c of Object.keys(pairingCodes)) {
    if (pairingCodes[c].groupId === groupId || pairingCodes[c].expiresAt < now) {
      delete pairingCodes[c];
    }
  }

  pairingCodes[code] = pairing;
  addAuditLog('PAIRING_CODE_GENERATED', userId || 'web', `Code ${code} généré pour groupe ${groups[groupId].name}`);

  res.json({
    code,
    expiresAt: pairing.expiresAt,
    instructions: [
      '1. Assurez-vous que le plugin HMD Minecraft est installé dans plugins/',
      '2. Sur votre serveur Minecraft, connectez-vous avec les droits opérateur (OP)',
      `3. Exécutez la commande : /pair ${code}`,
      '4. La liaison sera validée instantanément !'
    ]
  });
});

// 2. Plugin pairing verification (executed by Minecraft `/pair <code>`)
app.post('/api/minecraft/plugin/pair', (req: Request, res: Response) => {
  const { code, serverInfo } = req.body;
  if (!code) {
    res.status(400).json({ success: false, error: 'Code requis' });
    return;
  }

  const cleanCode = String(code).trim().toUpperCase();
  const pair = pairingCodes[cleanCode];

  if (!pair) {
    res.status(400).json({ success: false, error: 'Code invalide ou expiré' });
    return;
  }

  if (Date.now() > pair.expiresAt) {
    delete pairingCodes[cleanCode];
    res.status(400).json({ success: false, error: 'Code expiré. Veuillez en générer un nouveau sur HMD Talk.' });
    return;
  }

  const group = groups[pair.groupId];
  if (!group) {
    delete pairingCodes[cleanCode];
    res.status(404).json({ success: false, error: 'Groupe associé introuvable' });
    return;
  }

  // Invalidate code immediately (single use)
  delete pairingCodes[cleanCode];

  // Generate unique revocable server token
  const token = 'hmd_sec_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
  group.serverToken = token;
  group.status = 'online';
  group.lastSeen = Date.now();

  if (serverInfo) {
    if (serverInfo.ip) group.ip = serverInfo.ip;
    if (serverInfo.port) group.port = Number(serverInfo.port);
    if (serverInfo.version) group.version = serverInfo.version;
    if (serverInfo.loader) group.loader = serverInfo.loader;
    if (serverInfo.motd) group.motd = serverInfo.motd;
  }

  saveJSON(GROUPS_FILE, groups);

  addAuditLog(
    'SERVER_PAIRED',
    serverInfo?.ip || 'MinecraftServer',
    `Serveur connecté au groupe "${group.name}" avec succès`
  );

  notifyGroupUpdate(group.id, 'server_paired', {
    status: 'online',
    ip: group.ip,
    port: group.port,
    version: group.version,
    loader: group.loader
  });

  res.json({
    success: true,
    message: `Connecté avec succès au groupe HMD "${group.name}" !`,
    serverToken: token,
    groupId: group.id,
    groupName: group.name
  });
});

// 3. Plugin Heartbeat (periodic status, TPS, RAM, players)
app.post('/api/minecraft/plugin/heartbeat', authenticatePlugin, (req: Request, res: Response) => {
  const group = (req as any).minecraftGroup as MinecraftGroup;
  const { tps, ramUsedMb, ramMaxMb, players, motd, version } = req.body;

  group.status = 'online';
  group.lastSeen = Date.now();
  if (typeof tps === 'number') group.tps = Math.min(20, Math.max(0, Math.round(tps * 100) / 100));
  if (typeof ramUsedMb === 'number') group.ramUsedMb = ramUsedMb;
  if (typeof ramMaxMb === 'number') group.ramMaxMb = ramMaxMb;
  if (motd) group.motd = motd;
  if (version) group.version = version;
  if (Array.isArray(players)) group.players = players;

  // Check pending commands for this server
  const commands = pendingServerCommands[group.id] || [];
  pendingServerCommands[group.id] = [];

  // Check pending messages from HMD Talk to Minecraft
  const chatMessages = pendingOutboundChat[group.id] || [];
  pendingOutboundChat[group.id] = [];

  notifyGroupUpdate(group.id, 'heartbeat', {
    tps: group.tps,
    ramUsedMb: group.ramUsedMb,
    ramMaxMb: group.ramMaxMb,
    onlineCount: group.players.length,
    players: group.players
  });

  res.json({
    status: 'ok',
    commands,
    outboundChat: chatMessages
  });
});

// 4. Plugin chat synchronization (Minecraft -> HMD Talk)
app.post('/api/minecraft/plugin/chat', authenticatePlugin, (req: Request, res: Response) => {
  const group = (req as any).minecraftGroup as MinecraftGroup;
  const { author, uuid, message } = req.body;

  if (!author || !message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message ou auteur invalide' });
    return;
  }

  const cleanMessage = message.trim();
  if (!cleanMessage) {
    res.status(400).json({ error: 'Message vide' });
    return;
  }

  const chatMsg: MinecraftChatMessage = {
    id: 'mc-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
    groupId: group.id,
    author: String(author),
    uuid: uuid || '',
    isMinecraft: true,
    content: cleanMessage,
    timestamp: Date.now(),
    type: 'chat'
  };

  if (!messages[group.id]) messages[group.id] = [];
  messages[group.id].push(chatMsg);
  if (messages[group.id].length > 200) messages[group.id].shift();
  saveJSON(MESSAGES_FILE, messages);

  notifyGroupUpdate(group.id, 'chat_message', chatMsg);

  res.json({ success: true, messageId: chatMsg.id });
});

// 5. Plugin Server Events (Player join, quit, death, server shutdown)
app.post('/api/minecraft/plugin/events', authenticatePlugin, (req: Request, res: Response) => {
  const group = (req as any).minecraftGroup as MinecraftGroup;
  const { type, player, message } = req.body;

  const eventMsg: MinecraftChatMessage = {
    id: 'evt-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
    groupId: group.id,
    author: player || 'Serveur',
    isMinecraft: true,
    content: message || `${player} a rejoint la partie`,
    timestamp: Date.now(),
    type: type || 'system'
  };

  if (!messages[group.id]) messages[group.id] = [];
  messages[group.id].push(eventMsg);
  saveJSON(MESSAGES_FILE, messages);

  notifyGroupUpdate(group.id, 'server_event', eventMsg);
  res.json({ success: true });
});

/* ============================================================
   API ENDPOINTS : WEB CLIENT GROUPS & CHAT
============================================================ */

// List groups
app.get('/api/minecraft/groups', (req: Request, res: Response) => {
  const now = Date.now();
  // Mark servers offline if no heartbeat in 45s
  Object.values(groups).forEach(g => {
    if (g.status === 'online' && g.lastSeen && now - g.lastSeen > 45000) {
      g.status = 'offline';
    }
  });

  const list = Object.values(groups).map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    logo: g.logo,
    ip: g.ip,
    port: g.port,
    loader: g.loader,
    version: g.version,
    isPublic: g.isPublic,
    ownerId: g.ownerId,
    status: g.status,
    onlineCount: g.players ? g.players.length : 0,
    tps: g.tps,
    createdAt: g.createdAt
  }));
  res.json(list);
});

// Create group
app.post('/api/minecraft/groups', (req: Request, res: Response) => {
  const { name, description, logo, ip, port, loader, version, isPublic, ownerId } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Nom de groupe requis (min 2 caractères)' });
    return;
  }

  const id = 'grp-' + Math.random().toString(36).substring(2, 8) + '-' + Date.now().toString(36);
  const inviteCode = 'HMD-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  const newGroup: MinecraftGroup = {
    id,
    name: name.trim(),
    description: description ? description.trim() : '',
    logo: logo ? logo.trim() : '⛏️',
    ip: ip ? ip.trim() : '127.0.0.1',
    port: port ? Number(port) : 25565,
    loader: loader || 'Paper',
    version: version || '1.21.4',
    isPublic: isPublic !== false,
    inviteCode,
    ownerId: ownerId || 'user',
    createdAt: Date.now(),
    status: 'pending',
    players: [],
    members: {
      [ownerId || 'user']: { role: 'owner', joinedAt: Date.now() }
    }
  };

  groups[id] = newGroup;
  messages[id] = [
    {
      id: 'welcome-' + id,
      groupId: id,
      author: 'HMD Bot',
      isMinecraft: false,
      content: `🎉 Bienvenue dans le groupe Minecraft **${newGroup.name}** ! Pour connecter votre serveur, utilisez la commande **/pair** avec le code de jumelage généré dans les paramètres.`,
      timestamp: Date.now(),
      type: 'system'
    }
  ];

  saveJSON(GROUPS_FILE, groups);
  saveJSON(MESSAGES_FILE, messages);

  addAuditLog('GROUP_CREATED', ownerId || 'user', `Création du groupe Minecraft "${newGroup.name}"`);

  res.json(newGroup);
});

// Get group details
app.get('/api/minecraft/groups/:id', (req: Request, res: Response) => {
  const group = groups[req.params.id];
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const now = Date.now();
  if (group.status === 'online' && group.lastSeen && now - group.lastSeen > 45000) {
    group.status = 'offline';
  }

  res.json({
    ...group,
    serverToken: undefined // Don't leak secret server token to client
  });
});

// Update group settings
app.put('/api/minecraft/groups/:id', (req: Request, res: Response) => {
  const group = groups[req.params.id];
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const { name, description, logo, ip, port, loader, version, isPublic, webmapUrl, hidePlayerCoords } = req.body;
  if (name) group.name = String(name).trim();
  if (typeof description === 'string') group.description = description.trim();
  if (logo) group.logo = String(logo).trim();
  if (ip) group.ip = String(ip).trim();
  if (port) group.port = Number(port);
  if (loader) group.loader = loader;
  if (version) group.version = version;
  if (typeof isPublic === 'boolean') group.isPublic = isPublic;
  if (typeof webmapUrl === 'string') group.webmapUrl = webmapUrl.trim();
  if (typeof hidePlayerCoords === 'boolean') group.hidePlayerCoords = hidePlayerCoords;

  saveJSON(GROUPS_FILE, groups);
  res.json({ success: true, group });
});

// Disconnect / Unlink server from group
app.post('/api/minecraft/groups/:id/unlink', (req: Request, res: Response) => {
  const group = groups[req.params.id];
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  group.serverToken = undefined;
  group.status = 'pending';
  group.players = [];
  saveJSON(GROUPS_FILE, groups);

  addAuditLog('SERVER_UNLINKED', req.body.userId || 'user', `Déconnexion du serveur lié au groupe "${group.name}"`);
  notifyGroupUpdate(group.id, 'server_unlinked', { status: 'pending' });

  res.json({ success: true, message: 'Serveur dissocié avec succès.' });
});

// Group messages (chat history)
app.get('/api/minecraft/groups/:id/messages', (req: Request, res: Response) => {
  const list = messages[req.params.id] || [];
  res.json(list);
});

// Send chat message from HMD Talk to Minecraft
app.post('/api/minecraft/groups/:id/messages', (req: Request, res: Response) => {
  const group = groups[req.params.id];
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const { author, authorId, content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message vide' });
    return;
  }

  const cleanContent = content.trim();

  // Basic anti-spam check
  const recent = (messages[group.id] || []).slice(-5);
  const isDuplicate = recent.some(m => m.authorId === authorId && m.content === cleanContent && (Date.now() - m.timestamp < 3000));
  if (isDuplicate) {
    res.status(429).json({ error: 'Anti-spam : veuillez patienter un instant avant de renvoyer le même message.' });
    return;
  }

  const newMsg: MinecraftChatMessage = {
    id: 'hmd-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
    groupId: group.id,
    author: author || 'Membre HMD',
    authorId: authorId || 'user',
    isMinecraft: false,
    content: cleanContent,
    timestamp: Date.now(),
    type: 'chat'
  };

  if (!messages[group.id]) messages[group.id] = [];
  messages[group.id].push(newMsg);
  if (messages[group.id].length > 200) messages[group.id].shift();
  saveJSON(MESSAGES_FILE, messages);

  // Queue to send to Minecraft server via next heartbeat
  if (!pendingOutboundChat[group.id]) pendingOutboundChat[group.id] = [];
  pendingOutboundChat[group.id].push({
    id: newMsg.id,
    author: newMsg.author,
    content: newMsg.content,
    timestamp: newMsg.timestamp
  });

  notifyGroupUpdate(group.id, 'chat_message', newMsg);
  res.json(newMsg);
});

// SSE Live stream for a group
app.get('/api/minecraft/groups/:id/stream', (req: Request, res: Response) => {
  const groupId = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!sseClients[groupId]) sseClients[groupId] = [];
  sseClients[groupId].push(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ event: 'connected', groupId })}\n\n`);

  req.on('close', () => {
    if (sseClients[groupId]) {
      sseClients[groupId] = sseClients[groupId].filter(client => client !== res);
    }
  });
});

/* ============================================================
   API ENDPOINTS : SECURE ADMIN CONSOLE (Code 1937)
============================================================ */

// Admin login verification - Strictly server side with rate limiting
app.post('/api/admin/login', (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const { code } = req.body;

  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ error: 'Trop de tentatives incorrectes. Veuillez patienter 5 minutes.' });
    return;
  }

  if (!code || String(code).trim() !== ADMIN_CODE) {
    recordLoginAttempt(clientIp, false);
    addAuditLog('ADMIN_LOGIN_FAILED', 'unknown', `Code incorrect tenté depuis ${clientIp}`, clientIp);
    res.status(401).json({ error: 'Code administrateur incorrect' });
    return;
  }

  recordLoginAttempt(clientIp, true);
  const token = 'hmd_admin_session_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
  adminSessions.add(token);

  addAuditLog('ADMIN_LOGIN_SUCCESS', 'admin', `Connexion administrateur réussie depuis ${clientIp}`, clientIp);

  res.json({
    success: true,
    token,
    message: 'Authentification administrateur réussie'
  });
});

// Verify admin token status
app.get('/api/admin/status', (req: Request, res: Response) => {
  const token = req.headers['x-admin-token'] as string;
  const isValid = !!(token && adminSessions.has(token));
  res.json({ authenticated: isValid });
});

// Admin get all servers overview
app.get('/api/admin/servers', authenticateAdmin, (req: Request, res: Response) => {
  const now = Date.now();
  const list = Object.values(groups).map(g => {
    const isOnline = g.status === 'online' && g.lastSeen && now - g.lastSeen < 45000;
    return {
      id: g.id,
      name: g.name,
      ip: g.ip,
      port: g.port,
      loader: g.loader,
      version: g.version,
      status: isOnline ? 'online' : g.serverToken ? 'offline' : 'unpaired',
      lastSeen: g.lastSeen,
      tps: g.tps || (isOnline ? 20.0 : 0),
      ramUsedMb: g.ramUsedMb || 0,
      ramMaxMb: g.ramMaxMb || 0,
      playersCount: g.players ? g.players.length : 0,
      players: g.players || [],
      motd: g.motd || '',
      hasToken: !!g.serverToken
    };
  });
  res.json(list);
});

// Admin execute console command
app.post('/api/admin/console', authenticateAdmin, (req: Request, res: Response) => {
  const { groupId, command, operator } = req.body;
  if (!groupId || !groups[groupId]) {
    res.status(404).json({ error: 'Serveur introuvable' });
    return;
  }

  const group = groups[groupId];
  if (!group.serverToken) {
    res.status(400).json({ error: 'Aucun serveur Minecraft connecté à ce groupe.' });
    return;
  }

  if (!command || !command.trim()) {
    res.status(400).json({ error: 'Commande vide' });
    return;
  }

  const cleanCmd = command.trim();
  const cmdId = 'cmd-' + Math.random().toString(36).substring(2, 9);

  if (!pendingServerCommands[groupId]) pendingServerCommands[groupId] = [];
  pendingServerCommands[groupId].push({
    id: cmdId,
    command: cleanCmd,
    issuedAt: Date.now(),
    operator: operator || 'admin'
  });

  addAuditLog('CONSOLE_COMMAND', operator || 'admin', `Exécution sur ${group.name} : ${cleanCmd}`);

  res.json({
    success: true,
    message: `Commande transmise au serveur : "${cleanCmd}"`,
    commandId: cmdId
  });
});

// Admin power action (start, stop, restart)
app.post('/api/admin/power', authenticateAdmin, (req: Request, res: Response) => {
  const { groupId, action, operator } = req.body;
  const group = groups[groupId];
  if (!group) {
    res.status(404).json({ error: 'Serveur introuvable' });
    return;
  }

  if (!['start', 'stop', 'restart'].includes(action)) {
    res.status(400).json({ error: 'Action invalide' });
    return;
  }

  if (action === 'stop' || action === 'restart') {
    if (!group.serverToken) {
      res.status(400).json({ error: 'Impossible : aucun serveur connecté.' });
      return;
    }
    // Dispatch stop command to server
    if (!pendingServerCommands[groupId]) pendingServerCommands[groupId] = [];
    pendingServerCommands[groupId].push({
      id: 'cmd-power-' + Date.now(),
      command: action === 'restart' ? 'restart' : 'stop',
      issuedAt: Date.now(),
      operator: operator || 'admin'
    });
  }

  addAuditLog('POWER_ACTION', operator || 'admin', `Action "${action.toUpperCase()}" demandée sur ${group.name}`);

  res.json({
    success: true,
    message: `Action ${action} envoyée au serveur avec succès.`
  });
});

// Admin view logs
app.get('/api/admin/logs', authenticateAdmin, (req: Request, res: Response) => {
  res.json(auditLogs);
});

/* ============================================================
   MINECRAFT PLUGIN DOWNLOAD ENDPOINT & SOURCE CODE PACKAGER
============================================================ */

app.get('/api/minecraft/download/plugin-info', (req: Request, res: Response) => {
  res.json({
    name: 'HMD-Minecraft-Plugin',
    version: '1.0.0',
    supportedLoaders: ['Paper', 'Spigot', 'Purpur', 'Fabric', 'Forge', 'NeoForge'],
    supportedVersions: '1.16.5 - 26.1.2',
    sourceDirectory: '/minecraft-plugin',
    mavenCommand: 'mvn clean package',
    downloadJarUrl: '/api/minecraft/download/HMDMinecraft-1.0.0.jar',
    downloadSourceUrl: '/api/minecraft/download/source.zip',
    installInstructions: [
      '1. Téléchargez HMDMinecraft-1.0.0.jar',
      '2. Placez le fichier dans le dossier plugins/ de votre serveur Paper/Spigot/Purpur (ou mods/ pour Fabric/Forge)',
      '3. Redémarrez le serveur Minecraft',
      '4. Exécutez en jeu ou en console : /pair <CODE>',
      '5. Le serveur est synchronisé avec HMD Talk !'
    ]
  });
});

// Direct download for HMDMinecraft-1.0.0.jar
app.get(['/api/minecraft/download/HMDMinecraft-1.0.0.jar', '/api/minecraft/download/plugin.jar'], (req: Request, res: Response) => {
  const mavenJar = path.resolve(process.cwd(), 'minecraft-plugin/target/hmd-minecraft-1.0.0.jar');
  const publicJar = path.resolve(process.cwd(), 'public/downloads/HMDMinecraft-1.0.0.jar');

  const fileToSend = fs.existsSync(mavenJar) ? mavenJar : publicJar;
  if (!fs.existsSync(fileToSend)) {
    res.status(404).send('Plugin JAR introuvable. Veuillez exécuter la commande de compilation.');
    return;
  }

  res.setHeader('Content-Type', 'application/java-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="HMDMinecraft-1.0.0.jar"');
  res.download(fileToSend, 'HMDMinecraft-1.0.0.jar');
});

// Direct download for source zip archive
app.get(['/api/minecraft/download/source.zip', '/api/minecraft/download/hmd-minecraft-source.zip'], (req: Request, res: Response) => {
  const zipPath = path.resolve(process.cwd(), 'public/downloads/hmd-minecraft-source.zip');
  if (!fs.existsSync(zipPath)) {
    res.status(404).send('Archive zip introuvable.');
    return;
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="hmd-minecraft-source.zip"');
  res.download(zipPath, 'hmd-minecraft-source.zip');
});

// Fallback state sync route for RTDB emulator or backend sync
let localSyncStore: Record<string, any> = {};
app.get('/api/sync/store', (req: Request, res: Response) => {
  res.json(localSyncStore);
});
app.post('/api/sync/store', (req: Request, res: Response) => {
  localSyncStore = { ...localSyncStore, ...req.body };
  res.json({ success: true });
});

/* ============================================================
   START SERVER & VITE INTEGRATION
============================================================ */

async function start() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HMD Talk] Backend running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
});
