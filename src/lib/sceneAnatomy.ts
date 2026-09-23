import { z } from "zod";
import type { SceneAnatomyReview } from "@/lib/storage";

export const anatomySchema = z.object({ people: z.array(z.object({
  label: z.string().min(1).max(150), bodyPlan: z.enum(["human", "nonhuman"]),
  visibleHands: z.number().int().min(0).max(16), visibleArms: z.number().int().min(0).max(16),
  limbTrace: z.string().min(10).max(1800), verdict: z.enum(["pass", "fail", "uncertain"]),
  issues: z.array(z.string().min(1).max(500)).max(12),
})).max(32) });

export const ANATOMY_JSON_SCHEMA = {
  type: "object", properties: { people: { type: "array", items: {
    type: "object", properties: {
      label: { type: "string" }, bodyPlan: { type: "string", enum: ["human", "nonhuman"] },
      visibleHands: { type: "integer" }, visibleArms: { type: "integer" },
      limbTrace: { type: "string" }, verdict: { type: "string", enum: ["pass", "fail", "uncertain"] },
      issues: { type: "array", items: { type: "string" } },
    }, required: ["label", "bodyPlan", "visibleHands", "visibleArms", "limbTrace", "verdict", "issues"],
  } } }, required: ["people"],
} as const;

export function anatomyPrompt(scene: string, expectedPeople: number): string {
  return "Perform an independent anatomy audit of ONLY the attached final image. Do not assume generation succeeded. Inspect all people individually, including bodies at the canvas edges, behind frames or occluders. Expected foreground figures: " + expectedPeople + ". Scene context: " + scene + ".\n"
    + "For EACH person, inventory every visible hand and every distinct arm, including partially visible sleeves, wrists, and detached hands at an edge. In limbTrace, locate EACH hand in screen coordinates in words and trace wrist -> forearm -> elbow -> upper arm -> shoulder -> SAME torso. Then report visibleHands and visibleArms based on that inventory, never the expected number. Crossed arms may hide a hand: count arm chains independently. A raised old hand left behind after the same person gains crossed arms is an extra limb, even when only two hands are fully visible. Do not excuse it as another person, reflection, motion trail or fantasy anatomy without actual visual/contextual evidence.\n"
    + "Ordinary human bodies have at most two arms and two hands. bodyPlan nonhuman is allowed only for a clearly intentional nonhuman design supported by the scene, never to excuse an accidental extra limb. Check duplicated/fused/disconnected limbs, impossible shoulder attachment, inconsistent hand ownership, malformed finger topology and impossible object contact. Also check extra heads/legs. Occluded/off-frame limbs are normal; do not demand all limbs or all five fingers be visible. Foreshortening and stylization alone are not defects. If a plausible limb chain cannot be established, verdict uncertain; do not guess pass. Label each person by screen location and appearance. Report evidence and issues in Korean. An empty people array is allowed ONLY when no people are visible. Ignore editable captions/lettering; this pass checks body anatomy only.";
}

export function parseAnatomyReview(value: unknown, expectedPeople: number): SceneAnatomyReview {
  const { people } = anatomySchema.parse(value);
  const issues: string[] = [];
  let failed = false, uncertain = expectedPeople > 0 && people.length !== expectedPeople;
  if (uncertain) issues.push("콘티의 인원수와 검수한 인원수가 일치하지 않아 신체 구조 판정을 보류했습니다.");
  for (const person of people) {
    const extra = person.bodyPlan === "human" && (person.visibleHands > 2 || person.visibleArms > 2);
    if (extra) issues.push(person.label + ": 손 " + person.visibleHands + "개, 팔 " + person.visibleArms + "개로 신체가 중복됩니다.");
    if (extra || person.verdict === "fail" || person.issues.length) {
      failed = true;
      issues.push(...person.issues.map(issue => person.label + ": " + issue));
      if (!extra && !person.issues.length) issues.push(person.label + ": " + person.limbTrace);
    }
    if (person.verdict === "uncertain") { uncertain = true; issues.push(person.label + ": 손·팔의 연결 구조를 확정하지 못했습니다."); }
  }
  return { status: failed ? "fail" : uncertain ? "uncertain" : "pass", issues: [...new Set(issues)], people };
}
