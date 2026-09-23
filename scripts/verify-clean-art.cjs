/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const cache = new Map(), requests = [], blobs = [], drawn = [], cropRequests = [];
const httpRequests = [], assetReads = [];
const assets = new Map();
let layoutResponse;
const detectedRig = {
  head:{x:.5,y:.12},neck:{x:.5,y:.23},leftShoulder:{x:.38,y:.29},leftElbow:{x:.29,y:.46},leftHand:{x:.25,y:.63},
  rightShoulder:{x:.62,y:.29},rightElbow:{x:.71,y:.46},rightHand:{x:.75,y:.63},leftHip:{x:.44,y:.56},rightHip:{x:.56,y:.56},
  leftKnee:{x:.42,y:.76},leftFoot:{x:.38,y:.95},rightKnee:{x:.58,y:.76},rightFoot:{x:.62,y:.95},
};
const context = new Proxy({}, { get: (_, key) => key === "measureText" ? text => ({ width: [...text].length * 20 }) : key === "createLinearGradient" ? (...args) => { drawn.push([key, ...args]); return { addColorStop: (...stop) => drawn.push(["addColorStop", ...stop]) }; } : (...args) => drawn.push([key,...args]), set: (_, key, value) => { drawn.push(["set", key, value]); return true; } });
const browser = { document: { fonts: { ready: Promise.resolve() }, createElement: () => ({ getContext: () => context, toBlob: callback => callback(new Blob(["canvas"], { type: "image/png" })) }) } };
class FakeImage { naturalWidth = 900; naturalHeight = 1600; set src(value) { queueMicrotask(() => this.onload()); } }
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module: mod, exports: mod.exports, structuredClone, Blob, Image: FakeImage, crypto: require("node:crypto").webcrypto,
    fetch: async (url, options) => { const body = JSON.parse(options.body); httpRequests.push(body); return { ok: true, json: async () => body.action === "detect-character-rig" ? { characterRig: detectedRig } : ({ data: "mock", mimeType: "image/png", prompt: "mock" }) }; },
    window: browser, document: browser.document, process: { env: { GEMINI_API_KEY: "mock-only" } },
    URL: { createObjectURL: blob => { blobs.push(blob); return "blob:test"; }, revokeObjectURL: () => {} },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@google/genai") return { GoogleGenAI: class { interactions = { create: async input => { if (input.response_format?.schema?.properties?.people) { const text = input.input.find(item => item.type === "text").text; const count = Number(text.match(/Expected foreground figures: (\d+)/)?.[1] ?? 0); return { output_text: JSON.stringify({ people: Array.from({ length: count }, (_, i) => ({ label: "인물" + i, bodyPlan: "human", visibleHands: 2, visibleArms: 2, limbTrace: "양손이 각각 팔과 어깨로 연결됩니다.", verdict: "pass", issues: [] })) }) }; } if (input.response_format?.schema?.properties?.protectedRegions) return { output_text: JSON.stringify({ issues: [], protectedRegions: [] }) }; requests.push(input); return layoutResponse ? { output_text: JSON.stringify(layoutResponse) } : { output_image: { data: "mock", mime_type: "image/jpeg" } }; } }; } };
      if (name === "@/lib/mediaStorage") return {
        sourceHash: JSON.stringify, getMediaAsset: async id => { assetReads.push(id); return assets.get(id) ?? null; },
        blobToBase64: async () => "canvas", base64ToBlob: () => new Blob(["mock"], { type: "image/png" }), cropImageBlob: async (blob, crop) => { cropRequests.push(crop); return blob; },
      };
      if (name === "@/lib/panelGeometry") return { ...load("src/lib/panelGeometry.ts"), validatePanelImage: async () => {} };
      if (name.startsWith("@/")) return load("src/"+name.slice(2)+".ts");
      return require(name);
    },
  });
  return mod.exports;
}
const base = (id,type,text) => ({ id,type,text,x:0,y:0,width:300,height:200,rotation:0,zIndex:0,visible:true });
async function main() {
  const clean = load("src/lib/cleanGeneration.ts"), typography = load("src/lib/storyboardText.ts"), svg = load("src/lib/storyboardSvg.ts");
  const doc = { version:2,width:900,height:1600,aspectRatio:"9:16",elements:[
    {...base("bg","background","배경라벨"),width:900,height:1600},
    base("prop","prop","robot"), base("speech","speech","비밀대사"),base("shape","shape","가이드비밀"),
    base("arrow","arrow","동선비밀"),base("sfx","sfx","효과음비밀"),
  ]};
  const before = JSON.stringify(doc);
  assert.deepEqual(Array.from(clean.artworkOnlyStoryboard(doc).elements, e=>e.id),["bg","prop"]);
  const blank = clean.layerReferenceSvg(doc,"bg");
  assert.ok(!blank.includes("<text") && !blank.includes("stroke="));
  for(const secret of ["비밀대사","가이드비밀","동선비밀","배경라벨"]) assert.ok(!blank.includes(secret));
  const hero = {...base("hero","character","캐릭터라벨"),width:300,height:600};
  const pose = clean.layerReferenceSvg({...doc,elements:[hero,...doc.elements]},"hero");
  assert.ok(pose.includes("<line") && !pose.includes("<text") && !pose.includes("캐릭터라벨"));
  assert.throws(()=>clean.layerReferenceSvg(doc,"speech"),/생성 가능한/);
  const composite = load("src/lib/storyboardComposite.ts");
  await assert.rejects(composite.composeStoryboardPng({...doc,elements:[{...doc.elements[0],assetId:"missing"}]}, {includeOverlays:false,strictAssets:true}), /파일이 누락/);
  const scene = load("src/lib/gemini.ts");
  const input = { context:{title:"test",genre:"SF",setting:"학교",artDirection:{preset:"clean-webtoon",custom:""}}, episode:{number:1,title:"test",synopsis:"robot"},cut:{description:"robot",angle:"미디엄샷",dialogue:"비밀대사",soundEffect:"효과음비밀",aspectRatio:"9:16"},storyboard:doc,layoutImage:{data:"clean",mimeType:"image/png"},references:[] };
  await scene.generateSceneImage(input);
  let prompt = requests[0].input.find(item=>item.type==="text").text;
  for(const secret of ["비밀대사","가이드비밀","동선비밀","효과음비밀","RESERVED TYPOGRAPHY"]) assert.ok(!prompt.includes(secret));
  assert.ok(prompt.includes("ENTIRE canvas") && prompt.includes("empty balloons"));
  assert.ok(prompt.includes("PUBLICATION-READY FINISH") && prompt.includes("cast shadows") && prompt.includes("scene-appropriate finishing details"));
  await scene.generateStoryboardLayer({...input,layerId:"bg"});
  prompt = requests[1].input.find(item=>item.type==="text").text;
  assert.ok(prompt.includes("clean empty canvas"));
  assert.ok(prompt.includes("ENVIRONMENT ART") && prompt.includes("blank cutout holes"));
  assert.equal(JSON.stringify(doc),before);
  const { sceneHash, storyboardLayerHash } = load("src/lib/visualClient.ts");
  const project = { title:"test",genre:"SF",story:{setting:"학교"},world:{},artDirection:input.context.artDirection,characters:[] };
  const ep = { episodeNumber:1,title:"test",synopsis:"robot" }, cut={...input.cut,characterIds:[],storyboard:doc};
  const hash = sceneHash(project,ep,cut);
  const edited = structuredClone(cut);
  edited.dialogue = "새 대사"; edited.soundEffect="쾅"; edited.storyboard.elements[2].text="새 글자";
  edited.storyboard.elements[3].x=250;
  assert.equal(sceneHash(project,ep,edited),hash,"overlay/guide edits must not regenerate artwork");
  edited.storyboard.elements[1].x=123;
  assert.notEqual(sceneHash(project,ep,edited),hash);
  assert.notEqual(storyboardLayerHash(project,ep,cut,"prop"),storyboardLayerHash(project,ep,{...cut,storyboard:{...doc,elements:doc.elements.map(e=>e.id==="prop"?{...e,width:500}:e)}},"prop"));
  // Multiple dirty/missing layers go through ONE scene request, never layer generation.
  const directCut = structuredClone(cut);
  directCut.storyboard.elements[0].assetId = "edited-background";
  const originalRaster = new Blob(["original storyboard raster"], { type: "image/png" });
  assets.set("edited-background", { blob: originalRaster, mimeType: "image/png" });
  directCut.storyboard.elements[0].assetSourceHash = "old";
  directCut.storyboard.elements[0].text = "비 오는 도서관";
  directCut.storyboard.elements[1].text = "붉은 우산";
  const directBefore = JSON.stringify(directCut);
  assetReads.length = 0;
  const client = load("src/lib/visualClient.ts");
  const missingPersonCut = { ...directCut, storyboard: { ...directCut.storyboard, elements: [...directCut.storyboard.elements, hero] } };
  await assert.rejects(client.requestSceneImage(project, ep, missingPersonCut, "direct"), /인물 스케치가 없습니다/);
  hero.assetId = "lost-person-file";
  await assert.rejects(client.requestSceneImage(project, ep, missingPersonCut, "direct"), /인물 스케치가 없습니다/);
  delete hero.assetId;
  assert.equal(httpRequests.length, 0, "missing person never starts paid scene generation");
  const directResult = await client.requestSceneImage(project, ep, directCut, "direct");
  assert.equal(httpRequests.length, 1);
  assert.equal(httpRequests[0].action, "scene-image");
  assert.equal(httpRequests[0].referenceMode, "direct");
  assert.equal(httpRequests[0].storyboard.elements.length, 2);
  assert.equal(httpRequests[0].storyboard.elements[0].text, "비 오는 도서관");
  assert.equal(httpRequests[0].storyboard.elements[1].text, "붉은 우산");
  assert.ok(assetReads.includes("edited-background") && blobs.includes(originalRaster), "edited raster still enters full composition");
  assert.equal(httpRequests[0].structureImage.mimeType, "image/png");
  const selectedInEditor = { id: "editor-person", name: "편집기 선택 인물", role: "주연", age: "17", appearance: "단발머리", personality: "차분함", backstory: "", visualProfile: {}, imageAssetId: "editor-person-sheet", imageSourceHash: "sheet-v1" };
  assets.set("editor-person-sheet", { blob: new Blob(["character sheet"], { type: "image/png" }), mimeType: "image/png" });
  const editorSelectedCut = { ...directCut, characterIds: [], storyboard: { ...directCut.storyboard, elements: [...directCut.storyboard.elements, { ...hero, characterId: selectedInEditor.id }] } };
  const editorProject = { ...project, characters: [selectedInEditor] };
  const editorReferenceHash = sceneHash(editorProject, ep, editorSelectedCut);
  await client.requestSceneImage(editorProject, ep, editorSelectedCut, "direct", "sketch");
  assert.equal(httpRequests.at(-1).references.length, 1, "character chosen inside the storyboard editor must be sent even when the cut checkbox list is stale");
  assert.equal(httpRequests.at(-1).references[0].character.id, selectedInEditor.id);
  assert.notEqual(editorReferenceHash, sceneHash({ ...editorProject, characters: [{ ...selectedInEditor, imageSourceHash: "sheet-v2" }] }, ep, editorSelectedCut), "editor-selected character sheet changes must stale the scene");
  const svgInputs = await Promise.all(blobs.filter(blob => blob.type.startsWith("image/svg")).map(blob => blob.text()));
  assert.ok(svgInputs.some(value => value.includes('width="300" height="200"') && value.includes('translate(0 0)')), "missing prop has geometry instead of disappearing");
  const rigModule = load("src/lib/storyboardRig.ts");
  const exactRig = rigModule.resolveCharacterRig(hero);
  const rasterHero = { ...hero, assetId: "actual-upper-body-sketch" };
  assert.equal(Object.keys(rigModule.sceneCharacterRig(rasterHero)).length, 0, "legacy/default full-body rig must not override existing upper-body artwork");
  assert.ok(!clean.sceneStructureSvg({ ...doc, elements: [rasterHero] }).includes("<line"));
  assert.equal(Object.keys(rigModule.sceneCharacterRig({ ...rasterHero, poseControlEdited: true })).length, 14, "explicit user edits remain effective");
  const collapsedRig = { ...exactRig, leftHip: { x: .56, y: 1 }, leftKnee: { x: .56, y: 1 }, leftFoot: { x: .56, y: 1 } };
  const collapsedElement = { ...hero, characterRig: collapsedRig };
  const safeRig = rigModule.sceneCharacterRig(collapsedElement);
  assert.equal(safeRig.leftHip, undefined);
  assert.equal(safeRig.leftKnee, undefined);
  assert.equal(safeRig.leftFoot, undefined);
  assert.deepEqual(safeRig.head, exactRig.head);
  assert.deepEqual(collapsedElement.characterRig, collapsedRig, "never rewrite saved user joints");
  for (const preset of rigModule.CHARACTER_POSE_PRESETS) {
    assert.equal(Object.keys(rigModule.sceneCharacterRig({ ...hero, characterRig: preset.rig })).length, 14);
  }
  const measured = await client.requestSceneCharacterRigs(new Blob(["whole scene"], { type: "image/jpeg" }), { ...doc, elements: [{ ...hero, id: "measured", x: 100, y: 200, rotation: 12, flipX: true }] });
  assert.equal(Object.keys(measured.measured).length, 14);
  assert.equal(httpRequests.at(-1).action, "detect-character-rig");
  assert.ok(cropRequests.at(-1).x > 0 && cropRequests.at(-1).width < 1, "pose detection crops the character region from the whole scene");
  const structureHero = { ...hero, x: 123, y: 456, rotation: 17, flipX: true, characterRig: { ...exactRig, head: { x: .2, y: .3 } } };
  const geometry = clean.sceneStructureSvg({ ...doc, elements: [...doc.elements, structureHero, { ...hero, id: "hidden", visible: false }] });
  assert.ok(geometry.includes("translate(123 456) rotate(17 150 300)"));
  assert.ok(geometry.includes('cx="240" cy="180"'), "joint image uses exact local coordinates and mirroring without padding");
  for (const secret of ["비밀대사", "가이드비밀", "동선비밀", "효과음비밀", "<text"]) assert.ok(!geometry.includes(secret));
  assert.equal(directResult.sourceHash, sceneHash(project, ep, directCut));
  assert.equal(JSON.stringify(directCut), directBefore);
  const beforeStrictRequest = httpRequests.length;
  await assert.rejects(client.requestSceneImage(project, ep, directCut), /레이어를 먼저/);
  assert.equal(httpRequests.length, beforeStrictRequest, "strict mode remains guarded without an API call");
  const callsBefore = requests.length;
  await scene.generateSceneImage({ ...input, referenceMode: "direct", storyboard: directCut.storyboard, structureImage: { data: "geometry-map", mimeType: "image/png" } });
  assert.equal(requests.length, callsBefore + 1, "one model call for combined changes");
  const directPrompt = requests.at(-1).input.find(item => item.type === "text").text;
  assert.ok(directPrompt.includes("SINGLE image generation") && directPrompt.includes("STRUCTURAL CONTROL MAP"));
  assert.ok(!directPrompt.includes("PARTIAL canvas") && !directPrompt.includes("apply the described pose inside"));
  assert.ok(directPrompt.includes("Neither prose nor character-sheet poses may move these coordinates"));
  assert.equal(requests.at(-1).input.filter(item => item.type === "image").length, 2);
  assert.equal(requests.at(-1).input[1].data, "geometry-map");
  const reference = { character: { id: "person", name: "주인공", role: "주연", visualProfile: {} }, data: "sheet", mimeType: "image/png", heroData: "hero-crop", heroMimeType: "image/png" };
  const beforePerson = requests.length;
  const personResult = await scene.generateStoryboardLayer({ ...input, layerId: hero.id, storyboard: { ...doc, elements: [{ ...hero, characterId: "person" }] }, references: [reference] });
  assert.equal(requests.length, beforePerson + 1, "drawing success must not depend on a second pose-analysis call");
  assert.equal(personResult.data, "mock");
  assert.equal(personResult.characterRig, undefined, "do not overwrite creator joints with inferred cropped joints");
  assert.ok(personResult.prompt.includes("Do not center, enlarge or shrink"));
  assert.ok(personResult.prompt.includes("#00FF00") && personResult.prompt.includes("opaque grayscale"));
  await scene.generateSceneImage({ ...input, referenceMode: "direct", storyboard: { ...doc, elements: [...doc.elements, { ...structureHero, characterId: "person" }] }, structureImage: { data: "geometry-map", mimeType: "image/png" }, references: [reference] });
  const withCharacter = requests.at(-1);
  assert.equal(withCharacter.input.filter(item => item.type === "image").map(item => item.data).join(","), "clean,geometry-map,sheet,hero-crop");
  assert.ok(withCharacter.input.find(item => item.type === "text").text.includes("REFERENCE IMAGES 3 and 4"));
  assert.ok(sceneHash(project, ep, cut).includes(clean.SCENE_REFERENCE_VERSION), "old scene candidates are invalidated independently of layer hashes");
  assert.ok(directPrompt.includes("비 오는 도서관") && directPrompt.includes("붉은 우산"));
  assert.ok(!directPrompt.includes("비밀대사") && !directPrompt.includes("가이드비밀"));
  console.log("PASS: single scene request with full edited raster + SVG geometry image, missing-art placeholders, exact mirrored/rotated pose, overlay exclusion, geometry priority and strict-mode compatibility (mock)");
  // Regression from supplied SVG: x=510, width=390 touches right edge.
  const speech = {...base("speech","speech","...하은아, 전진 좌표가 아니라 좌측 회전 각도가 최대로 들어가 있어."),x:510,y:95,width:390,height:216};
  const fitted = typography.fitOverlayToCanvas(speech,900,1600);
  assert.ok(fitted.x+fitted.width<=888);
  assert.equal(speech.x,510,"saved source must remain untouched");
  for (const rotation of [-175,-90,-37,0,37,90,175]) {
    const element=typography.fitOverlayToCanvas({...speech,x:-200,y:1500,width:1000,height:600,rotation,tailX:2,tailY:-1},900,1600);
    const rad=rotation*Math.PI/180;
    const tail = load("src/lib/webtoonDecoration.ts").balloonTail(element);
    for (const [x,y] of [[0,0],[element.width,0],[0,element.height],[element.width,element.height],[tail.x,tail.y]]) {
      const dx=x-element.width/2,dy=y-element.height/2;
      const px=element.x+element.width/2+dx*Math.cos(rad)-dy*Math.sin(rad),py=element.y+element.height/2+dx*Math.sin(rad)+dy*Math.cos(rad);
      assert.ok(px>=11.99&&px<=888.01&&py>=11.99&&py<=1588.01,"rotated balloon/tail must fit");
    }
  }
  for(const type of ["speech","caption","sfx"]) {
    const element={...speech,type,text:Array(16).fill("대사내용").join("\n")};
    const layout = typography.layoutStoryboardText(element,"sans-serif");
    assert.equal(layout.lines.join("").replace(/\s/g,""),element.text.replace(/\s/g,""),"never truncate text");
    assert.ok(layout.lines.length>10);
    assert.ok(layout.lines.length*layout.lineHeight<=layout.availableHeight+.01);
    assert.ok(layout.widths.every(width=>width<=layout.availableWidth));
    assert.ok(layout.tooSmall);
  }
  // Canvas exports shapes without raster-SVG text, then paints the text with loaded fonts.
  await svg.drawStoryboardOverlays(context,{...doc,elements:[speech]});
  assert.ok(!(await blobs.at(-1).text()).includes("<text"));
  assert.ok(drawn.some(call=>call[0]==="fillText"));
  const overlay=svg.storyboardToSvg({...doc,elements:[speech]}, {overlaysOnly:true,transparent:true});
  assert.ok(overlay.includes("textLength="));
  assert.ok(!overlay.includes("가이드비밀"));
  const decoration = load("src/lib/webtoonDecoration.ts");
  const styled = { ...speech, textColor: "#112233", textGradient: true, textGradientColor: "#ff0066", textGradientAngle: 45, textStrokeColor: "#eeeeff", textStrokeWidth: 7, balloonFill: "#ffeecc", balloonStroke: "#334455", balloonStrokeWidth: 6 };
  const markup = svg.storyboardToSvg({ ...doc, elements: [styled] }, { overlaysOnly: true, transparent: true });
  for (const token of ["linearGradient", "#112233", "#ff0066", "#eeeeff", "#ffeecc", "#334455", 'stroke-width="7"', 'paint-order="stroke fill"']) assert.ok(markup.includes(token), token);
  assert.ok(decoration.balloonMarkup(styled).includes(" A "), "smooth joined balloon and tail");
  const shapes = ["normal", "thought", "shout", "whisper", "rounded", "none"].map(balloonStyle => decoration.balloonMarkup({ ...styled, balloonStyle }));
  assert.equal(new Set(shapes).size, 6);
  assert.equal(shapes.at(-1), "");
  assert.ok(shapes[1].includes("<circle") && shapes[1].includes(" Q "));
  assert.ok(shapes[3].includes("stroke-dasharray"));
  assert.ok(shapes[4].includes("<rect"));
  const hostile = decoration.balloonMarkup({ ...styled, balloonFill: '"><script>bad</script>' });
  assert.ok(!hostile.includes("<script>"));
  drawn.length = 0;
  await svg.drawStoryboardOverlays(context, { ...doc, elements: [styled] });
  assert.ok(drawn.some(call => call[0] === "createLinearGradient"));
  assert.ok(drawn.some(call => call[0] === "addColorStop" && call[2] === "#ff0066"));
  assert.ok(drawn.some(call => call[0] === "strokeText"));
  assert.ok(drawn.some(call => call[0] === "set" && call[1] === "strokeStyle" && call[2] === "#eeeeff"));
  const restyledCut = structuredClone(cut);
  Object.assign(restyledCut.storyboard.elements[2], styled);
  assert.equal(sceneHash(project, ep, restyledCut), sceneHash(project, ep, cut), "styling does not require paid image regeneration");
  console.log("PASS: six balloon shapes, sanitized paint, SVG and Canvas gradient/outline parity, typography-only hash stability");
  const brief = "학교 작업실, 눈높이 2점 투시. 전경 책상, 중경 선반과 창문, 원경 문. 왼쪽 오후 햇빛과 옅은 명암.";
  layoutResponse = { backgroundDescription: brief, elements: [base("prop", "prop", "robot")] };
  const layout = await scene.generateStoryboardLayout({ ...input, characters: [] });
  assert.equal(layout.elements[0].text, brief);
  assert.equal(layout.elements[0].width, layout.width);
  assert.equal(layout.elements[0].height, layout.height);
  assert.ok(requests.at(-1).response_format.schema.required.includes("backgroundDescription"));
  assert.ok(requests.at(-1).input.includes("World setting: 학교"));
  layoutResponse = { elements: [base("prop", "prop", "robot")] };
  const fallback = await scene.generateStoryboardLayout({ ...input, characters: [] });
  assert.ok(fallback.elements[0].text.includes("학교") && fallback.elements[0].text.includes("robot"));
  layoutResponse = undefined;
  console.log("PASS: concrete environment brief, full-canvas background, world context and legacy layout fallback (mock)");
  const { removeExteriorWhite } = load("src/lib/backgroundRemoval.ts");
  const { removeGreenScreen } = load("src/lib/backgroundRemoval.ts");
  const keyed = new Uint8ClampedArray([
    0,255,0,255, 255,255,255,255, 0,0,0,255, 128,255,128,255,
    0,128,0,255, 160,160,160,255, 0,255,0,0, 255,255,255,100,
  ]);
  removeGreenScreen(keyed, 4, 2);
  assert.equal(keyed[3], 0);
  assert.equal(keyed[7], 255, "white skin/hair is opaque even without a closed outline");
  assert.equal(keyed[11], 255);
  assert.equal(keyed[12], 255, "unmix green from white edge");
  assert.ok(keyed[15] >= 127 && keyed[15] <= 129);
  assert.equal(keyed[16], 0, "unmix green from dark edge");
  assert.equal(keyed[23], 255);
  assert.equal(keyed[27], 0);
  assert.equal(keyed[31], 100);
  const invalidScreen = new Uint8ClampedArray(16).fill(255);
  const invalidBefore = invalidScreen.slice();
  assert.throws(() => removeGreenScreen(invalidScreen, 2, 2), /녹색 화면/);
  assert.deepEqual(invalidScreen, invalidBefore, "invalid matte never erases white artwork");
  console.log("PASS: raster-first pose, explicit-only joint controls, chroma matte with white/gray preservation and edge decontamination");
  const pixels = new Uint8ClampedArray(9 * 9 * 4).fill(255);
  for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) {
    if (x === 2 || x === 6 || y === 2 || y === 6) pixels.set([30, 30, 30, 255], (y * 9 + x) * 4);
  }
  pixels.set([255, 230, 220, 255], 4);
  pixels.set([240, 240, 240, 100], 8);
  removeExteriorWhite(pixels, 9, 9);
  assert.equal(pixels[3], 0, "exterior white removed");
  assert.equal(pixels[(4 * 9 + 4) * 4 + 3], 255, "enclosed skin/clothing white retained");
  assert.equal(pixels[(2 * 9 + 2) * 4 + 3], 255, "dark contour retained");
  assert.equal(pixels[7], 255, "colored pixels retained");
  assert.ok(pixels[11] <= 100, "existing alpha never increases");
  console.log("PASS: enclosed white preserved, border-connected white removed, contour/color/alpha preserved; missing-person gate; single-call character generation");
  // Whole-scene sketches replace independently pasted art, while typography stays local.
  const coherent = { ...missingPersonCut, storyboard: { ...missingPersonCut.storyboard, sceneSketchAssetId: "whole-scene" } };
  assets.set("whole-scene", { blob: new Blob(["whole scene artwork"], { type: "image/png" }) });
  assetReads.length = 0;
  const composedBefore = drawn.filter(call => call[0] === "drawImage").length;
  await composite.composeStoryboardPng(coherent.storyboard, { includeOverlays: false, strictAssets: true });
  assert.equal(drawn.filter(call => call[0] === "drawImage").length - composedBefore, 1);
  assert.deepEqual(assetReads, ["whole-scene"], "do not paste old per-object raster pieces over a whole scene");
  await assert.rejects(composite.composeStoryboardPng({ ...coherent.storyboard, sceneSketchAssetId: "lost-scene" }), /장면 스케치 파일/);
  const coherentHash = sceneHash(project, ep, coherent);
  const readingEdit = structuredClone(coherent);
  readingEdit.storyboard.flow = { before: 700, after: 1200, inset: 180, align: "right" };
  readingEdit.storyboard.elements = readingEdit.storyboard.elements.map(e => e.type === "speech" ? { ...e, placement: "before", flowOrder: 42, flowSpacing: 600, text: "독백 수정" } : e);
  assert.equal(sceneHash(project, ep, readingEdit), coherentHash, "whitespace and lettering never stale the artwork");
  let httpCount = httpRequests.length;
  await client.requestSceneImage(project, ep, coherent);
  assert.equal(httpRequests.length, httpCount + 1);
  assert.equal(httpRequests.at(-1).stage, "finish");
  assert.equal(httpRequests.at(-1).storyboard.sceneSketchAssetId, "whole-scene");
  httpCount = httpRequests.length;
  await client.requestSceneImage(project, ep, missingPersonCut, "direct", "sketch");
  assert.equal(httpRequests.length, httpCount + 1, "first scene sketch does not require independent people rasters");
  assert.equal(httpRequests.at(-1).stage, "sketch");
  layoutResponse = undefined;
  await scene.generateSceneImage({ ...input, stage: "sketch", referenceMode: "direct" });
  const sketchPrompt = requests.at(-1).input.find(item => item.type === "text").text;
  assert.ok(sketchPrompt.includes("STORYBOARD PEN-LINE STAGE") && sketchPrompt.includes("monochrome"));
  assert.ok(sketchPrompt.includes("LINE ART ONLY") && sketchPrompt.includes("Do NOT add flat color") && sketchPrompt.includes("White paper and monochrome lines only"));
  assert.ok(sketchPrompt.includes("IDENTITY references only") && sketchPrompt.includes("sole pose authority"));
  assert.ok(!sketchPrompt.includes("FINISH the complete"));
  const verbalPose = { ...hero, assetId: "existing-person", pose: "두 손으로 노트북을 들기", poseDescriptionEdited: true };
  await scene.generateSceneImage({ ...input, storyboard: { ...coherent.storyboard, elements: [verbalPose] } });
  assert.ok(requests.at(-1).input.find(item => item.type === "text").text.includes("REQUESTED POSE CHANGE: 두 손으로 노트북을 들기"));
  assert.ok(!clean.sceneStructureSvg({ ...doc, elements: [verbalPose] }).includes("<line"));
  const sceneModel = requests.at(-1).model;
  await scene.generateCharacterSheet(input.context, { id: "hero", name: "hero", role: "main", age: "20", appearance: "black hair", personality: "calm", backstory: "", visualProfile: {} });
  assert.equal(requests.at(-1).model, sceneModel, "character sheets and scene art use the same image model");
  layoutResponse = { backgroundDescription: "교실의 창문과 책상, 빛", flow: { before: -10, after: 4000, inset: 800, align: "right" }, elements: [
    { ...base("narration", "caption", "속으로 생각한다"), placement: "top-edge", balloonStyle: "none", flowOrder: 2, flowSpacing: 180 },
  ] };
  const flowProposal = await scene.generateStoryboardLayout({ ...input, characters: [] });
  assert.equal(flowProposal.flow.before, 0); assert.equal(flowProposal.flow.after, 4000);
  assert.equal(flowProposal.flow.inset, 315); assert.equal(flowProposal.flow.align, "right");
  assert.equal(flowProposal.elements[1].placement, "top-edge");
  assert.equal(flowProposal.elements[1].balloonStyle, "none");
  assert.equal(flowProposal.elements[1].flowSpacing, 180);
  layoutResponse = undefined;
  const editorSource = fs.readFileSync("src/components/visual/StoryboardEditor.tsx", "utf8");
  assert.ok(editorSource.includes("{backgroundLayer && <section"), "background direction remains visible after a whole-scene sketch exists");
  assert.ok(!editorSource.includes("backgroundLayer && !document.sceneSketchAssetId && <section"));
  assert.ok(editorSource.includes("배경 연출 정보") && editorSource.includes("스케치에 포즈 좌표 맞추기") && editorSource.includes("AI 마무리 작화 생성"));
  console.log("PASS: single whole-scene raster, first-sketch and finish requests, AI flow proposal, caption styles and AI-free whitespace edits (mock)");
  if (process.argv.includes("--preview")) {
    const styles = ["normal", "thought", "shout", "whisper", "rounded", "none"];
    const labels = ["Hello!", "Dream...", "BOOM!", "Shh...", "Monologue", "LOVE"];
    const gallery = { ...doc, width: 900, height: 900, elements: styles.map((balloonStyle, i) => ({
      ...styled, id: "preview-" + i, balloonStyle, text: labels[i], x: 35 + i % 2 * 450, y: 25 + Math.floor(i / 2) * 290,
      width: 380, height: 190, fontSize: 48, textStrokeWidth: i === 2 ? 3 : 0,
      textColor: i === 4 ? "#ffffff" : "#be185d", textGradient: i === 2 || i === 5,
      textGradientColor: "#fbbf24", balloonFill: i === 4 ? "#172554" : "#fff1f2",
      balloonStroke: i === 4 ? "#60a5fa" : "#be185d", balloonStrokeWidth: 3,
    })) };
    await require("sharp")(Buffer.from(svg.storyboardToSvg(gallery))).png().toFile(".next/webtoon-style-preview.png");
    console.log("Preview: .next/webtoon-style-preview.png");
  }
  const revisedJpeg = new Blob(["jpeg"], { type: "image/jpeg" });
  await load("src/lib/visualClient.ts").requestSceneImage(project, ep, cut, "direct", "finish", "그림자를 깊게", revisedJpeg);
  assert.equal(httpRequests.at(-1).layoutImage.mimeType, "image/jpeg", "revision preserves reference MIME type");
  assert.equal(httpRequests.at(-1).revision, "그림자를 깊게");
  console.log("PASS: clean references, server prompt isolation, immutable data, art-only hashes, font layout/no truncation, safe margins and PNG text rendering (mock AI/canvas)");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
