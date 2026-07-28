'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeFloatingShapes({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 600;
    const H = container.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 100);
    camera.position.z = 11;

    // ── Lighting ──────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const lights = [
      { color: 0x8b5cf6, intensity: 8,  x: -4, y:  4, z:  5 },
      { color: 0x6366f1, intensity: 6,  x:  4, y: -3, z:  3 },
      { color: 0xc084fc, intensity: 5,  x:  0, y:  6, z: -2 },
      { color: 0xffffff, intensity: 3,  x:  0, y:  0, z:  9 },
    ].map(({ color, intensity, x, y, z }) => {
      const l = new THREE.PointLight(color, intensity, 22);
      l.position.set(x, y, z);
      scene.add(l);
      return l;
    });

    // ── Helper to build a PBR shape ────────────────────
    type ShapeEntry = {
      mesh: THREE.Mesh;
      wire?: THREE.Mesh;
      baseY: number;
      phase: number;
      speed: number;
      rotSpeed: THREE.Vector3;
    };
    const shapes: ShapeEntry[] = [];

    const add = (
      geo: THREE.BufferGeometry,
      opts: { color: number; metalness: number; roughness: number; clearcoat?: number; emissive?: number; emissiveIntensity?: number },
      pos: [number, number, number],
      phase: number,
      rotSpeed: [number, number, number],
      withWire = false,
    ) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color:               new THREE.Color(opts.color),
        metalness:           opts.metalness,
        roughness:           opts.roughness,
        clearcoat:           opts.clearcoat ?? 1.0,
        clearcoatRoughness:  0.04,
        emissive:            new THREE.Color(opts.emissive ?? opts.color),
        emissiveIntensity:   opts.emissiveIntensity ?? 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      scene.add(mesh);

      let wire: THREE.Mesh | undefined;
      if (withWire) {
        wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.12,
        }));
        wire.position.set(...pos);
        wire.scale.setScalar(1.025);
        scene.add(wire);
      }

      shapes.push({ mesh, wire, baseY: pos[1], phase, speed: 0.6 + Math.random() * 0.5, rotSpeed: new THREE.Vector3(...rotSpeed) });
    };

    // ── Shapes ────────────────────────────────────────
    // 1. Icosahedron — large chrome-purple
    add(new THREE.IcosahedronGeometry(1.15, 1),
      { color: 0x9333ea, metalness: 0.96, roughness: 0.04 },
      [-2.6, 1.2, 0], 0, [0.004, 0.007, 0.001], true);

    // 2. Octahedron — indigo chrome
    add(new THREE.OctahedronGeometry(0.88, 0),
      { color: 0x6366f1, metalness: 0.92, roughness: 0.08, emissiveIntensity: 0.06 },
      [2.3, -1.4, -0.5], 1.5, [0.006, 0.004, 0.002]);

    // 3. Torus — violet chrome
    add(new THREE.TorusGeometry(0.68, 0.23, 20, 80),
      { color: 0xc084fc, metalness: 0.85, roughness: 0.12, emissiveIntensity: 0.1 },
      [1.9, 2.1, -1], 3, [0.007, 0.002, 0.005]);

    // 4. Dodecahedron — soft glass
    add(new THREE.DodecahedronGeometry(0.72, 0),
      { color: 0x7c3aed, metalness: 0.35, roughness: 0.02, emissiveIntensity: 0.12 },
      [-1.3, -2.3, 0.5], 2, [0.003, 0.006, 0.003]);

    // 5. Tetrahedron — bright accent
    add(new THREE.TetrahedronGeometry(0.58, 0),
      { color: 0xf0abfc, metalness: 0.97, roughness: 0.02, emissiveIntensity: 0.15 },
      [0.2, 0.5, -2.2], 4, [0.008, 0.003, 0.006]);

    // 6. Torus Knot — hero accent
    add(new THREE.TorusKnotGeometry(0.5, 0.16, 100, 16),
      { color: 0x818cf8, metalness: 0.9, roughness: 0.06, emissiveIntensity: 0.08 },
      [-0.8, -0.4, 1], 2.5, [0.003, 0.008, 0.002], true);

    // ── Floating particles dust ────────────────────────
    const dustCount = 200;
    const dustPos   = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3]     = (Math.random() - 0.5) * 14;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    const dustMesh = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0x8b5cf6, size: 0.04, sizeAttenuation: true, transparent: true, opacity: 0.45,
    }));
    scene.add(dustMesh);

    // ── Mouse ─────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    // ── Animate ────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      shapes.forEach(({ mesh, wire, baseY, phase, speed, rotSpeed }) => {
        mesh.rotation.x += rotSpeed.x;
        mesh.rotation.y += rotSpeed.y;
        mesh.rotation.z += rotSpeed.z;
        mesh.position.y  = baseY + Math.sin(t * speed * 0.5 + phase) * 0.22;
        mesh.position.x += (mx * 0.08 - mesh.position.x * 0.02) * 0.04;
        if (wire) {
          wire.rotation.copy(mesh.rotation);
          wire.position.copy(mesh.position);
        }
      });

      dustMesh.rotation.y += 0.0004;
      dustMesh.rotation.x  = Math.sin(t * 0.05) * 0.05;

      // Orbit lights slowly
      lights[0].position.x = -4 + Math.sin(t * 0.4) * 2.5;
      lights[0].position.y =  4 + Math.cos(t * 0.3) * 1.5;
      lights[1].position.x =  4 + Math.cos(t * 0.35) * 2;
      lights[1].position.y = -3 + Math.sin(t * 0.5) * 1;

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
}
