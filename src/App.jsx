import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text3D, Center, OrbitControls, MeshReflectorMaterial, Float, useTexture } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import * as THREE from 'three'
import font from './font.json'

const DIGITS = '99777799'.split('')
const SPACING = 1.45
const pulse = { v: 0 }

// Colour depends only on distance from the centre, so the palindrome is symmetric in light as well as in shape.
function tint(i) {
  const d = Math.abs(i - 3.5) / 3.5
  return new THREE.Color().setHSL(0.52 + d * 0.38, 1, 0.58)
}

function Digit({ ch, i }) {
  const ref = useRef()
  const side = i < 4 ? -1 : 1
  const color = useMemo(() => tint(i), [i])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ref.current.rotation.y = side * (Math.sin(t * 0.8 + Math.abs(i - 3.5)) * 0.5 + pulse.v * Math.PI * 2)
    ref.current.scale.setScalar(1 + pulse.v * 0.25)
  })
  return (
    <Float speed={2} floatIntensity={0.6} rotationIntensity={0}>
      <group position={[(i - 3.5) * SPACING, 0.2, 0]}>
        <group ref={ref}>
          <Center>
            <Text3D font={font} size={1.1} height={0.45} bevelEnabled bevelSize={0.03} bevelThickness={0.05} curveSegments={8}>
              {ch}
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.7} roughness={0.2} />
            </Text3D>
          </Center>
        </group>
        <pointLight color={color} intensity={6} distance={5} position={[0, 0, 1.5]} />
      </group>
    </Float>
  )
}

// Orbiting rings come in mirrored pairs, one spinning each way.
function Rings() {
  const group = useRef()
  const rings = useMemo(() => Array.from({ length: 6 }, (_, k) => ({ r: 2.2 + k * 1.1, tilt: 0.2 + k * 0.22, color: tint(Math.min(k, 7)) })), [])
  useFrame(({ clock }) => {
    group.current.children.forEach((c, k) => { c.rotation.z = clock.elapsedTime * (k % 2 ? 0.25 : -0.25) * (1 + k * 0.1) })
  })
  return (
    <group ref={group} position={[0, 0.4, -1.5]}>
      {rings.map((r, k) => (
        <group key={k} rotation={[Math.PI / 2 - r.tilt, 0, 0]}>
          <mesh>
            <torusGeometry args={[r.r, 0.012, 8, 220, Math.PI * 1.0]} />
            <meshBasicMaterial color={r.color} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[r.r, 0.012, 8, 220, Math.PI * 1.0]} />
            <meshBasicMaterial color={r.color} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Sky() {
  const map = useTexture('/hero.jpg')
  map.colorSpace = THREE.SRGBColorSpace
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.01 })
  return (
    <mesh ref={ref} scale={[-1, 1, 1]}>
      <sphereGeometry args={[60, 48, 32]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} color="#b8a8d8" toneMapped={false} fog={false} />
    </mesh>
  )
}

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.1, 0]}>
      <planeGeometry args={[140, 140]} />
      <MeshReflectorMaterial blur={[300, 80]} resolution={1024} mixBlur={1} mixStrength={60} mirror={1} depthScale={0.8}
        minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#0b0824" metalness={0.8} roughness={0.9} />
    </mesh>
  )
}

// Half the motes are random; the other half are their reflections across x = 0, so the field is a palindrome too.
function MirrorDust() {
  const ref = useRef()
  const { pos, col } = useMemo(() => {
    const n = 700, pos = new Float32Array(n * 6), col = new Float32Array(n * 6)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 9, y = -1 + Math.random() * 8, z = -6 + Math.random() * 12
      c.setHSL(0.5 + (x / 9) * 0.38, 1, 0.65)
      pos.set([x, y, z, -x, y, z], i * 6)
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6)
    }
    return { pos, col }
  }, [])
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.02 })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  )
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#07051a']} />
      <fog attach="fog" args={['#07051a', 14, 55]} />
      <ambientLight intensity={0.25} />
      <Suspense fallback={null}><Sky /></Suspense>
      {DIGITS.map((ch, i) => <Digit key={i} ch={ch} i={i} />)}
      <Rings />
      <Floor />
      <MirrorDust />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.6} minPolarAngle={1.1} maxPolarAngle={1.65}
        minAzimuthAngle={-0.9} maxAzimuthAngle={0.9} enableDamping />
      <EffectComposer>
        <Bloom intensity={1.3} luminanceThreshold={0.25} mipmapBlur />
        <ChromaticAberration offset={[0.0007, 0.0007]} />
        <Vignette darkness={0.7} offset={0.3} />
      </EffectComposer>
    </>
  )
}


export default function App() {
  const hit = () => { gsap.fromTo(pulse, { v: 0 }, { v: 1, duration: 1.6, ease: 'power3.inOut' }) }
  return (
    <>
      <Canvas camera={{ position: [0, 1.2, 9.5], fov: 50 }} dpr={[1, 2]} onPointerDown={hit} gl={{ antialias: true }}>
        <Scene />
      </Canvas>
      <motion.div className="ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2.5, delay: 0.8 }}>
        <h1>9 9 7 7 <b>|</b> 7 7 9 9</h1>
        <p>drag to walk around the mirror · click to flip it · <span>99777799</span> reads the same backwards</p>
      </motion.div>
    </>
  )
}
