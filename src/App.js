
import React, { useState, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { OrbitControls, Environment, Sky, Grid, useTexture } from '@react-three/drei'
import { GoogleGenerativeAI } from "@google/generative-ai"

// --- UPDATED CONFIGURATION ---
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY)

// EXPANDED PHYSICS LIBRARY
const PHYSICS_PROPS = {
  bookshelf: { size: [1.2, 4, 0.6], mass: 25, color: '#5d4037', hazardMsg: "Tipping Risk: High. Anchor to wall studs." },
  refrigerator: { size: [1.6, 3, 1.6], mass: 150, color: '#bdc3c7', hazardMsg: "Crush Hazard: High. Ensure door latches are secure." },
  chair: { size: [0.8, 1, 0.8], mass: 8, color: '#2c3e50', hazardMsg: "Sliding Hazard: Low. Use rubber floor grips." },
  table: { size: [3, 1, 2], mass: 45, color: '#8B4513', hazardMsg: "Stable base. Safe to duck under if reinforced." },
  lamp: { size: [0.4, 3.5, 0.4], mass: 5, color: '#f1c40f', hazardMsg: "Falling Hazard: High. Secure base or move away from beds." },
  tv: { size: [2.5, 1.5, 0.2], mass: 12, color: '#222', hazardMsg: "Impact Hazard: Use mounting brackets or safety straps." },
  plant: { size: [0.7, 1.5, 0.7], mass: 10, color: '#27ae60', hazardMsg: "Spillage/Fall Hazard: Use heavy ceramic pots." }
}

function PhotoPlane({ url }) {
  const texture = useTexture(url)
  return (
    <mesh position={[0, 5, -12]} scale={[32, 16, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent opacity={0.4} />
    </mesh>
  )
}

function Room({ magnitude }) {
  const rigidBody = useRef()
  useFrame(({ clock }) => {
    if (rigidBody.current && magnitude > 0) {
      const t = clock.getElapsedTime()
      const intensity = Math.pow(magnitude / 9, 3)
      const freq = 12 + magnitude * 2
      const amp = intensity * 0.18 // Calibrated for realism
      rigidBody.current.setNextKinematicTranslation({ 
        x: Math.sin(t * freq) * amp, y: 0, z: Math.cos(t * freq * 1.1) * amp 
      })
    }
  })
  return (
    <RigidBody ref={rigidBody} type="kinematicPosition" colliders={false}>
      <CuboidCollider args={[25, 0.1, 25]} friction={4.0} restitution={0} />
      <Grid infiniteGrid fadeDistance={40} sectionColor="#333" cellColor="#111" />
    </RigidBody>
  )
}

export default function App() {
  const [magnitude, setMagnitude] = useState(0)
  const [image, setImage] = useState(null)
  const [detectedObjects, setDetectedObjects] = useState([])
  const [loading, setLoading] = useState(false)

  async function analyzeImage(file) {
    setLoading(true)
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]
        
        // REFINED PROMPT for the new library
        const prompt = `Act as a seismic safety expert. Scan this room photo. 
        Identify these specific objects: bookshelf, refrigerator, chair, table, lamp, tv, plant.
        Return a valid JSON array only: [{"type": "object_name", "x": number, "z": number}]. 
        Coordinates: x (-10 to 10), z (-10 to 0). No markdown, just raw JSON.`

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: file.type } }
        ])
        
        const text = result.response.text()
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim()
        setDetectedObjects(JSON.parse(cleanedText))
        setLoading(false)
      }
    } catch (error) {
      console.error("AI Error:", error)
      setLoading(false)
    }
  }

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImage(URL.createObjectURL(file))
      analyzeImage(file)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', zIndex: 10, padding: '25px', color: 'white', background: 'rgba(0,0,0,0.9)', width: '380px', height: '100vh', borderRight: '1px solid #333' }}>
        <h1 style={{ color: '#00ffcc', letterSpacing: '2px', fontSize: '24px' }}>QUAKEPROOF AI</h1>
        <p style={{ color: '#888', fontSize: '12px' }}>v2.5 - SEISMIC TWIN GENERATOR</p>
        
        <div style={{ margin: '20px 0', padding: '15px', border: '1px dashed #444' }}>
          <input type="file" accept="image/*" onChange={handleUpload} style={{ width: '100%' }} />
        </div>
        
        {loading && <div className="loader">Analyzing structural hazards...</div>}
        
        {detectedObjects.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ background: '#111', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>Seismic Magnitude: <span style={{ color: '#00ffcc' }}>{magnitude}</span></label>
              <input type="range" min="0" max="9" step="0.1" style={{ width: '100%' }} value={magnitude} onChange={(e) => setMagnitude(parseFloat(e.target.value))} />
              <button onClick={() => setMagnitude(0)} style={{ marginTop: '10px', width: '100%', padding: '8px', cursor: 'pointer' }}>Reset Position</button>
            </div>

            <h3 style={{ fontSize: '14px', color: '#ff4444' }}>AI HAZARD REPORT:</h3>
            <div style={{ overflowY: 'auto', maxHeight: '40vh' }}>
              {detectedObjects.map((obj, i) => (
                <div key={i} style={{ fontSize: '11px', background: '#222', padding: '10px', marginBottom: '8px', borderRadius: '5px', borderLeft: '3px solid #00ffcc' }}>
                  <b style={{ textTransform: 'uppercase' }}>{obj.type}</b>: {PHYSICS_PROPS[obj.type]?.hazardMsg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [0, 10, 18], fov: 35 }}>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} castShadow intensity={1.5} />

        <Suspense fallback={null}>
          {image && <PhotoPlane url={image} />}
          
          {/* REMOVED key={magnitude} to stop the "flying down" effect */}
          <Physics gravity={[0, -9.81, 0]}>
            <Room magnitude={magnitude} />
            
            {detectedObjects.map((obj, i) => {
              const data = PHYSICS_PROPS[obj.type] || PHYSICS_PROPS.chair
              // We position them slightly above floor (y: 0.5) to avoid clipping
              return (
                <RigidBody 
                  key={`${obj.type}-${i}`} 
                  position={[obj.x, data.size[1]/2 + 0.5, obj.z]} 
                  colliders="cuboid" 
                  mass={data.mass}
                  linearDamping={0.5}
                  angularDamping={0.5}
                >
                  <mesh castShadow>
                    <boxGeometry args={data.size} />
                    <meshStandardMaterial color={data.color} transparent opacity={0.8} metalness={0.2} roughness={0.1} />
                  </mesh>
                </RigidBody>
              )
            })}
          </Physics>
        </Suspense>

        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.2} />
        <Environment preset="city" />
      </Canvas>
    </div>
  )
}