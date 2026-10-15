import * as THREE from 'three';
import { InputManager } from './Input';

export interface CameraConfig {
  edgeScrollSpeed: number;
  edgeScrollThreshold: number; // Pixels da borda
  enableEdgeScroll: boolean;
  
  dragSpeed: number;
  enableDrag: boolean;
  
  zoomSpeed: number;
  minZoom: number;
  maxZoom: number;
  zoomSensitivity: number;
  
  smoothing: number; // Fator de LERP (0.01 a 1.0)
  defaultLocked: boolean;
}

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  
  // Estado
  public isLocked = true;
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private currentZoom = 1.0; // Redefinido zoom base para nova câmera afastada
  private targetZoom = 1.0;
  
  // Ângulo isométrico clássico afastado ideal para a proporção do print 2
  private offsetBase = new THREE.Vector3(0, 56, 48);
  
  // Limites do mapa (plano 80x80)
  private mapLimitX = 38;
  private mapLimitZ = 38;
  
  // Variáveis de cache para otimização de performance (evita GC allocations no loop)
  private tempTarget = new THREE.Vector3();
  private tempZoomOffset = new THREE.Vector3();
  
  // Configurações padrão
  public config: CameraConfig = {
    edgeScrollSpeed: 40,
    edgeScrollThreshold: 18,
    enableEdgeScroll: true,
    
    dragSpeed: 0.05,
    enableDrag: true,
    
    zoomSpeed: 0.15,
    minZoom: 0.85,  // Afasta o zoom mínimo para não entrar no personagem
    maxZoom: 2.3,   // Reduz o distanciamento máximo do zoom
    zoomSensitivity: 0.15,
    
    smoothing: 0.08,
    defaultLocked: true,
  };
  
  private toggleLockPressed = false;
  
  constructor() {
    // Inicializa a câmera PerspectiveCamera
    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 1, 1000);
    this.isLocked = this.config.defaultLocked;
  }
  
  public handleZoom(_deltaY: number) {
    // Zoom manual desabilitado para manter a distância clássica sempre constante
  }
  
  public update(playerPos: THREE.Vector3, input: InputManager, deltaTime: number) {
    // 1. Alterna o modo Locked/Free (Toggle Camera Lock) ao pressionar uma vez (Trigger)
    const toggleActive = input.isActionActive('ToggleCameraLock');
    if (toggleActive) {
      if (!this.toggleLockPressed) {
        this.isLocked = !this.isLocked;
        this.toggleLockPressed = true;
      }
    } else {
      this.toggleLockPressed = false;
    }
    
    // 2. Calcula posição alvo da câmera (Target)
    const isCentering = input.isActionActive('CenterCamera');
    
    if (this.isLocked || isCentering) {
      // Modo Travado com Folga (Locked com Folga do Mouse estilo LoL)
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      const ratioX = (input.mouseX - centerX) / centerX;
      const ratioY = (input.mouseY - centerY) / centerY;
      
      // Deslocamento máximo da câmera em relação ao jogador
      const maxLockOffset = 6.0;
      
      this.tempTarget.copy(playerPos);
      this.tempTarget.x += ratioX * maxLockOffset;
      this.tempTarget.z += ratioY * maxLockOffset;
      
      // Segue continuamente o jogador com a folga calculada
      this.cameraTarget.lerp(this.tempTarget, this.config.smoothing);
    } else {
      // Modo Livre (Free Camera)
      
      // 2a. Camera Drag (Arrasto)
      if (this.config.enableDrag && input.isActionActive('CameraDrag')) {
        // Converte o delta de pixel da tela para direção 3D inclinada
        // Movimento horizontal inverte e vertical desloca nos eixos
        const dx = input.mouseDeltaX * this.config.dragSpeed * this.currentZoom;
        const dy = input.mouseDeltaY * this.config.dragSpeed * this.currentZoom;
        
        this.cameraTarget.x -= dx;
        this.cameraTarget.z -= dy;
      }
      // 2b. Edge Scrolling (Rolagem por Borda)
      else if (this.config.enableEdgeScroll) {
        let moveX = 0;
        let moveZ = 0;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const threshold = this.config.edgeScrollThreshold;
        
        if (input.mouseX <= threshold) moveX = -1; // Esquerda
        else if (input.mouseX >= w - threshold) moveX = 1; // Direita
        
        if (input.mouseY <= threshold) moveZ = -1; // Superior
        else if (input.mouseY >= h - threshold) moveZ = 1; // Inferior
        
        if (moveX !== 0 || moveZ !== 0) {
          const speed = this.config.edgeScrollSpeed * deltaTime;
          this.cameraTarget.x += moveX * speed;
          this.cameraTarget.z += moveZ * speed;
        }
      }
    }
    
    // 3. Aplica limites de borda do mapa (Clamps)
    this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -this.mapLimitX, this.mapLimitX);
    this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -this.mapLimitZ, this.mapLimitZ);
    
    // 4. Interpola o Zoom suavemente (LERp)
    this.currentZoom = THREE.MathUtils.lerp(this.currentZoom, this.targetZoom, this.config.zoomSpeed);
    
    // 5. Atualiza a posição física e lookAt da câmera baseado no offset e no zoom
    this.tempZoomOffset.copy(this.offsetBase).multiplyScalar(this.currentZoom);
    this.camera.position.copy(this.cameraTarget).add(this.tempZoomOffset);
    this.camera.lookAt(this.cameraTarget);
    
    // Reseta deltas do input para evitar movimento fantasma
    input.mouseDeltaX = 0;
    input.mouseDeltaY = 0;
  }
  
  public handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
