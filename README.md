[![Version](https://img.shields.io/npm/v/@mazas/3dmt?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@mazas/3dmt)

# 3D Model Transformer

Reduces 3D model size to make them more web friendly.
Reduces mesh complexity, downscales images and converts
them to web friendly formats.

All done in-memory.

Based on [gltfjsx](https://github.com/pmndrs/gltfjsx)

## But why tho?

The goal is to reduce the 3D model sizes to improve loading times on the 
web/ mobile. The intention is to allow reducing the model sizes before 
serving them from the backend server. Difference from gltfjsx is that this 
module does the transformation in memory instead of using file system, making 
it faster. Long term goal is to reduce the dependency on node native packages 
which would allow this to be useful on edge compute runtimes such as Fastly.

## Installing

You can install the package form npm with:

```
npm i 3dmt
```

## Usage

```js
import { transform } from "3dmt";

const data = await transform("https://example.com/model.glb", {
  format: "webp",
});
```

## Contributing
Just clone the repo, make a branch and start messing around. Create a PR if 
you want your changes merged.