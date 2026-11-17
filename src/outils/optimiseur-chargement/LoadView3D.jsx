import { useRef, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import { RotateCcw, Eye, EyeOff } from 'lucide-react';

const S = 1 / 1000; // mm → unités de scène (mètres)

function ItemMesh({ item, color, dimmed, blocked, withEdges, onHover }) {
  const [hovered, setHovered] = useState(false);
  const size = [item.length * S, item.height * S, item.width * S];
  const position = [
    (item.x + item.length / 2) * S,
    (item.z + item.height / 2) * S,
    (item.y + item.width / 2) * S,
  ];
  const opacity = dimmed ? 0.12 : hovered ? 1 : 0.9;
  return (
    <mesh
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(item); }}
      onPointerOut={() => { setHovered(false); onHover(null); }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color.solid} transparent opacity={opacity} roughness={0.75} metalness={0.05} />
      {blocked
        ? <Edges color="#DC2626" lineWidth={2} />
        : (withEdges || color.combined) && <Edges color={color.edge ?? color.dark} lineWidth={color.combined ? 3 : 1} />}
    </mesh>
  );
}

function Scene({ container, placed, colorOf, isDimmed, blockedIds, showWalls, onHover }) {
  const CL = container.length * S;
  const CW = container.width * S;
  const CH = container.height * S;
  const withEdges = placed.length <= 300;

  return (
    <group position={[-CL / 2, -CH / 2, -CW / 2]}>
      {/* Sol du contenant */}
      <mesh position={[CL / 2, 0, CW / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CL, CW]} />
        <meshStandardMaterial color="#E2E8F0" transparent opacity={0.55} />
      </mesh>

      {/* Parois du contenant (semi-transparentes) + arêtes */}
      <mesh position={[CL / 2, CH / 2, CW / 2]}>
        <boxGeometry args={[CL, CH, CW]} />
        <meshStandardMaterial color="#2563EB" transparent opacity={showWalls ? 0.06 : 0} depthWrite={false} />
        <Edges color="#94A3B8" />
      </mesh>

      {/* Portes (arrière, X = longueur) : repère pour le déchargement par arrêt */}
      <mesh position={[CL, CH / 2, CW / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[CW, CH]} />
        <meshStandardMaterial color="#F59E0B" transparent opacity={0.16} side={2} depthWrite={false} />
        <Edges color="#F59E0B" />
      </mesh>

      {placed.map((item) => (
        <ItemMesh
          key={item.id}
          item={item}
          color={colorOf(item)}
          dimmed={isDimmed(item)}
          blocked={blockedIds?.has(item.id)}
          withEdges={withEdges}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

export default function LoadView3D({ container, placed, colorOf, isDimmed, blockedIds, onHover }) {
  const controls = useRef(null);
  const [showWalls, setShowWalls] = useState(true);

  const camera = useMemo(() => {
    const maxDim = Math.max(container.length, container.width, container.height) * S;
    return { position: [maxDim * 0.95, maxDim * 0.75, maxDim * 1.15], fov: 42, near: 0.01, far: 1000 };
  }, [container.length, container.width, container.height]);

  return (
    <div className="relative h-[340px] sm:h-[420px] lg:h-[460px]">
      <div className="absolute top-2 right-2 z-10 flex gap-1.5">
        <button onClick={() => setShowWalls((w) => !w)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-jetbrains text-[11px] bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-900"
          title={showWalls ? 'Masquer les parois (vue éclatée)' : 'Afficher les parois'}>
          {showWalls ? <EyeOff size={12} /> : <Eye size={12} />} Parois
        </button>
        <button onClick={() => controls.current?.reset()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-jetbrains text-[11px] bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-900"
          title="Réinitialiser la vue">
          <RotateCcw size={12} /> Vue
        </button>
      </div>

      <div className="absolute bottom-2 right-2 z-10 font-jetbrains text-[10px] px-2 py-1 rounded-md bg-white/90 border border-amber-200 text-amber-700 pointer-events-none">
        ▮ Portes (arrière)
      </div>

      <Canvas camera={camera} dpr={[1, 2]} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[8, 15, 10]} intensity={0.55} />
        <directionalLight position={[-8, 6, -10]} intensity={0.25} />
        <Scene
          container={container}
          placed={placed}
          colorOf={colorOf}
          isDimmed={isDimmed}
          blockedIds={blockedIds}
          showWalls={showWalls}
          onHover={onHover}
        />
        <OrbitControls ref={controls} makeDefault enablePan enableZoom target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
