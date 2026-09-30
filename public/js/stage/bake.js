// Runtime "baking": after the procedural build, every static opaque mesh in the level is merged
// with the others that share its material, so ~2,500 draw calls become a few hundred. Nothing
// changes visually; the models stay procedural and editable.
//
// Left alone (still separate objects):
//   - interactables and NPCs (picking, rim highlight, animation), and anything marked
//     userData.dynamic = true (mark new moving props this way)
//   - transparent materials (they need per-object depth sorting)
//   - meshes with children (lamps carry their lights and glow sprites), mirrored meshes,
//     instanced/skinned meshes and multi-material meshes
export function bakeStaticMeshes(THREE, level, mergeGeometries) {
  level.updateMatrixWorld(true);
  const toLevel = new THREE.Matrix4().copy(level.matrixWorld).invert();
  const buckets = new Map();

  const keep = node => node.userData.interactable || node.userData.kind === 'npc' || node.userData.dynamic ||
    node.name === 'ServedItems';

  (function visit(node) {
    if (node !== level && keep(node)) return;
    for (const child of [...node.children]) visit(child);
    if (!node.isMesh || node.isInstancedMesh || node.isSkinnedMesh || node.children.length) return;
    const material = node.material;
    if (!material || Array.isArray(material) || material.transparent || !node.visible) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(toLevel, node.matrixWorld);
    if (matrix.determinant() < 0) return;
    const geometry = node.geometry;
    const signature = [
      material.uuid, node.castShadow, node.receiveShadow, geometry.index ? 'i' : 'n',
      ...Object.keys(geometry.attributes).sort(), geometry.morphAttributes.position ? 'm' : '',
    ].join('|');
    if (!buckets.has(signature)) buckets.set(signature, { material, castShadow: node.castShadow, receiveShadow: node.receiveShadow, parts: [] });
    buckets.get(signature).parts.push({ node, matrix });
  })(level);

  const baked = new THREE.Group();
  baked.name = 'BakedStatic';
  let merged = 0;
  for (const { material, castShadow, receiveShadow, parts } of buckets.values()) {
    if (parts.length < 2) continue;
    const geometries = parts.map(({ node, matrix }) => {
      const geometry = node.geometry.clone();
      geometry.clearGroups();
      return geometry.applyMatrix4(matrix);
    });
    const geometry = mergeGeometries(geometries, false);
    for (const part of geometries) part.dispose();
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixAutoUpdate = false;
    baked.add(mesh);
    for (const { node } of parts) node.parent.remove(node);
    merged += parts.length;
  }
  level.add(baked);
  return { merged, meshes: baked.children.length };
}

// For things that move as a whole or by parts (robots): inside every node, merge its leaf mesh
// children that share a material into one mesh, in that node's own space. Limbs, heads and
// torsos keep animating because the merged meshes stay under the same pivots. Meshes carrying
// userData (the ring marker), transparent ones and subtrees marked userData.dynamic are left as is.
export function mergeRigidParts(THREE, root, mergeGeometries) {
  let before = 0;
  let after = 0;
  (function visit(node) {
    if (node.userData.dynamic) return;
    const buckets = new Map();
    for (const child of [...node.children]) {
      visit(child);
      if (!child.isMesh || child.isInstancedMesh || child.isSkinnedMesh || child.children.length) continue;
      const material = child.material;
      if (!material || Array.isArray(material) || material.transparent || Object.keys(child.userData).length) continue;
      child.updateMatrix();
      if (child.matrix.determinant() < 0) continue;
      const geometry = child.geometry;
      const signature = [material.uuid, child.castShadow, child.receiveShadow, child.visible, geometry.index ? 'i' : 'n',
        ...Object.keys(geometry.attributes).sort()].join('|');
      if (!buckets.has(signature)) buckets.set(signature, []);
      buckets.get(signature).push(child);
    }
    for (const parts of buckets.values()) {
      if (parts.length < 2) continue;
      const geometries = parts.map(part => {
        const geometry = part.geometry.clone();
        geometry.clearGroups();
        return geometry.applyMatrix4(part.matrix);
      });
      const geometry = mergeGeometries(geometries, false);
      for (const part of geometries) part.dispose();
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, parts[0].material);
      Object.assign(mesh, { castShadow: parts[0].castShadow, receiveShadow: parts[0].receiveShadow, visible: parts[0].visible });
      node.add(mesh);
      for (const part of parts) {
        node.remove(part);
        part.geometry.dispose();
      }
      before += parts.length;
      after++;
    }
  })(root);
  return { before, after };
}
