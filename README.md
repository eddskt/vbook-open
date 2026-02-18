# OMEGLE tv (MVP)

Projeto base para um chat aleatório estilo Omegle com foco em **baixo custo de infraestrutura** usando WebRTC P2P (custo principal no hardware/rede dos usuários), com opção de evolução para SFU/MCU conforme escala.

## Funcionalidades implementadas no MVP

- Controles estilo Omegle: **Próximo**, **Parar**, filtro por **País** e **Eu sou**.
- Botão **Voltar** com aprovação em painel lateral de **Notificações** (aceitar/recusar).
- Suporte a modo **1:1** e modo **grupo**, com limite por plano (free/pro/enterprise).
- Base de sinalização para WebRTC via WebSocket.
- Blueprint para modo "vídeo + áudio Discord" (mixagem de áudio local com Web Audio API).

## Stack sugerida (e usada no esqueleto)

- **Frontend**: React + Vite.
- **Backend sinalização**: Node.js + Express + WS.
- **Mensageria**: RabbitMQ (fila para matching, moderação, anti-spam, billing events).
- **Cache/estado distribuído**: Redis (presença, fila de espera, rate-limit).
- **NAT traversal**: TURN/STUN com coturn.

## Como rodar localmente

```bash
npm install
npm run dev -ws
```

Ou com Docker Compose:

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Web: `http://localhost:5173`
- API: `http://localhost:3333/health`
- RabbitMQ UI: `http://localhost:15672`

## Arquitetura para dissipar custo (usuário + servidor)

1. **Até 3 pessoas**: usar malha P2P (mesh) com bitrate adaptativo (simulcast não obrigatório no MVP).
2. **Acima de 3**: migrar para SFU (LiveKit/mediasoup/Janus) por sala premium.
3. **Fallback dinâmico**: detectar CPU/rede ruim e rebaixar resolução/fps automaticamente.
4. **Codec moderno**: VP9/AV1 quando disponível; H264 fallback.
5. **TURN só quando necessário**: priorizar conexão direta para reduzir custo de banda de servidor.

## Integração Discord + vídeo

No browser, não existe API oficial para capturar áudio do Discord diretamente por segurança, então o caminho viável é:

- Usuário usa virtual audio cable (Windows/macOS/Linux).
- Frontend captura:
  - câmera (vídeo + mic opcional)
  - entrada virtual (áudio Discord)
- Faz mixagem local com WebAudio e envia stream resultante para o peer.

## Opções de hospedagem / pay-per-use

### Opções com baixo custo inicial

- **Fly.io / Railway / Render** para API de sinalização.
- **Cloudflare** (Workers + Durable Objects) para presence/chat em escala global.
- **Supabase Realtime** para eventos leves se quiser reduzir esforço backend.

### AWS pay-as-you-go (produção)

- API: ECS Fargate ou Lambda + API Gateway (separar WS e HTTP).
- Redis: ElastiCache (ou MemoryDB).
- Mensageria: RabbitMQ gerenciado (Amazon MQ) ou SQS/SNS (se aceitar mudança de modelo).
- TURN: EC2 spot com autoscaling + coturn.
- Observabilidade: CloudWatch + OpenTelemetry.

## Próximos passos recomendados

1. Persistir usuário e planos com Stripe + webhook.
2. Adicionar moderação (NudeNet/AI moderation pipeline) assíncrona via fila.
3. Implementar SFU para salas premium (LiveKit é o caminho mais rápido).
4. Implementar gravação opcional por consentimento (compliance LGPD).

## Troubleshooting: `npm install` com erro 403

Se você ver `E403 Forbidden - GET https://registry.npmjs.org/...`, isso normalmente não é erro do projeto.
Neste ambiente, há proxy corporativo forçado via variáveis `HTTP_PROXY/HTTPS_PROXY` e o acesso ao registry público está bloqueado por política.

### Como validar rapidamente

```bash
npm view cors version --verbose
```

Se retornar 403 no fetch do registry, o bloqueio é de rede/política.

### Como resolver fora deste ambiente

1. Configurar um registry permitido (ex.: Artifactory/Nexus/CodeArtifact da empresa):

```bash
npm config set registry https://<seu-registry-interno>/
```

2. Se o registry exigir autenticação, fazer login/token (`npm login` ou `.npmrc` com token).
3. Reexecutar:

```bash
npm install
```

> No código deste repositório não há dependência privada nem versão inválida; o bloqueio ocorre antes do download dos pacotes públicos.
