export type InputAction = 'ToggleCameraLock' | 'CenterCamera' | 'CameraDrag' | 'AttackMove' | 'AttackBasic';

export class InputManager {
  private keyBindings: Map<InputAction, string> = new Map();
  private mouseBindings: Map<InputAction, number> = new Map();
  
  private activeKeys: Set<string> = new Set();
  private activeMouseButtons: Set<number> = new Set();
  
  // Teclas pressionadas apenas neste frame
  private justPressedKeys: Set<string> = new Set();
  
  // Coordenadas lógicas do Mouse (Reais ou Virtuais sob Pointer Lock)
  public mouseX = window.innerWidth / 2;
  public mouseY = window.innerHeight / 2;
  public mouseDeltaX = 0;
  public mouseDeltaY = 0;
  
  // Estado do Pointer Lock
  public pointerLocked = false;
  private virtualMouseX = window.innerWidth / 2;
  private virtualMouseY = window.innerHeight / 2;
  
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isDragging = false;
  
  constructor() {
    this.keyBindings.set('ToggleCameraLock', 'KeyY'); 
    this.keyBindings.set('CenterCamera', 'Quote');
    this.keyBindings.set('AttackMove', 'KeyA');
    this.keyBindings.set('AttackBasic', 'KeyX');
    this.mouseBindings.set('CameraDrag', 1);
    
    this.setupEvents();
  }
  
  private setupEvents() {
    window.addEventListener('keydown', (e) => {
      // Mapeamento universal para a tecla de apóstrofo (') independentemente do layout (ABNT2 ou US)
      const code = (e.key === "'" || e.key === "Quote") ? 'Quote' : e.code;
      
      if (!this.activeKeys.has(code)) {
        this.justPressedKeys.add(code);
      }
      this.activeKeys.add(code);
      
      if (code === 'Quote') {
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      const code = (e.key === "'" || e.key === "Quote") ? 'Quote' : e.code;
      this.activeKeys.delete(code);
    });
    
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault(); // Desativa autoscroll do botão do meio
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
      this.activeMouseButtons.add(e.button);
    });
    
    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.isDragging = false;
      }
      this.activeMouseButtons.delete(e.button);
    });
    
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        // Modo Pointer Lock: O mouse físico está travado no centro.
        // Lemos e acumulamos a variação movementX e movementY.
        this.virtualMouseX += e.movementX;
        this.virtualMouseY += e.movementY;
        
        // Clampa coordenadas virtuais nos limites da janela do navegador
        this.virtualMouseX = Math.max(0, Math.min(window.innerWidth, this.virtualMouseX));
        this.virtualMouseY = Math.max(0, Math.min(window.innerHeight, this.virtualMouseY));
        
        this.mouseX = this.virtualMouseX;
        this.mouseY = this.virtualMouseY;
        
        if (this.isDragging) {
          this.mouseDeltaX += e.movementX;
          this.mouseDeltaY += e.movementY;
        }
      } else {
        // Modo Convencional: Rastreia o cursor físico real do navegador
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        
        // Sincroniza o cursor virtual caso o Pointer Lock seja reativado
        this.virtualMouseX = e.clientX;
        this.virtualMouseY = e.clientY;
        
        if (this.isDragging) {
          this.mouseDeltaX += e.clientX - this.lastMouseX;
          this.mouseDeltaY += e.clientY - this.lastMouseY;
        }
      }
      
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      
      // Atualiza a div visual do cursor do LoL
      this.updateCursorVisual();
    });
    
    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement !== null;
      this.pointerLocked = isLocked;
      
      const cursorEl = document.getElementById('custom-cursor');
      if (cursorEl) {
        cursorEl.style.display = isLocked ? 'block' : 'none';
      }
    });
    
    window.addEventListener('blur', () => {
      this.activeKeys.clear();
      this.activeMouseButtons.clear();
      this.justPressedKeys.clear();
      this.isDragging = false;
    });
  }
  
  // Atualiza a posição da div do cursor virtual com translate3d para desempenho acelerado por GPU
  private updateCursorVisual() {
    const cursorEl = document.getElementById('custom-cursor');
    if (cursorEl && this.pointerLocked) {
      cursorEl.style.transform = `translate3d(${this.mouseX}px, ${this.mouseY}px, 0)`;
    }
  }
  
  // Altera a classe visual do cursor dependendo da ação (ex: espada vermelha para ataque)
  public setCursorType(type: 'normal' | 'attack' | 'link') {
    const cursorEl = document.getElementById('custom-cursor');
    if (!cursorEl) return;
    
    cursorEl.className = `cursor-${type}`;
  }
  
  public isActionActive(action: InputAction): boolean {
    const boundKey = this.keyBindings.get(action);
    if (boundKey && this.activeKeys.has(boundKey)) {
      return true;
    }
    
    const boundMouse = this.mouseBindings.get(action);
    if (boundMouse !== undefined && this.activeMouseButtons.has(boundMouse)) {
      return true;
    }
    
    return false;
  }
  
  public isActionJustPressed(action: InputAction): boolean {
    const boundKey = this.keyBindings.get(action);
    if (boundKey && this.justPressedKeys.has(boundKey)) {
      return true;
    }
    return false;
  }
  
  public clearFrameTriggers() {
    this.justPressedKeys.clear();
  }
  
  public remapKey(action: InputAction, keyCode: string) {
    this.keyBindings.set(action, keyCode);
  }
  
  public remapMouseButton(action: InputAction, buttonCode: number) {
    this.mouseBindings.set(action, buttonCode);
  }
}
