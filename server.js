const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 10000;
const MAX_PLAYERS_PER_ROOM = 10;
const rooms = new Map();
const clients = new Set();

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    const body = JSON.stringify({ ok: true, game: "Neon Trigger Online", online: clients.size, rooms: rooms.size, maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM });
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(body);
  }
  res.writeHead(404); res.end("Not found");
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws") { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function roomPlayers(room) { return [...room.players].map(p => ({ id: p.id, name: p.name })); }
function broadcastRoom(room, data, except) {
  for (const p of room.players) if (p.ws !== except) send(p.ws, data);
}
function onlineCount() { return clients.size; }
function broadcastOnline() {
  const payload = { type: "online", online: onlineCount(), rooms: rooms.size };
  for (const ws of clients) send(ws, payload);
}
function cleanString(value, max, fallback) {
  return typeof value === "string" ? value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, max) || fallback : fallback;
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.players = room.players.filter(p => p.ws !== ws);
  ws.room = null;
  broadcastRoom(room, { type: "player-left", id: ws.playerId, players: roomPlayers(room) });
  if (room.players.length === 0) rooms.delete(room.id);
  broadcastOnline();
}

wss.on("connection", ws => {
  ws.isAlive = true;
  ws.playerId = Math.random().toString(36).slice(2, 10);
  ws.room = null;
  clients.add(ws);
  send(ws, { type: "welcome", id: ws.playerId, maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM });
  send(ws, { type: "online", online: onlineCount(), rooms: rooms.size });
  broadcastOnline();

  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "Некорректный JSON" }); }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "join") {
      leave(ws);
      const roomId = cleanString(msg.room, 16, "lobby").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 16) || "LOBBY";
      const name = cleanString(msg.name, 20, "Игрок");
      let room = rooms.get(roomId);
      if (!room) { room = { id: roomId, players: [] }; rooms.set(roomId, room); }
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        if (room.players.length === 0) rooms.delete(roomId);
        return send(ws, { type: "error", message: "Комната заполнена (максимум 10 игроков)" });
      }
      ws.room = room;
      ws.playerName = name;
      room.players.push({ id: ws.playerId, name, ws });
      send(ws, { type: "joined", room: roomId, id: ws.playerId, players: roomPlayers(room), maxPlayers: MAX_PLAYERS_PER_ROOM });
      broadcastRoom(room, { type: "player-joined", player: { id: ws.playerId, name }, players: roomPlayers(room) }, ws);
      broadcastOnline();
      return;
    }

    if (msg.type === "leave") return leave(ws);
    const room = ws.room;
    if (!room) return send(ws, { type: "error", message: "Сначала войдите в комнату" });

    if (msg.type === "move") {
      const x = Number(msg.x), y = Number(msg.y), angle = Number(msg.angle);
      if (![x,y,angle].every(Number.isFinite)) return;
      broadcastRoom(room, { type: "player-moved", id: ws.playerId, x: Math.max(-10000, Math.min(10000,x)), y: Math.max(-10000, Math.min(10000,y)), angle }, ws);
    } else if (msg.type === "shoot") {
      broadcastRoom(room, { type: "player-shot", id: ws.playerId, x: Number(msg.x)||0, y: Number(msg.y)||0, angle: Number(msg.angle)||0 }, ws);
    } else if (msg.type === "chat") {
      const text = cleanString(msg.text, 160, "");
      if (text) broadcastRoom(room, { type: "chat", id: ws.playerId, name: ws.playerName, text });
    }
  });

  ws.on("close", () => { leave(ws); clients.delete(ws); broadcastOnline(); });
  ws.on("error", () => { leave(ws); clients.delete(ws); broadcastOnline(); });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, "0.0.0.0", () => console.log(`Neon Trigger Online listening on ${PORT}`));
