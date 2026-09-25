# Run Lab model

`/playground` (Run Lab) draws one rigged, animated runner from
`public/models/runner-v1.glb`. This file says where that asset comes from, what the
code needs from it, and how to replace it.

## What ships today

A **stand-in** built in code: `scripts/build-runner-model.mjs` generates a faceless
low-poly mannequin, its Mixamo-named skeleton, and three run cycles. It is original
work, so there is no licence to track.

```bash
node scripts/build-runner-model.mjs
```

Re-run it after changing the script, and commit the regenerated GLB with it.

It exists because the planned source, the Quaternius CC0 "Universal" character and
animation library, needs a manual download and a Blender pass, and neither could be
automated here.

## The body

The body is one continuous skin, built by `loft()` in the build script from ring
tables (`TORSO`, `ARM`, `LEG`, `HEAD_RINGS`, `NECK`). Each ring is a cross-section
at a height along the bone line. The shapes are the landmarks a coach looks at:

- **Torso:** glutes, waist, ribcage, pecs, the trapezius slope.
- **Arms:** deltoid, biceps, the bony elbow, the forearm tapering to the wrist.
- **Legs:** quads with the teardrop above the inner knee, the kneecap, the calf belly
  high and to the inside, the Achilles.

Weights blend across every joint, so knees and elbows bend smoothly. Hands are loose
running fists with curled fingers and a thumb. The head is sculpted but faceless, and
the skin is clay grey, keeping the monochrome frame. To reshape a muscle, edit its
ring and rebuild.

## The kit

The runner wears the club's kit, modelled from the product photos in the `prod`
dataset. There is a choice of four tops (Component SS T, 2502 Coda Performance
Tank, Hoole Cut-Off, Communion T). The Sleek Pocket Half Tight 9" and the
FuelCell Rebel v5 (Grey Days Edition) are always on. Three things make the
clothes behave:

- **Hidden skin.** The body is split into `Body_*` regions, and each garment hides
  the ones it covers (`KIT_COVERS` in `src/lib/run-lab/kit.ts`). Skin that is not
  drawn cannot poke through fabric.
- **Built from the body.** Every garment is the body's own rings plus ease, and it
  carries the body's own weights. Linear-blend skinning moves a point and its outward
  offset almost identically, so the clothes hug the muscles and stay outside the skin
  through every bend.
- **A spring on the hem.** Loose tops weight their hem to `ClothHem`, a bone no clip
  animates. `stepCloth` in `scene/runner-rig.ts` drives it with a damped spring plus
  air drag, so the hem lags each bounce. The cut-off moves most and the slim tee
  least.

Colours are baked into the GLB. The prints (BLKWTR, NB, the Hoole circle, the shoe's
N) are painted into canvases at runtime (`scene/decals.ts`). Product links in the
Kit tab use the slugs in `KIT_PRODUCT_SLUGS`, so renaming one of those products'
slugs means updating that map.

## The contract

`src/lib/run-lab/rig.ts` holds it, and `src/lib/run-lab/model.test.ts` enforces it
against the file on disk:

- **Bone names**: every entry in `MIXAMO_BONES`, as three.js sees them. GLTFLoader
  strips the colon, so `mixamorig:Hips` becomes `mixamorigHips`.
- **Clips**: `jog`, `run` and `sprint`, each exactly one stride. A Blender prefix such
  as `Armature|jog` is fine.
- **No decoder**: nothing in `extensionsRequired` except `KHR_mesh_quantization`.
  Draco and meshopt need WASM and blob workers, which the CSP blocks.
- **Mesh names**: every `Body_*` region, `Top_<id>`, `Bottom_tight` and the
  `Shoes_*` parts, plus the `ClothHem` bone (`kit.ts`).
- **Size**: under 800 KB.

The code measures everything else. At load, `measureClips` samples each clip and
works out the footfalls, the stance windows and how far the planted foot travels.
A new model with different timing still lines up and still does not skate.

## Replacing it with a Quaternius export

1. Download the Universal base character and the Universal Animation Library.
   Both are CC0; record the version in this file.
2. In Blender 4.x, import the character and the jog, run and sprint clips. Put
   each clip on its own NLA strip named exactly `jog`, `run` and `sprint`. Delete
   textures and materials, because the code replaces them. Apply transforms and
   work in metres.
3. Export as glTF Binary: +Y up, animations from NLA strips, sampling on,
   skinning on, compression **off**.
4. Shrink it:

   ```bash
   npx @gltf-transform/cli prune in.glb a.glb
   npx @gltf-transform/cli dedup a.glb b.glb
   npx @gltf-transform/cli resample b.glb c.glb
   npx @gltf-transform/cli quantize c.glb public/models/runner-v2.glb
   ```

5. Point `RUNNER_MODEL_URL` at the new file. Then run `npx vitest run src/lib/run-lab`.

**Axes are the part a name map cannot fix.** The dial overrides in
`scene/runner-rig.ts` (`applyOverrides`) assume the stand-in's convention: every
bone's rest rotation is identity, so local X is a pitch. A Mixamo rig's bones carry
their own rest rotations, so the lean, gaze and arm offsets must be re-derived per
bone. Check each dial in the side and front views before shipping a new rig.
