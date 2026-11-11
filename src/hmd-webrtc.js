import { S, dbSet, dbRemove, dbListen, dbRef, uid, formatTime, initials, avatarColor } from './hmd-state.js';

export const WR = {
  pc: null, localStream: null, screenStream: null,
  callId: null, callType: 'voice', isCaller: false, remoteUserId: null,
  micMuted: false, camOff: true, screenSharing: false,
  signalingUnsub: null, iceUnsub: null,
  iceCandidatesReceived: new Set(),
  silenceTrack: null, blackTrack: null,
};

export const ICE_SERVERS = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]};

let _ringtoneCtx = null, _ringtoneNodes = [], _ringtoneInterval = null;

export function createRingtoneContext() {
  if (!_ringtoneCtx) _ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _ringtoneCtx;
}

export function playRingTone() {
  if (!S.ringtoneEnabled) return;
  stopRingTone();
  const vol = S.ringtoneVolume / 100;
  if (vol === 0) return;
  function playPattern() {
    const ctx = createRingtoneContext();
    if (ctx.state === 'suspended') ctx.resume();
    const notes = [{ freq: 880, start: 0, dur: .12 }, { freq: 1100, start: .15, dur: .12 }, { freq: 880, start: .30, dur: .12 }];
    const masterGain = ctx.createGain();
    masterGain.gain.value = vol * .35;
    masterGain.connect(ctx.destination);
    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t = ctx.currentTime + n.start;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + .02);
      g.gain.setValueAtTime(1, t + n.dur - .03);
      g.gain.linearRampToValueAtTime(0, t + n.dur);
      osc.start(t);
      osc.stop(t + n.dur);
      _ringtoneNodes.push(osc);
    });
  }
  playPattern();
  _ringtoneInterval = setInterval(playPattern, 1800);
}

export function stopRingTone() {
  if (_ringtoneInterval) { clearInterval(_ringtoneInterval); _ringtoneInterval = null; }
  _ringtoneNodes.forEach(n => { try { n.stop(); } catch(e) {} });
  _ringtoneNodes = [];
}

export function createSilenceTrack() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const dst = ctx.createMediaStreamDestination();
  ctx.createGain().connect(dst);
  return dst.stream.getAudioTracks()[0];
}

export function createBlackTrack() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  canvas.getContext('2d').fillRect(0, 0, 2, 2);
  return canvas.captureStream(1).getVideoTracks()[0];
}

export async function replaceTrackInPC(newTrack, kind) {
  if (!WR.pc) return;
  const sender = WR.pc.getSenders().find(s => s.track && s.track.kind === kind);
  if (sender) {
    try { await sender.replaceTrack(newTrack); } catch(e) { console.warn('replaceTrack:', e); }
  }
}

export function setCallStatus(msg) {
  const el = document.getElementById('call-status-bar');
  if (el) el.textContent = msg;
}

export function buildCallTiles(fu, callType) {
  const vids = document.getElementById('call-videos');
  const me = S.users[S.me];
  vids.className = 'call-videos grid-2';
  const localAv = me && me.avatarImg ? `<img src="${me.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : initials(me ? me.username : '');
  const remoteAv = fu && fu.avatarImg ? `<img src="${fu.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : initials(fu ? fu.username : '');
  vids.innerHTML = `
    <div class="call-video-tile speaking" id="local-tile">
      <div class="tile-avatar" id="local-avatar" style="background:${me ? me.color || avatarColor(me.username) : 'var(--grad)'}">${localAv}</div>
      <video id="local-video" autoplay muted playsinline style="display:none;width:100%;height:100%;object-fit:cover;border-radius:10px;"></video>
      <div class="tile-name">${me ? me.username : 'Moi'} (moi)</div>
    </div>
    <div class="call-video-tile" id="remote-tile">
      <div class="tile-avatar" id="remote-avatar" style="background:${fu ? fu.color || avatarColor(fu.username) : 'var(--bg4)'}">${remoteAv}</div>
      <video id="remote-video" autoplay playsinline style="display:none;width:100%;height:100%;object-fit:cover;border-radius:10px;"></video>
      <div class="tile-name">${fu ? fu.username : 'Correspondant'}</div>
      <div id="remote-status" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.6);border-radius:6px;padding:4px 8px;font-size:12px;color:var(--text2);">📞 Sonnerie...</div>
    </div>`;
}

export function attachRemoteStream(stream, kind) {
  const rv = document.getElementById('remote-video');
  const ra = document.getElementById('remote-avatar');
  const rs = document.getElementById('remote-status');
  if (!rv) return;
  if (!rv.srcObject) rv.srcObject = stream;
  if (rs) rs.remove();
  const rt = document.getElementById('remote-tile');
  if (rt) rt.classList.add('speaking');
  if (kind === 'video') {
    rv.style.display = 'block';
    if (ra) ra.style.display = 'none';
  }
}

export function endCall() {
  stopRingTone();
  if (WR.localStream) { WR.localStream.getTracks().forEach(t => t.stop()); WR.localStream = null; }
  if (WR.screenStream) { WR.screenStream.getTracks().forEach(t => t.stop()); WR.screenStream = null; }
  if (WR.silenceTrack) { WR.silenceTrack.stop(); WR.silenceTrack = null; }
  if (WR.blackTrack) { WR.blackTrack.stop(); WR.blackTrack = null; }
  if (WR.pc) { WR.pc.close(); WR.pc = null; }
  if (WR.signalingUnsub) { WR.signalingUnsub(); WR.signalingUnsub = null; }
  if (WR.iceUnsub) { WR.iceUnsub(); WR.iceUnsub = null; }
  if (WR.callId && WR.remoteUserId) {
    const rid = WR.remoteUserId;
    const cid = WR.callId;
    dbRemove('calls/' + rid + '/incoming').catch(() => {});
    dbRemove('calls/' + S.me + '/answer/' + cid).catch(() => {});
  }
  WR.callId = null; WR.remoteUserId = null; WR.isCaller = false; WR.micMuted = false; WR.camOff = true; WR.screenSharing = false;
  WR.iceCandidatesReceived.clear();
  clearInterval(S.callTimer);
  S.callTimer = null; S.inCall = false; S.callSec = 0;
  const cui = document.getElementById('call-ui');
  if (cui) cui.classList.add('hidden');
  const ct = document.getElementById('call-timer');
  if (ct) ct.textContent = '00:00';
  setCallStatus('');
}

export async function toggleCallMic(btn) {
  if (!WR.localStream) return;
  WR.micMuted = !WR.micMuted;
  const at = WR.localStream.getAudioTracks();
  if (!at.length) return;
  if (WR.micMuted) {
    if (WR.silenceTrack) await replaceTrackInPC(WR.silenceTrack, 'audio');
    else at[0].enabled = false;
    btn.classList.add('off'); btn.textContent = '🔇';
  } else {
    at[0].enabled = true;
    await replaceTrackInPC(at[0], 'audio');
    btn.classList.remove('off'); btn.textContent = '🎤';
  }
}

export async function toggleCallCam(btn) {
  if (!WR.localStream) return;
  WR.camOff = !WR.camOff;
  if (WR.camOff) {
    if (!WR.blackTrack || WR.blackTrack.readyState === 'ended') WR.blackTrack = createBlackTrack();
    await replaceTrackInPC(WR.blackTrack, 'video');
    btn.classList.add('off'); btn.textContent = '📵';
    const lv = document.getElementById('local-video');
    const la = document.getElementById('local-avatar');
    if (lv) lv.style.display = 'none';
    if (la) la.style.display = 'flex';
  } else {
    let vt = WR.localStream.getVideoTracks()[0];
    if (vt) vt.enabled = true;
    await replaceTrackInPC(vt, 'video');
    btn.classList.remove('off'); btn.textContent = '📷';
    const lv = document.getElementById('local-video');
    const la = document.getElementById('local-avatar');
    if (lv) { lv.srcObject = WR.localStream; lv.style.display = 'block'; }
    if (la) la.style.display = 'none';
  }
}

export async function toggleScreenShare(btn) {
  if (WR.screenSharing) {
    if (WR.screenStream) { WR.screenStream.getTracks().forEach(t => t.stop()); WR.screenStream = null; }
    WR.screenSharing = false;
    btn.classList.remove('off'); btn.textContent = '🖥️';
    return;
  }
  try {
    WR.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    WR.screenSharing = true;
    btn.classList.add('off'); btn.textContent = '⏹️';
    const st = WR.screenStream.getVideoTracks()[0];
    st.onended = () => { if (WR.screenSharing) toggleScreenShare(btn); };
    const vs = WR.pc ? WR.pc.getSenders().find(s => s.track && s.track.kind === 'video') : null;
    if (vs) await vs.replaceTrack(st);
  } catch (e) {
    WR.screenSharing = false;
  }
}

export function toggleMic(btn) {
  S.micOn = !S.micOn;
  btn.style.opacity = S.micOn ? '1' : '.4';
  btn.textContent = S.micOn ? '🎤' : '🔇';
}

export function toggleDeaf(btn) {
  S.deafOn = !S.deafOn;
  btn.style.opacity = S.deafOn ? '.4' : '1';
  btn.textContent = S.deafOn ? '🔕' : '🎧';
}
