import type { CharacterRig, StoryboardElement } from "@/lib/storage";

export type CharacterPosePreset = {
  id: "stand" | "talk" | "point" | "run" | "sit" | "crouch";
  label: string;
  rig: CharacterRig;
};

const STAND: CharacterRig = {
  head: { x: 0.5, y: 0.12 }, neck: { x: 0.5, y: 0.23 },
  leftShoulder: { x: 0.38, y: 0.29 }, leftElbow: { x: 0.29, y: 0.46 }, leftHand: { x: 0.25, y: 0.63 },
  rightShoulder: { x: 0.62, y: 0.29 }, rightElbow: { x: 0.71, y: 0.46 }, rightHand: { x: 0.75, y: 0.63 },
  leftHip: { x: 0.44, y: 0.56 }, rightHip: { x: 0.56, y: 0.56 },
  leftKnee: { x: 0.42, y: 0.76 }, leftFoot: { x: 0.38, y: 0.95 },
  rightKnee: { x: 0.58, y: 0.76 }, rightFoot: { x: 0.62, y: 0.95 },
};

function rig(overrides: Partial<CharacterRig>): CharacterRig {
  return { ...structuredClone(STAND), ...overrides };
}

export const CHARACTER_POSE_PRESETS: CharacterPosePreset[] = [
  { id: "stand", label: "서기", rig: STAND },
  { id: "talk", label: "대화", rig: rig({ leftElbow: { x: 0.25, y: 0.4 }, leftHand: { x: 0.4, y: 0.34 }, rightElbow: { x: 0.76, y: 0.42 }, rightHand: { x: 0.67, y: 0.52 } }) },
  { id: "point", label: "가리키기", rig: rig({ rightElbow: { x: 0.78, y: 0.31 }, rightHand: { x: 0.98, y: 0.27 }, leftElbow: { x: 0.34, y: 0.45 }, leftHand: { x: 0.42, y: 0.55 } }) },
  { id: "run", label: "달리기", rig: rig({ head: { x: 0.57, y: 0.13 }, neck: { x: 0.54, y: 0.24 }, leftShoulder: { x: 0.43, y: 0.3 }, rightShoulder: { x: 0.65, y: 0.27 }, leftElbow: { x: 0.28, y: 0.37 }, leftHand: { x: 0.2, y: 0.27 }, rightElbow: { x: 0.77, y: 0.4 }, rightHand: { x: 0.67, y: 0.5 }, leftHip: { x: 0.47, y: 0.56 }, rightHip: { x: 0.6, y: 0.54 }, leftKnee: { x: 0.32, y: 0.7 }, leftFoot: { x: 0.14, y: 0.79 }, rightKnee: { x: 0.72, y: 0.73 }, rightFoot: { x: 0.85, y: 0.93 } }) },
  { id: "sit", label: "앉기", rig: rig({ head: { x: 0.5, y: 0.16 }, neck: { x: 0.5, y: 0.28 }, leftShoulder: { x: 0.38, y: 0.34 }, rightShoulder: { x: 0.62, y: 0.34 }, leftElbow: { x: 0.31, y: 0.5 }, leftHand: { x: 0.44, y: 0.6 }, rightElbow: { x: 0.69, y: 0.5 }, rightHand: { x: 0.56, y: 0.6 }, leftHip: { x: 0.43, y: 0.61 }, rightHip: { x: 0.57, y: 0.61 }, leftKnee: { x: 0.3, y: 0.72 }, leftFoot: { x: 0.27, y: 0.92 }, rightKnee: { x: 0.7, y: 0.72 }, rightFoot: { x: 0.73, y: 0.92 } }) },
  { id: "crouch", label: "웅크리기", rig: rig({ head: { x: 0.57, y: 0.24 }, neck: { x: 0.52, y: 0.34 }, leftShoulder: { x: 0.4, y: 0.37 }, rightShoulder: { x: 0.63, y: 0.35 }, leftElbow: { x: 0.28, y: 0.52 }, leftHand: { x: 0.4, y: 0.63 }, rightElbow: { x: 0.73, y: 0.49 }, rightHand: { x: 0.62, y: 0.62 }, leftHip: { x: 0.43, y: 0.61 }, rightHip: { x: 0.58, y: 0.6 }, leftKnee: { x: 0.25, y: 0.72 }, leftFoot: { x: 0.16, y: 0.9 }, rightKnee: { x: 0.72, y: 0.72 }, rightFoot: { x: 0.83, y: 0.9 } }) },
];

export function resolveCharacterRig(element: StoryboardElement): CharacterRig {
  if (element.characterRig) return element.characterRig;
  const pose = (element.pose ?? "").toLowerCase();
  const preset = pose.includes("달리") || pose.includes("뛰") ? "run"
    : pose.includes("앉") ? "sit"
      : pose.includes("웅크") || pose.includes("숙") ? "crouch"
        : pose.includes("가리") || pose.includes("뻗") ? "point"
          : pose.includes("대화") || pose.includes("말") ? "talk"
            : "stand";
  return structuredClone(CHARACTER_POSE_PRESETS.find((item) => item.id === preset)?.rig ?? STAND);
}

/** Cropped-image analysis can collapse an entire leg onto the image edge.
 * Do not turn those unknown joints into hard scene-generation constraints.
 * The saved rig stays untouched and remains editable.
 */
export function sceneCharacterRig(element: StoryboardElement): Partial<CharacterRig> {
  const rig = { ...resolveCharacterRig(element) };
  const result: Partial<CharacterRig> = { ...rig };
  for (const side of ["left", "right"] as const) {
    const hip = rig[`${side}Hip`], knee = rig[`${side}Knee`], foot = rig[`${side}Foot`];
    const length = Math.hypot(hip.x - knee.x, hip.y - knee.y) + Math.hypot(knee.x - foot.x, knee.y - foot.y);
    if (length < 0.04) {
      delete result[`${side}Hip`];
      delete result[`${side}Knee`];
      delete result[`${side}Foot`];
    }
  }
  return result;
}
