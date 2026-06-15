import type { LayoutNode, WallSegment } from '../types';

// House layout: centered on world origin.
// Total extent: x [-12, 12], z [-8, 8]
//
//  n1─────────────n2────n3
//  │   Living Room  │  Kitchen │
//  n4────n5─────n6────n7
//  │  MB  │  Bathroom  │ Office │
//  n8────n9────n10────n11
//
// Living Room : 16 × 8  (large, spans left two thirds of row 1)
// Kitchen     :  8 × 8
// Master Bed  :  8 × 8
// Bathroom    :  8 × 8
// Office      :  8 × 8

export const LAYOUT_NODES: Record<string, LayoutNode> = {
  n1:  { id: 'n1',  x: -12, z: -8 },
  n2:  { id: 'n2',  x:   4, z: -8 },
  n3:  { id: 'n3',  x:  12, z: -8 },
  n4:  { id: 'n4',  x: -12, z:  0 },
  n5:  { id: 'n5',  x:  -4, z:  0 },
  n6:  { id: 'n6',  x:   4, z:  0 },
  n7:  { id: 'n7',  x:  12, z:  0 },
  n8:  { id: 'n8',  x: -12, z:  8 },
  n9:  { id: 'n9',  x:  -4, z:  8 },
  n10: { id: 'n10', x:   4, z:  8 },
  n11: { id: 'n11', x:  12, z:  8 },
};

const H = 3; // wall height (world units)

export const WALL_SEGMENTS: WallSegment[] = [
  // ── Exterior – north (top) ───────────────────────────────────────────
  { id: 'ext-n-lr',  fromId: 'n1',  toId: 'n2',  height: H, sharedBy: ['living-room'] },
  { id: 'ext-n-kt',  fromId: 'n2',  toId: 'n3',  height: H, sharedBy: ['kitchen'] },
  // ── Exterior – east (right) ──────────────────────────────────────────
  { id: 'ext-e-kt',  fromId: 'n3',  toId: 'n7',  height: H, sharedBy: ['kitchen'] },
  { id: 'ext-e-of',  fromId: 'n7',  toId: 'n11', height: H, sharedBy: ['office'] },
  // ── Exterior – south (bottom) ────────────────────────────────────────
  { id: 'ext-s-of',  fromId: 'n11', toId: 'n10', height: H, sharedBy: ['office'] },
  { id: 'ext-s-ba',  fromId: 'n10', toId: 'n9',  height: H, sharedBy: ['bathroom'] },
  { id: 'ext-s-mb',  fromId: 'n9',  toId: 'n8',  height: H, sharedBy: ['master-bedroom'] },
  // ── Exterior – west (left) ───────────────────────────────────────────
  { id: 'ext-w-mb',  fromId: 'n8',  toId: 'n4',  height: H, sharedBy: ['master-bedroom'] },
  { id: 'ext-w-lr',  fromId: 'n4',  toId: 'n1',  height: H, sharedBy: ['living-room'] },
  // ── Interior – vertical dividers ────────────────────────────────────
  { id: 'int-lr-kt', fromId: 'n2',  toId: 'n6',  height: H, sharedBy: ['living-room', 'kitchen'] },
  // ── Interior – horizontal dividers (z = 0 row) ──────────────────────
  { id: 'int-lr-mb', fromId: 'n4',  toId: 'n5',  height: H, sharedBy: ['living-room', 'master-bedroom'] },
  { id: 'int-lr-ba', fromId: 'n5',  toId: 'n6',  height: H, sharedBy: ['living-room', 'bathroom'] },
  { id: 'int-kt-of', fromId: 'n6',  toId: 'n7',  height: H, sharedBy: ['kitchen', 'office'] },
  // ── Interior – vertical dividers in row 2 ───────────────────────────
  { id: 'int-mb-ba', fromId: 'n5',  toId: 'n9',  height: H, sharedBy: ['master-bedroom', 'bathroom'] },
  { id: 'int-ba-of', fromId: 'n6',  toId: 'n10', height: H, sharedBy: ['bathroom', 'office'] },
];
