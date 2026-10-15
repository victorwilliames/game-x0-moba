import * as THREE from 'three';
import { Dummy } from './Dummy';

export class Projectile {
  public position: THREE.Vector3 = new THREE.Vector3();
  public active = true;
  
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  
  // Modos de disparo
  private target: Dummy | null = null;
  private direction: THREE.Vector3 | null = null;
  
  private speed: number;
  private damage: number;
  
  private startPosition = new THREE.Vector3();
  private maxRange = 40.0;
  
  // Callback de colisão (spawna números de dano e partículas)
  public onHit: ((damage: number, position: THREE.Vector3) => void) | null = null;
  
  // Otimização: Cache de cálculos matemáticos para evitar GC allocations
  private tempV = new THREE.Vector3();
  
  constructor(
    scene: THREE.Scene, 
    startPos: THREE.Vector3, 
    speed: number, 
    damage: number, 
    target: Dummy | null, 
    direction: THREE.Vector3 | null = null
  ) {
    this.scene = scene;
    this.position.copy(startPos);
    this.startPosition.copy(startPos);
    this.speed = speed;
    this.damage = damage;
    this.target = target;
    
    if (direction) {
      this.direction = direction.clone().normalize();
    }
    
    // Cria visual da bala da Caitlyn (esfera brilhante rosa Hextech)
    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff007f }); // Rosa choque Hextech brilhante
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }
  
  public update(dummies: Dummy[], deltaTime: number) {
    if (!this.active) return;
    
    // 1. Deslocamento do Projétil
    if (this.target) {
      if (!this.target.active) {
        this.direction = new THREE.Vector3().subVectors(this.target.position, this.position).normalize();
        this.target = null;
      } else {
        // Teleguiado: Move-se na direção do alvo em tempo real
        this.tempV.subVectors(this.target.position, this.position);
        this.tempV.y = 0; // Mantém no plano
        
        const dist = this.tempV.length();
        const step = this.speed * deltaTime;
        
        if (dist <= step) {
          this.hit(this.target);
          return;
        } else {
          this.tempV.normalize();
          this.position.addScaledVector(this.tempV, step);
        }
      }
    }
    
    if (this.direction) {
      // Direcional (Disparo Livre estilo Wild Rift)
      const step = this.speed * deltaTime;
      this.position.addScaledVector(this.direction, step);
      
      // Checa colisão com os Dummies ativos (usando distância quadrada para otimização)
      const hitRadiusSq = (0.7 + 0.12) * (0.7 + 0.12); // Dummy (0.7) + Projétil (0.12)
      
      for (let i = 0; i < dummies.length; i++) {
        const d = dummies[i];
        if (d.active) {
          const dx = d.position.x - this.position.x;
          const dz = d.position.z - this.position.z;
          const distSq = dx * dx + dz * dz;
          
          if (distSq <= hitRadiusSq) {
            this.hit(d);
            return;
          }
        }
      }
      
      // Destrói se ultrapassar o alcance máximo de segurança
      if (this.position.distanceToSquared(this.startPosition) >= this.maxRange * this.maxRange) {
        this.destroy();
      }
    }
    
    // 2. Atualiza a malha visual
    this.mesh.position.copy(this.position);
  }
  
  private hit(dummy: Dummy) {
    dummy.takeDamage(this.damage);
    
    // Dispara o callback para o Game desenhar o floating damage text
    if (this.onHit) {
      this.onHit(this.damage, dummy.position);
    }
    
    this.destroy();
  }
  
  public destroy() {
    this.active = false;
    this.scene.remove(this.mesh);
  }
}
