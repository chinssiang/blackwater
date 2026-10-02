# Run Lab model

`/playground` (Run Lab) draws one rigged, animated runner from
`public/models/runner-v1.glb`. This file says where that asset comes from, what the
code needs from it, and how to replace it.

## What ships today

A **stand-in** built in code: `scripts/build-runner-model.mjs` generates a clay
runner with a sculpted face and short hair, its Mixamo-named skeleton, and three run
cycles. It is original work, so there is no licence to track.

```bash
node scripts/build-runner-model.mjs
```

Re-run it after changing the script, and commit the regenerated GLB with it. It
prints what a coach would check for each cycle (speed, contact and flight time,
vertical bob, knee angles) and fails if a planted foot drifts, a swinging foot digs
into the ground or a leg is asked to reach past straight.

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
running fists with curled fingers and a thumb. The skin is clay grey, keeping the
monochrome frame. To reshape a muscle, edit its ring and rebuild.

## The head

`headGeometry()` stacks superellipse rings into a skull (`RINGS`: depth front and
back, width, and a taper that closes the jaw to a U at the chin), then presses the face
into it with `relief()`: brow, eye sockets and lids, nose and nostril wings,
cheekbones, lips and chin. There is no texture, so the face is read from light and
shadow alone, and its forms are sized to carry at the camera's distance rather than
up close. The hair is the skull above a hairline curve (temples, sideburns, over the
ears, down to the nape), lifted off it along its normals. It is the `Hair` node, which
keeps its own dark colour the way the kit does (`HAIR_NODE` in `kit.ts`), so the Pacer
goes without it.

## The run cycles

The cycles are built from how a runner moves, not keyed by eye (`gait()` in the build
script; per-cycle numbers in `CLIPS`):

- **Hips.** Vertical motion comes from a half-sine ground force: lowest at midstance,
  a ballistic arc through flight, no kink at footfall or toe-off. `bob` scales it
  down a little, because good runners keep the hips quieter than the textbook curve.
  The pelvis also turns, drops on the swing side and sways over the stance foot.
- **Stance.** The ball of the foot is planted and rolls back at one constant speed,
  the heel settles after a midfoot landing and peels off before toe-off, and two-bone
  IK finds the hip and knee. Contact time is what shortens most with speed.
- **Swing.** The ankle follows one smooth path from toe-off through heel recovery and
  knee drive to the next footfall, matching the stance's position and velocity at
  toe-off. Coming in to land, the foot is aimed at the ground.
- **Upper body.** The arms swing with the opposite leg, elbows driving back; the
  chest counter-turns against the pelvis; the head holds level and looks ahead.

Every curve is a sinusoid or a C1 spline, so no joint stops dead at a key.

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
- **Mesh names**: every `Body_*` region, `Top_<id>`, `Bottom_tight`, the `Shoes_*`
  parts and `Hair`, plus the `ClothHem` bone (`kit.ts`).
- **Size**: under 800 KB. Skin weights are stored as normalised bytes (core glTF, not
  an extension) to stay inside it.

The code measures everything else. At load, `measureClips` samples each clip and
works out the footfalls and stance windows from the height of the ball of the foot,
and the ground speed from how fast that ball rolls back through midstance. A new model
with different timing still lines up and still does not skate.

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
