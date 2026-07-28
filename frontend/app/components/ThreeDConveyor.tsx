"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface PassingPart {
  mesh: THREE.Group;
  x: number;
  isDefective: boolean;
  hasBeenProcessed: boolean;
  color: THREE.Color;
}

export default function ThreeDConveyor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 460;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup (Perspective)
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    // Positioned slightly high and angled down to see the conveyor belt bed
    camera.position.set(0.0, 3.4, 6.2);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls (Rotation only, scroll zoom disabled to match gears)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.0;
    controls.maxDistance = 10.0;
    controls.enableZoom = false;
    controls.target.set(0, 0.2, 0);

    // 5. Lighting Stage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Overhead Keylight
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 4);
    scene.add(keyLight);

    // Purple fill light from left front
    const purpleFill = new THREE.DirectionalLight(0xa78bfa, 2.2);
    purpleFill.position.set(-6, 2, 3);
    scene.add(purpleFill);

    // Blue rim light from back right
    const blueRim = new THREE.DirectionalLight(0x818cf8, 1.5);
    blueRim.position.set(4, -1, -4);
    scene.add(blueRim);

    // 6. Materials
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e5ea,
      metalness: 0.95,
      roughness: 0.12,
    });

    const darkMetalBeltMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1c1e,
      metalness: 0.8,
      roughness: 0.35,
    });

    const normalPartMaterial = new THREE.MeshStandardMaterial({
      color: 0x9333ea, // Purple core parts
      metalness: 0.9,
      roughness: 0.15,
    });

    const defectivePartMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Red defective parts
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x991b1b,
      emissiveIntensity: 0.3,
    });

    // --- CONVEYOR BELT ASSEMBLY ---
    const conveyorGroup = new THREE.Group();
    scene.add(conveyorGroup);

    // Roller Cylinders (Left and Right)
    const rollerGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.8, 32);
    const leftRoller = new THREE.Mesh(rollerGeo, chromeMaterial);
    leftRoller.rotation.x = Math.PI / 2;
    leftRoller.position.set(-2.8, 0.4, 0);
    conveyorGroup.add(leftRoller);

    const rightRoller = leftRoller.clone();
    rightRoller.position.set(2.8, 0.4, 0);
    conveyorGroup.add(rightRoller);

    // Belt Main Bed Box
    const bedGeo = new THREE.BoxGeometry(5.6, 0.58, 1.76);
    const beltBed = new THREE.Mesh(bedGeo, darkMetalBeltMaterial);
    beltBed.position.set(0, 0.4, 0);
    conveyorGroup.add(beltBed);

    // Procedural Conveyor Slats (to visualize belt translation movement)
    const slatGeo = new THREE.BoxGeometry(0.08, 0.02, 1.78);
    const slatCount = 14;
    const slats: THREE.Mesh[] = [];
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(slatGeo, chromeMaterial);
      // Evenly space along X range [-2.8, 2.8]
      const startX = -2.8 + (i / slatCount) * 5.6;
      slat.position.set(startX, 0.7, 0);
      conveyorGroup.add(slat);
      slats.push(slat);
    }

    // --- CAMERA SCANNER SYSTEM ---
    const scannerGroup = new THREE.Group();
    scannerGroup.position.set(0, 1.8, 0);
    scene.add(scannerGroup);

    // Camera Housing Box
    const cameraHousingGeo = new THREE.BoxGeometry(0.48, 0.38, 0.48);
    const cameraHousing = new THREE.Mesh(cameraHousingGeo, darkMetalBeltMaterial);
    scannerGroup.add(cameraHousing);

    // Lens Cylinder
    const lensGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 16);
    const lens = new THREE.Mesh(lensGeo, chromeMaterial);
    lens.position.set(0, -0.22, 0);
    scannerGroup.add(lens);

    // Volumetric Laser Cone (Pulsing cone emission representing inspection sweep)
    const laserGeo = new THREE.CylinderGeometry(0.06, 0.8, 1.15, 32, 1, true);
    const laserMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      transmission: 0.9,
    });
    const laserBeam = new THREE.Mesh(laserGeo, laserMaterial);
    // Positioned directly below the camera lens down to the conveyor belt surface
    laserBeam.position.set(0, -0.74, 0);
    scannerGroup.add(laserBeam);

    // Point Light source underneath scanner
    const scannerLight = new THREE.PointLight(0xc084fc, 2.0, 4);
    scannerLight.position.set(0, -0.3, 0);
    scannerGroup.add(scannerLight);

    // --- REJECTION PISTON ACTUATOR SYSTEM ---
    const rejectPistonGroup = new THREE.Group();
    rejectPistonGroup.position.set(1.4, 0.6, -1.05); // Located downstream of scan point
    scene.add(rejectPistonGroup);

    // Piston Cylinder Sleeve
    const cylinderSleeveGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.52, 16);
    const cylinderSleeve = new THREE.Mesh(cylinderSleeveGeo, darkMetalBeltMaterial);
    cylinderSleeve.rotation.x = Math.PI / 2; // Pointing forward along Z-axis
    rejectPistonGroup.add(cylinderSleeve);

    // Hydraulic Rod
    const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16);
    const pistonRod = new THREE.Mesh(rodGeo, chromeMaterial);
    pistonRod.rotation.x = Math.PI / 2;
    pistonRod.position.set(0, 0, 0.1);
    rejectPistonGroup.add(pistonRod);

    // Rejection Pusher Plate
    const plateGeo = new THREE.BoxGeometry(0.38, 0.38, 0.04);
    const pusherPlate = new THREE.Mesh(plateGeo, chromeMaterial);
    pusherPlate.position.set(0, 0, 0.4);
    rejectPistonGroup.add(pusherPlate);

    // --- REJECT WASTE BOX (GLASS & WIREFRAME) ---
    const rejectBinGroup = new THREE.Group();
    rejectBinGroup.position.set(1.4, -0.62, 1.2);
    scene.add(rejectBinGroup);

    const binGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.05,
      transmission: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const binGeo = new THREE.BoxGeometry(0.9, 0.68, 0.9);
    const binMesh = new THREE.Mesh(binGeo, binGlassMaterial);
    rejectBinGroup.add(binMesh);

    // Bin wireframe frame lines
    const edges = new THREE.EdgesGeometry(binGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xef4444, opacity: 0.35, transparent: true });
    const binFrame = new THREE.LineSegments(edges, lineMat);
    rejectBinGroup.add(binFrame);

    // Add some pre-rejected static red gears inside the bin
    const wastePartGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12);
    for (let i = 0; i < 3; i++) {
      const wastePart = new THREE.Mesh(wastePartGeo, defectivePartMaterial);
      wastePart.position.set((Math.random() - 0.5) * 0.4, -0.22, (Math.random() - 0.5) * 0.4);
      wastePart.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      rejectBinGroup.add(wastePart);
    }

    // --- PROCEDURAL 3D PARTS LOOP SYSTEM ---
    const activeParts: PassingPart[] = [];
    const partGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 24);
    partGeometry.center();

    const createNewPart = (startX: number): PassingPart => {
      // Procedural 3D gear part (gear hub and extrusions)
      const group = new THREE.Group();
      const body = new THREE.Mesh(partGeometry, normalPartMaterial);
      group.add(body);

      // Add a couple of mechanical indents/features
      const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12);
      const core = new THREE.Mesh(coreGeo, chromeMaterial);
      group.add(core);

      group.position.set(startX, 0.8, 0);
      group.rotation.x = Math.PI / 2; // Lie flat on belt slats
      scene.add(group);

      return {
        mesh: group,
        x: startX,
        isDefective: Math.random() < 0.36, // ~36% defect rate
        hasBeenProcessed: false,
        color: new THREE.Color(0x9333ea),
      };
    };

    // Spawn initial 3 items evenly spaced
    activeParts.push(createNewPart(-2.6));
    activeParts.push(createNewPart(-0.8));
    activeParts.push(createNewPart(1.0));

    // Telemetry ground grid (subtle)
    const gridHelper = new THREE.GridHelper(7.2, 18, 0x8b5cf6, 0xe5e5ea);
    gridHelper.position.y = -1.1;
    (gridHelper.material as THREE.Material).opacity = 0.16;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    // --- ANIMATION / SIMULATION LOOPS ---
    const clock = new THREE.Clock();
    setLoading(false);

    let animationFrameId: number;
    let pistonTargetZ = 0; // Target extension depth for hydraulics
    let pistonState: "idle" | "extend" | "retract" = "idle";
    let activePistonTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const dt = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Constant translation speed for belt (units per sec)
      const beltSpeed = 0.88;

      // 1. Conveyor Belt Slat Movement & Roller Rotation
      leftRoller.rotation.y += beltSpeed * dt * 2.2;
      rightRoller.rotation.y += beltSpeed * dt * 2.2;

      slats.forEach((slat) => {
        slat.position.x += beltSpeed * dt;
        // Wrap slat around from end back to left drum
        if (slat.position.x > 2.8) {
          slat.position.x = -2.8 + (slat.position.x - 2.8);
        }
      });

      // 2. Pulse laser beam cone visual
      const laserPulse = 0.2 + Math.abs(Math.sin(elapsedTime * 9.0)) * 0.12;
      laserMaterial.opacity = laserPulse;
      laserBeam.scale.set(1 + Math.sin(elapsedTime * 6) * 0.04, 1, 1 + Math.cos(elapsedTime * 6) * 0.04);

      // 3. Piston Reject Logic
      if (pistonState === "idle") {
        pistonTargetZ = 0;
      } else if (pistonState === "extend") {
        activePistonTime += dt * 7.5;
        pistonTargetZ = THREE.MathUtils.lerp(0, 0.44, Math.min(activePistonTime, 1));
        if (activePistonTime >= 1.0) {
          pistonState = "retract";
          activePistonTime = 0;
        }
      } else if (pistonState === "retract") {
        activePistonTime += dt * 6.5;
        pistonTargetZ = THREE.MathUtils.lerp(0.44, 0, Math.min(activePistonTime, 1));
        if (activePistonTime >= 1.0) {
          pistonState = "idle";
          activePistonTime = 0;
        }
      }

      pistonRod.position.y = 0.1 + pistonTargetZ; // offset in parent group coordinates
      pusherPlate.position.z = 0.4 + pistonTargetZ;

      // 4. Update and translate mechanical parts on belt
      for (let i = activeParts.length - 1; i >= 0; i--) {
        const part = activeParts[i];
        part.x += beltSpeed * dt;
        part.mesh.position.x = part.x;

        // Rotate part cylinder slightly as it travels along belt to feel physical
        part.mesh.rotation.y += beltSpeed * dt * 1.5;

        // --- SCANNING CHECKPOINT (At X = 0) ---
        if (part.x >= -0.2 && part.x <= 0.2) {
          if (part.isDefective) {
            // Apply defective red material immediately under scanning strobe
            part.mesh.children.forEach((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = defectivePartMaterial;
              }
            });
            // Scanner strobe flares purple to signal anomaly alert
            scannerLight.color.setHex(0xef4444);
            scannerLight.intensity = 4.0;
            laserMaterial.color.setHex(0xef4444);
          } else {
            // Normal sweep (purple glow strobe)
            scannerLight.color.setHex(0xc084fc);
            scannerLight.intensity = 3.2;
            laserMaterial.color.setHex(0xc084fc);
          }
        }

        // Reset laser visual properties once part travels past center
        if (part.x > 0.28) {
          laserMaterial.color.setHex(0xc084fc);
          scannerLight.color.setHex(0xc084fc);
          scannerLight.intensity = 2.0;
        }

        // --- REJECT ACTUATOR TRIGGER (At X = 1.4) ---
        if (part.x >= 1.28 && part.x <= 1.48 && part.isDefective && !part.hasBeenProcessed) {
          pistonState = "extend";
          activePistonTime = 0;
          part.hasBeenProcessed = true;
        }

        // --- PHYSICAL COLLISION PHYSICS ANIMATION ---
        if (part.isDefective && part.hasBeenProcessed) {
          // If the piston is extended, push the part forward along Z axis
          if (pistonTargetZ > 0.05 && part.mesh.position.z < 1.1) {
            part.mesh.position.z += pistonTargetZ * 6.5 * dt;
          }
          
          // If pushed off edge (Z > 0.8), make it tumble/fall down into the box
          if (part.mesh.position.z >= 0.8 && part.mesh.position.y > -0.6) {
            part.mesh.position.y -= 3.8 * dt; // Gravity
            part.mesh.rotation.x += 6 * dt; // Tumbling spin
            part.mesh.rotation.y += 4 * dt;
          }
        }

        // --- DE-SPAWN & RE-SPAWN RECYCLING ---
        // If part moves off right screen edge (or fully falls in bin)
        if (part.x > 3.0 || part.mesh.position.y <= -0.58) {
          // Dispose meshes and remove from scene
          scene.remove(part.mesh);
          part.mesh.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              (object.material as THREE.Material).dispose();
            }
          });
          
          // Delete from array and spawn a new part at the left edge
          activeParts.splice(i, 1);
          activeParts.push(createNewPart(-2.6));
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }
    });
    resizeObserver.observe(container);

    // 9. Resource Cleanups
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Traverse scene to dispose resources properly
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      rollerGeo.dispose();
      bedGeo.dispose();
      slatGeo.dispose();
      cameraHousingGeo.dispose();
      lensGeo.dispose();
      laserGeo.dispose();
      cylinderSleeveGeo.dispose();
      rodGeo.dispose();
      plateGeo.dispose();
      binGeo.dispose();
      edges.dispose();
      lineMat.dispose();
      partGeometry.dispose();
      chromeMaterial.dispose();
      darkMetalBeltMaterial.dispose();
      normalPartMaterial.dispose();
      defectivePartMaterial.dispose();
      laserMaterial.dispose();
      binGlassMaterial.dispose();
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
