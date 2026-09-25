'use client';

import { type RefObject, memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { mod, seededRandom } from '@/lib/run-lab/math';
import type { Terrain } from '@/lib/run-lab/types';
import {
	GROUND,
	LINE,
	LINE_FAINT,
	TILE_COUNT,
	TILE_LENGTH,
	TILE_WIDTH,
	WATER,
} from './constants';
import { BufferAttribute, type Group, PlaneGeometry } from 'three';

/**
 * The runner stays at the origin and the world scrolls under it: a few tiles
 * leapfrogging along -Z. Everything a terrain draws is a child of a tile, so
 * it scrolls for free. Hairlines only -- the monochrome frame, in 3D.
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
	const tiles = useRef<(Group | null)[]>([]);
	// One displaced trail surface shared by every tile, released when the
	// terrain changes: a geometry passed as a prop is not one R3F disposes.
	const trailGeometry = useMemo(
		() => (terrain === 'trail' ? buildTrailGeometry() : null),
		[terrain]
	);
	useEffect(() => () => trailGeometry?.dispose(), [trailGeometry]);

	useFrame(() => {
		const offset = offsetRef.current ?? 0;
		const span = TILE_LENGTH * TILE_COUNT;
		tiles.current.forEach((tile, i) => {
			if (!tile) return;
			// Tiles run from one tile behind the runner to well ahead of it; one
			// leaving the back re-enters at the front.
			tile.position.z = mod(i * TILE_LENGTH - offset, span) - TILE_LENGTH;
		});
	});

	return (
		<group>
			{Array.from({ length: TILE_COUNT }, (_, i) => (
				<group
					key={i}
					ref={(el) => {
						tiles.current[i] = el;
					}}
				>
					<Tile terrain={terrain} seed={i} trailGeometry={trailGeometry} />
				</group>
			))}
		</group>
	);
});

function Line({
	x,
	width = 0.03,
	color = LINE,
	length = TILE_LENGTH,
	z = TILE_LENGTH / 2,
}: {
	x: number;
	width?: number;
	color?: string;
	length?: number;
	z?: number;
}) {
	return (
		<mesh position={[x, 0.004, z]} rotation-x={-Math.PI / 2}>
			<planeGeometry args={[width, length]} />
			<meshBasicMaterial color={color} />
		</mesh>
	);
}

/** The trail's ground: low noise, kept nearly flat where the feet land. */
function buildTrailGeometry() {
	const g = new PlaneGeometry(TILE_WIDTH, TILE_LENGTH, 28, 24);
	const pos = g.attributes.position as BufferAttribute;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		// Keep the line the feet run on nearly flat so they never sink in.
		const away = Math.min(1, Math.abs(x) / 1.2);
		// Periodic in the tile's length, so tiles meet without a step.
		const k = (2 * Math.PI) / TILE_LENGTH;
		const h =
			0.05 * Math.sin(x * 1.7 + Math.sin(y * k * 2) * 1.3) +
			0.035 * Math.cos(y * k * 3 + x * 2.3);
		pos.setZ(i, h * (0.15 + 0.85 * away));
	}
	g.computeVertexNormals();
	return g;
}

function Tile({
	terrain,
	seed,
	trailGeometry,
}: {
	terrain: Terrain;
	seed: number;
	trailGeometry: PlaneGeometry | null;
}) {
	const scatter = useMemo(() => {
		const r = seededRandom(seed + 1);
		return Array.from({ length: 16 }, () => ({
			x: (r() - 0.5) * 12,
			z: r() * TILE_LENGTH,
			rot: r() * Math.PI,
			len: 0.2 + r() * 0.5,
			rock: r() > 0.7,
		})).filter((s) => Math.abs(s.x) > 0.7);
	}, [seed]);

	return (
		<group>
			<mesh
				rotation-x={-Math.PI / 2}
				position={[0, 0, TILE_LENGTH / 2]}
				geometry={trailGeometry ?? undefined}
			>
				{!trailGeometry && <planeGeometry args={[TILE_WIDTH, TILE_LENGTH]} />}
				<meshStandardMaterial
					color={GROUND}
					roughness={1}
					flatShading={terrain === 'trail'}
				/>
			</mesh>

			{terrain === 'track' && (
				<>
					{[-1.83, -0.61, 0.61, 1.83].map((x) => (
						<Line key={x} x={x} width={0.05} />
					))}
					<Line x={-3.05} width={0.08} color={LINE_FAINT} />
					<Line x={3.05} width={0.08} color={LINE_FAINT} />
				</>
			)}

			{terrain === 'riverside' && (
				<>
					<Line x={-1.2} />
					<Line x={1.1} />
					{/* The bikeway beside the path, its dashed centre line nearest the camera. */}
					{[0, 3, 6, 9].map((z) => (
						<Line
							key={z}
							x={-2.4}
							length={1.2}
							z={z + 0.6}
							color={LINE_FAINT}
						/>
					))}
					{/* The river on the far side, past a row of lamp posts. */}
					<mesh
						rotation-x={-Math.PI / 2}
						position={[7, 0.003, TILE_LENGTH / 2]}
					>
						<planeGeometry args={[9, TILE_LENGTH]} />
						<meshBasicMaterial color={WATER} />
					</mesh>
					<Line x={2.5} width={0.02} color={LINE} />
					<mesh position={[2.1, 1.6, 2]}>
						<boxGeometry args={[0.05, 3.2, 0.05]} />
						<meshBasicMaterial color={LINE} />
					</mesh>
				</>
			)}

			{terrain === 'trail' &&
				scatter.map((s, i) =>
					s.rock ? (
						<mesh key={i} position={[s.x, 0.04, s.z]} rotation-y={s.rot}>
							<dodecahedronGeometry args={[0.06 + s.len * 0.1, 0]} />
							<meshStandardMaterial color={LINE} roughness={1} flatShading />
						</mesh>
					) : (
						<mesh
							key={i}
							position={[s.x, 0.012, s.z]}
							rotation={[-Math.PI / 2, 0, s.rot]}
						>
							<planeGeometry args={[0.03, s.len]} />
							<meshBasicMaterial color={LINE} />
						</mesh>
					)
				)}

			{(terrain === 'uphill' || terrain === 'downhill') && (
				<>
					<Line x={-1.1} />
					<Line x={1.1} />
					{[1.5, 4.5, 7.5, 10.5].map((z) => (
						<Line
							key={z}
							x={0}
							width={0.6}
							length={0.03}
							z={z}
							color={LINE_FAINT}
						/>
					))}
				</>
			)}
		</group>
	);
}
