"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function ThreeDViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 460;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup (Perspective)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(-2.6, 1.8, 7.0);

    // 3. WebGL Renderer Setup (Alpha enabled for transparency)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4.0;
    controls.maxDistance = 11.0;
    controls.enableZoom = false;
    controls.target.set(0, -0.2, 0);

    // 5. Hyper-Realistic Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Top-Right Strong White Keylight
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(6, 12, 6);
    scene.add(keyLight);

    // Left Purple Accent Fill Light
    const purpleFill = new THREE.DirectionalLight(0xa78bfa, 2.0);
    purpleFill.position.set(-6, 3, 3);
    scene.add(purpleFill);

    // Bottom White Spotlight to catch gear bevel highlights
    const bottomLight = new THREE.DirectionalLight(0xffffff, 1.5);
    bottomLight.position.set(0, -6, 4);
    scene.add(bottomLight);

    // Point light inside assembly for neon glow core
    const coreLight = new THREE.PointLight(0xc084fc, 3.0, 8);
    coreLight.position.set(0, 0, 0.5);
    scene.add(coreLight);

    // 6. Assembly Group
    const assemblyGroup = new THREE.Group();
    scene.add(assemblyGroup);

    // Hyper-Realistic Chrome Steel Material (adjusted roughness for lighting diffuse catches)
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f7,
      metalness: 0.95,
      roughness: 0.14,
    });

    // --- PROCEDURAL 3D GEARS ---
    const createGearShape = (teethCount: number, innerR: number, outerR: number, holeR: number) => {
      const shape = new THREE.Shape();
      for (let i = 0; i < teethCount; i++) {
        const angle = (i / teethCount) * Math.PI * 2;
        const angleNext = ((i + 0.5) / teethCount) * Math.PI * 2;
        const angleNextNext = ((i + 1) / teethCount) * Math.PI * 2;

        const x1 = Math.cos(angle) * outerR;
        const y1 = Math.sin(angle) * outerR;
        const x2 = Math.cos(angleNext) * outerR;
        const y2 = Math.sin(angleNext) * outerR;
        const x3 = Math.cos(angleNext) * innerR;
        const y3 = Math.sin(angleNext) * innerR;
        const x4 = Math.cos(angleNextNext) * innerR;
        const y4 = Math.sin(angleNextNext) * innerR;

        if (i === 0) shape.moveTo(x1, y1);
        else shape.lineTo(x1, y1);
        shape.lineTo(x2, y2);
        shape.lineTo(x3, y3);
        shape.lineTo(x4, y4);
      }
      
      const hole = new THREE.Path();
      hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      return shape;
    };

    const extrudeSettings = {
      depth: 0.24,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.035,
      bevelThickness: 0.035,
    };

    // Big Main Gear
    const bigGearShape = createGearShape(12, 0.65, 0.96, 0.35);
    const bigGearGeo = new THREE.ExtrudeGeometry(bigGearShape, extrudeSettings);
    bigGearGeo.center();
    const bigGear = new THREE.Mesh(bigGearGeo, chromeMaterial);
    bigGear.position.set(-0.66, 0, 0);
    assemblyGroup.add(bigGear);

    // Small Meshed Gear
    const smallGearShape = createGearShape(8, 0.42, 0.63, 0.22);
    const smallGearGeo = new THREE.ExtrudeGeometry(smallGearShape, extrudeSettings);
    smallGearGeo.center();
    const smallGear = new THREE.Mesh(smallGearGeo, chromeMaterial);
    smallGear.position.set(0.66, 0, 0);
    assemblyGroup.add(smallGear);

    // --- FROSTED TRANSLUCENT GLASS CHASSIS ---
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd8b4fe,
      transparent: true,
      opacity: 0.16,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.96,
      ior: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const chassisGeo = new THREE.CylinderGeometry(1.85, 1.85, 0.62, 32, 1, true);
    const chassis = new THREE.Mesh(chassisGeo, glassMaterial);
    chassis.rotation.x = Math.PI / 2;
    assemblyGroup.add(chassis);

    // Outer Chrome Rim Rings
    const ringGeo = new THREE.TorusGeometry(1.85, 0.035, 16, 64);
    const topRim = new THREE.Mesh(ringGeo, chromeMaterial);
    topRim.position.z = 0.31;
    assemblyGroup.add(topRim);

    const bottomRim = topRim.clone();
    bottomRim.position.z = -0.31;
    assemblyGroup.add(bottomRim);

    // --- ORBITING SCANNED PARTICLE CLOUD (Fine dust) ---
    const particleCount = 240;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds: number[] = [];
    const radii: number[] = [];
    const heights: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.0 + Math.random() * 0.75;
      const angle = Math.random() * Math.PI * 2;
      const heightVal = (Math.random() - 0.5) * 1.4;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = heightVal;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      radii.push(radius);
      heights.push(heightVal);
      speeds.push(0.55 + Math.random() * 1.15);
    }

    particlesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      color: 0xd8b4fe,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particlesGeo, particlesMaterial);
    assemblyGroup.add(particleSystem);

    // --- GLOWING GROUND TELEMETRY GRID (Very subtle) ---
    const gridHelper = new THREE.GridHelper(5.2, 14, 0xd8b4fe, 0xe5e5ea);
    gridHelper.position.y = -1.2;
    (gridHelper.material as THREE.Material).opacity = 0.22;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    // Initial angle adjustments
    assemblyGroup.rotation.x = 0.42;
    assemblyGroup.rotation.y = 0.32;

    const clock = new THREE.Clock();
    setLoading(false);

    // 7. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Main Gear rotation (slightly faster)
      bigGear.rotation.z = -0.9 * elapsedTime;
      // Secondary Gear meshes in opposite direction (1.5x tooth count ratio speed adjustment)
      smallGear.rotation.z = 1.35 * elapsedTime;

      // Swirl the scanning particles
      const posAttr = particlesGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const angle = elapsedTime * speeds[i] + i;
        const radius = radii[i];
        posAttr.setX(i, Math.cos(angle) * radius);
        posAttr.setZ(i, Math.sin(angle) * radius);
      }
      posAttr.needsUpdate = true;

      // Slow orbit rotation of the entire chassis system (slightly faster)
      assemblyGroup.rotation.y = 0.18 * elapsedTime;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Handle Container Sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }
    });
    resizeObserver.observe(container);

    // 9. Clean up resources
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Geometries and Materials
      bigGearGeo.dispose();
      smallGearGeo.dispose();
      chassisGeo.dispose();
      ringGeo.dispose();
      particlesGeo.dispose();
      chromeMaterial.dispose();
      glassMaterial.dispose();
      particlesMaterial.dispose();
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full relative flex items-center justify-center min-h-[460px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-transparent rounded-3xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-[460px] cursor-grab active:cursor-grabbing" />
    </div>
  );
}
