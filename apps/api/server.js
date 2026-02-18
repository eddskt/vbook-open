import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

const clients = new Map();
const waitingQueue = [];
const rooms = new Map();

const PLAN_LIMITS = {
  free: 3,
  pro: 6,
  enterprise: 12
};

function send(ws, type, payload = {}) {
  if (ws?.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function roomSnapshot(room) {
  return {
    id: room.id,
    mode: room.mode,
    users: room.users.map((u) => ({ id: u.id, country: u.country, iam: u.iam }))
  };
}

function createOrJoinRoom(client, preference = "duo") {
  const capacity = preference === "group" ? PLAN_LIMITS[client.plan] ?? 3 : 2;
  let targetRoom;

  for (const room of rooms.values()) {
    if (room.mode === preference && room.users.length < Math.min(capacity, room.capacity)) {
      targetRoom = room;
      break;
    }
  }

  if (!targetRoom) {
    targetRoom = {
      id: randomUUID(),
      mode: preference,
      users: [],
      capacity
    };
    rooms.set(targetRoom.id, targetRoom);
  }

  targetRoom.users.push(client);
  client.roomId = targetRoom.id;

  targetRoom.users.forEach((user) => {
    send(user.ws, "room:update", roomSnapshot(targetRoom));
  });

  if (targetRoom.users.length > 1) {
    targetRoom.users.forEach((user) => {
      send(user.ws, "room:ready", {
        roomId: targetRoom.id,
        peers: targetRoom.users.filter((u) => u.id !== user.id).map((u) => u.id)
      });
    });
  }
}

function removeFromRoom(client) {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) return;

  room.users = room.users.filter((u) => u.id !== client.id);
  room.users.forEach((u) => send(u.ws, "peer:left", { peerId: client.id }));

  if (room.users.length === 0) {
    rooms.delete(room.id);
  } else {
    room.users.forEach((u) => send(u.ws, "room:update", roomSnapshot(room)));
  }

  client.roomId = undefined;
}

function findClientById(id) {
  return [...clients.values()].find((client) => client.id === id);
}

app.get("/health", (_, res) => {
  res.json({ ok: true, rooms: rooms.size, waiting: waitingQueue.length });
});

app.get("/plans", (_, res) => {
  res.json({
    free: { maxParticipants: PLAN_LIMITS.free, includesBackRequest: true },
    pro: { maxParticipants: PLAN_LIMITS.pro, includesBackRequest: true },
    enterprise: { maxParticipants: PLAN_LIMITS.enterprise, includesBackRequest: true }
  });
});

wss.on("connection", (ws) => {
  const client = {
    id: randomUUID(),
    ws,
    plan: "free",
    country: "world",
    iam: "all"
  };

  clients.set(ws, client);
  send(ws, "session:init", { id: client.id });

  ws.on("message", (raw) => {
    try {
      const { type, payload } = JSON.parse(raw.toString());

      switch (type) {
        case "profile:update": {
          client.country = payload.country ?? client.country;
          client.iam = payload.iam ?? client.iam;
          client.plan = payload.plan ?? client.plan;
          send(ws, "profile:updated", { country: client.country, iam: client.iam, plan: client.plan });
          break;
        }
        case "match:next": {
          removeFromRoom(client);
          createOrJoinRoom(client, payload.mode ?? "duo");
          break;
        }
        case "match:stop": {
          removeFromRoom(client);
          send(ws, "match:stopped");
          break;
        }
        case "match:back-request": {
          const target = findClientById(payload.targetPeerId);
          if (!target) {
            send(ws, "back:failed", { reason: "peer-offline" });
            break;
          }

          send(target.ws, "back:incoming", {
            fromPeerId: client.id,
            nickname: payload.nickname ?? "Visitante"
          });
          break;
        }
        case "match:back-response": {
          const requester = findClientById(payload.toPeerId);
          if (!requester) break;
          send(requester.ws, "back:response", {
            accepted: Boolean(payload.accepted),
            peerId: client.id
          });
          break;
        }
        case "signal": {
          const peer = findClientById(payload.toPeerId);
          if (!peer) break;
          send(peer.ws, "signal", {
            fromPeerId: client.id,
            data: payload.data
          });
          break;
        }
        default:
          send(ws, "error", { message: `Unknown event: ${type}` });
      }
    } catch (err) {
      send(ws, "error", { message: "Invalid message", detail: err.message });
    }
  });

  ws.on("close", () => {
    removeFromRoom(client);
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3333;
httpServer.listen(PORT, () => {
  console.log(`Signaling API running on :${PORT}`);
});
