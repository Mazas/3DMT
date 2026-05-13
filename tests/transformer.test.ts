import { describe, test, beforeAll, expect } from 'vitest';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as draco3d from 'draco3dgltf';
import { transform } from '../src/transformer.js';
import { makeGLB, toDataURI } from './fixtures/helper.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-parse a GLB Uint8Array back into a gltf-transform Document. Throws on failure. */
async function parseGLB(bytes: Uint8Array) {
  const uri = toDataURI(bytes);
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
  return io.read(uri);
}

/** Assert common invariants that every output must satisfy. */
async function assertValidOutput(
  output: unknown,
  inputByteLength: number,
): Promise<void> {
  expect(output).toBeInstanceOf(Uint8Array);
  const out = output as Uint8Array;
  expect(out.byteLength).toBeGreaterThan(0);
  expect(out.byteLength).toBeLessThanOrEqual(inputByteLength);
  // Must re-parse without throwing
  await expect(parseGLB(out)).resolves.toBeDefined();
}

// ---------------------------------------------------------------------------
// Network test: skip in CI, run locally
// ---------------------------------------------------------------------------
const networkTest = process.env.CI === 'true' ? test.skip : test;

// A well-known stable public GLB (Khronos sample models)
const NETWORK_GLB_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxTextured/glTF-Binary/BoxTextured.glb';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('transform()', () => {
  let inputBytes: Uint8Array;
  let inputURI: string;

  beforeAll(async () => {
    inputBytes = await makeGLB();
    inputURI = toDataURI(inputBytes);
  }, 30_000);

  // -------------------------------------------------------------------------
  // Offline tests (use local data URI)
  // -------------------------------------------------------------------------

  test('default config', async () => {
    const output = await transform(inputURI);
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('format: webp', async () => {
    const output = await transform(inputURI, { format: 'webp' });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('format: jpeg', async () => {
    const output = await transform(inputURI, { format: 'jpeg' });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('format: png', async () => {
    const output = await transform(inputURI, { format: 'png' });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('format: avif', async () => {
    const output = await transform(inputURI, { format: 'avif' });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('keepmaterials: true', async () => {
    const output = await transform(inputURI, { keepmaterials: true });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('keepmeshes: true', async () => {
    const output = await transform(inputURI, { keepmeshes: true });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('simplify: true', async () => {
    const output = await transform(inputURI, {
      simplify: true,
      ratio: 0.5,
      error: 0.01,
    });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  test('degrade pattern matches texture name', async () => {
    const output = await transform(inputURI, {
      format: 'webp',
      degrade: 'baseColor',
      degraderesolution: 256,
      resolution: 512,
    });
    await assertValidOutput(output, inputBytes.byteLength);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Network test (skipped in CI)
  // -------------------------------------------------------------------------

  networkTest(
    'fetches GLB from network URL and produces parseable output',
    async () => {
      const output = await transform(NETWORK_GLB_URL);

      expect(output).toBeInstanceOf(Uint8Array);
      expect((output as Uint8Array).byteLength).toBeGreaterThan(0);
      // Re-parse to confirm output is a valid GLB
      await expect(parseGLB(output as Uint8Array)).resolves.toBeDefined();
    },
    120_000,
  );

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  test('rejects on invalid/unreachable URL', async () => {
    await expect(
      transform('https://invalid.invalid/bad.glb'),
    ).rejects.toThrow();
  }, 30_000);
});
