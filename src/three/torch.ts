import * as THREE from 'three'

export interface TorchRig {
  rig: THREE.Group
  target: THREE.Object3D
  main: THREE.SpotLight
  fill: THREE.SpotLight
  bounce: THREE.PointLight
  beam: THREE.Mesh
  cookie: THREE.Texture | null
}

export interface TorchRigParams {
  rigOffset: THREE.Vector3
  targetOffset: THREE.Vector3
  targetZ: number
  beamStart: number
  beamLength: number
  beamOpacity: number
  main: {
    color: number
    intensity: number
    distance: number
    angle: number
    penumbra: number
    decay: number
  }
  fill: {
    color: number
    intensity: number
    distance: number
    angle: number
    penumbra: number
    decay: number
  }
  bounce: {
    color: number
    intensity: number
    distance: number
    decay: number
  }
}

export const defaultTorchRigParams: TorchRigParams = {
  // Keep the torch centered on the camera so the hotspot matches the crosshair.
  rigOffset: new THREE.Vector3(0, 0, 0),
  targetOffset: new THREE.Vector3(0, 0, 0),
  targetZ: -8,
  // Keep the near end away from the camera near-plane even when the beam is shortened.
  beamStart: 0.6,
  beamLength: 10,
  // Keep the volumetric beam subtle so it doesn't wash out wall/floor detail.
  beamOpacity: 0,
  main: {
    color: 0xFFF3D6,
    // Use a gentler falloff than inverse-square so nearby walls don't blow out,
    // but distant walls/floor remain readable in a maze.
    intensity: 150,
    distance: 40,
    angle: Math.PI / 3.8,
    penumbra: 0.96,
    decay: 1,
  },
  fill: {
    color: 0xFFD7A0,
    // Very subtle wide fill to avoid "mystery" bright patches on walls.
    intensity: 0,
    distance: 24,
    angle: Math.PI / 3.1,
    penumbra: 1,
    decay: 1,
  },
  bounce: {
    color: 0xFFD7A0,
    // Subtle readability lift; keep very low to avoid "mystery light patches".
    intensity: 22,
    distance: 16,
    decay: 1,
  },
}

export function createTorchRig(
  fpsCamera: THREE.PerspectiveCamera,
  opts: {
    params?: TorchRigParams
    createCookieTexture?: () => THREE.Texture
  } = {},
): TorchRig {
  const params = opts.params ?? defaultTorchRigParams

  const rig = new THREE.Group()
  rig.position.copy(params.rigOffset)
  fpsCamera.add(rig)

  const target = new THREE.Object3D()
  target.position.set(
    params.targetOffset.x,
    params.targetOffset.y,
    params.targetZ + params.targetOffset.z,
  )
  // Keep the target on the camera so the beam always aligns with the crosshair.
  fpsCamera.add(target)

  const main = new THREE.SpotLight(
    params.main.color,
    params.main.intensity,
    params.main.distance,
    params.main.angle,
    params.main.penumbra,
    params.main.decay,
  )
  main.position.set(0, 0, 0)
  main.target = target
  rig.add(main)

  const fill = new THREE.SpotLight(
    params.fill.color,
    params.fill.intensity,
    params.fill.distance,
    params.fill.angle,
    params.fill.penumbra,
    params.fill.decay,
  )
  fill.position.set(0, 0, 0)
  fill.target = target
  const cookie = opts.createCookieTexture?.() ?? null
  if (cookie)
    fill.map = cookie
  rig.add(fill)

  const bounce = new THREE.PointLight(
    params.bounce.color,
    params.bounce.intensity,
    params.bounce.distance,
    params.bounce.decay,
  )
  // Slightly down so the floor is readable.
  bounce.position.set(0, -0.75, -1.25)
  rig.add(bounce)

  const beamLength = Math.max(4, params.beamLength)
  const beamStart = Math.max(0.15, params.beamStart)
  const beamRadius = Math.tan(params.main.angle) * beamLength
  const beamGeo = new THREE.ConeGeometry(beamRadius, beamLength, 24, 1, true)
  beamGeo.rotateX(Math.PI / 2)
  // Tip ends at -beamStart, base ends at -(beamStart + beamLength).
  beamGeo.translate(0, 0, -(beamLength / 2 + beamStart))
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xFFE8BF,
    transparent: true,
    opacity: params.beamOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Camera sits inside the cone.
    side: THREE.BackSide,
  })
  const beam = new THREE.Mesh(beamGeo, beamMat)
  beam.renderOrder = 2
  beam.userData.baseLength = beamLength
  beam.userData.startZ = beamStart
  rig.add(beam)

  return { rig, target, main, fill, bounce, beam, cookie }
}
