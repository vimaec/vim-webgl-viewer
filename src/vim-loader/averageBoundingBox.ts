import * as THREE from 'three'

/**
 * Returns the bounding box of the average center of all meshes.
 * Less precise but is more stable against outliers.
 */
export function getAverageBoundingBox (positions: THREE.Vector3[], thresholdSpan = 1000, framingDistanceMultiplier = 2): THREE.Box3 {
  if (positions.length === 0) {
    return new THREE.Box3()
  }

  const { centroid, aabb } = calculateCentroidAndBoundingBox(positions)
  const span = aabb.getSize(new THREE.Vector3()).length()
  const center = span > thresholdSpan ? centroid : aabb.getCenter(new THREE.Vector3())

  const avgDist = new THREE.Vector3()
  for (const pos of positions) {
    avgDist.set(
      avgDist.x + Math.abs(pos.x - center.x),
      avgDist.y + Math.abs(pos.y - center.y),
      avgDist.z + Math.abs(pos.z - center.z))
  }

  const scaledDist = avgDist.multiplyScalar(framingDistanceMultiplier / positions.length)
  return new THREE.Box3(
    center.clone().sub(scaledDist),
    center.clone().add(scaledDist)
  )
}

function calculateCentroidAndBoundingBox (positions: THREE.Vector3[]): { centroid: THREE.Vector3, aabb: THREE.Box3 } {
  const sum = new THREE.Vector3()
  const aabb = new THREE.Box3()

  for (const pos of positions) {
    sum.add(pos)
    aabb.expandByPoint(pos)
  }

  const centroid = sum.divideScalar(positions.length)
  return { centroid, aabb }
}
