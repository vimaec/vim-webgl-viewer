import * as THREE from 'three'

// eslint-disable-next-line no-unused-vars
function drawSphere (sphere: THREE.Sphere) {
  const s = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereBufferGeometry(sphere.radius)),
    new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
  )
  s.position.copy(sphere.center)
  s.updateMatrix()
  s.applyMatrix4(this.getViewMatrix())
  this.scene.add(s)
}
