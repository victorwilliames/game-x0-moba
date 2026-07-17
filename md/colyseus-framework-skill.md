# Colyseus Framework — Complete Reference (Claude Skill)

> **Version:** 0.17 | **Runtime:** Node.js / Bun | **Language:** TypeScript/JavaScript
> **Source:** https://docs.colyseus.io/ | **Copyright:** 2026 Endel Dreyer

Colyseus is an open-source Node.js framework for building authoritative game servers with real-time state synchronization, matchmaking, and integration into any game engine or frontend.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Vite Integration](#vite-integration)
3. [Server Configuration](#server-configuration)
4. [Room API](#room-api)
5. [State & Schema](#state--schema)
6. [Client SDK](#client-sdk)
7. [React Integration](#react-integration)
8. [Authentication](#authentication)
9. [Matchmaking](#matchmaking)
10. [HTTP Routes](#http-routes)
11. [Transport Layers](#transport-layers)
12. [Presence (IPC)](#presence-ipc)
13. [Driver (Room Persistence)](#driver-room-persistence)
14. [Tools & Development](#tools--development)
15. [Database & Persistence](#database--persistence)
16. [Best Practices](#best-practices)
17. [Recipes](#recipes)
18. [3rd-Party Packages](#3rd-party-packages)

---

## Quick Start

### Node.js

```bash
npm create colyseus-app@latest ./my-server
cd my-server
npm start
```

### Bun

```bash
bun create colyseus-app@latest ./my-server
cd my-server
bun add @colyseus/bun-websockets
bun run src/index.ts
```

### From Scratch (TypeScript)

```bash
mkdir colyseusServer && cd colyseusServer
npm init
npm i colyseus
npm i --save-dev typescript ts-node-dev
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "module": "commonjs",
    "target": "es2016",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false
  }
}
```

**package.json scripts:**
```json
{
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "ts-node-dev src/main.ts",
    "start:dev": "ts-node-dev --respawn src/main.ts",
    "start:prod": "node dist/main.js"
  }
}
```

**src/main.ts:**
```typescript
import { defineServer } from "colyseus";

const PORT = Number(process.env.PORT) || 3000;

const server = defineServer({
    // server options here
});

server.listen(PORT);
```

---

## Vite Integration

> **Source:** https://colyseus.io/blog/vite-integration/ | Ships with Colyseus 0.17+

Colyseus ships with a first-class Vite plugin that lets you develop and build your multiplayer game from a single config. Both client and game server run from one command, with hot module reloading for room definitions without requiring a separate process.

### Installation

```bash
npm install colyseus vite
```

### Configuration

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import { colyseus } from 'colyseus/vite';

export default defineConfig({
    plugins: [
        colyseus({
            serverEntry: '/src/server/index.ts',
        }),
    ],
});
```

### Server Entry File

**src/server/index.ts:**
```typescript
import { defineServer, defineRoom } from 'colyseus';
import { MyRoom } from './MyRoom';

export const server = defineServer({
    rooms: {
        my_room: defineRoom(MyRoom),
    },
});
```

**Alternative export pattern (bare rooms):**
```typescript
export const rooms = {
    my_room: defineRoom(MyRoom),
};
```

### Commands

```bash
# Development (client + server with HMR)
npx vite

# Production build (both client and server)
npx vite build --app
```

### Build Output

```
dist/
  client/          # Static client assets (HTML, JS, CSS)
  server/
    server.mjs     # Standalone server entry point
```

### Plugin Options

```typescript
colyseus({
    serverEntry: '/src/server/index.ts',  // required — path to server definitions
    port: 2567,                            // default production port
    serveClient: true,                     // serve built client files from server
    quiet: false,                          // suppress log messages
    loadWsTransport: () => import('@colyseus/ws-transport'),  // custom transport loader
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serverEntry` | string | required | Path to server definitions file |
| `port` | number | 2567 | Production server port |
| `serveClient` | boolean | true | Serve client assets from production server via express |
| `quiet` | boolean | false | Suppress plugin log messages |
| `loadWsTransport` | function | — | Custom WebSocket transport loader |

### How It Works

- **Development:** The plugin leverages Vite's Environment API to create a dedicated server environment alongside the client environment. Colyseus integrates with Vite's dev server rather than creating its own — no proxy configuration needed.
- **Hot Module Reloading:** When room classes are modified, server code hot-reloads while preserving running room state. Connected clients reconnect automatically without data loss.
- **Production:** A single `npx vite build --app` generates both client assets and a standalone server entry point. With `serveClient: true`, the production server delivers client files directly via express middleware.

---

## Server Configuration

The `defineServer()` function configures the entire server instance:

```typescript
import { defineServer, defineRoom } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

const server = defineServer({
    transport: new WebSocketTransport({ pingInterval: 10000 }),
    rooms: {
        chat: defineRoom(ChatRoom),
        battle: defineRoom(BattleRoom).filterBy(['mode']).sortBy({ clients: -1 })
    },
    express: (app) => {
        app.get("/", (req, res) => res.send("Hello!"));
    }
});

server.listen(2567);
```

### Server Options

| Option | Description | Default |
|--------|-------------|---------|
| `transport` | Bidirectional communication handler | WebSocketTransport |
| `driver` | Room persistence for matchmaking | LocalDriver (in-memory) |
| `presence` | Inter-process communication | LocalPresence (in-memory) |
| `rooms` | Room type definitions | — |
| `express` | Express route configuration callback | — |
| `routes` | Type-safe API routes (alternative to express) | — |
| `devMode` | Restore rooms on restart during development | false |
| `gracefullyShutdown` | Auto-register shutdown routine | true |
| `isStandaloneMatchMaker` | Process only handles matchmaking | false |
| `selectProcessIdToCreateRoom` | Custom load-balancing callback | fewest rooms |
| `logger` | Custom logger instance | console |

### Room Definition Methods

```typescript
defineRoom(RoomClass)
    .filterBy(['mode', 'maxClients'])  // matchmaking filters (stored options)
    .sortBy({ clients: -1 })           // room selection priority (-1 desc, 1 asc)
    .enableRealtimeListing()           // notify LobbyRoom of changes
```

**`filterBy()`** restricts which options are stored for matchmaking filtering.

**`sortBy()`** prioritizes which room to join when multiple match the filter.

**`enableRealtimeListing()`** notifies LobbyRoom during `onCreate`, `onJoin`, `onLeave`, `onDispose`.

### Lifecycle Events on Room Definitions

```typescript
const battleDef = defineRoom(BattleRoom);
battleDef.on("create", (room) => { });
battleDef.on("dispose", (room) => { });
battleDef.on("join", (room, client) => { });
battleDef.on("leave", (room, client) => { });
battleDef.on("lock", (room) => { });
battleDef.on("unlock", (room) => { });
```

### Server Methods

| Method | Description |
|--------|-------------|
| `server.listen(port)` | Bind transport to port |
| `server.onBeforeShutdown(cb)` | Pre-shutdown hook |
| `server.onShutdown(cb)` | Post-shutdown hook |
| `server.gracefullyShutdown()` | Trigger shutdown manually |
| `server.simulateLatency(ms)` | Dev-only latency simulation |

---

## Room API

### Room Lifecycle Methods

```typescript
import { Room, Client } from "colyseus";

export class MyRoom extends Room {
    state = new MyState();

    onCreate(options) { }        // room created
    onJoin(client, options, auth) { }  // client joined
    onLeave(client, code) { }    // client left permanently
    onDispose() { }              // room being destroyed

    // Message handlers (object-based)
    messages = {
        "move": (client, message) => { },
        "chat": (client, message) => { }
    };
}
```

### Room Properties

| Property | Description |
|----------|-------------|
| `this.state` | The room's synchronized state |
| `this.clients` | Array of connected clients |
| `this.roomId` | Unique room instance ID |
| `this.presence` | Presence API instance |
| `this.clock` | Timing/scheduling interface |
| `this.maxClients` | Maximum clients allowed |
| `this.patchRate` | State sync frequency (default: 50ms / 20fps) |

### Room Methods

| Method | Description |
|--------|-------------|
| `this.broadcast(type, message, options?)` | Send to all clients |
| `this.send(client, type, message)` | Send to specific client |
| `this.lock()` | Prevent new joins |
| `this.unlock()` | Allow new joins |
| `this.disconnect()` | Disconnect all clients and dispose |
| `this.setPrivate()` | Hide from matchmaking queries |
| `this.setMetadata(meta)` | Update room metadata |
| `this.setSimulationInterval(cb, ms?)` | Fixed-step game loop |
| `this.allowReconnection(client, seconds)` | Enable reconnection window |

### Messages

#### Server-Side: Receiving Messages

```typescript
import { validate } from "colyseus";
import { z } from "zod";

messages = {
    // Simple handler
    "move": (client, message) => {
        // message is untyped
    },

    // Validated handler with Zod
    "chat": validate(
        z.object({ text: z.string().max(500) }),
        function (client, message) {
            // message.text is typed and validated
            this.broadcast("chat", { sender: client.sessionId, text: message.text });
        }
    ),

    // Numeric message type
    0: (client, payload) => {
        // Used for performance-critical messages
    }
};
```

#### Message Composability

Reusable, type-safe message handlers with `Messages<R>`:

```typescript
import { Messages } from "colyseus";

export const chatMessages: Messages<MyRoom> = {
    chat: validate(
        z.object({ text: z.string().max(500) }),
        function (client, message) {
            this.broadcast("chat", {
                sender: client.sessionId,
                text: message.text,
            });
        }
    ),
};

// Compose into room using spread:
messages = {
    ...chatMessages,
    ...gameMessages,  // later handlers override earlier ones with same name
};
```

> Use regular functions (not arrow functions) when accessing `this` inside `validate()`.

#### Client-Side: Sending Messages

```typescript
room.send("move", { direction: "left" });
room.sendBytes(new Uint8Array([1, 2, 3]));  // raw bytes for custom encoding
```

### Reconnection

#### Server-Side

```typescript
export class MyRoom extends Room {
    onDrop(client, code) {
        // Client disconnected unexpectedly
        // Call allowReconnection to permit rejoining
        this.allowReconnection(client, 30); // 30 second window

        // Mark player as disconnected in state (for UI)
        const player = this.state.players.get(client.sessionId);
        player.connected = false;
    }

    onReconnect(client) {
        // Client successfully reconnected
        const player = this.state.players.get(client.sessionId);
        player.connected = true;
    }

    onLeave(client, code) {
        // Permanent leave — clean up player data
        this.state.players.delete(client.sessionId);
    }
}
```

#### Client-Side

```typescript
// Callbacks
room.onDrop(() => { console.log("Connection lost, retrying..."); });
room.onReconnect(() => { console.log("Reconnected!"); });
room.onLeave((code) => { console.log("Left room:", code); });

// Configuration
room.reconnection.enabled = true;
room.reconnection.maxRetries = 15;
room.reconnection.delay = 100;       // initial delay ms
room.reconnection.maxDelay = 5000;   // max delay ms
room.reconnection.minUptime = 5000;  // min connection time before auto-reconnect
room.reconnection.maxEnqueuedMessages = 10;  // buffer during disconnect
```

**Message buffering:** Messages sent via `room.send()` during disconnection are automatically queued (up to `maxEnqueuedMessages`) and transmitted after reconnection.

#### Close Codes

| Code | Name | Meaning |
|------|------|---------|
| 1006 | `ABNORMAL_CLOSURE` | Unexpected closure |
| 4000 | `CONSENTED` | Client called `room.leave()` |
| 4001 | `SERVER_SHUTDOWN` | Graceful shutdown |
| 4003 | `FAILED_TO_RECONNECT` | All retries exhausted |
| 4010 | `MAY_TRY_RECONNECT` | Dev mode shutdown |

#### Best Practices

- Always call `allowReconnection()` in `onDrop()` for reconnection support
- Don't remove player data in `onDrop()` — defer cleanup to `onLeave()`
- Mark players as "disconnected" in state for UI representation
- Set reasonable timeouts (30s for fast-paced, 5min for turn-based)

### Timing Events

All intervals/timeouts are cleared automatically on room disposal.

```typescript
// Repeated execution
const delayed = this.clock.setInterval(() => {
    // game loop logic
}, 1000);

// One-time execution
this.clock.setTimeout(() => {
    // delayed logic
}, 5000);

// Clear all timers
this.clock.clear();

// Control individual timers
delayed.pause();
delayed.resume();
delayed.clear();
delayed.reset();

// Clock properties (read-only)
this.clock.elapsedTime;  // ms since clock.start()
this.clock.currentTime;  // current time ms
this.clock.deltaTime;    // ms since last tick
```

**Delayed instance properties:**
- `delayed.elapsedTime` — elapsed time in ms
- `delayed.active` — boolean, is timer running
- `delayed.paused` — boolean, is timer paused

### Exception Handling

Available since `@colyseus/core` 0.15.55:

```typescript
export class MyRoom extends Room {
    onUncaughtException(error, methodName) {
        console.error(`Error in ${methodName}:`, error);
        // Handle gracefully — log, notify, etc.
    }
}
```

**Methods that can throw:** `onCreate`, `onAuth`, `onJoin`, `onLeave`, `onDispose`, `onMessage`, `setSimulationInterval`, `clock.setTimeout`, `clock.setInterval`

**Exception types:**

| Type | Properties |
|------|------------|
| `OnCreateException` | `options` |
| `OnAuthException` | `client`, `options` |
| `OnJoinException` | `client`, `options` |
| `OnLeaveException` | `client`, `code` |
| `OnMessageException` | `client`, `payload`, `type` |
| `OnDisposeException` | — |
| `SimulationIntervalException` | — |
| `TimedEventException` | `args` |

> **Important:** Exceptions in `onAuth` and `onJoin` still prevent clients from joining, even if caught.

### Built-in Rooms

#### LobbyRoom

Live listing of available rooms with real-time updates:

```typescript
import { defineServer, defineRoom, LobbyRoom } from "colyseus";

const server = defineServer({
    rooms: {
        lobby: defineRoom(LobbyRoom),
        my_room: defineRoom(MyRoom).enableRealtimeListing()
    }
});
```

**Client-side (TypeScript):**
```typescript
import { Client, RoomAvailable } from "@colyseus/sdk";

const client = new Client("http://localhost:2567");
const lobby = await client.joinOrCreate("lobby");

let allRooms: RoomAvailable[] = [];

lobby.onMessage("rooms", (rooms) => {
    allRooms = rooms;
});

lobby.onMessage("+", ([roomId, room]) => {
    const roomIndex = allRooms.findIndex((room) => room.roomId === roomId);
    if (roomIndex !== -1) {
        allRooms[roomIndex] = room;
    } else {
        allRooms.push(room);
    }
});

lobby.onMessage("-", (roomId) => {
    allRooms = allRooms.filter((room) => room.roomId !== roomId);
});
```

**Client-side (Unity C#):**
```csharp
using Colyseus;

Client client = new Client("http://localhost:2567");
Room lobbyRoom = await client.JoinOrCreate("lobby");

List<RoomAvailable> allRooms = new List<RoomAvailable>();

lobbyRoom.OnMessage("rooms", (RoomAvailable[] rooms) => {
    allRooms.Clear();
    allRooms.AddRange(rooms);
});

lobbyRoom.OnMessage("+", (object[] message) => {
    string roomId = (string)message[0];
    var room = (RoomAvailable)message[1];
    int roomIndex = allRooms.FindIndex((r) => r.roomId == roomId);
    if (roomIndex != -1) { allRooms[roomIndex] = room; }
    else { allRooms.Add(room); }
});

lobbyRoom.OnMessage("-", (string roomId) => {
    allRooms.RemoveAll((r) => r.roomId == roomId);
});
```

**Filtering rooms:**
```typescript
// On join
const lobby = await client.joinOrCreate("lobby", {
    filter: { name: "my_room", metadata: { gameMode: "deathmatch" } }
});

// Dynamic filter change
lobby.send("filter", { name: "my_room", metadata: { gameMode: "ctf" } });
```

#### QueueRoom

Matchmaking with rank-based grouping, teams, and timeout escalation:

```typescript
import { defineServer, defineRoom, QueueRoom } from "colyseus";

const server = defineServer({
    rooms: {
        queue: defineRoom(QueueRoom, {
            matchRoomName: "battle",       // required: target room name
            maxPlayers: 4,                 // default: 4
            maxWaitingCycles: 15,          // default: 15
            maxWaitingCyclesForPriority: 10, // default: 10
            maxTeamSize: 2,               // enable team grouping
            allowIncompleteGroups: false,  // start with fewer players
            compare: (a, b) => Math.abs(a.rank - b.rank) <= 200,
            onGroupReady: async (group) => {
                // Custom room creation/selection logic
            }
        })
    }
});
```

**Client-side:**
```typescript
const queue = await client.joinOrCreate("queue", {
    rank: 1500,
    teamId: "team-abc",
    mode: "ranked"
});

queue.onMessage("clients", (count) => {
    console.log(`Group size: ${count}`);
});

queue.onMessage("seat", async (reservation) => {
    // Optional: confirm before consuming
    const room = await client.consumeSeatReservation(reservation);
});
```

**Queue Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `matchRoomName` | string | required | Target room to create |
| `maxPlayers` | number | 4 | Players per match |
| `maxWaitingCycles` | number | 15 | Cycles before group ready |
| `maxWaitingCyclesForPriority` | number | 10 | High-priority threshold |
| `maxTeamSize` | number | — | Enable team grouping |
| `allowIncompleteGroups` | boolean | false | Allow undersized matches |
| `compare` | function | — | Custom compatibility check |
| `onGroupReady` | function | — | Custom room creation hook |

#### RelayRoom

Lightweight message relay for prototypes or frontend-driven games:

```typescript
const server = defineServer({
    rooms: {
        relay: defineRoom(RelayRoom, {
            maxClients: 4,
            allowReconnectionTime: 120  // seconds
        })
    }
});
```

**Client-side:**
```typescript
const relay = await client.joinOrCreate("your_relayed_room");

// Listen for player events
relay.state.players.onAdd((player, sessionId) => { });
relay.state.players.onRemove((player, sessionId) => { });

// Send messages (broadcast to others)
relay.send("chat", { text: "Hello!" });

// Receive messages from others
relay.onMessage("chat", ({ sessionId, message }) => {
    console.log(`${sessionId}: ${message.text}`);
});
```

> No server validation — implement a custom room with backend logic for production.

---

## State & Schema

### Defining State

Only `@type()`-decorated fields are synchronized to clients:

```typescript
import { Schema, type, MapSchema, ArraySchema, SetSchema, CollectionSchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("string") name: string;
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") connected: boolean = true;

    // NOT synchronized — server-only
    inputQueue: any[] = [];
}

export class MyState extends Schema {
    @type("string") currentTurn: string;
    @type({ map: Player }) players = new MapSchema<Player>();
    @type(["string"]) messages = new ArraySchema<string>();
    @type("number") tickCount: number = 0;
}
```

**JavaScript (no decorators):**
```javascript
import { schema } from "@colyseus/schema";

const Player = schema({
    name: "string",
    x: "number",
    y: "number",
    connected: "boolean"
});

const MyState = schema({
    currentTurn: "string",
    players: { map: Player },
    messages: ["string"]
});
```

### Using State in Room

```typescript
import { Room } from "colyseus";
import { MyState } from "./MyState";

export class MyRoom extends Room {
    state = new MyState();
}
```

### Primitive Types

| Type | Description | Byte Range |
|------|-------------|------------|
| `string` | UTF-8 strings | max 4294967295 bytes |
| `boolean` | true/false | 1 byte |
| `number` | Variable-length encoding (auto) | varies |
| `int8` | Signed -128 to 127 | 1 byte |
| `int16` | Signed -32768 to 32767 | 2 bytes |
| `int32` | Signed -2B to 2B | 4 bytes |
| `int64` | Signed 64-bit | 8 bytes |
| `uint8` | Unsigned 0 to 255 | 1 byte |
| `uint16` | Unsigned 0 to 65535 | 2 bytes |
| `uint32` | Unsigned 0 to 4294967295 | 4 bytes |
| `uint64` | Unsigned 64-bit | 8 bytes |
| `float32` | Single precision float | 4 bytes |
| `float64` | Double precision float | 8 bytes |
| `bigInt64` | 64-bit BigInt (signed) | 8 bytes |
| `bigUint64` | 64-bit BigInt (unsigned) | 8 bytes |

### Collection Types

#### ArraySchema

Synchronizable ordered array. Cannot mix types.

```typescript
class MyState extends Schema {
    @type(["string"]) animals = new ArraySchema<string>();
    @type([Player]) players = new ArraySchema<Player>();
}

// Usage
this.state.animals.push("cat", "dog");
this.state.animals.pop();
this.state.animals.shift();
this.state.animals.unshift("bird");
this.state.animals.splice(1, 1);
this.state.animals.shuffle();
this.state.animals.move((item) => item === "cat" ? 0 : undefined);
this.state.animals.forEach((item, index) => { });
this.state.animals.clear();
```

#### MapSchema

String-keyed dictionary. Only string keys supported.

```typescript
class MyState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
}

// Usage
this.state.players.set("player1", new Player());
this.state.players.get("player1");
this.state.players.delete("player1");
this.state.players.size;
this.state.players.forEach((value, key) => { });
this.state.players.clear();
```

#### SetSchema (JavaScript SDK only)

Unique value collection:

```typescript
class Player extends Schema {
    @type({ set: Effect }) effects = new SetSchema<Effect>();
}

// Usage
player.effects.add(new Effect());
player.effects.delete(effect);
player.effects.has(effect);
player.effects.size;
player.effects.clear();
```

#### CollectionSchema (JavaScript SDK only)

Like ArraySchema but without index control:

```typescript
class Player extends Schema {
    @type({ collection: Item }) items = new CollectionSchema<Item>();
}

// Usage
player.items.add(new Item());
player.items.at(0);
player.items.delete(item);
player.items.has(item);
player.items.size;
player.items.forEach((value, index) => { });
player.items.clear();
```

### Nested Schemas

```typescript
class World extends Schema {
    @type("number") width: number;
    @type("number") height: number;
}

class MyState extends Schema {
    @type(World) world: World = new World();
}
```

> Maximum of **64 synchronizable properties** per Schema type.

### Inheritance

Collections support inherited types from a common base:

```typescript
class Item extends Schema {
    @type("string") name: string;
}

class Weapon extends Item {
    @type("number") damage: number;
}

class Shield extends Item {
    @type("number") defense: number;
}

class Inventory extends Schema {
    @type({ map: Item }) items = new MapSchema<Item>();
}

// Usage
const inventory = new Inventory();
inventory.items.set("left", new Weapon());   // Weapon extends Item
inventory.items.set("right", new Shield());  // Shield extends Item
```

### Versioning & Backwards Compatibility

Add new fields at the end; mark old fields with `@deprecated()`:

```typescript
import { Schema, type, deprecated } from "@colyseus/schema";

class MyState extends Schema {
    @deprecated() @type("string") oldField: string;  // preserved ordering
    @type("string") newField: string;                 // appended at end
}
```

### StateView (Per-Client Visibility)

Control which parts of state each client sees (introduced v0.16):

```typescript
import { Room, StateView } from "colyseus";
import { view } from "@colyseus/schema";

class Player extends Schema {
    @type("string") name: string;          // visible to all
    @view() @type("number") health: number; // only visible via view.add()
    @view(1) @type("number") mana: number;  // only visible via view.add(instance, 1)
}

class MyRoom extends Room {
    state = new MyState();

    onJoin(client) {
        client.view = new StateView();
        const player = this.state.players.get(client.sessionId);
        client.view.add(player);      // reveals @view() fields
        client.view.add(player, 1);   // also reveals @view(1) fields
    }
}
```

**Methods:**
- `client.view.add(instance, tag?)` — make instance visible
- `client.view.remove(instance, tag?)` — hide instance
- `client.view.has(instance, tag?)` — check visibility

> Not recommended for large datasets. Use for private fields, level-of-detail, or area-based visibility.

### Advanced Usage

**Custom Types (`defineCustomTypes`):** Define custom encoding/decoding for specialized types.

**Change Tracking (`$track`):** Monitor when schema attributes are mutated.

**Custom Encoding (`$encoder`):** Pack multiple values into fewer bytes (e.g., bit-packing).

**Custom Decoding (`$decoder`):** Extract data from custom byte formats on the client.

**Non-Schema Structures:** Sync third-party objects using `Metadata.setFields()` + `Schema.initialize()`.

---

## Client SDK

### Installation

```bash
npm install @colyseus/sdk
```

### Setup

```typescript
import { Client } from "@colyseus/sdk";
const client = new Client("http://localhost:2567");
```

Available for: TypeScript/JavaScript, Unity (C#), Defold (Lua), Haxe, Godot (GDScript).

### Joining Rooms

```typescript
// Join or create (most common — joins existing or creates new)
const room = await client.joinOrCreate("game_room", { mode: "battle" });

// Always create new room
const room = await client.create("game_room", { mode: "battle" });

// Join existing room only (fails if none available)
const room = await client.join("game_room", { mode: "battle" });

// Join specific room by ID
const room = await client.joinById(roomId, { options });
```

### Room Properties

| Property | Type | Description |
|----------|------|-------------|
| `room.state` | Schema | Synchronized state object |
| `room.sessionId` | string | Unique session identifier |
| `room.roomId` | string | Room instance identifier |
| `room.name` | string | Room type name |
| `room.reconnectionToken` | string | Token for manual reconnection |
| `room.reconnection` | object | Reconnection configuration |

### Messaging

```typescript
// Send typed message
room.send("move", { direction: "left" });

// Send numeric type (performance)
room.send(0, { x: 10, y: 20 });

// Send raw bytes
room.sendBytes(new Uint8Array([1, 2, 3]));

// Receive messages
room.onMessage("chat", (message) => {
    console.log("Chat:", message.text);
});

// Receive all messages (wildcard)
room.onMessage("*", (type, message) => {
    console.log("Message:", type, message);
});
```

### State Sync Callbacks

```typescript
import { Client, Callbacks } from "@colyseus/sdk";

const client = new Client("http://localhost:2567");
const room = await client.joinOrCreate("my_room");
const callbacks = Callbacks.get(room);
```

#### listen — Single Property Change

```typescript
const unbind = callbacks.listen("currentTurn", (currentValue, previousValue) => {
    console.log(`Turn: ${previousValue} → ${currentValue}`);
});
// Later: unbind();
```

#### bindTo — Auto-assign to Target Object

```typescript
callbacks.bindTo(player, sprite, ["x", "y"]);
// sprite.x and sprite.y auto-update when player.x/y change
```

#### onChange — Any Direct Property Change

```typescript
callbacks.onChange(room.state, () => {
    // Fires after changes applied to the Schema instance
});
```

#### onAdd — Collection Item Added

Called immediately for existing items by default:

```typescript
callbacks.onAdd(room.state.players, (player, sessionId) => {
    console.log(`Player ${sessionId} joined`);

    // Nest listeners on the player instance
    callbacks.listen(player, "health", (current, previous) => {
        console.log(`HP: ${previous} → ${current}`);
    });
});
```

#### onRemove — Collection Item Removed

```typescript
callbacks.onRemove(room.state.players, (player, sessionId) => {
    console.log(`Player ${sessionId} left`);
    // Clean up sprites, UI, etc.
});
```

### Frontend Schema Generation

For statically-typed languages (C#, Haxe, C++, Godot):

```bash
npx schema-codegen src/Schema.ts --output frontend/ --csharp --namespace MyGame.Schema
```

### Custom Callback System

Override the decoder for raw change access:

```typescript
import { Room } from "@colyseus/sdk";
import { DataChange } from "@colyseus/schema";

function getRawChangesCallback(room: Room, callback: (changes: DataChange[]) => void) {
    room['serializer']['decoder'].triggerChanges = callback;

    // Access internal structures:
    // room['serializer']['decoder'].root.refs
    // room['serializer']['decoder'].root.refIds
    // room['serializer']['decoder'].root.refCounts
}

const room = await client.joinOrCreate("my_room");
getRawChangesCallback(room, (changes) => {
    console.log("raw list of changes", changes);
});
```

### Connection Lifecycle

```typescript
room.onDrop(() => { /* connection lost unexpectedly */ });
room.onReconnect(() => { /* reconnected successfully */ });
room.onLeave((code) => { /* permanently left room */ });
room.onError((code, message) => { /* error occurred */ });
room.onStateChange((state) => { /* any state update received */ });
```

### Latency & Server Selection

```typescript
// Measure round-trip time
const rtt = await room.ping();

// Multi-region server selection (picks lowest latency)
const bestServer = await Client.selectByLatency([
    "https://us-east.example.com",
    "https://eu-west.example.com",
    "https://ap-south.example.com"
]);
const client = new Client(bestServer);
```

### HTTP Utilities

Automatic `Authorization` header injection:

```typescript
client.auth.token = "YOUR_JWT_TOKEN";

const response = await client.http.get("/profile");
const response = await client.http.post("/profile", { body: { name: "test" } });
const response = await client.http.put("/settings", { body: data });
const response = await client.http.delete("/account");
```

---

## React Integration

### Installation

```bash
npm install @colyseus/react
```

### Hooks

#### useRoom(callback, deps?)

Manages room lifecycle with React StrictMode support:

```typescript
import { useRoom } from "@colyseus/react";

function Game() {
    const { room, isConnecting, error } = useRoom(
        () => client.joinOrCreate("game_room"),
        []  // dependency array — reconnects when changed
    );

    if (isConnecting) return <div>Connecting...</div>;
    if (error) return <div>Error: {error.message}</div>;
    return <GameUI room={room} />;
}
```

- When deps change, previous room is left and new connection established
- Pass falsy value for conditional connection

#### useRoomState(room, selector?)

Immutable plain-object snapshots with referential equality:

```typescript
import { useRoomState } from "@colyseus/react";

function PlayerList({ room }) {
    // Only re-renders when players change
    const players = useRoomState(room, (state) => state.players);
    const score = useRoomState(room, (state) => state.score);

    return <ul>{[...players.values()].map(p => <li>{p.name}: {score}</li>)}</ul>;
}
```

#### useLobbyRoom(callback, deps?)

```typescript
import { useLobbyRoom } from "@colyseus/react";

function Lobby() {
    const { rooms, room, isConnecting, error } = useLobbyRoom(
        () => client.joinOrCreate("lobby")
    );

    return (
        <ul>
            {rooms.map(r => <li key={r.roomId}>{r.name} ({r.clients}/{r.maxClients})</li>)}
        </ul>
    );
}
```

#### useQueueRoom(connect, consume, deps?)

Full queue lifecycle: connect → track group → receive seat → confirm → consume:

```typescript
import { useQueueRoom } from "@colyseus/react";

function Matchmaking() {
    const { room, queue, clients, seat, error, isWaiting } = useQueueRoom(
        () => client.joinOrCreate("queue", { rank: 1500 }),
        (reservation) => client.consumeSeatReservation(reservation),
        []
    );

    if (isWaiting) return <div>Finding match... ({clients} in group)</div>;
    if (seat) return <div>Match found! Joining...</div>;
    return <div>In queue...</div>;
}
```

### Contexts

#### createRoomContext()

Share single room connection across React tree (closure-scoped, works across reconcilers):

```typescript
import { createRoomContext } from "@colyseus/react";

const { RoomProvider, useRoom, useRoomState } = createRoomContext();

function App() {
    return (
        <RoomProvider connect={() => client.joinOrCreate("game")} deps={[]}>
            <GameUI />
        </RoomProvider>
    );
}

function GameUI() {
    const { room } = useRoom();
    const score = useRoomState((state) => state.score);
    // No need to pass room to useRoomState — uses context
}
```

#### createLobbyContext()

```typescript
import { createLobbyContext } from "@colyseus/react";

const { LobbyProvider, useLobby } = createLobbyContext();

function App() {
    return (
        <LobbyProvider connect={() => client.joinOrCreate("lobby")}>
            <RoomProvider connect={() => client.joinOrCreate("game")} deps={[]}>
                <GameUI />
            </RoomProvider>
        </LobbyProvider>
    );
}

function LobbyUI() {
    const { rooms, isConnecting, error } = useLobby();
}
```

### Direct SDK Usage (useEffect)

Alternative without `@colyseus/react`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Client, Room } from "@colyseus/sdk";

function Game() {
    const roomRef = useRef<Room | null>(null);
    const [players, setPlayers] = useState([]);

    useEffect(() => {
        const client = new Client("http://localhost:2567");
        client.joinOrCreate("game").then((room) => {
            roomRef.current = room;
            room.onStateChange((state) => {
                setPlayers([...state.players.values()]);
            });
        });
        return () => { roomRef.current?.leave(); };
    }, []);
}
```

---

## Authentication

### Room Authentication (onAuth)

#### Static onAuth (Recommended)

Does not require room instance creation before authentication:

```typescript
import { Room, ServerError } from "colyseus";
import { JWT } from "@colyseus/auth";

class MyRoom extends Room {
    static async onAuth(token, options, context) {
        const userdata = await JWT.verify(token);
        if (!userdata) throw new ServerError(401, "Invalid token");
        return userdata;  // truthy = allow, falsy/throw = deny
    }

    async onJoin(client, options, auth) {
        console.log("Authenticated user:", client.auth);
    }
}
```

#### Instance onAuth

Use when you need access to room instance properties:

```typescript
class MyRoom extends Room {
    async onAuth(client, options, context) {
        const userdata = await JWT.verify(context.token);
        return userdata;
    }
}
```

#### Context Object

| Property | Description |
|----------|-------------|
| `context.token` | Auth token from client |
| `context.headers` | Request headers |
| `context.ip` | Client IP (X-Real-IP → X-Forwarded-For → remoteAddress) |

#### Client-Side

```typescript
client.auth.token = "YOUR_JWT_TOKEN";
const room = await client.joinOrCreate("my_room");
```

### Auth Module (`@colyseus/auth`)

Full authentication system supporting email/password, anonymous, and 200+ OAuth providers.

```bash
npm install --save @colyseus/auth
```

#### Setup

```typescript
import { auth } from "@colyseus/auth";
import { defineServer } from "colyseus";

const server = defineServer({
    express: (app) => {
        app.use(auth.prefix, auth.routes());
    },
});

// Set backend URL for callbacks
if (process.env.NODE_ENV === "production") {
    auth.backend_url = "https://your-game.io";
} else {
    auth.backend_url = "http://localhost:2567";
}
```

#### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `AUTH_SALT` | Password hashing (scrypt algorithm) |
| `JWT_SECRET` | JWT token signing |
| `SESSION_SECRET` | OAuth session cookie signing |

> **Security:** Keep these secrets safe. Exposure leads to security breaches.

#### Frontend API

```typescript
// Registration & Sign-In
await client.auth.registerWithEmailAndPassword(email, password);
await client.auth.signInWithEmailAndPassword(email, password);
await client.auth.signInAnonymously();
await client.auth.signInWithProvider("discord");  // opens popup

// Password Management
await client.auth.sendPasswordResetEmail(email);

// User Data
const user = await client.auth.getUserData();
client.auth.onChange((userData) => { /* auth state changed */ });
client.auth.signOut();

// Direct token access
const token = client.auth.token;
```

#### Backend Configuration Callbacks

```typescript
// --- Email/Password ---
auth.settings.onFindUserByEmail = async (email) => {
    return await User.query().selectAll().where("email", "=", email).executeTakeFirst();
};

auth.settings.onRegisterWithEmailAndPassword = async (email, password, options) => {
    return await User.insert({ email, password, name: options.name });
};

// --- Anonymous ---
auth.settings.onRegisterAnonymously = async (options) => {
    const userId = await User.insert({ anonymous: true });
    return { userId };
};

// --- Password Reset ---
auth.settings.onForgotPassword = async (email, html) => {
    await resend.emails.send({
        to: email,
        subject: '[Game]: Reset password',
        from: 'no-reply@your-domain.io',
        html: html  // contains reset link
    });
};

auth.settings.onResetPassword = async (email, password) => {
    await User.update({ password }).where("email", "=", email).execute();
};

// --- Email Verification ---
auth.settings.onSendEmailConfirmation = async (email, html, link) => {
    await resend.emails.send({ to: email, html });
};

auth.settings.onEmailConfirmed = async (email) => {
    await User.update({ verified: true }).where("email", "=", email).execute();
    return true;
};

// --- Advanced ---
auth.settings.onParseToken = async (data) => { return data; };
auth.settings.onGenerateToken = async (userdata) => { return JWT.sign(userdata); };
auth.settings.onHashPassword = async (password) => { return Hash.make(password); };
```

#### OAuth Configuration

```typescript
// Add provider (200+ supported via Grant)
auth.oauth.addProvider('discord', {
    key: "CLIENT_ID",
    secret: "CLIENT_SECRET",
    scope: ['identify', 'email'],
});

// Handle OAuth callback
auth.oauth.onCallback(async (data, provider) => {
    const profile = data.profile;
    return await User.upsert({
        discord_id: profile.id,
        name: profile.global_name || profile.username,
        locale: profile.locale,
        email: profile.email,
    });
});
```

**Redirect URL format:** `https://[YOUR-DOMAIN]/auth/provider/[PROVIDER-ID]/callback`

#### Account Upgrading & Linking

Access previous token via `options.upgradingToken`:

```typescript
auth.settings.onRegisterWithEmailAndPassword = async (email, password, options) => {
    if (options.upgradingToken) {
        // Link email to existing anonymous account
        await User.update({ email, password, anonymous: false })
            .where("id", "=", options.upgradingToken.userId).execute();
    }
};

auth.oauth.onCallback(async (data, provider) => {
    if (data.upgradingToken) {
        // Link OAuth to existing account
    }
});
```

#### Email Template Customization

```
my-colyseus-app/
  html/
    address-confirmation-email.html
    address-confirmation.html
    reset-password-email.html
    reset-password-form.html
```

### HTTP Route Protection

```typescript
// Using @colyseus/auth middleware
app.use("/profile", auth.middleware(), (req, res) => {
    res.json(req.auth);  // authenticated user data
});

// Custom middleware
function authMiddleware(req, res, next) {
    const authorization = req.headers.authorization;
    // validate token
    next();
}
app.use("/profile", authMiddleware, (req, res) => { });
```

---

## Matchmaking

### Standard Flow

1. Client calls `joinOrCreate("room_name", options)`
2. Matchmaker queries available rooms matching `filterBy` criteria
3. If match found, client joins; otherwise new room created
4. Client receives room connection details

### Standalone Match-Maker Architecture

For horizontal scaling, separate matchmaking from room hosting:

```
Client → Match-Maker Process → (IPC via Redis) → Game Server Process
       ← Seat Reservation ←                    ← Room Created
       → Direct WebSocket Connection to publicAddress →
```

**Requirements:** Shared Redis for both Presence and Driver across all processes.

#### Game Server Config

```typescript
import { defineServer, defineRoom } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";

const server = defineServer({
    transport: new WebSocketTransport({}),
    presence: new RedisPresence(),
    driver: new RedisDriver(),
    rooms: {
        battle: defineRoom(BattleRoom),
    },
    publicAddress: "game-server-1.example.com:2567"  // unique per process
});
```

#### Match-Maker Config

```typescript
const server = defineServer({
    presence: new RedisPresence(),
    driver: new RedisDriver(),
    isStandaloneMatchMaker: true,  // only matchmaking, no rooms
    rooms: {
        // Must register types for filterBy and auth (no local instantiation)
        battle: defineRoom(BattleRoom).filterBy(['mode']),
    },
    selectProcessIdToCreateRoom: async (roomName, options) => {
        // Custom process selection (default: fewest rooms)
        return processId;
    }
});
```

#### Operation Flow

1. Client sends matchmaking request to match-maker
2. Match-maker delegates room creation to game server via IPC (Redis)
3. Match-maker returns seat reservation with `sessionId`, `roomId`, `publicAddress`
4. Client connects directly to game server using provided address

---

## HTTP Routes

### API Routes (Type-Safe, Recommended)

```typescript
import { defineServer, createEndpoint, createRouter, createMiddleware } from "colyseus";
import { z } from "zod";

const getProfile = createEndpoint("/profile/:id", {
    method: "GET",
    query: z.object({ include: z.string().optional() }),
}, async (ctx) => {
    return { id: ctx.params.id, include: ctx.query.include };
});

const updateProfile = createEndpoint("/profile/:id", {
    method: "POST",
    body: z.object({ name: z.string() }),
}, async (ctx) => {
    ctx.setStatus(201);
    return { id: ctx.params.id, name: ctx.body.name };
});

const server = defineServer({
    routes: createRouter({ getProfile, updateProfile })
});
```

### Middleware

```typescript
const auth = createMiddleware(async (ctx) => {
    const token = ctx.headers.get("authorization");
    if (!token) throw ctx.error("UNAUTHORIZED", { message: "Missing token" });
    return { userId: "user-123" };  // merged into ctx.context
});

const secureEndpoint = createEndpoint("/secure", {
    method: "GET",
    use: [auth],
}, async (ctx) => {
    ctx.setHeader("X-User", ctx.context.userId);
    ctx.setCookie("session", "abc", { httpOnly: true });
    return { ok: true, userId: ctx.context.userId };
});
```

### Endpoint Options

| Option | Description |
|--------|-------------|
| `method` | HTTP method string or array (e.g., `"GET"` or `["GET", "POST"]`) |
| `body` | Zod schema for body validation; invalid → 400 |
| `query` | Zod schema for query validation; invalid �� 400 |
| `use` | Array of middlewares from `createMiddleware` |
| `requireHeaders` | When true, requires headers when calling as function |
| `requireRequest` | When true, requires request object when calling as function |
| `metadata.scope` | `"rpc"` (default): RPC client available; `"server"`: direct only; `"http"`: routed only |
| `metadata.allowedMediaTypes` | Restrict accepted Content-Type |

### Handler Context

**Properties:**
- `ctx.request` — Raw Request object
- `ctx.headers` — Headers instance
- `ctx.body` — Parsed and validated body
- `ctx.query` — Parsed and validated query
- `ctx.params` — Route parameters (`:id`, `**:name`)
- `ctx.method` ��� HTTP method
- `ctx.context` — Merged middleware context

**Methods:**
- `ctx.setStatus(status)` — Override success status code
- `ctx.error(codeOrStatus, data?, headers?)` — Throw API error
- `ctx.redirect(url)` — Throw redirect response
- `ctx.json(data)` — Return JSON response
- `ctx.setHeader(name, value)` — Set response header
- `ctx.setCookie(name, value, options?)` — Set response cookie
- `ctx.getCookie(name)` — Read request cookie
- `ctx.setSignedCookie(name, value, options?)` — Set signed cookie
- `ctx.getSignedCookie(name)` — Read signed cookie

### Express Routes (Alternative)

```typescript
import express from "express";

const server = defineServer({
    express: (app) => {
        app.use(express.json({ limit: "100kb" }));
        app.get("/hello", (req, res) => res.json({ hello: "world" }));
        app.post("/profile", (req, res) => res.json({ received: req.body }));
    },
});
```

### CORS

Enabled by default. Customize:

```typescript
import { matchMaker } from "colyseus";

matchMaker.controller.DEFAULT_CORS_HEADERS = {
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Max-Age': '2592000',
};

// Dynamic CORS based on request:
matchMaker.controller.getCorsHeaders = function(requestHeaders) {
    return {};  // return custom key-value headers
};
```

### Frontend Usage

```typescript
// Use client.http.* to call endpoints (auto auth header injection)
const response = await client.http.get("/profile/123");
const response = await client.http.post("/profile/123", { body: { name: "New" } });
```

---

## Transport Layers

### WebSocket (Default) — `@colyseus/ws-transport`

Powered by `websockets/ws`:

```typescript
import { WebSocketTransport } from "@colyseus/ws-transport";

const server = defineServer({
    transport: new WebSocketTransport({
        pingInterval: 6000,        // ms between pings (default: 3000)
        pingMaxRetries: 4,         // max missed pings before disconnect (default: 2)
        maxPayload: 1024 * 1024,   // max message size bytes (default: 4096)
        perMessageDeflate: false,  // compression (default: false)
        verifyClient: (info) => {  // custom handshake verification
            return true;
        }
    })
});
```

**Custom HTTP server:**
```typescript
new WebSocketTransport({ server: existingHttpServer })
```

**Troubleshooting:** For "431 Request Header Fields Too Large":
```bash
NODE_OPTIONS="--max-http-header-size=32768"
```

### uWebSockets.js — `@colyseus/uwebsockets-transport` (Production Recommended)

~10x performance over Socket.IO, ~8.5x over Fastify. Highest TechEmpower rankings.

```bash
npm install --save @colyseus/uwebsockets-transport@^2.0.1  # Express v5
npm install --save @colyseus/uwebsockets-transport@^1.4.1  # Express v4
```

```typescript
import { uWebSocketsTransport } from "@colyseus/uwebsockets-transport";

const server = defineServer({
    transport: new uWebSocketsTransport({
        maxPayloadLength: 4096,       // bytes (default)
        idleTimeout: 120,             // seconds, 0 = disable (default: 120)
        sendPingsAutomatically: true, // default
        compression: 0,               // disabled (default)
        maxBackpressure: 1024 * 1024, // 1MB per socket (default)

        // SSL options:
        key_file_name: "path/to/key.pem",
        cert_file_name: "path/to/cert.pem",
        passphrase: "optional-password"
    })
});
```

**Override bundled version** via package.json `overrides`/`resolutions`/`pnpm.overrides`.

**Troubleshooting:** Set `UWS_HTTP_MAX_HEADERS_SIZE` env var (default 4KiB).

### WebTransport — `@colyseus/h3-transport` (Experimental)

HTTP/3 + QUIC (UDP-based), low-latency bidirectional:

```bash
npm install --save @colyseus/h3-transport
```

```typescript
import { H3Transport } from "@colyseus/h3-transport";
import fs from "fs";

const server = defineServer({
    transport: new H3Transport({
        app: expressApp,
        cert: fs.readFileSync("cert.pem", "utf-8"),
        key: fs.readFileSync("key.pem", "utf-8"),
        server: httpServer,
        localProxy: optionalFallbackProxy
    })
});
```

> **Warning:** Not battle-tested. WebTransport is still an emerging technology.

### Bun WebSockets — `@colyseus/bun-websockets` (Experimental)

Native Bun WebSockets with Express compatibility layer:

```bash
bun add @colyseus/bun-websockets
```

```typescript
import { BunWebSockets } from "@colyseus/bun-websockets";

const server = defineServer({
    transport: new BunWebSockets({ /* Bun.serve options */ }),
    express: (app) => {
        app.get("/hello", (req, res) => res.json({ hello: "world!" }));
    },
});
```

> **Warning:** Experimental. Report issues.

---

## Presence (IPC)

Inter-process communication for multi-process/distributed deployments. Provides pub/sub messaging and shared key-value storage.

### Configuration

**Default (single process):** `LocalPresence` — in-memory, no setup needed.

**Production (multi-process):** `RedisPresence`

```bash
npm install --save @colyseus/redis-presence
```

```typescript
import { RedisPresence } from "@colyseus/redis-presence";

const server = defineServer({
    presence: new RedisPresence(),  // localhost:6379
    // or: new RedisPresence("redis://user:pass@host:6379/0")
    // or: new RedisPresence(6379)  // localhost with port
    // or: new RedisPresence({ host: "...", port: 6379, password: "...", db: 0 })
});
```

**Cluster:**
```typescript
new RedisPresence([
    { host: "node1.redis.example.com", port: 6379 },
    { host: "node2.redis.example.com", port: 6379 },
    { host: "node3.redis.example.com", port: 6379 },
], { redisOptions: { password: "secret" } })
```

### API Access

Every Room has `this.presence`. Also available via `matchMaker.presence`.

### Pub/Sub

```typescript
// Subscribe to topic
this.presence.subscribe("global-event", (data) => {
    console.log("received:", data);
});

// Publish to topic
this.presence.publish("global-event", { any: 1, data: 2, here: "3" });

// Unsubscribe (all or specific callback)
this.presence.unsubscribe("global-event");
this.presence.unsubscribe("global-event", specificCallback);

// List active channels (supports wildcards)
const allChannels = await this.presence.channels();
const gameChannels = await this.presence.channels("game:*");
```

### Key-Value

```typescript
await this.presence.set("key", "value");
await this.presence.setex("key", "value", 120);  // with TTL (seconds)
await this.presence.get("key");                   // returns string | null
await this.presence.del("key");
await this.presence.exists("key");                // returns boolean
await this.presence.incr("counter");              // increment (sets to 0 if missing)
await this.presence.decr("counter");              // decrement
await this.presence.expire("key", 60);            // set TTL on existing key
```

### Sets

```typescript
await this.presence.sadd("myset", "member-one");     // add member (ignores dupes)
await this.presence.smembers("myset");                // get all members
await this.presence.sismember("myset", "member-one"); // 1 if member, 0 if not
await this.presence.srem("myset", "member-one");      // remove member
await this.presence.scard("myset");                   // count members
await this.presence.sinter("set1", "set2");           // intersection
```

### Hashes

```typescript
await this.presence.hset("player:123", "name", "John");  // set field (true=new, false=update)
await this.presence.hset("player:123", "score", "100");
await this.presence.hget("player:123", "name");           // get field value
await this.presence.hgetall("player:123");                // get all fields
await this.presence.hdel("player:123", "score");          // delete field
await this.presence.hlen("player:123");                   // field count
await this.presence.hincrby("player:123", "score", 10);   // increment field
await this.presence.hincrbyex("rate:user:123", "requests", 1, 60);  // incr + TTL
```

### Lists

```typescript
await this.presence.rpush("queue", "task1");    // append to end (returns length)
await this.presence.lpush("queue", "urgent");   // prepend to beginning
await this.presence.rpop("queue");              // remove and return last
await this.presence.lpop("queue");              // remove and return first
await this.presence.llen("queue");              // list length
await this.presence.brpop("queue", 5);          // blocking pop (timeout seconds)
// brpop returns [key, value] or null on timeout
```

---

## Driver (Room Persistence)

Stores room data for matchmaker queries. When rooms are created, deleted, or have metadata updates, the driver persists this for matchmaking.

### LocalDriver (Default)

In-memory, single-process only. Suitable for development.

### RedisDriver (Production)

```bash
npm install --save @colyseus/redis-driver
```

```typescript
import { RedisDriver } from "@colyseus/redis-driver";

const server = defineServer({
    driver: new RedisDriver(),
    // Connection options same as RedisPresence:
    // new RedisDriver("redis://user:pass@host:6379/0")
    // new RedisDriver(6379)
    // new RedisDriver({ host, port, password, db })
    // Cluster: new RedisDriver([nodes], { redisOptions })
});
```

### PostgresDriver (Experimental — Drizzle ORM)

```bash
npm install --save @colyseus/drizzle-driver
```

```typescript
import { PostgresDriver } from "@colyseus/drizzle-driver";

// Uses DATABASE_URL env var (default: postgresql://postgres:postgres@localhost:5432/postgres)
const server = defineServer({
    driver: new PostgresDriver(),
});

// Or with existing Drizzle instance:
import { drizzle } from "drizzle-orm/postgres-js";
const db = drizzle(process.env.DATABASE_URL);
const server = defineServer({
    driver: new PostgresDriver({ db }),
});

// Or with custom schema:
import { pgTable, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";

const customRoomCaches = pgTable('my_room_caches', {
    roomId: varchar({ length: 9 }).primaryKey(),
    processId: varchar({ length: 9 }),
    name: varchar({ length: 64 }).notNull(),
    clients: integer().notNull(),
    maxClients: integer().notNull(),
    locked: boolean(),
    private: boolean(),
    metadata: jsonb(),
    publicAddress: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    unlisted: boolean(),
});

const server = defineServer({
    driver: new PostgresDriver({ schema: customRoomCaches }),
});
```

**Default table schema (`roomcaches_v1`):**

| Column | Type | Description |
|--------|------|-------------|
| roomId | varchar(9) | Primary key |
| processId | varchar(9) | Hosting process ID |
| name | varchar(64) | Room handler name |
| clients | integer | Connected clients |
| maxClients | integer | Max allowed |
| locked | boolean | Room locked |
| private | boolean | Room private |
| metadata | jsonb | Custom metadata |
| publicAddress | varchar(255) | Public address |
| createdAt | timestamp | Creation time |
| unlisted | boolean | Hidden from queries |

### MongoDriver (Not Recommended)

```bash
npm install --save @colyseus/mongoose-driver
```

```typescript
import { MongooseDriver } from "@colyseus/mongoose-driver";
const server = defineServer({ driver: new MongooseDriver(/* connection options */) });
```

> Not actively maintained — not recommended for production.

---

## Tools & Development

### Development Mode

Caches active rooms before server restart, restores them after — preserving state and client connections:

```typescript
const server = defineServer({ devMode: true });
```

```typescript
class MyRoom extends Room {
    onCacheRoom() {
        // Return JSON-serializable data to preserve before restart
        return { scores: this.getScores(), round: this.currentRound };
    }

    onRestoreRoom(cachedData) {
        // Restore from cached data (no clients connected yet)
        this.currentRound = cachedData.round;
    }
}
```

**Frontend note:** The frontend doesn't reload — only the connection re-establishes. The `onAdd` callback triggers again, so be prepared to ignore additional `onAdd` calls during development.

> **Warning:** Do not use in production. Not optimized for many rooms.

### Debugging

Enable debug logs:
```bash
DEBUG=colyseus:* npm start
```

| Namespace | Description |
|-----------|-------------|
| `colyseus:errors` | Unexpected/internally expected errors |
| `colyseus:matchmaking` | Room spawn/disposal events |
| `colyseus:message` | Incoming/outgoing room messages |
| `colyseus:patch` | Patch bytes and intervals |
| `colyseus:connection` | Incoming/outgoing connections |

**Remote Debugging:**
1. SSH into server: `ssh root@remote.example.com`
2. Find PID: `ps aux | grep node`
3. Attach inspector: `kill -usr1 PID` (does NOT kill process)
4. SSH tunnel: `ssh -L 9229:localhost:9229 root@remote.example.com`
5. Open `chrome://inspect` in Chrome

> **Warning:** Memory snapshots and breakpoints impact user experience in production.

### Graceful Shutdown

Automatic on SIGTERM/SIGINT. Sequence:

1. **`server.onBeforeShutdown()`** — custom pre-shutdown logic
2. **Process excluded from matchmaking** — no new room creation
3. **All rooms locked** — `room.lock()` prevents new joins
4. **Each room's `onBeforeShutdown()`** — default calls `room.disconnect()`
5. **Wait for all rooms to dispose** — room count reaches zero
6. **Close infrastructure** — Transport, Presence, Driver
7. **`server.onShutdown()`** — final cleanup
8. **Process exits**

```typescript
class MyRoom extends Room {
    onBeforeShutdown() {
        // Override default behavior (which immediately disconnects)
        this.broadcast("going-down", "Server shutting down in 5 minutes. Save progress!");
        this.clock.setTimeout(() => this.disconnect(), 5 * 60 * 1000);
    }
}

server.onBeforeShutdown(async () => {
    // Custom logic before shutdown begins
});

server.onShutdown(async () => {
    await closeDatabaseConnections();
    await flushLogs();
});
```

All lifecycle methods support async/Promises — server waits for resolution.

### Logging

Default logger is `console`. Replace with any compatible logger:

```typescript
import pino from "pino";

const server = defineServer({
    logger: pino({ level: 50, msgPrefix: '[HTTP] ' }),
});
```

**Winston example:**
```typescript
import winston from "winston";

const server = defineServer({
    logger: winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        defaultMeta: { service: 'game-server' },
        transports: [
            new winston.transports.File({ filename: 'error.log', level: 'error' }),
            new winston.transports.File({ filename: 'combined.log' }),
        ],
    }),
});
```

Required methods: `debug()`, `log()`, `info()`, `warn()`, `error()`

### Playground

Browser-based real-time debugging tool:

```bash
npm install --save @colyseus/playground
```

```typescript
import { playground } from "@colyseus/playground";

app.use("/playground", playground());
// Access at http://localhost:2567/playground
```

**Features:**
- Create room connections (joinOrCreate / create / join / joinById)
- View active rooms list
- Authenticate with Auth Module credentials
- Simulate disconnections for reconnection testing
- Visualize client state as JSON
- Send messages (auto-detected types)
- Test HTTP endpoints

**Security — password protect in production:**
```typescript
import basicAuth from "express-basic-auth";

const basicAuthMiddleware = basicAuth({
    users: { "admin": "admin" },
    challenge: true
});
app.use("/playground", basicAuthMiddleware, playground());
```

### Monitoring Panel

Administration tool for production inspection:

```bash
npm install --save @colyseus/monitor
```

```typescript
import { monitor } from "@colyseus/monitor";

app.use("/monitor", monitor({
    columns: ['roomId', 'name', 'clients', 'maxClients', 'locked', 'elapsedTime']
}));
// Access at http://localhost:2567/monitor
```

**Default columns:** `['roomId', 'name', 'clients', 'maxClients', 'locked', 'elapsedTime']`

**Custom metadata columns:**
```typescript
columns: ['roomId', 'name', 'clients', { metadata: "spectators" }, 'locked', 'elapsedTime']
```

**Features:**
- List all active rooms with force-dispose
- Inspect room state
- Send/broadcast messages to clients
- Force-disconnect individual clients

> **Warning:** Password-protect in production (same as playground).

### Load Testing

```bash
npm install --save-dev @colyseus/loadtest
```

**Run:**
```bash
npx tsx loadtest/example.ts --room battle --numClients 50 --endpoint http://localhost:2567
```

**Arguments:**
- `script` — path to client script
- `--room` — room name to connect to
- `--numClients` — simulated clients count
- `--endpoint` — server URL (default: `http://localhost:2567`)

**Script example:**
```typescript
import { Room } from "@colyseus/sdk";

export function onJoin(room: Room) {
    room.onMessage("*", (type, message) => {
        console.log("Message:", type, message);
    });

    room.onStateChange((state) => {
        console.log("State changed");
    });

    room.onError((code, message) => {
        console.error("Error:", code, message);
    });

    room.onLeave((code) => {
        console.log("Left:", code);
    });

    // Simulate bot behavior
    setInterval(() => {
        room.send("move", { x: Math.random(), y: Math.random() });
    }, 1000);
}
```

### Unit Testing

```bash
npm install --save-dev @colyseus/testing
```

Pre-installed in projects created with `npm create colyseus-app`.

**Basic structure:**
```typescript
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await ColyseusTestServer.create(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(async () => { await colyseus.cleanup(); });  // rooms dispose between tests

test("player joins room", async () => {
    const room = await colyseus.createRoom("battle");
    const client1 = await colyseus.sdk.joinOrCreate("battle");

    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);
});

test("players exchange messages", async () => {
    const room = await colyseus.createRoom("battle");
    const client1 = await colyseus.sdk.joinOrCreate("battle");

    client1.send("move", { x: 10, y: 20 });

    const [sender, message] = await room.waitForMessage("move");
    expect(message).toEqual({ x: 10, y: 20 });
});
```

**Server-side utilities:**
- `room.waitForMessage(type)` — wait for specific message
- `room.waitForNextMessage()` — wait for any message (optional delay)
- `room.waitForNextPatch()` — wait for state patch sent
- `room.waitForNextSimulationTick()` — wait for simulation tick

**Client-side utilities:**
- `client.waitForNextPatch()` — sync client state
- `client.waitForMessage(type)` — wait for specific message
- `client.waitForNextMessage()` — wait for any message

**HTTP testing:**
```typescript
const res = await colyseus.http.get("/profile");
expect(res.data.name).toBe("test");

const res = await colyseus.http.post("/profile", { body: { name: "new" } });
expect(res.data.success).toBe(true);
```

**Best Practices:**
- Assert on both server and client state
- Create fresh rooms per test (`colyseus.cleanup()` handles disposal)
- Use async test functions
- Await processing before assertions

---

## Database & Persistence

Colyseus is database-agnostic. Use any Node.js database module.

**Recommended ORMs:** DrizzleORM, MikroORM, Prisma, Sequelize, TypeORM

**Query Builders:** Kysely, Knex

**Integration points:**

```typescript
class MyRoom extends Room {
    static async onAuth(token, options, context) {
        // Fetch user data during authentication
        const user = await db.users.findById(token.userId);
        return user;
    }

    async onJoin(client, options, auth) {
        // Mark user online
        await db.users.update(auth.id, { online: true });
    }

    async onLeave(client) {
        // Persist state and mark offline
        await db.users.update(client.auth.id, {
            online: false,
            lastPosition: { x: player.x, y: player.y }
        });
    }
}
```

> Colyseus roadmap includes player identity, leaderboards, and configurations as future built-in features.

---

## Best Practices

### Command Pattern

Decouple game logic from room lifecycle using `@colyseus/command`:

```bash
npm install --save @colyseus/command
```

```typescript
import { Command, Dispatcher } from "@colyseus/command";

// Define commands
class MoveCommand extends Command<MyRoom, { sessionId: string; x: number; y: number }> {
    execute({ sessionId, x, y }) {
        const player = this.state.players.get(sessionId);
        player.x = x;
        player.y = y;
    }
}

class AttackCommand extends Command<MyRoom, { sessionId: string; targetId: string }> {
    execute({ sessionId, targetId }) {
        const attacker = this.state.players.get(sessionId);
        const target = this.state.players.get(targetId);
        target.hp -= attacker.damage;
    }
}

// Room setup
class MyRoom extends Room {
    dispatcher = new Dispatcher(this);
    state = new MyState();

    messages = {
        "move": (client, message) => {
            this.dispatcher.dispatch(new MoveCommand(), {
                sessionId: client.sessionId, ...message
            });
        },
        "attack": (client, message) => {
            this.dispatcher.dispatch(new AttackCommand(), {
                sessionId: client.sessionId, ...message
            });
        }
    };

    onDispose() {
        this.dispatcher.stop();
    }
}
```

**Benefits:**
- Decouples operation invocation from execution
- Enables command queuing
- Extends without modifying existing code
- Strict control over invocation timing
- Improves testability and readability

---

## Recipes

### Custom Room ID

Generate human-readable room codes (e.g., "ABCD"):

```typescript
const LOBBY_CHANNEL = "$mylobby";

class MyRoom extends Room {
    async onCreate(options) {
        // Generate unique 4-letter code
        const existing = await this.presence.smembers(LOBBY_CHANNEL);
        let id: string;
        do {
            id = Array.from({ length: 4 }, () =>
                String.fromCharCode(65 + Math.floor(Math.random() * 26))
            ).join("");
        } while (existing.includes(id));

        this.roomId = id;
        await this.presence.sadd(LOBBY_CHANNEL, id);
    }

    async onDispose() {
        await this.presence.srem(LOBBY_CHANNEL, this.roomId);
    }
}
```

> Small race condition possible but extremely unlikely (1 in 15 trillion with 1M active rooms).

### Deny Player Join

Throw errors in `onAuth()` or `onJoin()`:

```typescript
import { Room, ServerError } from "colyseus";
import { JWT } from "@colyseus/auth";

class BattleRoom extends Room {
    static async onAuth(token, options, context) {
        const user = await JWT.verify(token);
        const hero = await db.getHero(user.id, options.heroId);

        if (!hero) throw new ServerError(400, "Hero not found");
        if (hero.level < 10) throw new ServerError(400, "Hero must be level 10+");

        return user;
    }
}
```

**Client-side error handling:**
```typescript
try {
    const room = await client.joinOrCreate("battle", { heroId: "123" });
} catch (e) {
    console.error("Denied:", e.message);  // "Hero must be level 10+"
}
```

### Password-Protected Room

```typescript
// Server
const server = defineServer({
    rooms: {
        battle: defineRoom(BattleRoom).filterBy(['password']),
    }
});

class BattleRoom extends Room {
    onCreate(options) {
        if (options.password) {
            this.setPrivate();  // hide from public matchmaking
        }
    }
}

// Client — creating
await client.create("battle", { password: "secret123" });

// Client — joining
await client.joinOrCreate("battle", { password: "secret123" });
```

---

## 3rd-Party Packages

### Recommended Packages

| Category | Package | Purpose |
|----------|---------|---------|
| **RNG** | `seedrandom` | Reproducible procedural generation |
| **ECS** | `miniplex` | Entity-Component System architecture |
| **Spatial** | `@timohausmann/quadtree-ts` | Collision detection optimization |
| **3D Physics** | `@perplexdotgg/bounce` | Server-side 3D physics |
| **3D Physics** | `crashcat` | Server-side 3D physics |
| **2D Physics** | `Planck.js` | Server-side 2D (Box2D port) |
| **2D Physics** | `matter.js` | Server-side 2D physics |
| **2D Physics** | `kinetics.ts` | Server-side 2D physics |
| **2D Physics** | `grid-engine` | Tile-based movement |
| **NavMesh** | `navcat` | Navigation mesh pathfinding |
| **Profanity** | `obscenity` | Content filtering for UGC |

> **Note:** Running a full physics engine on the backend is generally not recommended for performance reasons. Consider simplified server-side validation instead.

---

## Architecture Overview

```
┌────��────────────────────────────────────────────────┐
│                    Client SDK                         │
│  (TypeScript, Unity C#, Defold Lua, Haxe, Godot)    │
���  @colyseus/sdk, @colyseus/react                     │
└────────────────────────┬─────────────────���──────────┘
                         │ WebSocket / WebTransport
┌────────────────────────▼───────���────────────────────┐
│                 Transport Layer                       │
│  ws (default) | uWebSockets (prod) | WebTransport   │
│  | Bun WebSockets                                    │
└─────────────��──────────┬─────��──────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                Colyseus Server                        │
│                                                      │
│  ┌─────────────┐  ┌───────────┐  ┌───────────���──┐  │
│  │ Matchmaker  │  │   Rooms   │  │ HTTP Routes  │  │
│  │             │  │           │  │              │  │
│  │ filterBy()  │  │ onCreate  │  │ Express or   │  │
│  │ sortBy()    │  │ onJoin    │  │ createRouter │  │
│  │ QueueRoom   │  │ onLeave   │  │ + Zod valid. │  │
│  │ LobbyRoom   │  │ onDispose │  │              │  │
│  └──────┬──────┘  │ messages  │  └──────────────┘  │
│         │         │ clock     │                      │
│         │         └─────┬────��┘                      │
│         │               │                            │
│  ┌──────▼───────────────▼──────┐                     │
│  │    Schema (State Engine)     │                     │
│  │                              │                     │
│  │  @type() decorators          │                     │
│  │  Delta encoding (binary)     │                     │
│  │  ArraySchema / MapSchema     │                     │
│  │  StateView (per-client)      │                     │
│  │  Auto-sync at patchRate      │                     │
│  └─────────────────���────────────┘                     │
└────────────────────────┬──────────────��─────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Infrastructure Layer                     │
│                                                      │
│  ┌──────────┐  ┌────��─────┐  ┌──────────────────┐  │
��  │ Presence │  │  Driver  │  │    Database      │  │
│  │          │  │          │  │                  │  │
│  │ Local or │  │ Local or │  │ Any ORM/QB:     │  │
│  │ Redis    │  │ Redis or │  │ Drizzle, Prisma │  │
│  │          │  │ Postgres │  │ Kysely, etc.    │  │
│  │ Pub/Sub  │  │ or Mongo │  │                  │  │
│  │ KV Store │  │          │  │                  ���  │
│  │ Sets/Hash│  │ Room     │  │                  │  │
│  │ Lists    │  │ Cache    │  │                  │  │
│  └──────────┘  └──────────��  └─────────────��────┘  │
└───────���───────────────────────────────────��─────────┘
```

### Key Design Decisions

- **Server-authoritative:** All game state lives on the server; clients cannot mutate it directly
- **Schema-based sync:** Only decorated fields are tracked and synced — binary delta encoding
- **Room isolation:** Each game session is an isolated Room instance with own state and lifecycle
- **Horizontal scaling:** Redis-backed Presence + Driver enables multi-process deployments
- **Transport agnostic:** Swap between ws, uWebSockets, WebTransport, or Bun without code changes
- **Framework agnostic:** Works with any frontend (React, Phaser, Unity, Godot, etc.)
