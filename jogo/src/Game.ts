import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Character } from './entities/Character';
import { CameraController } from './Camera';
import { InputManager } from './Input';
import { Dummy } from './entities/Dummy';
import { Projectile } from './entities/Projectile';
import { TargetingSystem } from './Targeting';

export class Game {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private clock!: THREE.Clock;
  
  private player!: Character;
  private cameraController!: CameraController;
  private input!: InputManager;
  
  // Dummies e Projéteis
  private dummies: Dummy[] = [];
  private projectiles: Projectile[] = [];
  
  // Seleção de Alvo
  private selectedTarget: Dummy | null = null;
  
  // Indicadores Visuais 3D
  private rangeIndicator!: THREE.Mesh;
  private targetMarker!: THREE.Mesh;
  private directionLine!: THREE.Line;
  
  // Chão e raycasting
  private floor!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  // Indicador de clique verde (Carregado do GLB)
  private clickIndicator!: THREE.Object3D;
  private clickIndicatorTimer = 0;
  
  // Estado de Attack Move ativo
  private isAttackMoveMode = false;
  
  // Métricas
  private fpsLastTime = 0;
  private fpsFrames = 0;
  
  // Números de Dano Flutuantes
  private damageNumbers: Array<{
    el: HTMLDivElement;
    pos: THREE.Vector3;
    timer: number;
    maxTimer: number;
    xOffset: number;
    yOffset: number;
    isCrit: boolean;
  }> = [];
  
  // Cache de vetores para otimização extrema de performance (Zero GC)
  private tempCursorWorldPos = new THREE.Vector3();
  private tempDirection = new THREE.Vector3();
  
  constructor() {
    this.clock = new THREE.Clock();
  }
  
  public async init() {
    // 1. Inicializa Cena e Renderizador
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03070c');
    
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1.0); // Otimização extrema para 120 FPS
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Filtragem bilinear rápida
    
    // Desativa menu de contexto padrão do botão direito
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 2. Configura Câmera & Input
    this.cameraController = new CameraController();
    this.input = new InputManager();
    
    // 3. Luzes
    const ambientLight = new THREE.AmbientLight('#121b26', 1.5);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight('#ffffff', 2.0);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    const d = 30;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);
    
    // 4. Cria Chão com Grid de Desenvolvimento
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0a1016',
      roughness: 0.8,
      metalness: 0.1,
    });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    
    const gridHelper = new THREE.GridHelper(80, 40, '#c29d53', '#162838');
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
    
    // 5. Indicador de Clique Verde (Point Target GLB)
    this.clickIndicator = new THREE.Group(); // Instancia temporária para evitar undefined
    this.scene.add(this.clickIndicator);
    
    const loader = new GLTFLoader();
    loader.load('./UI/rts-target/source/pointTarget.glb', (gltf) => {
      this.scene.remove(this.clickIndicator);
      
      this.clickIndicator = gltf.scene;
      const greenMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.85
      });
      
      this.clickIndicator.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = greenMat;
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      
      this.clickIndicator.scale.set(1.5, 1.5, 1.5);
      this.clickIndicator.visible = false;
      this.scene.add(this.clickIndicator);
    }, undefined, (err) => {
      console.warn('Falha ao carregar pointTarget.glb, usando fallback de anel', err);
      // Fallback
      const indGeo = new THREE.RingGeometry(0.1, 0.4, 32);
      indGeo.rotateX(-Math.PI / 2);
      const indMat = new THREE.MeshBasicMaterial({
        color: '#00ff88',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      this.clickIndicator = new THREE.Mesh(indGeo, indMat);
      this.clickIndicator.position.set(0, 0.02, 0);
      this.clickIndicator.visible = false;
      this.scene.add(this.clickIndicator);
    });
    
    // 6. Instancia Dummies de Teste
    this.dummies.push(new Dummy(this.scene, new THREE.Vector3(7, 0, 7), 'static'));
    this.dummies.push(new Dummy(this.scene, new THREE.Vector3(-7, 0, 7), 'moving'));
    
    // 7. Instancia e Carrega a Caitlyn
    this.player = new Character(this.scene);
    this.player.position.set(0, 0, 0);
    
    const loadingEl = document.getElementById('loading-status');
    try {
      await this.player.loadModel();
      if (loadingEl) loadingEl.innerText = 'Pronto!';
    } catch (e) {
      if (loadingEl) loadingEl.innerText = 'Erro ao carregar modelo';
    }
    
    this.player.onShoot = (target, direction, isMelee) => {
      const damage = 55.0;
      
      if (isMelee) {
        // Ataque Melee (Coronhada): Dano instantâneo e faísca amarela!
        if (target) {
          target.takeDamage(damage);
          this.spawnDamageNumber(damage, target.position);
          this.spawnMeleeSlashEffect(target.position);
        }
      } else {
        // Ataque Ranged (Projétil rosa Hextech)
        const spawnPos = this.player.position.clone();
        spawnPos.y += 1.85;
        const speed = 25.0;
        const proj = new Projectile(this.scene, spawnPos, speed, damage, target, direction);
        
        proj.onHit = (dmg, position) => {
          this.spawnDamageNumber(dmg, position);
        };
        
        this.projectiles.push(proj);
      }
    };
    
    // 8. Inicializa Indicadores Visuais 3D
    const rangeGeo = new THREE.RingGeometry(this.player.attackRange - 0.08, this.player.attackRange + 0.08, 64);
    rangeGeo.rotateX(-Math.PI / 2);
    const rangeMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12
    });
    this.rangeIndicator = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeIndicator.position.y = 0.02;
    this.scene.add(this.rangeIndicator);
    
    const markerGeo = new THREE.RingGeometry(0.75, 0.95, 32);
    markerGeo.rotateX(-Math.PI / 2);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.targetMarker = new THREE.Mesh(markerGeo, markerMat);
    this.targetMarker.position.y = 0.03;
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);
    
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 0.05, this.player.attackRange)
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6
    });
    this.directionLine = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.directionLine);
    this.directionLine.visible = false;
    
    // 9. Configura Fullscreen API
    this.setupFullscreen();
    
    window.addEventListener('resize', this.onWindowResize.bind(this));
    canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    canvas.addEventListener('wheel', (e) => this.cameraController.handleZoom(e.deltaY), { passive: true });
    
    // 10. Inicia Loop
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }
  
  private setupFullscreen() {
    const fsBtn = document.getElementById('fullscreen-btn');
    if (!fsBtn) return;
    
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const canvas = this.renderer.domElement;
      
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          canvas.requestPointerLock();
        }).catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
    });
    
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        fsBtn.classList.add('active');
        fsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"/>
          </svg>
        `;
      } else {
        fsBtn.classList.remove('active');
        fsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        `;
      }
    });
  }
  
  private onWindowResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraController.handleResize();
  }
  
  private updateMouseWorldPos() {
    this.mouse.x = (this.input.mouseX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(this.input.mouseY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.cameraController.camera);
    const intersects = this.raycaster.intersectObject(this.floor);
    if (intersects.length > 0) {
      this.tempCursorWorldPos.copy(intersects[0].point);
    }
  }
  
  private spawnDamageNumber(amount: number, pos: THREE.Vector3) {
    const isCrit = Math.random() < 0.25; // 25% de chance de crítico para números variados maiores
    const finalDmg = isCrit ? Math.round(amount * 1.75) : Math.round(amount);
    
    const el = document.createElement('div');
    el.className = 'floating-damage-number' + (isCrit ? ' crit' : '');
    el.innerText = finalDmg.toString() + (isCrit ? '!' : '');
    
    const xOffset = (Math.random() - 0.5) * 1.5;
    
    document.body.appendChild(el);
    
    this.damageNumbers.push({
      el,
      pos: pos.clone(),
      timer: 0.8,
      maxTimer: 0.8,
      xOffset,
      yOffset: 0,
      isCrit
    });
  }
  
  private spawnMeleeSlashEffect(pos: THREE.Vector3) {
    const slashGeo = new THREE.RingGeometry(0.1, 0.8, 16);
    const slashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00, // Amarelo de porrada física
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const slashMesh = new THREE.Mesh(slashGeo, slashMat);
    
    // Coloca no peito do minion
    slashMesh.position.copy(pos);
    slashMesh.position.y += 1.35;
    
    // Rotaciona aleatoriamente para parecer uma faísca dinâmica
    slashMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    
    this.scene.add(slashMesh);
    
    const start = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - start) / 1000.0;
      if (elapsed >= 0.15) {
        this.scene.remove(slashMesh);
        slashGeo.dispose();
        slashMat.dispose();
      } else {
        const progress = elapsed / 0.15;
        slashMesh.scale.set(1.0 + progress * 2.0, 1.0 + progress * 2.0, 1.0);
        slashMat.opacity = 0.9 * (1.0 - progress);
        requestAnimationFrame(anim);
      }
    };
    anim();
  }
  
  private onPointerDown(e: PointerEvent) {
    const canvas = this.renderer.domElement;
    
    // Solicita Pointer Lock e Fullscreen automáticos na primeira interação (clique)
    if (!this.input.pointerLocked) {
      canvas.requestPointerLock();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      }
    }
    
    // 1. Botão do Meio (Drag Câmera)
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
    
    this.updateMouseWorldPos();
    
    // 2. Clique Esquerdo
    if (e.button === 0) {
      // 2a. Verifica clique virtual no botão de Fullscreen (canto superior direito)
      const bxMin = window.innerWidth - 62;
      const bxMax = window.innerWidth - 20;
      const byMin = 20;
      const byMax = 62;
      
      if (this.input.mouseX >= bxMin && this.input.mouseX <= bxMax && this.input.mouseY >= byMin && this.input.mouseY <= byMax) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
            canvas.requestPointerLock();
          }).catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
        }
        return;
      }
      
      // 2b. Conclui Attack Move se ativo
      if (this.isAttackMoveMode) {
        this.isAttackMoveMode = false;
        
        let closestDummy: Dummy | null = null;
        let minDistSq = Infinity;
        
        for (let i = 0; i < this.dummies.length; i++) {
          const d = this.dummies[i];
          if (d.active) {
            const dx = d.position.x - this.tempCursorWorldPos.x;
            const dz = d.position.z - this.tempCursorWorldPos.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              closestDummy = d;
            }
          }
        }
        
        if (closestDummy) {
          const distToPlayerSq = this.player.position.distanceToSquared(closestDummy.position);
          const rangeSq = (this.player.attackRange + 3.0) * (this.player.attackRange + 3.0);
          
          if (distToPlayerSq <= rangeSq) {
            this.selectedTarget = closestDummy;
          } else {
            this.player.moveTarget = this.tempCursorWorldPos.clone();
            this.selectedTarget = null;
          }
        } else {
          this.player.moveTarget = this.tempCursorWorldPos.clone();
          this.selectedTarget = null;
        }
        
        this.clickIndicator.position.copy(this.tempCursorWorldPos);
        this.clickIndicator.position.y = 0.05;
        this.clickIndicator.visible = true;
        this.clickIndicatorTimer = 0.35;
      }
      // 2c. Clique esquerdo normal: ataca automaticamente o inimigo válido mais próximo (LoL + Wild Rift Smart Attack)
      else {
        const bestTarget = TargetingSystem.findBestTarget(
          this.player.position,
          this.tempCursorWorldPos,
          this.dummies,
          this.player.attackRange
        );
        
        if (bestTarget) {
          this.selectedTarget = bestTarget;
          if (this.player.attackCooldown <= 0 && this.player.state !== 'ATTACKING') {
            this.player.startAttack(bestTarget, null);
          }
        }
      }
    }
    
    // 3. Clique Direito (Movimentação / Kiting / Travar Alvo com Tolerância de Hitbox)
    if (e.button === 2) {
      let targetDummy: Dummy | null = null;
      
      // Tenta clique exato na geometria do Dummy
      const dummyMeshes = this.dummies.map(d => d.mesh);
      const intersects = this.raycaster.intersectObjects(dummyMeshes, true);
      
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        for (let i = 0; i < this.dummies.length; i++) {
          const d = this.dummies[i];
          let found = false;
          d.mesh.traverse((child) => {
            if (child === hitMesh) {
              found = true;
            }
          });
          if (found) {
            targetDummy = d;
            break;
          }
        }
      }
      
      // Se não clicou exato, busca Dummy próximo no raio de tolerância (3.0 unidades = círculo roxo)
      if (!targetDummy || !targetDummy.active) {
        let closestDummy: Dummy | null = null;
        let minDistSq = Infinity;
        const clickToleranceSq = 3.0 * 3.0; // Tolerância de clique ampliada para raio de 3.0
        
        for (let i = 0; i < this.dummies.length; i++) {
          const d = this.dummies[i];
          if (d.active) {
            const dx = d.position.x - this.tempCursorWorldPos.x;
            const dz = d.position.z - this.tempCursorWorldPos.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < clickToleranceSq && distSq < minDistSq) {
              minDistSq = distSq;
              closestDummy = d;
            }
          }
        }
        
        if (closestDummy) {
          targetDummy = closestDummy;
        }
      }
      
      // Se achou alvo, ataca
      if (targetDummy && targetDummy.active) {
        this.selectedTarget = targetDummy;
        this.isAttackMoveMode = false;
        
        if (this.player.state === 'ATTACKING' && this.player.isAttackWindupTriggered) {
          this.player.cancelAttack();
        }
        return;
      }
      
      // Caso contrário, move no chão normal
      this.selectedTarget = null;
      this.isAttackMoveMode = false;
      
      if (this.player.state === 'ATTACKING') {
        this.player.cancelAttack();
      }
      
      this.player.moveTarget = this.tempCursorWorldPos.clone();
      
      this.clickIndicator.position.copy(this.tempCursorWorldPos);
      this.clickIndicator.position.y = 0.05;
      this.clickIndicator.visible = true;
      this.clickIndicatorTimer = 0.35;
    }
  }
  
  private handleCombateAI() {
    if (this.selectedTarget) {
      if (!this.selectedTarget.active) {
        this.selectedTarget = null;
        return;
      }
      
      const distSq = this.player.position.distanceToSquared(this.selectedTarget.position);
      const rangeSq = this.player.attackRange * this.player.attackRange;
      
      if (distSq <= rangeSq) {
        if (this.player.state === 'WALKING') {
          this.player.moveTarget = null;
        }
        
        if (this.player.attackCooldown <= 0 && this.player.state !== 'ATTACKING') {
          this.player.startAttack(this.selectedTarget, null);
        }
      } else {
        if (this.player.state !== 'ATTACKING') {
          this.player.moveTarget = this.selectedTarget.position;
        }
      }
    }
  }
  
  private animate() {
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    const camera = this.cameraController.camera;
    
    this.updateMouseWorldPos();
    
    // 1. Processa Triggers do Teclado
    if (this.input.isActionJustPressed('AttackMove')) {
      this.isAttackMoveMode = true;
    }
    
    if (this.input.isActionJustPressed('AttackBasic')) {
      const bestTarget = TargetingSystem.findBestTarget(
        this.player.position,
        this.tempCursorWorldPos,
        this.dummies,
        this.player.attackRange
      );
      
      if (bestTarget) {
        this.selectedTarget = bestTarget;
        if (this.player.attackCooldown <= 0 && this.player.state !== 'ATTACKING') {
          this.player.startAttack(bestTarget, null);
        }
      } else {
        if (this.player.attackCooldown <= 0 && this.player.state !== 'ATTACKING') {
          this.tempDirection.subVectors(this.tempCursorWorldPos, this.player.position);
          this.tempDirection.y = 0;
          this.player.startAttack(null, this.tempDirection);
        }
      }
    }
    
    // 2. Processa Combate e Movimento
    this.handleCombateAI();
    this.player.update(camera, deltaTime);
    
    // 3. Atualiza Dummies
    for (let i = 0; i < this.dummies.length; i++) {
      this.dummies[i].update(camera, deltaTime);
    }
    
    // 4. Atualiza Projéteis
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(this.dummies, deltaTime);
      if (!proj.active) {
        this.projectiles.splice(i, 1);
      }
    }
    
    // 5. Atualiza Câmera
    this.cameraController.update(this.player.position, this.input, deltaTime);
    
    // 6. Atualiza Indicadores Visuais 3D
    this.rangeIndicator.position.copy(this.player.position);
    this.rangeIndicator.position.y = 0.02;
    const rangeMat = this.rangeIndicator.material as THREE.MeshBasicMaterial;
    rangeMat.opacity = this.isAttackMoveMode ? 0.35 : 0.08;
    rangeMat.color.setHex(this.isAttackMoveMode ? 0xff0055 : 0x00ff88);
    
    if (this.selectedTarget && this.selectedTarget.active) {
      this.targetMarker.position.copy(this.selectedTarget.position);
      this.targetMarker.position.y = 0.03;
      this.targetMarker.visible = true;
      const s = 1.0 + Math.sin(performance.now() * 0.01) * 0.1;
      this.targetMarker.scale.set(s, s, s);
    } else {
      this.targetMarker.visible = false;
    }
    
    const isHoldingAttack = this.input.isActionActive('AttackBasic');
    if (isHoldingAttack && !this.selectedTarget) {
      this.directionLine.position.copy(this.player.position);
      this.directionLine.position.y = 0.05;
      this.tempDirection.subVectors(this.tempCursorWorldPos, this.player.position);
      this.tempDirection.y = 0;
      const angle = Math.atan2(this.tempDirection.x, this.tempDirection.z);
      this.directionLine.rotation.y = angle;
      this.directionLine.visible = true;
    } else {
      this.directionLine.visible = false;
    }
    
    // 7. Atualiza indicador de clique verde
    if (this.clickIndicator && this.clickIndicator.visible) {
      this.clickIndicatorTimer -= deltaTime;
      const progress = this.clickIndicatorTimer / 0.35;
      if (progress <= 0) {
        this.clickIndicator.visible = false;
      } else {
        this.clickIndicator.rotation.y += deltaTime * 6;
        const s = 1.5 * progress;
        this.clickIndicator.scale.set(s, s, s);
      }
    }
    
    // 8. Limpa e Atualiza visual dos Outlines de todos os Dummies
    for (let i = 0; i < this.dummies.length; i++) {
      this.dummies[i].outlineMesh.visible = false;
    }
    
    // 9. Atualiza tipo de cursor virtual dependendo do hover na área roxa (3.0 unidades) e aplica outline vermelho
    if (this.input.pointerLocked) {
      let hoverEnemy = false;
      
      for (let i = 0; i < this.dummies.length; i++) {
        const d = this.dummies[i];
        if (d.active) {
          // Se for o alvo travado selecionado, força a borda vermelha brilhante do LoL
          if (this.selectedTarget === d) {
            d.outlineMesh.visible = true;
          }
          
          // Mede distância quadrada no plano X-Z para detectar hover dentro do círculo roxo
          const dx = d.position.x - this.tempCursorWorldPos.x;
          const dz = d.position.z - this.tempCursorWorldPos.z;
          const distSq = dx * dx + dz * dz;
          if (distSq <= 3.0 * 3.0) {
            hoverEnemy = true;
            d.outlineMesh.visible = true; // Outline vermelho sólido e grosso ativo
          }
        }
      }
      
      if (hoverEnemy) {
        this.input.setCursorType('attack');
      } else if (this.isAttackMoveMode) {
        this.input.setCursorType('link');
      } else {
        // Se estiver em cima do botão de Fullscreen virtual
        const bxMin = window.innerWidth - 62;
        const bxMax = window.innerWidth - 20;
        const byMin = 20;
        const byMax = 62;
        if (this.input.mouseX >= bxMin && this.input.mouseX <= bxMax && this.input.mouseY >= byMin && this.input.mouseY <= byMax) {
          this.input.setCursorType('link');
        } else {
          this.input.setCursorType('normal');
        }
      }
    }
    
    // 10. Atualiza Posição dos Números de Dano Flutuantes (HTML + GPU translate3d)
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.timer -= deltaTime;
      
      if (dn.timer <= 0) {
        dn.el.parentNode?.removeChild(dn.el);
        this.damageNumbers.splice(i, 1);
      } else {
        dn.yOffset += deltaTime * 3.2; // Sobe suavemente
        
        const tempPos = dn.pos.clone();
        tempPos.x += dn.xOffset;
        tempPos.y += 1.8 + dn.yOffset; // Fica sobre a cabeça
        
        tempPos.project(camera);
        
        if (tempPos.z > 1) {
          dn.el.style.opacity = '0';
        } else {
          const x = Math.round((tempPos.x * 0.5 + 0.5) * window.innerWidth);
          const y = Math.round((tempPos.y * -0.5 + 0.5) * window.innerHeight);
          
          dn.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
          dn.el.style.opacity = (dn.timer / dn.maxTimer).toString();
        }
      }
    }
    
    // 11. Limpa triggers do input do frame
    this.input.clearFrameTriggers();
    
    // 12. Medição de FPS
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLastTime >= 1000) {
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) {
        fpsEl.innerText = this.fpsFrames.toString();
      }
      this.fpsFrames = 0;
      this.fpsLastTime = now;
    }
    
    // 13. Renderização
    this.renderer.render(this.scene, this.cameraController.camera);
  }
}
