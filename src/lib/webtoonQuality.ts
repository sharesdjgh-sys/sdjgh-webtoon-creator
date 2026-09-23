import type { SceneReview, StoryboardDocument, StoryboardElement } from "@/lib/storage";
import { webtoonFlowLayout } from "@/lib/webtoonFlow";
import { layoutStoryboardText } from "@/lib/storyboardText";
import { defaultWebtoonFont, webtoonFontStack } from "@/lib/storyboardSvg";
import { balloonTail } from "@/lib/webtoonDecoration";
const bounds = (e: StoryboardElement) => {
  const a = e.rotation * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = e.width * c + e.height * s, h = e.width * s + e.height * c;
  return { x: e.x + (e.width - w) / 2, y: e.y + (e.height - h) / 2, width: w, height: h };
};
const overlaps = (a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) =>
  Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>4 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>4;
/** Geometric checks complement the optional AI image review; no claim of visual certainty. */
export function reviewWebtoonLettering(source: StoryboardDocument, review?: SceneReview): string[] {
  const layout = webtoonFlowLayout(source), notes: string[] = [];
  const items = layout.document.elements.filter(e => e.visible !== false && ["speech","caption","sfx"].includes(e.type));
  if (layout.overflow) notes.push(layout.overflow);
  for (const [index, item] of items.entries()) {
    const text = layoutStoryboardText(item, webtoonFontStack(item.fontFamily ?? defaultWebtoonFont(item.type)));
    if (item.text.trim() && text.fontSize * 390 / source.width < 12) notes.push("“"+item.text.trim().slice(0,14)+"”의 글자가 작은 화면에서 작게 보입니다. 여백 자동 배치로 대사를 나눌 수 있습니다.");
    if (item.type !== "sfx" && items.slice(index+1).some(other => other.type !== "sfx" && overlaps(bounds(item), bounds(other)))) notes.push("서로 겹치는 대사·자막이 있습니다. 읽는 순서를 확인해주세요.");
    for (const region of review?.protectedRegions ?? []) {
      const protectedBox = { x: layout.art.x + region.x * layout.art.width, y: layout.art.y + region.y * layout.art.height, width: region.width * layout.art.width, height: region.height * layout.art.height };
      const tail = balloonTail(item), a = item.rotation * Math.PI/180;
      const dx = tail.x-item.width/2, dy = tail.y-item.height/2;
      const tip = { x: item.x+item.width/2+dx*Math.cos(a)-dy*Math.sin(a)-4, y: item.y+item.height/2+dx*Math.sin(a)+dy*Math.cos(a)-4, width:8,height:8 };
      if (overlaps(bounds(item),protectedBox) || tail.enabled && overlaps(tip,protectedBox)) { notes.push("“"+item.text.slice(0,12)+"”가 "+region.label+" 영역과 겹칩니다. 여백으로 옮기는 것을 권합니다."); break; }
    }
  }
  return [...new Set(notes)];
}
