import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Dummy } from './Dummy';

export type CharacterState = 'IDLE' | 'WALKING' | 'ATTACKING';

export class Character {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotationY: number = 0;
  public state: CharacterState = 'IDLE';
  
  public speed: number = 16.0;
  public height: number = 3.5;
  
  // Atributos de Vida e Combate estilo LoL
  public maxHp = 1072;
  public hp = 1072;
  
  public attackRange = 18.0; // Alcance ampliado
  public attackSpeed = 1.85; // Ataques por segundo
  public attackCooldown = 0;
  
  private attackWindupTimer = 0;
  private attackAnimTimer = 0;
  public isAttackWindupTriggered = false;
  
  public attackTarget: Dummy | null = null;
  public attackDirection: THREE.Vector3 | null = null;
  
  // Rastreamento de cliques rápidos para Kiting Mecânico
  private lastAttackClickTime = 0;
  private consecutiveFastClicks = 0;
  public attackSpeedBonus = 0;
  private bonusTimer = 0;
  private isMeleeAttack = false;
  
  // Callback disparado quando o disparo deve nascer (Windup concluído)
  // Recebe (target, direction, isMelee)
  public onShoot: ((target: Dummy | null, direction: THREE.Vector3 | null, isMelee: boolean) => void) | null = null;
  
  // Elementos flutuantes de barra de vida
  public healthBarElement: HTMLDivElement | null = null;
  private hpInnerEl: HTMLSpanElement | null = null;
  private hpTextOverlayEl: HTMLSpanElement | null = null;
  
  // Três.js Views
  public mesh: THREE.Group | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  
  private scene: THREE.Scene;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimation: THREE.AnimationAction | null = null;
  
  public moveTarget: THREE.Vector3 | null = null;
  private tempDir = new THREE.Vector3();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initUI();
  }
  
  private initUI() {
    let container = document.getElementById('health-bars-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'health-bars-container';
      document.body.appendChild(container);
    }
    
    const bar = document.createElement('div');
    bar.className = 'floating-health-bar player';
    bar.style.position = 'absolute';
    bar.style.transform = 'translate(-50%, -100%)';
    bar.style.opacity = '0';
    
    // 1. Cabeçalho de informações (Nome e HP texto alinhados lado a lado)
    const header = document.createElement('div');
    header.className = 'player-header-info';
    
    const nameEl = document.createElement('span');
    nameEl.className = 'entity-name';
    nameEl.innerText = 'Caitlyn';
    header.appendChild(nameEl);
    
    const hpTextOverlayEl = document.createElement('span');
    hpTextOverlayEl.className = 'hp-text-overlay';
    hpTextOverlayEl.innerText = `${this.hp} / ${this.maxHp} (100%)`;
    header.appendChild(hpTextOverlayEl);
    this.hpTextOverlayEl = hpTextOverlayEl;
    
    bar.appendChild(header);
    
    // 2. Placa do Player estilo LoL (Nível + Barras de HP/Mana)
    const plate = document.createElement('div');
    plate.className = 'lol-player-plate';
    
    // Quadrado de Nível
    const levelBox = document.createElement('div');
    levelBox.className = 'lol-level-box';
    levelBox.innerText = '5'; // Nível 5 igual ao do print
    plate.appendChild(levelBox);
    
    // Container das barras
    const barsContainer = document.createElement('div');
    barsContainer.className = 'lol-bars-container';
    
    // Barra de HP
    const hpOuter = document.createElement('div');
    hpOuter.className = 'bar-outer hp';
    
    this.hpInnerEl = document.createElement('div');
    this.hpInnerEl.className = 'bar-inner hp';
    hpOuter.appendChild(this.hpInnerEl);
    
    // Ticks divisores pretos de 100 de HP na barra externa
    const numTicks = Math.floor(this.maxHp / 100);
    for (let i = 1; i <= numTicks; i++) {
      const tick = document.createElement('div');
      tick.className = 'hp-tick';
      tick.style.left = `${(i * 100 / this.maxHp) * 100}%`;
      hpOuter.appendChild(tick);
    }
    barsContainer.appendChild(hpOuter);
    
    // Barra de Mana
    const manaOuter = document.createElement('div');
    manaOuter.className = 'bar-outer mana';
    
    const manaInner = document.createElement('div');
    manaInner.className = 'bar-inner mana';
    manaOuter.appendChild(manaInner);
    barsContainer.appendChild(manaOuter);
    
    plate.appendChild(barsContainer);
    bar.appendChild(plate);
    container.appendChild(bar);
    
    this.healthBarElement = bar;
  }
  
  public loadModel(): Promise<void> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      
      loader.load(
        './Personagens Principais/caitlyn/source/CaitlynComplete.glb',
        (gltf) => {
          this.mesh = gltf.scene;
          this.mesh.scale.set(0.055, 0.055, 0.055);
          this.mesh.position.copy(this.position);
          this.mesh.rotation.y = this.rotationY;
          
          this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          this.scene.add(this.mesh);
          
          this.setupAnimations(gltf.animations);
          resolve();
        },
        undefined,
        (err) => {
          console.error('Erro ao carregar modelo da Caitlyn:', err);
          resolve();
        }
      );
    });
  }
  
  private setupAnimations(gltfAnimations: THREE.AnimationClip[]) {
    if (!this.mesh) return;
    this.mixer = new THREE.AnimationMixer(this.mesh);
    
    gltfAnimations.forEach((clip) => {
      const cleanClip = this.sanitizeAnimationClip(clip);
      const action = this.mixer!.clipAction(cleanClip);
      const clipName = cleanClip.name.toLowerCase();
      
      const isTransition = clipName.includes('to_') || clipName.includes('toidle') || clipName.includes('_in') || clipName.includes('_out');
      
      if (clipName === 'idle1.anm' || clipName === 'idle.anm') {
        this.animations.set('idle', action);
      } else if (clipName === 'run.anm') {
        action.timeScale = 2.5; 
        this.animations.set('run', action);
      } else if (clipName === 'attack1.anm' || clipName === 'attack2.anm') {
        action.timeScale = 3.5; // Animação de tiro ágil acelerada
        this.animations.set('attack', action);
      } else if (!isTransition) {
        if (clipName.includes('idle') && !this.animations.has('idle')) {
          this.animations.set('idle', action);
        }
        if ((clipName.includes('run') || clipName.includes('walk')) && !this.animations.has('run')) {
          action.timeScale = 2.5;
          this.animations.set('run', action);
        }
        if (clipName.includes('attack') && !this.animations.has('attack')) {
          this.animations.set('attack', action);
        }
      }
    });
    
    // Fallbacks
    if (!this.animations.has('idle') && gltfAnimations.length > 0) {
      const clean = this.sanitizeAnimationClip(gltfAnimations[0]);
      this.animations.set('idle', this.mixer.clipAction(clean));
    }
    if (!this.animations.has('run')) {
      const clip = gltfAnimations.length > 1 ? gltfAnimations[1] : gltfAnimations[0];
      const clean = this.sanitizeAnimationClip(clip);
      const action = this.mixer.clipAction(clean);
      action.timeScale = 2.5;
      this.animations.set('run', action);
    }
    if (!this.animations.has('attack')) {
      const clip = gltfAnimations.length > 2 ? gltfAnimations[2] : gltfAnimations[0];
      const clean = this.sanitizeAnimationClip(clip);
      this.animations.set('attack', this.mixer.clipAction(clean));
    }
    
    // Inicia Idle
    const idleAction = this.animations.get('idle');
    if (idleAction) {
      idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      this.currentAnimation = idleAction;
    }
  }
  
  private sanitizeAnimationClip(clip: THREE.AnimationClip): THREE.AnimationClip {
    const validTracks: THREE.KeyframeTrack[] = [];
    
    clip.tracks.forEach((track) => {
      const trackName = track.name;
      if (!trackName.endsWith('.position') && !trackName.endsWith('.quaternion') && !trackName.endsWith('.scale')) {
        return;
      }
      
      if (!track.times || track.times.length === 0 || !track.values || track.values.length === 0) {
        return;
      }
      
      let hasNaN = false;
      for (let i = 0; i < track.times.length; i++) {
        if (isNaN(track.times[i]) || !isFinite(track.times[i])) {
          hasNaN = true;
          break;
        }
      }
      if (hasNaN) return;
      
      for (let i = 0; i < track.values.length; i++) {
        if (isNaN(track.values[i]) || !isFinite(track.values[i])) {
          hasNaN = true;
          break;
        }
      }
      if (hasNaN) return;
      
      let isOrdered = true;
      for (let i = 1; i < track.times.length; i++) {
        if (track.times[i] <= track.times[i - 1]) {
          isOrdered = false;
          break;
        }
      }
      
      if (!isOrdered) {
        const size = track.times.length;
        const stride = track.values.length / size;
        const keys = [];
        for (let i = 0; i < size; i++) {
          const time = track.times[i];
          const valSlice = [];
          for (let j = 0; j < stride; j++) {
            valSlice.push(track.values[i * stride + j]);
          }
          keys.push({ time, values: valSlice });
        }
        
        keys.sort((a, b) => a.time - b.time);
        
        const uniqueKeys = [];
        let lastTime = -Infinity;
        for (let i = 0; i < keys.length; i++) {
          if (keys[i].time > lastTime + 0.0001) {
            uniqueKeys.push(keys[i]);
            lastTime = keys[i].time;
          }
        }
        
        const newTimes = new Float32Array(uniqueKeys.length);
        const newValues = new Float32Array(uniqueKeys.length * stride);
        
        uniqueKeys.forEach((kf, idx) => {
          newTimes[idx] = kf.time;
          for (let j = 0; j < stride; j++) {
            newValues[idx * stride + j] = kf.values[j];
          }
        });
        
        track.times = newTimes as any;
        track.values = newValues as any;
      }
      
      validTracks.push(track);
    });
    
    return new THREE.AnimationClip(clip.name, clip.duration, validTracks);
  }
  
  public playAnimation(name: string, loop: boolean = true, duration: number = 0.25) {
    const action = this.animations.get(name);
    if (!action || action === this.currentAnimation) return;
    
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    
    if (this.currentAnimation) {
      this.currentAnimation.fadeOut(duration);
    }
    
    action.fadeIn(duration).play();
    this.currentAnimation = action;
  }
  
  public startAttack(target: Dummy | null, direction: THREE.Vector3 | null) {
    const now = performance.now();
    const clickInterval = (now - this.lastAttackClickTime) / 1000.0;
    this.lastAttackClickTime = now;
    
    // Se já está em cooldown e o windup já passou (kiting), recompensa cliques rápidos
    if (this.attackCooldown > 0) {
      if (this.isAttackWindupTriggered) {
        // Reduz o cooldown restante em 0.14s (140ms) por clique rápido, acelerando o kiting!
        this.attackCooldown = Math.max(0, this.attackCooldown - 0.14);
      }
      return;
    }
    
    // Acumula bônus de velocidade de ataque se clicar rápido e repetidamente
    if (clickInterval >= 0.10 && clickInterval <= 0.42) {
      this.consecutiveFastClicks = Math.min(3, this.consecutiveFastClicks + 1);
      this.attackSpeedBonus = this.consecutiveFastClicks * 0.15; // +15% AS por clique rápido (máximo +45%)
      this.bonusTimer = 1.0; // Bônus dura 1s
    } else if (clickInterval > 0.42) {
      this.consecutiveFastClicks = 0;
      this.attackSpeedBonus = 0;
    }
    
    this.moveTarget = null;
    this.state = 'ATTACKING';
    this.attackTarget = target;
    this.attackDirection = direction ? direction.clone().normalize() : null;
    
    // Se o inimigo estiver a menos de 3.2 unidades de distância, vira ataque melee (Coronhada de Rifle)
    if (target && this.position.distanceTo(target.position) <= 3.2) {
      this.isMeleeAttack = true;
    } else {
      this.isMeleeAttack = false;
    }
    
    this.isAttackWindupTriggered = false;
    this.attackWindupTimer = 0.04; // Windup super ágil
    this.attackAnimTimer = 0.12;   // Animação super rápida
    
    // Cooldown efetivo aplicando o bônus de clique rápido do kiting mecânico
    const effectiveAttackSpeed = this.attackSpeed * (1.0 + this.attackSpeedBonus);
    this.attackCooldown = 1.0 / effectiveAttackSpeed;
    
    // Acelera dinamicamente a velocidade visual da animação
    const action = this.animations.get('attack');
    if (action) {
      action.timeScale = 3.5 * (1.0 + this.attackSpeedBonus);
    }
    
    this.playAnimation('attack', false, 0.1);
  }
  
  public cancelAttack() {
    this.state = 'IDLE';
    this.attackTarget = null;
    this.attackDirection = null;
    this.attackAnimTimer = 0;
    this.attackWindupTimer = 0;
    this.isAttackWindupTriggered = false;
    this.playAnimation('idle', true, 0.15);
  }
  
  public takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
  }
  
  public update(camera: THREE.Camera, deltaTime: number) {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }
    
    // Decai o bônus de velocidade por cliques rápidos
    if (this.bonusTimer > 0) {
      this.bonusTimer -= deltaTime;
      if (this.bonusTimer <= 0) {
        this.attackSpeedBonus = 0;
        this.consecutiveFastClicks = 0;
      }
    }
    
    // 1. Simulação do Estado de Ataque
    if (this.state === 'ATTACKING') {
      if (this.attackAnimTimer > 0) {
        this.attackAnimTimer -= deltaTime;
        
        if (this.attackTarget) {
          this.tempDir.subVectors(this.attackTarget.position, this.position);
          this.tempDir.y = 0;
          this.rotationY = Math.atan2(this.tempDir.x, this.tempDir.z);
        } else if (this.attackDirection) {
          this.rotationY = Math.atan2(this.attackDirection.x, this.attackDirection.z);
        }
        
        if (this.attackWindupTimer > 0) {
          this.attackWindupTimer -= deltaTime;
          if (this.attackWindupTimer <= 0 && !this.isAttackWindupTriggered) {
            this.isAttackWindupTriggered = true;
            if (this.onShoot) {
              this.onShoot(this.attackTarget, this.attackDirection, this.isMeleeAttack);
            }
          }
        }
        
        if (this.attackAnimTimer <= 0) {
          this.state = 'IDLE';
          this.playAnimation('idle');
        }
      }
    }
    
    // 2. Simulação da Movimentação
    if (this.state !== 'ATTACKING' && this.moveTarget) {
      this.tempDir.subVectors(this.moveTarget, this.position);
      this.tempDir.y = 0;
      
      const dist = this.tempDir.length();
      const moveDist = this.speed * deltaTime;
      
      if (dist <= moveDist) {
        this.position.copy(this.moveTarget);
        this.moveTarget = null;
        this.state = 'IDLE';
        this.playAnimation('idle');
      } else {
        this.tempDir.normalize();
        this.position.addScaledVector(this.tempDir, moveDist);
        
        const targetAngle = Math.atan2(this.tempDir.x, this.tempDir.z);
        let diff = targetAngle - this.rotationY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.rotationY += diff * 0.25;
        
        this.state = 'WALKING';
        this.playAnimation('run');
      }
    }
    
    // Sincroniza visual do esqueleto 3D
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;
    }
    
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    
    // 3. Atualiza Barra de Vida Flutuante (translate3d GPU)
    if (this.healthBarElement && this.hpInnerEl && this.hpTextOverlayEl) {
      const hpPct = (this.hp / this.maxHp) * 100;
      this.hpInnerEl.style.width = `${hpPct}%`;
      this.hpTextOverlayEl.innerText = `${this.hp} / ${this.maxHp} (${Math.round(hpPct)}%)`;
      
      const tempV = new THREE.Vector3().copy(this.position);
      tempV.y += 5.2; // Elevado para ficar perfeitamente acima do chapéu alto
      tempV.project(camera);
      
      if (tempV.z > 1) {
        this.healthBarElement.style.opacity = '0';
      } else {
        const x = Math.round((tempV.x * 0.5 + 0.5) * window.innerWidth);
        const y = Math.round((tempV.y * -0.5 + 0.5) * window.innerHeight);
        
        const newTransform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
        if (this.healthBarElement.style.transform !== newTransform) {
          this.healthBarElement.style.transform = newTransform;
        }
        if (this.healthBarElement.style.opacity !== '1') {
          this.healthBarElement.style.opacity = '1';
        }
      }
    }
  }
}
