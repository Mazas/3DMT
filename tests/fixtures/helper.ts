import {
  Document,
  NodeIO,
  Primitive,
  Buffer as GLTFBuffer,
} from '@gltf-transform/core';
import sharp from 'sharp';

/**
 * Builds a minimal but real GLB in memory:
 * - One scene, node, mesh with a box primitive (8 verts, 12 tris)
 * - POSITION, NORMAL, TEXCOORD_0 accessors
 * - One material with a base color texture (16x16 solid-color PNG via sharp)
 *
 * Returns the raw GLB bytes.
 */
export async function makeGLB(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();

  // --- Geometry: a simple box (cube) ---

  // prettier-ignore
  const positions = new Float32Array([
    // front
    -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,
    // back
    -1, -1, -1,  -1,  1, -1,   1,  1, -1,   1, -1, -1,
  ]);

  // prettier-ignore
  const normals = new Float32Array([
     0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
     0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
  ]);

  // prettier-ignore
  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);

  // prettier-ignore
  const indices = new Uint16Array([
    0, 1, 2,  0, 2, 3,   // front
    4, 5, 6,  4, 6, 7,   // back
  ]);

  const posAccessor = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(positions)
    .setBuffer(buffer);

  const normAccessor = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(normals)
    .setBuffer(buffer);

  const uvAccessor = doc
    .createAccessor()
    .setType('VEC2')
    .setArray(uvs)
    .setBuffer(buffer);

  const indexAccessor = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(indices)
    .setBuffer(buffer);

  // --- Texture: 16x16 solid orange PNG via sharp ---
  const pngBytes = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 255, g: 128, b: 0 },
    },
  })
    .png()
    .toBuffer();

  const texture = doc
    .createTexture('baseColor')
    .setMimeType('image/png')
    .setImage(new Uint8Array(pngBytes));

  // --- Material ---
  const material = doc
    .createMaterial('mat')
    .setBaseColorTexture(texture);

  // --- Primitive / Mesh / Node / Scene ---
  const prim = doc
    .createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', posAccessor)
    .setAttribute('NORMAL', normAccessor)
    .setAttribute('TEXCOORD_0', uvAccessor)
    .setIndices(indexAccessor)
    .setMaterial(material);

  const mesh = doc.createMesh('box').addPrimitive(prim);
  const node = doc.createNode('boxNode').setMesh(mesh);
  const scene = doc.createScene('scene').addChild(node);
  doc.getRoot().setDefaultScene(scene);

  const io = new NodeIO();
  return io.writeBinary(doc);
}

/**
 * Encodes GLB bytes as a data URI that WebIO can read without network access.
 */
export function toDataURI(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString('base64');
  return `data:model/gltf-binary;base64,${b64}`;
}
