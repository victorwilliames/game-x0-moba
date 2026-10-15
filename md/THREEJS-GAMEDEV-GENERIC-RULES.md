# Three.js Game Development — Generic Codebase Rules

Reusable architecture rules for maintainable Three.js and browser-based game projects. These rules are designed to guide both human developers and AI coding agents before implementing a feature and again before reviewing the result.

The goal is simple: game code should be easy to understand, update, debug, test, optimize, and extend without accidental regressions.

The rules are intentionally framework-neutral. They work with plain Three.js, ECS and non-ECS architectures, singleplayer and multiplayer games, and different physics or UI libraries. When a project has stronger local rules, follow the local rules first.

---

## How To Use This File

Give this document to an AI coding agent before it changes the project. The agent should follow these rules unless a local project rule explicitly overrides them. After making changes, it should review the result against the same document and run the required verification commands.

---

## Core Philosophy

### Rule 1: Prefer Data-Driven Simulation, Event-Driven Side Effects

The game simulation should be driven by explicit state. One-shot facts and cross-domain side effects should be driven by typed events.

Use normal systems/functions for continuous simulation:

- movement
- physics
- animation blending
- AI ticking
- hunger/stamina/resource ticking
- interpolation
- transform sync
- chunk or level streaming
- camera follow

Use events for one-shot facts and cross-domain communication:

- damage happened
- entity died
- item picked up
- sound requested
- visual effect requested
- UI prompt changed
- network message queued
- save requested
- achievement/progression triggered

Do not force everything through events. Fully event-driven gameplay often becomes harder to trace than simple ordered systems. The preferred rule is:

> Data-driven simulation. Event-driven side effects.

### Rule 2: Code Should Reveal Ownership

Every important piece of state must have a clear owner.

Before changing state, know:

- Which module owns this state?
- Which system is allowed to write it?
- Which systems may only read it?
- Is this persistent gameplay state, transient runtime state, or pure view state?

If two systems write the same field, stop and define ownership before adding more code.

### Rule 3: The Happy Path Should Be Easy To Read

Game code becomes difficult when every feature is a pile of special cases. Prefer:

- small named functions
- guard clauses
- explicit phases
- plain data shapes
- domain-specific names
- single-purpose modules

Avoid cleverness that saves a few lines but hides intent.

### Rule 4: Favor Boring, Local Abstractions

Add abstractions only when they reduce real complexity.

Good abstractions:

- remove repeated logic
- name a domain concept
- centralize a risky rule
- make testing easier
- make ownership clearer

Bad abstractions:

- hide simple code behind generic names
- mix unrelated domains
- exist only because "we might need it later"
- make debugging require jumping through many files

---

## Architecture Boundaries

### Rule 5: Separate Core, View, Platform, and Tools

Use clear architectural layers.

Recommended structure:

```txt
src/
  core/
    traits-or-state/
    systems/
    actions/
    events/
    data/
    math/
    physics/
  view/
    renderers/
    components/
    hud/
    effects/
  platform/
    audio/
    input/
    networking/
    persistence/
    browser-or-native/
  tools/
    debug/
    editors/
    inspectors/
  app/
    startup/
    game-loop/
    providers/
```

Names may vary by project, but the boundaries should stay clear.

Core should not import from view, UI, debug tools, networking clients, browser-only modules, or platform-specific adapters.

The dependency direction should usually be:

```txt
app -> view -> core
app -> platform -> core
tools -> core/view/platform
core -> shared utilities/data only
```

### Rule 6: Core Logic Must Be Headless

Core gameplay logic should be able to run without the renderer.

Core modules should not depend on:

- UI framework imports
- renderer objects unless they are isolated references
- DOM APIs like `window` or `document`
- browser storage APIs
- audio APIs
- network client instances
- debug panels

If core needs one of these things, emit an event or call a small injected adapter.

### Rule 7: Views Render State, They Do Not Own Gameplay

View components should:

- render visuals
- subscribe to view-relevant state
- register scene refs or view refs
- call actions for user commands

View components should not:

- contain gameplay rules
- run physics
- mutate unrelated game state directly
- own authoritative timers
- duplicate system logic
- poll gameplay state every frame unless explicitly required for a visual-only effect

### Rule 8: Platform Integrations Are Adapters

Audio, networking, persistence, analytics, browser APIs, native APIs, and controller APIs are platform adapters.

Adapters should translate between the outside world and game concepts. They should not become the place where gameplay rules live.

Examples:

- Network adapter receives `player:hit` and turns it into a typed game event.
- Audio adapter consumes `SoundRequested` events.
- Save adapter consumes `SaveRequested` events and reads a serializer.
- Input adapter writes an `InputState` or dispatches input commands.

---


## Three.js, Physics, And Runtime Boundaries

### Rule 9: Gameplay Defines Intent, Physics Resolves Motion, Rendering Displays Results

Keep the responsibilities separate:

1. input and gameplay systems decide the desired action or movement
2. the physics layer resolves collisions and produces the allowed result
3. authoritative game state stores the final position, velocity, or contact state
4. the Three.js view copies that state into scene objects

The renderer should not secretly become the source of gameplay truth. Physics objects and Three.js objects may hold references for synchronization, but ownership must remain explicit.

Good flow:

```ts
readInput()
computeDesiredMovement()
resolvePhysics()
writeFinalTransformToState()
syncStateToThreeObjects()
```

Bad flow:

```ts
// Renderer object is moved directly, then other systems guess what happened.
playerMesh.position.x += speed * delta
```

### Rule 10: Runtime Callbacks Report Facts, They Do Not Contain Full Gameplay Features

Collision, raycast, animation, input, and loader callbacks are boundary points. Keep them small.

They should usually:

- record what happened
- normalize external data
- emit a typed event
- call one named action
- queue work for the next known game-loop phase

They should not contain a large mixture of damage, inventory, audio, VFX, UI, saving, and networking logic.

Example:

```ts
function onCollision(contact: CollisionContact) {
  collisionEvents.push({ type: 'projectile_hit', projectileId: contact.a, targetId: contact.b })
}
```

A gameplay system processes that event in a controlled phase.

---

## ECS And State Rules

These rules apply directly to ECS projects. For non-ECS projects, treat "trait/component" as "state object" and "system" as "domain update function".

### Rule 11: State Belongs In One Place

Do not split authoritative gameplay state across multiple stores.

Good:

- ECS traits/components own game state.
- UI store owns menu state.
- Platform adapter owns connection status.

Bad:

- player health in ECS, UI store, and network cache at the same time
- inventory duplicated between server snapshot, local store, and entity state without a bridge owner
- render refs used as gameplay state

If state is duplicated for performance or networking, document which copy is authoritative and which copy is derived.

### Rule 12: Mutations Go Through Actions

Any reusable gameplay mutation should be an action.

Actions should be named after player/game concepts:

- `dealDamage`
- `healEntity`
- `pickupItem`
- `equipItem`
- `placeConstruction`
- `openContainer`
- `startAttack`
- `respawnPlayer`

Do not inline important mutation logic inside UI handlers, network handlers, or random systems. If more than a couple of lines mutate game state, extract an action.

### Rule 13: Systems Own Domains

A system should have one primary job.

Good systems:

- read a clear set of state
- write only the state they own
- run in a known phase
- have a short comment explaining order dependencies when needed

Bad systems:

- update movement, audio, UI, network messages, and VFX in one function
- write fields owned by another system
- depend on hidden module state
- call into unrelated layers directly

### Rule 14: Model State Phases Explicitly

Use explicit phases or tags instead of piles of booleans.

Good:

```ts
type MotionPhase =
  | 'grounded'
  | 'jumping'
  | 'falling'
  | 'climbing'
  | 'attacking'
  | 'dead'
```

Bad:

```ts
isGrounded
isJumping
isFalling
isClimbing
isAttacking
isDead
```

When phases are mutually exclusive, represent them as mutually exclusive state.

### Rule 15: Avoid Large Mixed-Purpose State Bags

If a state object has fields owned by many systems, split it.

Warning signs:

- many unrelated comments inside one state object
- fields only valid during one phase
- many systems update different parts of the same object
- hard-to-name helper functions because the data shape is too broad

Prefer smaller state shapes with clear ownership.

---


### Rule 16: Entity Lifecycle Has One Owner And A Complete Cleanup Path

Every created entity or runtime object must have a clear lifecycle:

- who creates it
- who marks it inactive or destroyed
- who removes it from queries or collections
- who detaches renderer and physics references
- who releases assets or pooled slots

Do not maintain several manual ID lists that must all be updated separately. Prefer one authoritative registry, world, or entity manager and derive views from it.

Destroying an entity should not leave behind:

- active timers
- collision references
- audio handles
- scene objects
- event subscriptions
- inventory or targeting links

### Rule 17: Model Relationships Explicitly

Ownership, hierarchy, targeting, containment, and equipment relationships should be represented as real data, not hidden conventions.

Examples:

- a sword is equipped by a character
- a projectile was fired by an attacker
- a wall belongs to a structure
- an enemy targets a player
- an item is stored in a container

Use typed references or relationship records. Avoid unrelated string IDs scattered across modules without validation or cleanup rules.

---

## Event Rules

### Rule 18: Events Are Typed Facts, Not String Bags

Events should be typed and domain-specific.

Good:

```ts
type GameEvent =
  | { type: 'entity_damaged'; target: EntityId; amount: number; source?: EntityId }
  | { type: 'entity_died'; entity: EntityId; cause: 'combat' | 'fall' | 'starvation' }
  | { type: 'sound_requested'; soundId: SoundId; position?: Vec3; volume?: number }
```

Bad:

```ts
{ type: string; data: any }
```

Use strings for discriminants, not for untyped payloads.

### Rule 19: Events Must Have A Clear Lifetime

Every event queue must answer:

- Who emits this event?
- Who consumes it?
- When is it drained?
- Is it consumed once or retained?
- What happens if no consumer exists?

One-shot events should be drained exactly once in a known game-loop phase.

### Rule 20: Events Cross Boundaries, They Do Not Replace State

Events should not be used as the only source of truth for persistent state.

Good:

- `DamageEvent` happens once.
- `Health` stores the resulting state.

Bad:

- replaying all damage events every frame to determine current health.

Use events to say "this happened." Use state to say "this is true now."

### Rule 21: Core Emits Intent, Adapters Perform Effects

Core systems may emit:

- `SoundRequested`
- `VfxRequested`
- `NetworkMessageQueued`
- `CameraShakeRequested`
- `UiPromptChanged`
- `SaveRequested`

Core systems should not directly call:

- audio playback
- particle spawning
- UI framework state setters
- network send methods
- browser storage
- scene graph mutation outside owned refs

Bridge modules consume events and call platform/view APIs.

### Rule 22: Keep Event Processing Ordered

The game loop should show event processing order clearly.

Example:

```ts
inputPhase()
fixedSimulationPhase()
gameplayEventPhase()
networkOutboxPhase()
viewEventPhase()
visualSyncPhase()
audioPhase()
debugPhase()
```

Do not drain events from random places. Event order is part of game behavior.

---

## Game Loop Rules

### Rule 23: The Game Loop Is An Orchestrator, Not A Feature Dump

The game loop should mostly call named systems or phase runners.

Good:

```ts
runInputPhase(world, input)
runFixedSimulationPhase(world, fixedDelta)
runInteractionPhase(world, cameraSnapshot)
runPresentationPhase(world, frameDelta)
```

Bad:

```ts
// 800 lines of inline gameplay, UI prompts, networking, audio, debug, and rendering
```

If the game loop grows large, extract domain-specific phase runners.

### Rule 24: Use Explicit Tick Phases

Separate fixed-rate simulation from variable-rate presentation.

Fixed-rate:

- input consumption
- movement
- physics
- gameplay timers
- combat resolution
- deterministic AI

Variable-rate:

- camera smoothing
- visual interpolation
- animation mixer updates
- particle updates
- audio fades
- shader time
- debug rendering

Never hide fixed simulation inside view components.

### Rule 25: Only Approved Files May Own Frame Callbacks

Frame callbacks should be centralized.

For Three.js and browser games:

- `requestAnimationFrame` should be owned by the main game-loop module.
- render-only exceptions must be explicit, documented, and reviewed.
- avoid modules registering hidden per-frame gameplay callbacks.

For other engines:

- centralize update registration.
- avoid components registering hidden per-frame gameplay logic.

---


### Rule 26: Gameplay Timers Follow The Simulation Clock

Cooldowns, respawns, temporary effects, attack windows, and AI delays should normally be updated by the game loop instead of raw `setTimeout()` or `setInterval()` calls.

Frame-based or simulation-clock timers:

- pause correctly
- respect time scaling
- are deterministic
- can be cancelled when an entity is destroyed
- run in a known order

Example:

```ts
interface GameplayTimer {
  remaining: number
  action: 'respawn' | 'finish_attack' | 'remove_effect'
}

function updateGameplayTimer(timer: GameplayTimer, delta: number) {
  timer.remaining -= delta
}
```

Browser timers remain acceptable for platform concerns such as telemetry batching, non-gameplay UI notifications, or external service retries.


## Time, Randomness, And Determinism

### Rule 27: No Raw Time In Gameplay Systems

Gameplay systems should receive time from the game loop.

Good:

```ts
movementSystem(world, fixedDelta)
```

Bad:

```ts
const now = Date.now()
```

Raw clocks are acceptable only in platform adapters, profiling, telemetry, and persistence timestamps.

### Rule 28: No Raw Randomness In Gameplay Systems

Use named RNG sources.

Recommended RNG categories:

- seeded gameplay RNG
- seeded procedural generation RNG
- server-authoritative RNG
- cosmetic-only RNG

`Math.random()` is acceptable only for cosmetic effects that do not affect gameplay, networking, saves, or replayability. Even then, prefer a named helper like `randomCosmetic()`.

### Rule 29: Procedural Generation Must Be Reproducible

Procedural world generation should take explicit inputs:

- seed
- chunk/level coordinates
- biome/domain parameters
- generation version if needed

The same inputs should produce the same outputs.

---

## File And Module Structure

### Rule 30: Organize By Responsibility

Use folders that communicate responsibility.

Common responsibilities:

- `data`: static definitions and registries
- `actions`: reusable mutations
- `systems`: per-tick logic
- `events`: typed events and queues
- `renderers`: entity-to-view mapping
- `components`: reusable UI/view pieces
- `adapters`: platform bridges
- `debug`: dev-only tools
- `utils`: generic helpers with no domain ownership

Do not put domain logic in `utils` just because it is shared. If a helper knows about inventory, combat, physics, or quests, it belongs to that domain.

### Rule 31: Files Should Have A Clear Reason To Exist

A file should usually answer one question.

Good:

- `inventory-actions.ts`: how inventory mutates
- `movement-system.ts`: how velocity is produced
- `damage-events.ts`: damage event types and queue
- `audio-bridge.ts`: how sound events become audio playback

Bad:

- `helpers.ts`
- `misc.ts`
- `game-stuff.ts`
- massive files that mix many domains

### Rule 32: Split Files Before They Become Hard To Review

Large files are not automatically bad, but they need stronger structure.

Consider splitting when:

- a file passes 300 to 500 lines
- multiple domains share the file
- exports are used by unrelated modules
- review requires scrolling through unrelated sections
- comments are used to create many mini-files inside one file

---


### Rule 33: Tunable Values Live In Central Configuration

Gameplay values that designers or AI agents may tune should live in typed configuration or data files rather than as unexplained numbers inside systems.

Examples:

- movement speed
- jump height
- damage
- cooldowns
- render distance
- camera limits
- spawn rates
- world seed
- physics tolerances

Bad:

```ts
if (distance < 3.0) detectPlayer()
```

Good:

```ts
if (distance < GAME_CONFIG.STEALTH.DETECTION_RADIUS) detectPlayer()
```

Keep constants close to their domain when one giant configuration file would become difficult to maintain.

### Rule 34: Extract Reusable Logic Before It Spreads

When logic is likely to be used in more than one place, give it a domain-specific name and extract it early.

Common candidates:

- distance, clamp, interpolation, and normalization helpers
- damage and defense calculations
- range and visibility checks
- state transitions
- spawn and despawn procedures
- validation such as `canAttack`, `canBuild`, or `canUseItem`

Do not wait for many copy-pasted versions to exist. Avoid abstraction for hypothetical needs, but remove real duplication before AI-generated variants drift apart.

### Rule 35: Pass Important Dependencies Explicitly

Systems and actions should receive the world, state, services, configuration, or adapters they need through parameters or a clear context object.

Prefer:

```ts
movementSystem(gameWorld, inputState, fixedDelta)
```

Avoid hidden module-level imports that make tests and execution order difficult to understand:

```ts
import { globalWorld } from '../world'
```

Explicit dependencies make headless tests, workers, alternate renderers, and future multiplayer migration easier.

### Rule 36: Use Consistent File Naming

Choose one file naming convention and apply it across the project. For JavaScript and TypeScript game projects, `kebab-case` is a clear default:

```txt
movement-system.ts
player-renderer.ts
inventory-actions.ts
game-config.ts
```

Do not mix several naming styles without a project-specific reason.


## Naming Rules

### Rule 37: Names Should Be Domain-Specific

Prefer names that describe the game concept.

Good:

- `startAttack`
- `enterClimbing`
- `canPlaceWall`
- `consumeFood`
- `syncRemotePlayers`

Bad:

- `handleThing`
- `processData`
- `updateStuff`
- `doAction`
- `manager`

### Rule 38: Boolean Names Should Read Like Questions

Good:

- `isGrounded`
- `hasLineOfSight`
- `canPlace`
- `shouldRespawn`

Bad:

- `groundedFlag`
- `placement`
- `valid`

### Rule 39: Avoid Unnamed Object Shapes

Reusable object shapes should be named.

Good:

```ts
interface CameraSnapshot {
  position: Vec3
  forward: Vec3
}
```

Bad:

```ts
function update(x: { a: number; b: number; c: number }) {}
```

Inline shapes are fine for tiny local code, not for domain contracts.

---

## UI And HUD Rules

### Rule 40: UI Reads State Through Hooks Or Bridges

UI should not poll gameplay state every frame by default.

Preferred:

- subscribe to state with framework/ECS hooks
- read snapshots pushed by a throttled bridge
- render from explicit UI state

Avoid:

- `requestAnimationFrame` loops in HUD components
- duplicating gameplay calculations in UI
- storing gameplay truth in UI state

### Rule 41: UI Commands Call Actions

UI should express user intent:

- craft item
- move slot
- close menu
- respawn
- equip item

The UI should not implement the gameplay mutation itself.

---

## Debug And Tooling Rules

### Rule 42: Debug Tools Must Be Isolated

Debug tools should live in a debug/tools area and be easy to exclude from production.

Debug code should not:

- be mounted by default in production
- mutate config through `any`
- leave large commented sections in runtime files
- introduce hidden frame loops
- become required for gameplay

### Rule 43: Runtime Tuning Must Have A Promotion Path

If a debug panel changes tuning values, there must be a clear path to promote those values into config/data.

Good:

- debug panel edits a draft tuning object
- final values are copied to config
- config remains typed

Bad:

- debug panel mutates global config with unchecked casts
- tuned values only exist in module-level variables

---

## Type Safety Rules

### Rule 44: `any` Is A Boundary Tool Only

Avoid `any` in domain logic.

Allowed uses:

- third-party library boundaries
- untyped asset loader output
- network payload parsing before validation
- temporary migration code with a comment and follow-up

If `any` is needed, contain it in a tiny adapter and convert it to a named type before it enters core logic.

### Rule 45: Parse External Data Before Trusting It

External data includes:

- network messages
- save files
- URL parameters
- local storage
- editor-authored JSON
- analytics payloads

Validate or normalize external data at the boundary. Do not let untrusted shapes spread through the codebase.

---

## Performance Rules

### Rule 46: Optimize Ownership Before Micro-Optimizing

Performance problems are often architecture problems first.

Before micro-optimizing, check:

- Is this running more often than needed?
- Is this state causing unnecessary renders?
- Is this logic in the wrong layer?
- Is this allocation inside a hot loop?
- Can this be moved to a system, worker, pool, or cache?

### Rule 47: Hot Paths Avoid Allocations

Per-frame and per-entity loops should avoid unnecessary allocations.

Prefer:

- reusable vectors/arrays
- object pools for frequent effects
- cached queries where supported
- stable config references

But do not sacrifice clarity without a measured reason.

### Rule 48: Effects That Spawn Often Use Pools

Frequent visual effects should use pooling.

Examples:

- damage numbers
- sparks
- footsteps
- hit flashes
- projectiles
- particles

Infrequent UI and menus do not need pooling.

---

## Multiplayer And Persistence Rules

### Rule 49: Server Authority Must Be Explicit

For multiplayer features, document which side owns truth.

Examples:

- server-authoritative health
- client-predicted movement
- client-only cosmetics
- server-approved inventory changes

Never hide authority decisions in random client code.

### Rule 50: Network Code Is A Bridge, Not Gameplay

Network handlers should:

- validate messages
- convert messages to actions/events
- sync authoritative state

Network handlers should not:

- duplicate gameplay rules
- directly trigger renderer-only effects from core state
- mutate many unrelated domains inline

### Rule 51: Saves Use Serializers

Persistence should use explicit serializers/deserializers.

Do not let save logic crawl through arbitrary state without named ownership. Each persisted domain should own how it saves and restores its data.

---

## Testing And Review Rules

### Rule 52: Build, Lint, And Tests Are Gates

AI work is not complete until the relevant checks pass.

Minimum gates:

```txt
npm run build
npm run lint
npm test, if available
```

Equivalent commands should be used for non-JavaScript projects.

If a gate cannot run, the final response must say why.

### Rule 53: Add Tests Where Bugs Would Be Expensive

Prioritize tests for:

- pure rules
- actions
- serializers
- procedural generation
- inventory/crafting
- combat math
- networking message validation
- save/load migration

Renderer-heavy visuals can use smoke tests, screenshots, or manual verification when unit tests are not practical.

### Rule 54: Review For Architecture, Not Just Bugs

Code review should check:

- Does this preserve layer boundaries?
- Is ownership clear?
- Did gameplay state stay out of UI/platform stores?
- Are side effects event-driven where appropriate?
- Is the game loop still readable?
- Are types named and useful?
- Are time and randomness controlled?
- Is debug code isolated?
- Are build/lint/tests passing?

---

## Feature Implementation Workflow For AI Agents

When implementing a feature:

1. Read the local rules and this document.
2. Identify the domain owner.
3. Identify the state that already exists.
4. Decide whether the feature needs state, actions, systems, events, view code, platform adapters, or tests.
5. Keep simulation data-driven.
6. Use typed events for one-shot side effects and boundary crossings.
7. Keep core headless.
8. Add or update reusable actions instead of inlining mutations.
9. Update the game loop only by adding named systems or phase runners.
10. Use simulation-clock timers for gameplay timing.
11. Keep physics, authoritative state, and Three.js rendering synchronized but separately owned.
12. Verify entity cleanup, relationships, and event lifetimes.
13. Run the required checks.

When reviewing a feature:

1. Look for boundary violations first.
2. Check state ownership.
3. Check event usage and event lifetime.
4. Check whether UI/view code owns gameplay accidentally.
5. Check whether the game loop grew too much.
6. Check type safety at external boundaries.
7. Check tests and verification.
8. Recommend new rules if the issue is likely to repeat.

---

## Short Version

Use this as the mental model:

- Core is headless.
- State has one owner.
- Systems run continuous simulation.
- Actions perform reusable mutations.
- Events communicate one-shot facts and side effects.
- Views render state.
- Platform adapters handle the outside world.
- Debug tools are isolated.
- The game loop orchestrates named phases.
- Time and randomness are controlled.
- Gameplay timers follow the simulation clock.
- Physics resolves motion; state owns truth; Three.js displays the result.
- Entity creation and destruction have complete cleanup paths.
- Tunable values live in configuration, not magic numbers.
- Dependencies are explicit.
- Build, lint, and tests are gates.

