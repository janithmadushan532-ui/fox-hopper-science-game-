import * as THREE from 'three';
import type { Solid } from '../levels/types';
import { Enemy } from './Enemy';

/** Original pipe-flower hazard: rises and dips above its pipe on a gentle cycle. */
export class PipeFlower extends Enemy {
  private elapsed = 0;
  private readonly head: THREE.Group;
  private readonly baseY: number;

  constructor(x: number, y: number) {
    super('pipeFlower', x, y, { halfW: 0.48, height: 1.15, hp: 1 });
    this.baseY = y;
    this.stompable = true;
    const green = new THREE.MeshStandardMaterial({ color: 0x42a85a, roughness: 0.72 });
    const red = new THREE.MeshStandardMaterial({ color: 0xf05262, roughness: 0.55 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.85, 10), green);
    stem.position.y = 0.42;
    stem.castShadow = true;
    this.group.add(stem);
    this.head = new THREE.Group();
    this.head.position.y = 0.83;
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), yellow);
    center.scale.set(1.0, 0.82, 0.8);
    center.castShadow = true;
    this.head.add(center);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), red);
      petal.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.18, 0.02);
      petal.scale.set(1.0, 0.72, 0.72);
      petal.castShadow = true;
      this.head.add(petal);
    }
    this.group.add(this.head);
    this.group.position.set(x, y, 0);
  }

  protected updateAlive(dt: number, _solids: readonly Solid[]): void {
    this.elapsed += dt;
    // Slow rise-and-hide motion; the pipe remains the visual anchor.
    const rise = 0.18 + 0.42 * (0.5 + 0.5 * Math.sin(this.elapsed * 1.7));
    this.head.position.y = 0.42 + rise;
    this.y = this.baseY;
  }

  protected override syncMesh(_dt: number): void {
    this.group.position.set(this.x, this.y, 0);
  }

  override dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    });
    super.dispose();
  }
}
