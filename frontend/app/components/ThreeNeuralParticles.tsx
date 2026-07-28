'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeNeuralParticles({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 800;
    const H = container.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.z = 14;

    const group = new THREE.Group();
    scene.add(group);

    // ── Nodes ──────────────────────────────────────────
    const nodeCount = 130;
    const nodePositions: THREE.Vector3[] = [];

    const nodeGeo  = new THREE.SphereGeometry(0.065, 8, 8);
    const hubGeo   = new THREE.SphereGeometry(0.14,  10, 10);
    const nodeMat  = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.75 });
    const hubMat   = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.9 });

    for (let i = 0; i < nodeCount; i++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
      );
      nodePositions.push(pos);
      const isHub = i % 9 === 0;
      const node  = new THREE.Mesh(isHub ? hubGeo : nodeGeo, isHub ? hubMat : nodeMat);
      node.position.copy(pos);
      group.add(node);
    }

    // ── Edges ──────────────────────────────────────────
    const edgeVerts: number[] = [];
    const maxDist = 4.0;

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (nodePositions[i].distanceTo(nodePositions[j]) < maxDist) {
          edgeVerts.push(
            nodePositions[i].x, nodePositions[i].y, nodePositions[i].z,
            nodePositions[j].x, nodePositions[j].y, nodePositions[j].z,
          );
        }
      }
    }

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.12,
    });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // ── Ambient pulse ring ────────────────────────────
    const ringGeo = new THREE.TorusGeometry(5, 0.015, 8, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.18 });
    const ring1   = new THREE.Mesh(ringGeo, ringMat);
    const ring2   = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.012, 8, 100), new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.14 }));
    ring1.rotation.x = Math.PI / 2;
    ring2.rotation.x = Math.PI / 3;
    scene.add(ring1, ring2);

    // ── Data stream "pulses" along edges ──────────────
    // A small bright sphere travels along random paths
    const pulseCount = 6;
    const pulses: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; speed: number }[] = [];
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xf0abfc });
    const pulseGeo = new THREE.SphereGeometry(0.09, 6, 6);

    const pickEdge = () => {
      const i = Math.floor(Math.random() * nodeCount);
      let best = -1, bestD = Infinity;
      for (let j = 0; j < nodeCount; j++) {
        if (j === i) continue;
        const d = nodePositions[i].distanceTo(nodePositions[j]);
        if (d < maxDist && d < bestD) { bestD = d; best = j; }
      }
      return { from: nodePositions[i].clone(), to: nodePositions[best >= 0 ? best : 0].clone() };
    };

    for (let i = 0; i < pulseCount; i++) {
      const { from, to } = pickEdge();
      const mesh = new THREE.Mesh(pulseGeo, pulseMat.clone());
      scene.add(mesh);
      pulses.push({ mesh, from, to, t: Math.random(), speed: 0.4 + Math.random() * 0.6 });
    }

    // ── Animate ────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      group.rotation.y += 0.0007;
      group.rotation.x  = Math.sin(elapsed * 0.08) * 0.12;

      ring1.rotation.z += 0.001;
      ring2.rotation.z -= 0.0015;

      pulses.forEach((p) => {
        p.t += dt * p.speed;
        if (p.t > 1) {
          const { from, to } = pickEdge();
          p.from = from; p.to = to; p.t = 0;
        }
        p.mesh.position.lerpVectors(p.from, p.to, p.t);
      });

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
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
}
