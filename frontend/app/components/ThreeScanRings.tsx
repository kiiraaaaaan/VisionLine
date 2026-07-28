'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeScanRings({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 600;
    const H = container.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 100);
    camera.position.set(0, 5.5, 7);
    camera.lookAt(0, 0, 0);

    // ── Lighting ──────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const coreLight = new THREE.PointLight(0x8b5cf6, 6, 12);
    coreLight.position.set(0, 0.5, 0);
    scene.add(coreLight);
    const rimLight = new THREE.PointLight(0x6366f1, 3, 18);
    rimLight.position.set(6, 4, 4);
    scene.add(rimLight);

    // ── AI Core sphere ─────────────────────────────────
    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      new THREE.MeshPhysicalMaterial({
        color:              new THREE.Color(0x8b5cf6),
        emissive:           new THREE.Color(0x7c3aed),
        emissiveIntensity:  1.8,
        metalness:          0.4,
        roughness:          0.08,
        clearcoat:          1,
        clearcoatRoughness: 0.05,
      }),
    );
    scene.add(coreMesh);

    // Inner glow halo
    const haloMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.07 }),
    );
    scene.add(haloMesh);

    // ── Pulsing flat rings (radar style) ──────────────
    const RING_COUNT = 6;
    const maxRadius  = 6.5;
    const pulseRings: { geo: THREE.TorusGeometry; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const geo = new THREE.TorusGeometry(1, 0.018, 8, 120);
      const mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      scene.add(mesh);
      pulseRings.push({ geo, mesh, mat, phase: i / RING_COUNT });
    }

    // ── Static reference rings (always visible, faint) ─
    [2.0, 3.8, 5.6].forEach((r, i) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.012, 8, 120),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.10 - i * 0.025 }),
      );
      mesh.rotation.x = Math.PI / 2;
      scene.add(mesh);
    });

    // ── Tilted orbital rings ───────────────────────────
    const orbitalDefs = [
      { radius: 2.2, rx: 0.35, ry: 0,    rz: 0.2,  color: 0x6366f1, op: 0.22 },
      { radius: 3.4, rx: -0.2, ry: 0.45, rz: 0.1,  color: 0xc084fc, op: 0.16 },
      { radius: 4.6, rx: 0.5,  ry: 0.2,  rz: -0.3, color: 0x8b5cf6, op: 0.10 },
    ];
    const orbitals = orbitalDefs.map(({ radius, rx, ry, rz, color, op }) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.022, 8, 120),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op }),
      );
      m.rotation.set(rx, ry, rz);
      scene.add(m);
      return m;
    });

    // ── Radar sweep arc ────────────────────────────────
    const buildArc = (r: number, span: number, segs = 80) => {
      const pts: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * span;
        pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      return pts;
    };
    const sweepR = 6;
    const sweepSpan = Math.PI / 2.2;

    // Sweep outer arc line
    const sweepLineGeo = new THREE.BufferGeometry();
    sweepLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(buildArc(sweepR, sweepSpan), 3));
    const sweepLine = new THREE.Line(
      sweepLineGeo,
      new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.7 }),
    );
    sweepLine.rotation.x = Math.PI / 2;
    scene.add(sweepLine);

    // Sweep fill triangle fan
    const fanVerts: number[] = [];
    const arcPts = buildArc(sweepR, sweepSpan, 40);
    for (let i = 0; i < arcPts.length / 3 - 1; i++) {
      fanVerts.push(0, 0, 0);
      fanVerts.push(arcPts[i * 3], arcPts[i * 3 + 1], arcPts[i * 3 + 2]);
      fanVerts.push(arcPts[(i + 1) * 3], arcPts[(i + 1) * 3 + 1], arcPts[(i + 1) * 3 + 2]);
    }
    const fanGeo = new THREE.BufferGeometry();
    fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(fanVerts, 3));
    const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({
      color: 0x8b5cf6, transparent: true, opacity: 0.055, side: THREE.DoubleSide,
    }));
    fan.rotation.x = Math.PI / 2;
    scene.add(fan);

    // ── Target blips (dots appearing on radar) ─────────
    const blipPositions = [
      [2.2, 0.8], [1.5, 2.1], [3.6, 1.3], [4.1, 0.4],
      [2.8, 3.5], [1.0, 3.0], [3.0, 4.8], [5.0, 2.0],
    ];
    const blips: { mesh: THREE.Mesh; x: number; z: number; phase: number }[] = [];
    blipPositions.forEach(([x, z], i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0 }),
      );
      m.position.set(x, 0, z);
      scene.add(m);
      blips.push({ mesh: m, x, z, phase: i * 0.9 });
    });

    // ── Crosshair lines (grid lines through center) ────
    const crosshairDefs = [
      [[- sweepR, 0, 0], [sweepR, 0, 0]],
      [[0, 0, -sweepR], [0, 0, sweepR]],
    ];
    crosshairDefs.forEach((pts) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.07 })));
    });

    // ── Mouse ─────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5);
      my = -(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', onMouse);

    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Core pulse
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      coreMesh.scale.setScalar(pulse);
      haloMesh.scale.setScalar(pulse * 2);
      coreLight.intensity = 6 + Math.sin(t * 5) * 2.5;

      // Pulse rings — expand from center outward and fade
      pulseRings.forEach(({ mesh, mat, phase }) => {
        const p = ((t * 0.35 + phase) % 1);
        mesh.scale.setScalar(0.15 + p * maxRadius / 1);
        mat.opacity = (1 - p) * 0.45;
      });

      // Orbital rings rotate
      orbitals.forEach((m, i) => {
        m.rotation.z += 0.0018 * (i % 2 === 0 ? 1 : -1);
        m.rotation.y += 0.0009 * (i + 1);
      });

      // Sweep rotation
      const sweepAngle = t * 0.9;
      sweepLine.rotation.y = sweepAngle;
      fan.rotation.y = sweepAngle;

      // Blips light up when sweep passes over them
      blips.forEach(({ mesh, x, z, phase }) => {
        const blipAngle = Math.atan2(z, x);
        let diff = ((sweepAngle % (Math.PI * 2)) - blipAngle + Math.PI * 4) % (Math.PI * 2);
        if (diff > Math.PI * 2) diff -= Math.PI * 2;
        const lit = diff < 0.5;
        const tail = Math.max(0, 1 - diff / 1.5);
        (mesh.material as THREE.MeshBasicMaterial).opacity = lit ? 0.95 : tail * 0.35;
      });

      // Camera mouse tilt
      camera.position.x = mx * 1.2;
      camera.position.y = 5.5 + my * 0.8;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

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
