import { useEffect, useMemo, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3333/ws";

const notificationTemplate = {
  fromPeerId: "",
  nickname: "",
  createdAt: ""
};

export function App() {
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [country, setCountry] = useState("world");
  const [iam, setIam] = useState("all");
  const [plan, setPlan] = useState("free");
  const [mode, setMode] = useState("duo");
  const [room, setRoom] = useState(null);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [previousPeer, setPreviousPeer] = useState("");
  const sessionRef = useRef("");

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setLogs((prev) => [message.type, ...prev].slice(0, 8));

      if (message.type === "session:init") {
        setSessionId(message.payload.id);
        sessionRef.current = message.payload.id;
      }
      if (message.type === "room:update") {
        setRoom(message.payload);
        const lastPeer = message.payload.users.find((user) => user.id !== sessionRef.current);
        if (lastPeer) setPreviousPeer(lastPeer.id);
      }
      if (message.type === "back:incoming") {
        setNotifications((prev) => [
          {
            ...notificationTemplate,
            fromPeerId: message.payload.fromPeerId,
            nickname: message.payload.nickname,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);
      }
      if (message.type === "back:response") {
        setLogs((prev) => [`back:${message.payload.accepted ? "accepted" : "declined"}`, ...prev]);
      }
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const roomParticipants = useMemo(() => room?.users?.length ?? 0, [room]);

  const send = (type, payload = {}) => {
    if (!socket || socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify({ type, payload }));
  };

  const saveProfile = () => send("profile:update", { country, iam, plan });

  return (
    <main className="layout">
      <section className="main-card">
        <h1>OMEGLE tv</h1>
        <p className="subtitle">Chat em vídeo leve: foco em WebRTC P2P para dissipar custo de infra.</p>

        <div className="controls-grid">
          <label>
            País
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="world">Mundo</option>
              <option value="br">Brasil</option>
              <option value="pt">Portugal</option>
              <option value="us">Estados Unidos</option>
            </select>
          </label>

          <label>
            Eu sou
            <select value={iam} onChange={(e) => setIam(e.target.value)}>
              <option value="all">Todos</option>
              <option value="male">Homem</option>
              <option value="female">Mulher</option>
              <option value="nb">Não-binário</option>
            </select>
          </label>

          <label>
            Plano
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">Free (até 3)</option>
              <option value="pro">Pro (até 6)</option>
              <option value="enterprise">Enterprise (até 12)</option>
            </select>
          </label>

          <label>
            Modo
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="duo">1:1</option>
              <option value="group">Grupo</option>
            </select>
          </label>
        </div>

        <div className="buttons">
          <button onClick={saveProfile}>Salvar perfil</button>
          <button onClick={() => send("match:next", { mode })}>Próximo</button>
          <button onClick={() => send("match:stop")}>Parar</button>
          <button disabled={!previousPeer} onClick={() => send("match:back-request", { targetPeerId: previousPeer, nickname: "Você" })}>
            Voltar
          </button>
        </div>

        <article className="status-box">
          <h2>Status</h2>
          <p>Sessão: {sessionId || "conectando..."}</p>
          <p>Sala: {room?.id ?? "sem sala"}</p>
          <p>Participantes conectados: {roomParticipants}</p>
          <p>Últimos eventos: {logs.join(", ") || "-"}</p>
        </article>

        <article className="discord-box">
          <h2>Modo Discord + Vídeo</h2>
          <ol>
            <li>Captura vídeo local via getUserMedia.</li>
            <li>Captura áudio de chamada Discord via Virtual Cable (VB-CABLE / PulseAudio monitor).</li>
            <li>Mescla faixas com WebAudio (AudioContext + MediaStreamDestination).</li>
            <li>Envia stream único para peer remoto (vídeo + áudio combinado).</li>
          </ol>
        </article>
      </section>

      <aside className="notification-card">
        <h2>Notificações de Voltar</h2>
        {!notifications.length && <p>Nenhuma solicitação no momento.</p>}
        {notifications.map((n) => (
          <div key={`${n.fromPeerId}-${n.createdAt}`} className="notification-item">
            <p>
              <strong>{n.nickname}</strong> quer retomar conversa.
            </p>
            <div className="notification-actions">
              <button onClick={() => send("match:back-response", { toPeerId: n.fromPeerId, accepted: true })}>Aceitar</button>
              <button className="ghost" onClick={() => send("match:back-response", { toPeerId: n.fromPeerId, accepted: false })}>
                Recusar
              </button>
            </div>
          </div>
        ))}
      </aside>
    </main>
  );
}
