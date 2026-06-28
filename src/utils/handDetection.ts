/**
 * Utility functions for hand landmark calculations and gesture detection
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureResult {
  isPeaceSign: boolean;
  confidence: number;
  details: {
    indexExtended: boolean;
    middleExtended: boolean;
    ringCurled: boolean;
    pinkyCurled: boolean;
    vSeparated: boolean;
    indexRatio: number;
    middleRatio: number;
    ringRatio: number;
    pinkyRatio: number;
    tipDistance: number;
    mcpDistance: number;
  };
}

// Distance between two 3D landmarks
export function getDistance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Detects if the hand landmarks form a "peace sign" (V-sign)
 * 
 * Rules for a peace sign:
 * 1. Index finger is extended (straight)
 * 2. Middle finger is extended (straight)
 * 3. Ring finger is curled/folded
 * 4. Pinky finger is curled/folded
 * 5. Index and Middle finger are spread apart (forming a V-shape)
 */
export function detectPeaceSign(landmarks: Landmark[]): GestureResult {
  if (!landmarks || landmarks.length < 21) {
    return {
      isPeaceSign: false,
      confidence: 0,
      details: {
        indexExtended: false,
        middleExtended: false,
        ringCurled: false,
        pinkyCurled: false,
        vSeparated: false,
        indexRatio: 0,
        middleRatio: 0,
        ringRatio: 0,
        pinkyRatio: 0,
        tipDistance: 0,
        mcpDistance: 0,
      }
    };
  }

  // 1. Calculate finger ratios (TIP-to-MCP distance / PIP-to-MCP distance)
  // When straight, the ratio is high (~1.8 - 2.5) because TIP is far from MCP.
  // When curled, the ratio is low (< 1.1) because TIP is close to MCP.
  
  // Index Finger: MCP (5), PIP (6), TIP (8)
  const index_mcp = landmarks[5];
  const index_pip = landmarks[6];
  const index_tip = landmarks[8];
  const indexRatio = getDistance(index_tip, index_mcp) / Math.max(0.001, getDistance(index_pip, index_mcp));

  // Middle Finger: MCP (9), PIP (10), TIP (12)
  const middle_mcp = landmarks[9];
  const middle_pip = landmarks[10];
  const middle_tip = landmarks[12];
  const middleRatio = getDistance(middle_tip, middle_mcp) / Math.max(0.001, getDistance(middle_pip, middle_mcp));

  // Ring Finger: MCP (13), PIP (14), TIP (16)
  const ring_mcp = landmarks[13];
  const ring_pip = landmarks[14];
  const ring_tip = landmarks[16];
  const ringRatio = getDistance(ring_tip, ring_mcp) / Math.max(0.001, getDistance(ring_pip, ring_mcp));

  // Pinky Finger: MCP (17), PIP (18), TIP (20)
  const pinky_mcp = landmarks[17];
  const pinky_pip = landmarks[18];
  const pinky_tip = landmarks[20];
  const pinkyRatio = getDistance(pinky_tip, pinky_mcp) / Math.max(0.001, getDistance(pinky_pip, pinky_mcp));

  // Define thresholds
  const EXTENDED_THRESHOLD = 1.35;
  const CURLED_THRESHOLD = 1.15;

  const indexExtended = indexRatio > EXTENDED_THRESHOLD;
  const middleExtended = middleRatio > EXTENDED_THRESHOLD;
  const ringCurled = ringRatio < CURLED_THRESHOLD;
  const pinkyCurled = pinkyRatio < CURLED_THRESHOLD;

  // 2. Check V-Separation (Index TIP and Middle TIP are spread apart)
  // We compare the TIP distance with the MCP distance. In a peace sign, the TIPS are spread out wide.
  const tipDistance = getDistance(index_tip, middle_tip);
  const mcpDistance = getDistance(index_mcp, middle_mcp);
  
  // Palm width to normalize distances (MCP 5 to MCP 17)
  const palmWidth = getDistance(landmarks[5], landmarks[17]);
  
  // V-separation check: distance between tips is significantly wider than between base MCPs
  // and is a significant fraction of the palm width.
  const vSeparated = tipDistance > mcpDistance * 1.4 && tipDistance > palmWidth * 0.35;

  // Calculate a match confidence score [0, 1]
  let matchCount = 0;
  if (indexExtended) matchCount++;
  if (middleExtended) matchCount++;
  if (ringCurled) matchCount++;
  if (pinkyCurled) matchCount++;
  if (vSeparated) matchCount++;

  const confidence = matchCount / 5;
  const isPeaceSign = confidence >= 0.8; // require 4 out of 5 checks to pass

  return {
    isPeaceSign,
    confidence,
    details: {
      indexExtended,
      middleExtended,
      ringCurled,
      pinkyCurled,
      vSeparated,
      indexRatio,
      middleRatio,
      ringRatio,
      pinkyRatio,
      tipDistance,
      mcpDistance,
    }
  };
}
