import * as THREE from 'three';

export class Dummy {
  public position: THREE.Vector3 = new THREE.Vector3();
  public maxHp = 600;
  public hp = 600;
  public active = true;
  
  public mesh: THREE.Group;
  public toleranceRing: THREE.Group;
  public outlineMesh: THREE.Mesh;
  private scene: THREE.Scene;
  
  // Elementos flutuantes de barra de vida
  public healthBarElement: HTMLDivElement | null = null;
  private hpInnerEl: HTMLSpanElement | null = null;
  private hpTextOverlayEl: HTMLDivElement | null = null;
  
  private originalMaterials: Map<THREE.Mesh, THREE.Material> = new Map();
  private flashTimer = 0;
  private respawnTimer = 0;
  
  // Modo de movimentação
  public mode: 'static' | 'moving';
  private moveSpeed = 2.5;
  private moveDir = 1;
  private startX = 0;
  
  constructor(scene: THREE.Scene, position: THREE.Vector3, mode: 'static' | 'moving' = 'static') {
    this.scene = scene;
    this.position.copy(position);
    this.startX = position.x;
    this.mode = mode;
    
    // 1. Cria a malha do Dummy (Cápsula vermelha estilosa)
    const group = new THREE.Group();
    
    // Corpo
    const bodyGeo = new THREE.CapsuleGeometry(0.7, 1.5, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x9e2a2b, // Vermelho escuro elegante
      roughness: 0.5,
      metalness: 0.2
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 1.45; // Centraliza apoiado no chão (0.75 + 0.7)
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);
    
    // Criar o outlineMesh de silhueta vermelha bem grossa e sólida (Backface Outline para borda do LoL)
    const outlineGeo = new THREE.CapsuleGeometry(0.85, 1.65, 8, 16); // Super espesso
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Vermelho puro ultra brilhante
      side: THREE.BackSide, // Renderiza faces invertidas
      transparent: false // Borda sólida e forte
    });
    this.outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
    this.outlineMesh.position.y = 1.45;
    this.outlineMesh.visible = false;
    group.add(this.outlineMesh);
    
    // Olhos brilhantes para indicar frente
    const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.25);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    
    const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
    eyeLeft.position.set(-0.25, 2.0, 0.55);
    group.add(eyeLeft);
    
    const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
    eyeRight.position.set(0.25, 2.0, 0.55);
    group.add(eyeRight);
    
    // 2. Círculo de tolerância roxo de clique no chão sob o Dummy
    this.toleranceRing = new THREE.Group();
    
    const fillGeo = new THREE.RingGeometry(0, 3.0, 32);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xaa00ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.04
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.y = 0.01;
    this.toleranceRing.add(fillMesh);
    
    const borderGeo = new THREE.RingGeometry(2.96, 3.0, 64);
    borderGeo.rotateX(-Math.PI / 2);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xaa00ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.y = 0.012;
    this.toleranceRing.add(borderMesh);
    
    group.add(this.toleranceRing);
    
    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
    
    // Guarda materiais originais para efeito de flash de dano (Ignora RingGeometry e Outline)
    this.mesh.traverse((child) => {
      if (
        child instanceof THREE.Mesh && 
        child.geometry.type !== 'RingGeometry' && 
        child !== this.outlineMesh
      ) {
        this.originalMaterials.set(child, child.material);
      }
    });
    
    // 3. Cria a Barra de Vida HTML flutuante
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
    bar.className = 'floating-health-bar enemy';
    bar.style.position = 'absolute';
    bar.style.transform = 'translate(-50%, -100%)';
    bar.style.opacity = '0';
    
    // Overlay de Texto de HP quantitativo no topo da barra
    this.hpTextOverlayEl = document.createElement('div');
    this.hpTextOverlayEl.className = 'hp-text-overlay';
    this.hpTextOverlayEl.innerText = `${this.hp} / ${this.maxHp} (100%)`;
    bar.appendChild(this.hpTextOverlayEl);
    
    // Nome do Dummy
    const nameEl = document.createElement('div');
    nameEl.className = 'entity-name';
    nameEl.innerText = this.mode === 'moving' ? 'Dummy (Móvel)' : 'Dummy (Estático)';
    bar.appendChild(nameEl);
    
    // Barra externa
    const outer = document.createElement('div');
    outer.className = 'bar-outer';
    
    // Barra interna
    const inner = document.createElement('div');
    inner.className = 'bar-inner';
    outer.appendChild(inner);
    
    // Adiciona os ticks divisores pretos de 100 de HP na barra externa
    const numTicks = Math.floor(this.maxHp / 100) - 1;
    for (let i = 1; i <= numTicks; i++) {
      const tick = document.createElement('div');
      tick.className = 'hp-tick';
      tick.style.left = `${(i * 100 / this.maxHp) * 100}%`;
      outer.appendChild(tick);
    }
    
    bar.appendChild(outer);
    container.appendChild(bar);
    
    this.healthBarElement = bar;
    this.hpInnerEl = inner;
  }
  
  public takeDamage(amount: number) {
    if (!this.active) return;
    
    this.hp = Math.max(0, this.hp - amount);
    
    // Feedback visual: pisca em branco brilhante
    this.flashTimer = 0.1;
    this.mesh.traverse((child) => {
      if (
        child instanceof THREE.Mesh && 
        child.geometry.type !== 'RingGeometry' && 
        child !== this.outlineMesh
      ) {
        child.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      }
    });
    
    if (this.hp <= 0) {
      this.die();
    }
  }
  
  private die() {
    this.active = false;
    this.respawnTimer = 3.0; // 3 segundos para ressurgir
    this.toleranceRing.visible = false; // Esconde círculo de clique
    this.outlineMesh.visible = false;   // Esconde borda de seleção
    
    // Esconde a barra de vida
    if (this.healthBarElement) {
      this.healthBarElement.style.opacity = '0';
    }
    
    // Deita o Dummy no chão
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y = 0.2;
  }
  
  private respawn() {
    this.active = true;
    this.hp = this.maxHp;
    this.mesh.rotation.z = 0;
    this.mesh.position.y = 0;
    this.position.x = this.startX; // Volta ao ponto inicial
    this.mesh.position.copy(this.position);
    this.toleranceRing.visible = true; // Mostra círculo de clique
    
    if (this.healthBarElement) {
      this.healthBarElement.style.opacity = '1';
    }
  }
  
  public update(camera: THREE.Camera, deltaTime: number) {
    // 1. Respawn timer
    if (!this.active) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }
    
    // 2. Movimentação opcional (Modo Móvel)
    if (this.mode === 'moving') {
      this.position.x += this.moveSpeed * this.moveDir * deltaTime;
      // Zigue-zague limite de 8 unidades do início
      if (Math.abs(this.position.x - this.startX) >= 8.0) {
        this.moveDir *= -1;
        this.mesh.rotation.y = this.moveDir > 0 ? 0 : Math.PI;
      }
      this.mesh.position.copy(this.position);
    }
    
    // 3. Efeito de flash de dano
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaTime;
      if (this.flashTimer <= 0) {
        // Restaura materiais originais
        this.mesh.traverse((child) => {
          if (
            child instanceof THREE.Mesh && 
            child.geometry.type !== 'RingGeometry' && 
            child !== this.outlineMesh
          ) {
            const originalMat = this.originalMaterials.get(child);
            if (originalMat) {
              child.material = originalMat;
            }
          }
        });
      }
    }
    
    // 4. Atualiza Barra de Vida Flutuante (translate3d GPU)
    if (this.healthBarElement && this.hpInnerEl && this.hpTextOverlayEl) {
      const hpPct = (this.hp / this.maxHp) * 100;
      this.hpInnerEl.style.width = `${hpPct}%`;
      this.hpTextOverlayEl.innerText = `${this.hp} / ${this.maxHp} (${Math.round(hpPct)}%)`;
      
      const tempV = new THREE.Vector3().copy(this.position);
      tempV.y += 3.4; // topo do dummy (elevado para ficar acima do minion)
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
  
  public destroy() {
    if (this.healthBarElement && this.healthBarElement.parentNode) {
      this.healthBarElement.parentNode.removeChild(this.healthBarElement);
    }
    this.scene.remove(this.mesh);
  }
}
