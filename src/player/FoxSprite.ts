import * as THREE from 'three';

/** A small, friendly 3D fox hero built from lightweight Three.js primitives. */
export class FoxSprite {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private clock = 0;
  private hurtTime = 0;

  constructor() {
    this.group.name = 'CuteFoxHero';
    this.body.name = 'FoxBody';
    this.group.add(this.body);

    const orange = this.mat(0xf28a32);
    const orangeLight = this.mat(0xffa94f);
    const cream = this.mat(0xfff0d8);
    const pink = this.mat(0xffa5ad);
    const dark = this.mat(0x342535);
    const eyeWhite = this.mat(0xffffff);

    const sphere = (name: string, scale: [number, number, number], pos: [number, number, number], material: THREE.Material, parent = this.body) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), material);
      mesh.name = name; mesh.scale.set(...scale); mesh.position.set(...pos);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const cone = (name: string, radius: number, height: number, pos: [number, number, number], rotZ: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 20), material);
      mesh.name = name; mesh.position.set(...pos); mesh.rotation.z = rotZ;
      mesh.castShadow = true; this.body.add(mesh); return mesh;
    };

    // Rounded body, chest and fluffy cheeks.
    sphere('Fox torso', [0.48, 0.34, 0.29], [-0.08, 0.58, 0], orange);
    sphere('Cream chest', [0.22, 0.31, 0.245], [0.22, 0.58, 0.12], cream);
    sphere('Fox head', [0.34, 0.33, 0.29], [0.28, 1.02, 0], orangeLight);
    sphere('White muzzle', [0.22, 0.14, 0.23], [0.52, 0.91, 0.14], cream);
    sphere('Nose', [0.075, 0.055, 0.07], [0.69, 0.96, 0.2], dark);
    sphere('Eye shine', [0.035, 0.035, 0.022], [0.405, 1.13, 0.268], eyeWhite);
    sphere('Eye', [0.047, 0.06, 0.035], [0.405, 1.12, 0.285], dark);
    sphere('Cheek', [0.11, 0.07, 0.045], [0.48, 0.91, 0.29], pink);

    // Tall fox ears with soft pink inner ears.
    cone('Near ear', 0.17, 0.43, [0.08, 1.34, 0.02], -0.22, orange);
    cone('Far ear', 0.16, 0.4, [0.43, 1.34, -0.08], 0.12, orange);
    cone('Near inner ear', 0.085, 0.25, [0.09, 1.35, 0.155], -0.22, pink);
    cone('Far inner ear', 0.075, 0.22, [0.43, 1.35, 0.035], 0.12, pink);

    // Curved-looking fluffy tail, with a white tip, animated from its base.
    this.tail.position.set(-0.46, 0.72, -0.02);
    this.body.add(this.tail);
    const tailMain = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), orange);
    tailMain.scale.set(0.43, 0.19, 0.19); tailMain.rotation.z = -0.42;
    tailMain.position.set(-0.22, 0.08, 0); tailMain.castShadow = true; this.tail.add(tailMain);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), cream);
    tailTip.scale.set(0.18, 0.16, 0.17); tailTip.rotation.z = -0.42;
    tailTip.position.set(-0.49, 0.22, 0); tailTip.castShadow = true; this.tail.add(tailTip);

    // Four short paws. Each leg pivots at the hip for a simple run cycle.
    const legMat = this.mat(0xd96e28);
    for (const [x, z] of [[-0.34, -0.16], [0.27, -0.16], [-0.34, 0.17], [0.27, 0.17]] as const) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z); this.body.add(pivot);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 4, 8), legMat);
      leg.position.y = -0.13; leg.castShadow = true; pivot.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cream);
      paw.scale.set(0.12, 0.075, 0.11); paw.position.set(0.025, -0.27, 0.015); paw.castShadow = true; pivot.add(paw);
      this.legs.push(pivot);
    }
  }

  private mat(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02 });
  }

  get object3d(): THREE.Object3D { return this.group; }
  setPosition(x: number, y: number, z = 0): void { this.group.position.set(x, y, z); }
  setFacing(facing: 1 | -1): void { this.group.scale.x = facing; }
  playHurt(): void { this.hurtTime = 0.32; }

  update(dt: number, opts: { grounded: boolean; vx: number; vy: number; justLanded: boolean; justJumped: boolean; crouching?: boolean }): void {
    this.clock += dt;
    const moving = opts.grounded && Math.abs(opts.vx) > 0.35;
    const stride = moving ? Math.sin(this.clock * 13) * 0.48 : Math.sin(this.clock * 2.2) * 0.045;
    this.legs.forEach((leg, i) => { leg.rotation.z = moving ? stride * (i % 2 === 0 ? 1 : -1) : stride * (i % 2 === 0 ? 1 : -1); });
    this.tail.rotation.z = Math.sin(this.clock * 4.2) * 0.17 + (moving ? 0.08 : 0);
    this.body.position.y = opts.grounded ? Math.sin(this.clock * (moving ? 13 : 2.2)) * (moving ? 0.035 : 0.012) : 0.025;
    if (this.hurtTime > 0) { this.hurtTime = Math.max(0, this.hurtTime - dt); this.body.rotation.z = Math.sin(this.clock * 48) * 0.08; }
    else this.body.rotation.z = 0;
    if (opts.crouching) this.body.scale.y = 0.88; else this.body.scale.y = 1;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach((m) => m.dispose()); }
    });
  }
}
