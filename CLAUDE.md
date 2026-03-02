# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **抢庄牛牛 (Qiang Zhuang Niu Niu)** card game platform with three major components:

1. **`server/`** — Go game backend (submodule-based architecture)
2. **`client/`** — Vue 3 mobile H5 game client (player-facing)
3. **`admin_client/`** — Vue 3 admin dashboard (cool-admin-vue 8.x)

---

## Commands

### Go Server (`server/service/`)

```bash
# Run a specific server binary in debug/terminal mode (dev)
cd server/server/main_client && go run . --debug --term

# Build Linux binary for main_client
cd server/server/main_client && ./gobuild.sh   # outputs build_main_client.bz2

# Build Linux binary for robot server
cd server/server/main_robot && ./gobuild.sh    # outputs build_robot_server.bz2

# Build tunnel server
cd server/server/main_tunnel && go build -o build_tunnel ./

# Run tests (service module)
cd server/service && go test ./...

# Run a single test
cd server/service && go test ./mainClient/... -run TestName -v
```

Config files (`server.yaml` or `server_debug.yaml`) must be placed in a `cfg/` directory relative to the binary. In `--debug` mode the binary reads `server_debug.yaml`.

### Mobile Game Client (`client/`)

```bash
cd client
npm run dev       # dev server (host hardcoded to 172.20.10.4:5173 in vite.config.js)
npm run build     # production build
./buildRelease.sh # release build (from project root: ./build_client.sh)
```

### Admin Client (`admin_client/`)

```bash
cd admin_client
pnpm i            # install deps (use pnpm, not npm)
pnpm dev          # dev server at http://localhost:9000
pnpm build        # production build
pnpm lint         # eslint --fix
pnpm format       # prettier write src/
pnpm type-check   # vue-tsc
```

---

## Architecture

### Go Server Structure

The Go code lives under `server/service/` (Go module name: `service`). Two git submodules are resolved locally:
- `compoment` → `server/compoment/` — shared utilities (ORM/beego, Redis, WebSocket conn wrapper, logging, UID generation, alert, etc.)
- `thirdcode/beego/v2` → `server/thirdcode/` — patched beego v2

**Key packages:**

| Package | Purpose |
|---|---|
| `comm/` | Shared middleware (IP rate-limit, CORS, token auth), WebSocket protocol types (`Request`/`Response`/`PushData`), config, logging, error types |
| `initMain/` | Daemon runner framework — process lifecycle (start/stop/reload/restart), monitor process, PID management |
| `mainClient/` | Client HTTP+WebSocket server: `router.go` registers routes; `handler.go` contains all game action handlers; `ctl.go` has the WS entry/dispatch loop |
| `mainClient/game/` | `RoomManager` — singleton actor-model manager; all state mutations go through `opCh` channel (`syncOp`/`syncOpErr` helpers) |
| `mainClient/game/qznn/` | Core 抢庄牛牛 game logic: room FSM, card dealing, settlement, win-rate strategy system (`UserStrategyData`, 48-hour rolling window profit control) |
| `mainClient/game/znet/` | WebSocket router push type — sends `PushRouter` to clients to navigate lobby↔game |
| `mainClient/game/strategy/` | Pluggable strategy interface for win-rate control |
| `mainRobot/` | Bot management: polls `/rpc/qznn-data`, plans robot actions (fill rooms with real users, maintain pure-robot rooms), manages robot lifecycle via WebSocket |
| `mainSchedule/` | Periodic scheduled tasks (statistics aggregation) |
| `modelAdmin/` | DB models for admin data (statistics: `ModelStaUser`, `ModelStaPeriod`, system params) |
| `modelClient/` | DB models for players (`ModelUser`, game records, balance locking) |
| `modelComm/` | Shared cache helpers (`WrapCache`) |

**Server binaries** (in `server/server/`):
- `main_client` — serves the game (`:HttpPort` for players, `:AdminPort` for admin RPC/pprof)
- `main_robot` — bot manager process (connects to `main_client` via WS)
- `main_tunnel` — SSH tunnel process (reads `cfg/server.yaml`)

**WebSocket protocol:**
- Client sends `Request{Cmd, Seq, Data}`
- Server responds with `Response{Cmd, Seq, Code, Msg, Data}` (code 0 = success)
- Server pushes `PushData{Cmd: "onServerPush", PushType, Data}` for unsolicited events

### Mobile Client (`client/`)

Vue 3 + Vant 4 mobile H5 app. Single `GameClient` class (`Network.js`) handles all WebSocket logic: connect, heartbeat, reconnect, message routing. The singleton is exported from `socket.js`.

- **Views:** `LobbyView.vue`, `GameView.vue`, `LoadingPage.vue`
- **Pinia stores** in `src/stores/`
- **Alias:** `@` → `src/`
- WS URL: `ws://<host>/ws?app=<appId>&uid=<uid>&token=<token>`

### Admin Client (`admin_client/`)

cool-admin-vue 8.x framework. Modular architecture under `src/modules/` and `src/plugins/`.

**Import aliases:**
- `/@` → `src/`
- `/$` → `src/modules/`
- `/#` → `src/plugins/`
- `/~` → `packages/`

Service type descriptions are in `build/cool/eps.d.ts`. When adding new modules/plugins, follow the structure in `.cursor/rules/`.

Admin API backend proxied to `http://127.0.0.1:8001` (configured in `src/config/proxy.ts`).

---

## Key Design Patterns

**RoomManager actor model:** All room state is owned by a single background goroutine. External callers submit closures via `opCh` and block on a result channel (`syncOp`/`syncOpErr`). Never access room state directly from outside this pattern.

**Win-rate strategy system:** `qznn/logic.go` contains a `UserStrategyData` struct and a 48-hour rolling window profit control system. The system adjusts per-user "Lucky" values before dealing cards to hit target profit margins. This is the most complex part of the backend.

**Daemon lifecycle:** Servers use `initMain.DaemonRunner` with a monitor subprocess. Use `--start`/`--stop`/`--reload`/`--restart` flags in production. Use `--debug --term` for local development (logs to terminal, skips PID locking).
