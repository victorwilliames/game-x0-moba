import * as THREE from 'three';
import { Dummy } from './entities/Dummy';

export class TargetingSystem {
  public static findBestTarget(
    playerPos: THREE.Vector3,
    cursorWorldPos: THREE.Vector3 | null,
    dummies: Dummy[],
    maxAttackRange: number
  ): Dummy | null {
    if (dummies.length === 0) return null;
    
    // 1. Tenta encontrar o alvo mais próximo do cursor do mouse (Wild Rift smart targeting)
    if (cursorWorldPos) {
      let closestDummy: Dummy | null = null;
      let minCursorDistSq = Infinity;
      const selectThresholdSq = 5.0 * 5.0; // Raio de 5.0 unidades de tolerância ao redor do mouse
      
      for (let i = 0; i < dummies.length; i++) {
        const d = dummies[i];
        if (d.active) {
          const dx = d.position.x - cursorWorldPos.x;
          const dz = d.position.z - cursorWorldPos.z;
          const distSq = dx * dx + dz * dz;
          
          if (distSq < selectThresholdSq && distSq < minCursorDistSq) {
            minCursorDistSq = distSq;
            closestDummy = d;
          }
        }
      }
      
      if (closestDummy) {
        return closestDummy;
      }
    }
    
    // 2. Se não achar nada próximo do cursor, tenta achar o Dummy ativo mais próximo da Caitlyn
    let closestToPlayer: Dummy | null = null;
    let minPlayerDistSq = Infinity;
    const maxRangeSq = maxAttackRange * maxAttackRange;
    
    for (let i = 0; i < dummies.length; i++) {
      const d = dummies[i];
      if (d.active) {
        const dx = d.position.x - playerPos.x;
        const dz = d.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;
        
        if (distSq <= maxRangeSq && distSq < minPlayerDistSq) {
          minPlayerDistSq = distSq;
          closestToPlayer = d;
        }
      }
    }
    
    return closestToPlayer;
  }
}
