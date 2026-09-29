/**
 * The official logo inside documents (V60: the official file, never recoloured). The logo files are plain SVG paths
 * (`public/brand/direct-logo*.svg`); react-pdf and PowerPoint cannot place an SVG file as it is, so its paths are read
 * here and drawn as vector paths with their own fills. Anything but paths is refused, so a new logo file that needs
 * more is noticed instead of drawn wrong.
 */
export interface LogoPaths {
  viewBox: { x: number; y: number; width: number; height: number };
  paths: { d: string; fill: string; fillRule: 'nonzero' | 'evenodd' }[];
}

const DRAWING = /<(?:path|rect|circle|ellipse|line|polyline|polygon|text|image|use|g)\b[^>]*>/g;

export function parseLogoSvg(svg: string): LogoPaths {
  const vb = /viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/.exec(svg);
  if (!vb) throw new Error('logo: the SVG has no viewBox');
  const paths: LogoPaths['paths'] = [];
  for (const m of svg.matchAll(DRAWING)) {
    const tag = m[0];
    if (!tag.startsWith('<path')) throw new Error(`logo: only paths are supported, found ${tag.slice(0, 12)}…`);
    const d = /\sd="([^"]+)"/.exec(tag)?.[1];
    const fill = /\sfill="([^"]+)"/.exec(tag)?.[1];
    if (!d || !fill) throw new Error('logo: a path without d or fill');
    const rule = /\sfill-rule="(evenodd|nonzero)"/.exec(tag)?.[1];
    paths.push({ d, fill, fillRule: rule === 'evenodd' ? 'evenodd' : 'nonzero' });
  }
  if (!paths.length) throw new Error('logo: the SVG has no paths');
  return {
    viewBox: { x: Number(vb[1]), y: Number(vb[2]), width: Number(vb[3]), height: Number(vb[4]) },
    paths,
  };
}
