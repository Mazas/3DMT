import { WebIO } from "@gltf-transform/core";
import {
  simplify,
  instance,
  flatten,
  dequantize,
  reorder,
  join,
  weld,
  sparse,
  dedup,
  resample,
  prune,
  textureCompress,
  draco,
  palette,
  unpartition,
} from "@gltf-transform/functions";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import {
  ready as resampleReady,
  resample as resampleWASM,
} from "keyframe-resample";
import * as draco3d from "draco3dgltf";

export type Config = {
  resolution?: number;
  degraderesolution?: number;
  degrade?: string;
  format?: "jpeg" | "png" | "webp" | "avif";
  keepmaterials?: boolean;
  keepmeshes?: boolean;
  simplify?: boolean;
  ratio?: number;
  error?: number;
  weld?: number;
};

export async function transform(
  file: string,
  config: Config = {}
): Promise<Uint8Array> {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
  const document = await io.read(file);
  const resolution = config.resolution ?? 1024;
  const normalResolution = Math.max(resolution, 2048);
  const degradeResolution = config.degraderesolution ?? 512;
  const functions = [unpartition()];
  if (!config.keepmaterials) functions.push(palette({ min: 5 }));
  functions.push(
    reorder({ encoder: MeshoptEncoder }),
    dedup(),
    instance({ min: 5 }),
    flatten(),
    dequantize()
  );
  if (!config.keepmeshes) {
    functions.push(join());
  }
  if (config.simplify) {
    functions.push(
      // Weld vertices
      // @ts-ignore
      weld({ tolerance: config.weld ?? 0.0001 / 2 }),
      // Simplify meshes
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: config.ratio ?? 0,
        error: config.error ?? 0.0001,
      })
    );
  }
  functions.push(
    resample({ ready: resampleReady, resample: resampleWASM }),
    prune({ keepAttributes: false, keepLeaves: false }),
    sparse()
  );
  if (config.degrade) {
    // Custom per-file resolution
    functions.push(
      textureCompress({
        pattern: new RegExp(`^(?=${config.degrade}).*$`),
        targetFormat: config.format,
        resize: [degradeResolution, degradeResolution],
      }),
      textureCompress({
        pattern: new RegExp(`^(?!${config.degrade}).*$`),
        targetFormat: config.format,
        resize: [resolution, resolution],
      })
    );
  } else {
    // Keep normal maps near lossless
    functions.push(
      textureCompress({
        slots: /^(?!normalTexture).*$/, // exclude normal maps
        targetFormat: config.format,
        resize: [resolution, resolution],
      }),
      textureCompress({
        slots: /^(?=normalTexture).*$/, // include normal maps
        targetFormat: "jpeg",
        resize: [normalResolution, normalResolution],
      })
    );
  }
  functions.push(draco());
  await document.transform(...functions);
  return await io.writeBinary(document);
}
