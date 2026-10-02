'use client';

import { type RefObject, memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { seededRandom } from '@/lib/run-lab/math';
import {
	MAX_PROPS_PER_KIND,
	PROP_KINDS,
	type PropKind,
	TILE_COUNT,
	TILE_LENGTH,
	TILE_WIDTH,
	scenery,
	tileSegment,
	tileStart,
	trailHeight,
} from '@/lib/run-lab/scenery';
import type { Terrain } from '@/lib/run-lab/types';
import { GROUND } from './constants';
import {
	AdditiveBlending,
	BoxGeometry,
	type BufferAttribute,
	type BufferGeometry,
	CanvasTexture,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DodecahedronGeometry,
	Group,
	IcosahedronGeometry,
	InstancedBufferAttribute,
	InstancedMesh,
	type Material,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	RepeatWrapping,
	SRGBColorSpace,
} from 'three';

/**
 * The runner stays at the origin and the world scrolls under it: a few tiles
 * leapfrogging along -Z (see `tileStart`). Each tile shows one numbered
 * stretch of world and refills when it wraps to the front, so the scenery
 * never comes round again. Props are instanced, one mesh per kind per tile,
 * so a refill rewrites matrices rather than mounting anything.
 */
// Memoised: its props (a terrain, a stable ref) hold still, so a slider tick
// that re-renders the scene leaves the tiles alone.
export const Ground = memo(function Ground({
	terrain,
	offsetRef,
}: {
	terrain: Terrain;
	offsetRef: RefObject<number>;
}) {
	// Mutates three.js objects inside useFrame; see eslint.config.mjs.
	'use no memo';
	const kit = useMemo(createKit, []);
	const tiles = useMemo(
		() => Array.from({ length: TILE_COUNT }, () => createTile(kit)),
		[kit]
	);
	useEffect(
		() => () => {
			for (const tile of tiles) tile.ground.geometry.dispose();
			kit.dispose();
		},
		[kit, tiles]
	);

	useFrame(() => {
		const offset = offsetRef.current ?? 0;
		tiles.forEach((tile, i) => {
			tile.group.position.z = tileStart(i, offset);
			const segment = tileSegment(i, offset);
			if (segment !== tile.segment || terrain !== tile.terrain) {
				fillTile(tile, kit, terrain, segment);
			}
		});
	});

	return (
		<group>
			{tiles.map((tile, i) => (
				<primitive key={i} object={tile.group} />
			))}
		</group>
	);
});

type Kit = ReturnType<typeof createKit>;
type Tile = ReturnType<typeof createTile>;

/** Geometry and materials every tile shares. */
function createKit() {
	const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const cube = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
	// The kinds' origins follow `Prop`: flat, standing on y, or centred on it.
	const geometries: Record<PropKind, BufferGeometry> = {
		mark: plane,
		box: cube,
		trunk: new CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0),
		cone: new ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0),
		blob: new IcosahedronGeometry(0.5, 0),
		rock: new DodecahedronGeometry(0.5, 0),
		glow: cube,
		pool: plane,
	};
	// White, so each instance's tone is its colour.
	const paint = new MeshBasicMaterial();
	const solid = new MeshStandardMaterial({ roughness: 1, flatShading: true });
	const materials: Record<PropKind, Material> = {
		mark: paint,
		box: solid,
		trunk: solid,
		cone: solid,
		blob: solid,
		rock: solid,
		glow: new MeshBasicMaterial(),
		pool: new MeshBasicMaterial({
			map: poolTexture(),
			transparent: true,
			depthWrite: false,
			blending: AdditiveBlending,
		}),
	};
	const grain = grainTexture();
	const ground = new MeshStandardMaterial({
		color: GROUND,
		roughness: 1,
		map: grain,
	});
	const faceted = new MeshStandardMaterial({
		color: GROUND,
		roughness: 1,
		map: grain,
		flatShading: true,
	});
	return {
		geometries,
		materials,
		ground,
		faceted,
		dispose() {
			for (const g of new Set(Object.values(geometries))) g.dispose();
			for (const m of new Set(Object.values(materials))) m.dispose();
			(materials.pool as MeshBasicMaterial).map?.dispose();
			grain.dispose();
			ground.dispose();
			faceted.dispose();
		},
	};
}

function createTile(kit: Kit) {
	const group = new Group();
	// Its own geometry, laid out in tile space (z 0..TILE_LENGTH): the trail
	// reshapes it for every stretch of world it shows.
	const ground = new Mesh(
		new PlaneGeometry(TILE_WIDTH, TILE_LENGTH, TILE_WIDTH, TILE_LENGTH * 2)
			.rotateX(-Math.PI / 2)
			.translate(0, 0, TILE_LENGTH / 2),
		kit.ground
	);
	group.add(ground);
	const props = {} as Record<PropKind, InstancedMesh>;
	for (const kind of PROP_KINDS) {
		const mesh = new InstancedMesh(
			kit.geometries[kind],
			kit.materials[kind],
			MAX_PROPS_PER_KIND
		);
		mesh.instanceColor = new InstancedBufferAttribute(
			new Float32Array(MAX_PROPS_PER_KIND * 3),
			3
		);
		mesh.count = 0;
		group.add(mesh);
		props[kind] = mesh;
	}
	return {
		group,
		ground,
		props,
		segment: NaN,
		terrain: null as Terrain | null,
	};
}

const dummy = new Object3D();
const color = new Color();

function fillTile(tile: Tile, kit: Kit, terrain: Terrain, segment: number) {
	tile.segment = segment;
	tile.terrain = terrain;

	const geometry = tile.ground.geometry;
	const position = geometry.attributes.position as BufferAttribute;
	for (let i = 0; i < position.count; i++) {
		const y =
			terrain === 'trail'
				? trailHeight(
						position.getX(i),
						segment * TILE_LENGTH + position.getZ(i)
					)
				: 0;
		position.setY(i, y);
	}
	position.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	tile.ground.material = terrain === 'trail' ? kit.faceted : kit.ground;

	const meshes = Object.values(tile.props);
	for (const mesh of meshes) mesh.count = 0;
	for (const p of scenery(terrain, segment)) {
		const mesh = tile.props[p.kind];
		dummy.position.set(p.x, p.y, p.z);
		dummy.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
		dummy.scale.set(p.w, p.h, p.d);
		dummy.updateMatrix();
		mesh.setMatrixAt(mesh.count, dummy.matrix);
		mesh.setColorAt(mesh.count, color.setHex(p.tone));
		mesh.count++;
	}
	for (const mesh of meshes) {
		mesh.visible = mesh.count > 0;
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		// Cached on first use, so stale once the instances move.
		mesh.computeBoundingSphere();
	}
}

/** Metres of ground one repeat of the grain covers. */
const GRAIN_METRES = 3;

/**
 * Fine grain in the running surface, so the ground itself shows the speed.
 * Tileable, and a whole number of repeats along a tile, so tiles meet
 * without a seam.
 */
function grainTexture() {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const c = canvas.getContext('2d');
	if (c) {
		c.fillStyle = '#fff';
		c.fillRect(0, 0, size, size);
		const r = seededRandom(48271);
		// Each mark is drawn again across every edge it overhangs, so the
		// texture wraps.
		const tiled = (draw: (x: number, y: number) => void) => {
			const x = r() * size;
			const y = r() * size;
			for (const dx of [-size, 0, size]) {
				for (const dy of [-size, 0, size]) draw(x + dx, y + dy);
			}
		};
		// Worn patches, which still read at a distance once the specks blur.
		for (let i = 0; i < 24; i++) {
			const radius = 16 + r() * 40;
			tiled((x, y) => {
				const g = c.createRadialGradient(x, y, 0, x, y, radius);
				g.addColorStop(0, 'rgba(0,0,0,0.1)');
				g.addColorStop(1, 'rgba(0,0,0,0)');
				c.fillStyle = g;
				c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
			});
		}
		for (let i = 0; i < 2200; i++) {
			const v = Math.round(90 + r() * 120);
			const s = 1.5 + r() * 2.5;
			c.fillStyle = `rgb(${v},${v},${v})`;
			tiled((x, y) => c.fillRect(x, y, s, s));
		}
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.repeat.set(TILE_WIDTH / GRAIN_METRES, TILE_LENGTH / GRAIN_METRES);
	texture.anisotropy = 8;
	return texture;
}

/** A lamp's light on the ground: bright in the middle, gone at the edge. */
function poolTexture() {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const c = canvas.getContext('2d');
	if (c) {
		const g = c.createRadialGradient(
			size / 2,
			size / 2,
			0,
			size / 2,
			size / 2,
			size / 2
		);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		c.fillStyle = g;
		c.fillRect(0, 0, size, size);
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}
