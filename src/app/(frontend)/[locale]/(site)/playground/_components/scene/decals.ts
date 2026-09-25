import type { DecalId } from '@/lib/run-lab/kit';
import { seededRandom } from '@/lib/run-lab/math';
import { CanvasTexture, SRGBColorSpace } from 'three';

// The kit's prints, painted once into canvases and shared by every rig. The
// wordmark is set in the site's own face, read off the body, so it re-paints
// when web fonts finish loading.

const cache = new Map<DecalId, CanvasTexture>();

function fontFamily() {
	return getComputedStyle(document.body).fontFamily || 'sans-serif';
}

const PAINTERS: Record<
	DecalId,
	{
		size: [number, number];
		paint: (c: CanvasRenderingContext2D, w: number, h: number) => void;
	}
> = {
	blkwtr: {
		size: [512, 128],
		paint(c, w, h) {
			c.fillStyle = '#f2f2f2';
			c.font = `400 ${h * 0.72}px ${fontFamily()}`;
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.letterSpacing = `${h * 0.06}px`;
			c.fillText('BLKWTR', w / 2, h / 2 + h * 0.03);
		},
	},
	nb: {
		size: [256, 140],
		paint(c, w, h) {
			c.fillStyle = '#f2f2f2';
			c.font = `italic 900 ${h * 0.8}px Arial, Helvetica, sans-serif`;
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.fillText('NB', w / 2, h / 2 + h * 0.04);
			// The mark's speed lines, cut through the letters.
			c.globalCompositeOperation = 'destination-out';
			for (let i = 1; i < 5; i++)
				c.fillRect(0, (h * i) / 5 - h * 0.025, w * 0.45, h * 0.05);
			c.globalCompositeOperation = 'source-over';
		},
	},
	hoole: {
		size: [256, 256],
		paint(c, w) {
			// Jesse Hoole's circle: a rough, re-drawn ring with a wave through it.
			const r = seededRandom(7);
			c.strokeStyle = 'rgba(242,242,242,0.85)';
			c.lineCap = 'round';
			const cx = w / 2;
			for (let pass = 0; pass < 5; pass++) {
				c.lineWidth = 3 + r() * 5;
				c.beginPath();
				for (let a = 0; a <= Math.PI * 2 + 0.2; a += 0.12) {
					const rad = w * 0.36 + (r() - 0.5) * w * 0.05;
					const x = cx + Math.cos(a) * rad;
					const y = cx + Math.sin(a) * rad;
					if (a === 0) c.moveTo(x, y);
					else c.lineTo(x, y);
				}
				c.stroke();
			}
			c.lineWidth = 6;
			c.beginPath();
			for (let t = 0; t <= 1; t += 0.05) {
				const x = cx - w * 0.2 + t * w * 0.4 + (r() - 0.5) * 4;
				const y = cx + Math.sin(t * Math.PI * 2) * w * 0.12 + (r() - 0.5) * 4;
				if (t === 0) c.moveTo(x, y);
				else c.lineTo(x, y);
			}
			c.stroke();
		},
	},
	n: {
		size: [256, 150],
		paint(c, w, h) {
			// The shoe's side N: a slanted, outlined letter in a darker grey.
			c.save();
			c.translate(w / 2, h / 2);
			c.transform(1, 0, -0.35, 1, 0, 0);
			c.font = `900 ${h * 0.95}px Arial, Helvetica, sans-serif`;
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.fillStyle = '#9d9d9b';
			c.fillText('N', 0, h * 0.04);
			c.lineWidth = 6;
			c.strokeStyle = '#b8b8b6';
			c.strokeText('N', 0, h * 0.04);
			c.restore();
		},
	},
};

export function decalTexture(id: DecalId): CanvasTexture {
	const hit = cache.get(id);
	if (hit) return hit;
	const { size, paint } = PAINTERS[id];
	const canvas = document.createElement('canvas');
	[canvas.width, canvas.height] = size;
	const draw = () => {
		const c = canvas.getContext('2d');
		if (!c) return;
		c.clearRect(0, 0, canvas.width, canvas.height);
		paint(c, canvas.width, canvas.height);
	};
	draw();
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 4;
	document.fonts?.ready.then(() => {
		draw();
		texture.needsUpdate = true;
	});
	cache.set(id, texture);
	return texture;
}
