# R3F Game Architecture Rules

Rules for building Hollowlands — a multiplayer third-person survival action game with BotW-inspired aesthetics, procedural world generation, construction, combat, stealth, and climbing. Built with React Three Fiber + Koota ECS + Rapier WASM physics (headless, not react-three/rapier).

See [GAME-CONTEXT.md](GAME-CONTEXT.md) for full game context, art direction, and survival inspirations.

**Core principles: Full ECS via Koota, KISS, DRY, reusable functions, Rapier for collision/physics world, custom ECS systems for movement state machines.**

---

## Rule 1: Koota Is the Single Source of Truth — Not Zustand, Not Refs

**The problem (previous game):** State was fragmented across a manual `world` object, Zustand stores, and scattered refs. Systems iterated with `for (const id in world.fighters)` loops that didn't scale.

**The rule:** All game state lives in koota traits on entities. Zustand is only used for pure UI state that has nothing to do with the game world (menu open/closed, settings). Never store game state in Zustand.

```ts
import { trait, createWorld } from 'koota'

// Traits define data
const Position = trait({ x: 0, y: 0, z: 0 })
const Velocity = trait({ vx: 0, vy: 0, vz: 0 })
const Health = trait({ current: 100, max: 100 })
const IsPlayer = trait()
const IsEnemy = trait()

// World is the container
const world = createWorld()

// Entities compose traits
const player = world.spawn(Position({ x: 100, y: 0, z: 50 }), Velocity, Health, IsPlayer)
```

**Querying replaces for-loops:**

```ts
// BAD (old game) — manual iteration, O(n) lookup, no archetype optimization
for (const id in world.fighters) {
  const fighter = world.fighters[id]
  fighter.position.x += fighter.velocity.vx * delta
}

// GOOD — koota query with archetype-based iteration
world.query(Position, Velocity).updateEach(([pos, vel]) => {
  pos.x += vel.vx * delta
  pos.z += vel.vz * delta
})
```

---

## Rule 2: Never Subscribe to Zustand at the Component Level for Frame-Loop Data

**The rule:** If data is read inside `useFrame`, read it with `store.getState()` inside useFrame, not with the hook at the top of the component. This prevents re-renders at 60fps.

```ts
// BAD - re-renders component 60x/sec
function CameraController() {
  const { rotation } = useCameraStore()
  useFrame(() => rotateCamera(rotation))
}

// GOOD - zero re-renders
function CameraController() {
  useFrame(() => {
    const { rotation } = useCameraStore.getState()
    rotateCamera(rotation)
  })
}
```

**When you DO want the subscription:** UI components (inventory panel, health display) that need to re-render. Use selectors with `shallow`:

```ts
import { shallow } from 'zustand/shallow'
const hp = usePlayerStore((s) => s.hp, shallow)
```

**With koota:** Prefer `useTrait` from `koota/react` for entity data in React components — it handles change detection automatically:

```ts
import { useTrait } from 'koota/react'
function HealthBar({ entity }) {
  const health = useTrait(entity, Health) // re-renders only when Health changes
  return <div style={{ width: `${(health.current / health.max) * 100}%` }} />
}
```

---

## Rule 3: Components Are Thin Wrappers — Systems Own All Logic

**The problem:** Components containing game logic as closures, `useFrame` calls for physics/movement, and collision handlers with inline logic.

**The rule:** Components do exactly two things:

1. Render JSX (mesh, geometry, material)
2. Sync entity refs via `useEffect`

**No game logic. No `useFrame`. No state reads beyond what the view needs.**

```ts
// CORRECT — thin wrapper, koota entity drives everything
function PlayerView({ entity }: { entity: Entity }) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    // Sync the Three.js ref to the entity as an AoS trait
    entity.add(SceneRef(() => groupRef))
    return () => entity.remove(SceneRef)
  }, [entity])

  return (
    <group ref={groupRef}>
      <CharacterModel />
    </group>
  )
}

// WRONG — game logic in component
function PlayerView({ entity }: { entity: Entity }) {
  useFrame((_, delta) => {
    // This belongs in a system
    const pos = entity.get(Position)
    groupRef.current.position.set(pos.x, pos.y, pos.z)
  })
}
```

Systems are pure functions that query the world and mutate traits:

```ts
// systems/movement.ts
export function movementSystem(world: World, delta: number) {
  world.query(Position, Velocity).updateEach(([pos, vel]) => {
    pos.x += vel.vx * delta
    pos.z += vel.vz * delta
  })
}
```

---

## Rule 4: One useFrame Orchestrator — Never in Components

**The rule:** `useFrame` exists in exactly one place: `GameLoop.tsx`. It calls all systems in a defined, explicit order.

```ts
// systems/game-loop.tsx — the ONLY file with useFrame
export default function GameLoopSystem() {
  const accum = useRef(0)
  const TICK = 1 / 60

  useFrame((_, delta) => {
    accum.current += delta
    while (accum.current >= TICK) {
      accum.current -= TICK
      // Fixed-rate systems — deterministic, order matters
      inputSystem(world, TICK)
      movementSystem(world, TICK)        // computes desired velocity
      physicsStepSystem(world, TICK)      // steps Rapier world, applies character controller
      syncPhysicsSystem(world)            // copies Rapier body positions back to Position traits
      climbingSystem(world, TICK)
      stealthSystem(world, TICK)
      combatSystem(world, TICK)
      projectileSystem(world, TICK)
      constructionSystem(world, TICK)
    }

    // Variable-rate systems — visual only
    syncTransformSystem(world)
    animationSystem(world, delta)
    chunkLoadingSystem(world)             // also manages chunk collider lifecycle
  })

  return null
}
```

**If you are tempted to add `useFrame` to a component, stop.** Extract the logic to a system and call it from GameLoop.

---

## Rule 5: Replace setTimeout with Frame-Based Timers

**The rule:** Use a `Timer` trait ticked by a `timerSystem`, not `setTimeout`. This respects pause, is deterministic (crucial for multiplayer), and never fires on destroyed entities.

```ts
const Timer = trait({ remaining: 0, action: '' })

// systems/timer.ts
export function timerSystem(world: World, delta: number) {
  world.query(Timer).updateEach(([timer], entity) => {
    timer.remaining -= delta
    if (timer.remaining <= 0) {
      handleTimerExpired(entity, timer.action)
      entity.remove(Timer)
    }
  })
}

// Usage — add timer trait to entity
entity.add(Timer({ remaining: 2.0, action: 'respawn' }))
```

---

## Rule 6: Bridge ECS State to UI via Koota React Hooks

**For per-entity visual state (HP bars, stamina bars):** Use `useTrait` from `koota/react` — it re-renders only when the trait changes.

```ts
import { useTrait } from 'koota/react'

function HealthBar({ entity }: { entity: Entity }) {
  const health = useTrait(entity, Health)
  if (!health) return null
  const ratio = health.current / health.max
  return <div className="health-bar" style={{ width: `${ratio * 100}%` }} />
}
```

**For bulk UI that React owns (scoreboard, chat):** Push snapshots to Zustand at a throttled rate (10Hz max), never from the fixed tick loop.

**For one-time events (death, level up):** Use koota actions that fire once — they're event-driven, not per-frame.

---

## Rule 7: Use Actions for All State Mutations — Keep Them Reusable

**The problem (previous game):** Logic was inlined at the call site — the same damage calculation appeared in 3 different systems. No reuse.

**The rule:** Every state mutation is an action. Actions are pure functions that take the world and parameters, and mutate traits. They are reusable from any call site — systems, event handlers, network message processors.

```ts
// actions/combat.ts
export function dealDamage(attacker: Entity, target: Entity, baseDamage: number) {
  const armor = target.get(Defense)?.armor ?? 0
  const finalDamage = calculateDamage(baseDamage, armor)

  target.set(Health, (h) => ({ current: Math.max(0, h.current - finalDamage) }))

  if (target.get(Health)!.current <= 0) {
    target.add(IsDead)
  }
}

// actions/spawn.ts
export function spawnEnemy(world: World, x: number, z: number) {
  return world.spawn(
    Position({ x, y: 0, z }),
    Velocity,
    Health({ current: 50, max: 50 }),
    IsEnemy,
    AIController({ state: 'patrol' }),
  )
}

// actions/equipment.ts
export function equipItem(entity: Entity, item: Entity) {
  const slot = item.get(ItemSlot)?.slot
  if (!slot) return
  entity.add(Equipped(item))  // relation
  applyStatModifiers(entity, item)
}
```

**Rule of thumb:** If you're about to write more than 2 lines of mutation logic inline in a system, extract it to an action.

---

## Rule 8: Systems Own Their Domain — No Overlap

Each system has exclusive ownership of specific traits. When two systems could both write the same field, assign it to exactly one and have the other defer.

| System | Owns |
| --- | --- |
| `inputSystem` | Reads input devices, writes `InputState` trait |
| `movementSystem` | Computes desired `Velocity` from input + camera direction |
| `physicsStepSystem` | Steps the Rapier world, runs character controller with desired velocity |
| `syncPhysicsSystem` | Copies Rapier rigid body positions back to `Position` traits |
| `chunkColliderSystem` | Creates/destroys Rapier colliders (terrain, rocks, trees) when chunks load/unload |
| `climbingSystem` | `ClimbState`, stamina drain during climb |
| `stealthSystem` | `Visibility` trait, bush detection |
| `combatSystem` | `AttackState`, hit detection, emits damage events |
| `projectileSystem` | Arrow/projectile `Position`, lifetime, collision |
| `constructionSystem` | Structure placement, building progress |
| `aiSystem` | `AIController` state transitions, pathfinding |
| `syncTransformSystem` | Copies `Position`/`Rotation` traits to Three.js refs |
| `animationSystem` | Three.js `AnimationAction` crossfades |
| `chunkLoadingSystem` | Loads/unloads world chunks + triggers `chunkColliderSystem` |

Clear handoff points, no conflicts. `combatSystem` never writes `Position`; `movementSystem` never writes `Health`.

---

## Rule 9: Entity Lifecycle via Koota — Not Zustand ID Lists

**The old way:** Zustand held `enemyIds[]`, React rendered from the list, world object held state separately.

**The new way:** Koota manages the full lifecycle. Queries replace ID lists. React components observe the world.

```ts
// Spawning
const enemy = world.spawn(Position({ x: 10, y: 0, z: 20 }), Health, IsEnemy, AIController)

// Despawning
enemy.destroy() // koota handles cleanup, queries update automatically

// React rendering — use useQuery from koota/react
function EnemyRenderer() {
  const enemies = useQuery(IsEnemy, Position)
  return enemies.map((entity) => <EnemyView key={entity} entity={entity} />)
}
```

No manual ID list synchronization. No `delete world.enemies[id]` + `set(state => ...)` two-step.

---

## Rule 10: Collision Handlers Dispatch Events, Not Logic

**The rule:** Collision callbacks only record what happened. Systems process events next tick.

```ts
// Collision traits
const CollisionEvent = trait({ type: '', targetEntity: 0 as Entity, data: {} as Record<string, unknown> })

// In a component — just add trait, no logic
onCollisionEnter={(other) => {
  world.spawn(CollisionEvent({ type: 'hit', targetEntity: other.entity, data: { damage: 10 } }))
}}

// In a system — process and destroy event entities
export function collisionProcessingSystem(world: World) {
  world.query(CollisionEvent).forEach((eventEntity) => {
    const event = eventEntity.get(CollisionEvent)
    if (event.type === 'hit') dealDamage(event.targetEntity, event.data.damage)
    eventEntity.destroy()
  })
}
```

---

## Rule 11: Model Entity Phases as Tag Traits — Not Flat Flags

**The problem (previous game):** Flat boolean flags (`isDead`, `isStunned`, `isPushed`) with growing skip-checks in every system.

**The rule:** Use mutually exclusive tag traits for entity phases. Systems filter by the presence/absence of these tags.

```ts
// Phase tags — mutually exclusive
const PhaseIdle = trait()
const PhaseMoving = trait()
const PhaseCombat = trait()
const PhaseClimbing = trait()
const PhaseStunned = trait()
const PhaseDead = trait()

// Data for phase-specific state
const StunData = trait({ remaining: 0 })
const ClimbData = trait({ surface: '', stamina: 0 })

// Systems filter naturally
export function movementSystem(world: World, delta: number) {
  // Only moves entities that are in the moving phase
  world.query(PhaseMoving, Position, Velocity).updateEach(([pos, vel]) => {
    pos.x += vel.vx * delta
    pos.z += vel.vz * delta
  })
}

// Phase transitions via actions
export function stunEntity(entity: Entity, duration: number) {
  // Remove any existing phase tags
  clearPhase(entity)
  entity.add(PhaseStunned, StunData({ remaining: duration }))
}
```

---

## Rule 12: All Game Constants Live in game-config.ts

**The rule:** Every tunable constant belongs in `src/game-config.ts` under the `GAME_CONFIG` object. No magic numbers in systems, components, or trait initializers.

```ts
export const GAME_CONFIG = {
  WORLD: {
    SEED: 42,
    CHUNK_SIZE: 64,
    RENDER_DISTANCE: 3,
  },
  CHARACTER: {
    MOVEMENT_SPEED: 5.0,
    CLIMB_SPEED: 2.0,
    CLIMB_STAMINA_DRAIN: 10, // per second
    STEALTH_DETECTION_RADIUS: 3.0,
  },
  COMBAT: {
    SWORD_DAMAGE: 25,
    ARROW_DAMAGE: 15,
    ARROW_SPEED: 20,
    ATTACK_COOLDOWN: 0.6,
    CRIT_MULTIPLIER: 1.5,
  },
  CONSTRUCTION: {
    GRID_SIZE: 1.0,
    WALL_HP: 200,
    FLOOR_HP: 150,
  },
  CAMERA: {
    DEFAULT_HEIGHT: 15,
    MIN_ZOOM: 8,
    MAX_ZOOM: 25,
    ROTATION_SPEED: 2.0,
  },
}
```

```ts
// BAD — magic number
if (dist < 3.0) detectPlayer()

// GOOD — single source of truth
if (dist < GAME_CONFIG.CHARACTER.STEALTH_DETECTION_RADIUS) detectPlayer()
```

---

## Rule 13: Visual Effects Use Object Pooling — Never Zustand

**The rule:** Visual effects (floating damage numbers, arrow trails, impact sparks) that fire multiple times per second use a fixed-size pool as a koota trait array. Components pre-mount all pool slots. A render system drives visibility and transforms directly on refs.

```ts
// Trait for pooled effects
const FloatingText = trait({ active: false, text: '', x: 0, y: 0, z: 0, progress: 0 })

// Pre-spawn pool at startup
for (let i = 0; i < 20; i++) {
  world.spawn(FloatingText)
}

// Action to activate a slot
export function spawnFloatingText(world: World, text: string, x: number, y: number, z: number) {
  const slot = world.queryFirst(FloatingText, Not(IsActive))
  if (!slot) return // pool full
  slot.set(FloatingText, { active: true, text, x, y, z, progress: 0 })
  slot.add(IsActive)
}

// System drives animation
export function floatingTextSystem(world: World, delta: number) {
  world.query(IsActive, FloatingText).updateEach(([ft], entity) => {
    ft.progress += delta / 1.0
    ft.y += delta * 2
    if (ft.progress >= 1) {
      ft.active = false
      entity.remove(IsActive)
    }
  })
}
```

**When NOT to pool (Zustand/React state is fine):** Round start/end UI, score updates, menu interactions — anything event-driven and infrequent.

---

## Rule 14: Procedural Generation Must Be Deterministic and Seed-Based

**The rule:** Every procedural generation function takes the world seed (or a derived sub-seed) as input and produces identical output for identical input. No `Math.random()` — use a seeded PRNG.

```ts
// BAD — non-deterministic, breaks multiplayer
const treeX = Math.random() * chunkSize

// GOOD — deterministic, every client generates the same world
const rng = createSeededRNG(GAME_CONFIG.WORLD.SEED, chunkX, chunkZ)
const treeX = rng.next() * chunkSize
```

This is non-negotiable for multiplayer. If two clients generate different terrain, the game is broken.

---

## Rule 15: Write Reusable Functions — No Inline Duplication

**The problem (previous game):** AI-generated code inlined the same logic repeatedly instead of extracting functions. Distance calculations, position lookups, and damage formulas were copy-pasted across systems.

**The rule:** If a piece of logic appears (or could appear) in more than one place, extract it to a named function immediately. Don't wait for the third occurrence.

```ts
// BAD — same calculation inlined in 4 systems
const dx = pos1.x - pos2.x
const dz = pos1.z - pos2.z
const dist = Math.sqrt(dx * dx + dz * dz)

// GOOD — one function, used everywhere
export function distance2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

// GOOD — reusable action
export function isInRange(a: Entity, b: Entity, range: number): boolean {
  const posA = a.get(Position)
  const posB = b.get(Position)
  if (!posA || !posB) return false
  return distance2D(posA, posB) <= range
}
```

This applies to:
- Math utilities (distance, lerp, clamp, normalize)
- Entity queries (findNearestEnemy, getEquippedWeapon)
- State transitions (clearPhase, enterCombat)
- Validation (canAttack, canBuild, canClimb)

---

## Rule 16: Relations for Entity Graphs

**The rule:** Use koota relations to model ownership, hierarchy, targeting, and containment — not string IDs stored in traits.

```ts
import { relation } from 'koota'

const ChildOf = relation({ autoDestroy: 'orphan' })  // Structure parts → parent structure
const Equipped = relation()                            // Item → character wearing it
const Targeting = relation({ exclusive: true })        // Entity → its current target
const Contains = relation({ store: { amount: 0 } })   // Inventory slot → item with quantity

// Build hierarchy: wall belongs to a base
const base = world.spawn(IsStructure, Position)
const wall = world.spawn(IsWall, Position, Health, ChildOf(base))

// Query: all items equipped by player
const items = player.targetsFor(Equipped)

// Query: who is targeting this entity?
const attackers = world.query(Targeting(enemy))
```

---

## Rule 17: Name Every Data Shape — No Inline Object Types

**The rule:** Every reusable object shape must be a named interface or use koota's `TraitRecord` type, not inline type annotations.

```ts
// BAD — inline shapes
const Position = trait({ x: 0 as number, z: 0 as number })

// GOOD — named via TraitRecord
const Position = trait({ x: 0, y: 0, z: 0 })
type PositionData = TraitRecord<typeof Position>

// Use in function signatures
export function distance2D(a: PositionData, b: PositionData): number { ... }
```

---

## Rule 18: Separate Core from View

**The rule:** Core logic (traits, systems, actions, world) is pure TypeScript with zero React/R3F imports. The view layer reads from the world and mutates via actions.

```
src/
  core/                 # Pure TypeScript — NO React imports
    traits/             # All trait definitions
    systems/            # All systems (pure functions)
    actions/            # All state mutation actions
    physics/            # Rapier world, collider factories, character controller wrapper
    world.ts            # Koota world creation + seed config
    game-config.ts      # All tunable constants
  features/             # View layer — React + R3F
    player/
    enemies/
    world-gen/
    construction/
    combat/
    ui/
  game-loop.tsx         # The ONE useFrame orchestrator
```

This separation means:
- Systems can run headless (server, worker, tests)
- Views can be swapped (2D debug view, 3D game view)
- Core logic is testable without React

---

## Rule 19: Rapier Handles Physics World — ECS Systems Drive Game Logic

**The rule:** Use `@dimforge/rapier3d-compat` (headless WASM, NOT `@react-three/rapier`) for collision detection, ray-casting, shape-casting, and the kinematic character controller. Custom ECS systems compute desired movement; Rapier resolves collisions and provides the final position.

**Why:** The game uses smooth BotW-style terrain with climbing and paragliding. Smooth terrain requires trimesh collision, broadphase spatial partitioning, and ray/shape-casting — all of which Rapier provides at WASM speed. Using Rapier headlessly (not through a React wrapper) keeps the physics portable to a server for multiplayer authority.

**How it works:**

- **One Rapier `World` instance** — created at init, stepped each fixed tick by `physicsStepSystem`
- **Colliders are chunk-scoped** — when a chunk loads, create terrain heightfield + rock trimesh + tree capsule colliders. When it unloads, destroy them
- **Player uses `KinematicCharacterController`** — `movementSystem` computes desired velocity, `physicsStepSystem` calls `controller.computeColliderMovement()`, `syncPhysicsSystem` writes the corrected position back to the `Position` trait
- **Custom state machines on top** — climbing, paragliding, swimming bypass the default character controller and use Rapier ray-casts/shape-casts directly
- **Rapier never imported in view layer** — all Rapier access lives in `src/core/physics/`

```ts
// core/physics/physics-world.ts — singleton, headless
import RAPIER from '@dimforge/rapier3d-compat'

let rapierWorld: RAPIER.World
let characterController: RAPIER.KinematicCharacterController

export async function initPhysics() {
  await RAPIER.init()
  rapierWorld = new RAPIER.World({ x: 0, y: -9.81 * 4, z: 0 })
  characterController = rapierWorld.createCharacterController(0.01)
  characterController.enableSnapToGround(0.5)
  characterController.setMaxSlopeClimbAngle(Math.PI * 0.35)
  characterController.enableAutostep(0.7, 0.3, false)
}

// core/systems/physics-step-system.ts
export function physicsStepSystem(world: World, delta: number) {
  // Apply desired velocity through character controller
  world.query(IsPlayer, Velocity, RapierBodyRef).readEach(([vel, bodyRef]) => {
    const desired = { x: vel.vx * delta, y: vel.vy * delta, z: vel.vz * delta }
    characterController.computeColliderMovement(bodyRef.collider, desired)
    const corrected = characterController.computedMovement()
    const pos = bodyRef.body.translation()
    bodyRef.body.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    })
  })
  rapierWorld.step()
}
```

**Collider types by object:**

| Object | Collider | Notes |
| --- | --- | --- |
| Terrain | `HeightfieldCollider` per chunk | Built from chunk `heights` Float32Array |
| Rocks | `TrimeshCollider` per instance | Uses actual rock mesh geometry for accurate collision |
| Trees | `CapsuleCollider` per trunk | Simple and cheap, only the trunk blocks movement |
| Player | `CapsuleCollider` + `KinematicCharacterController` | Kinematic body, not dynamic |

---

## Extra Rules

1. Files use kebab-case: `player-view.tsx`, `movement-system.ts`
2. Avoid `if {} else {}` — use early returns and guard clauses
3. Use `updateEach`/`readEach` over `for...of` + `entity.get()` for data-bearing queries
4. Never use `Math.random()` in game logic — always seeded PRNG
5. Every system receives `world` as first argument — no module-level world imports in systems
6. Visual style targets BotW aesthetic — cel-shaded, stylized, warm palette. No photorealism
