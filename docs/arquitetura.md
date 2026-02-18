# Arquitetura proposta para escala

## Serviços

- `api-signaling` (Node + WS): sessão, matchmaking, eventos de controle.
- `matchmaking-worker` (Node + RabbitMQ): regras de fila, país/gênero/interesses.
- `presence` (Redis): online/offline e heartbeat.
- `media`:
  - MVP: P2P WebRTC.
  - Premium: SFU (LiveKit/mediasoup) por região.
- `turn` (coturn): relay apenas quando necessário.

## Filas RabbitMQ sugeridas

- `matchmaking.requests`
- `matchmaking.results`
- `moderation.frames`
- `billing.usage`
- `notifications.back-request`

## Regras de produto

- Free: até 3 em vídeo na sala.
- Pro/Enterprise: configurações avançadas e salas maiores.
- Botão voltar sempre exige consentimento explícito via notificação lateral.

## Estratégia anti-custo

- Bandwidth de vídeo em P2P distribuído nos clientes.
- Áudio com `Opus` e VAD/DTX para reduzir bytes.
- Congestion control no browser (`RTCRtpSender.setParameters`).
- TURN hard-limit por usuário para evitar abuso.
