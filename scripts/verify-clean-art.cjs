/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const cache = new Map(), requests = [], blobs = [], drawn = [];
const httpRequests = [], assetReads = [];
const context = new Proxy({}, { get: (_, key) => key === "measureText" ? text => ({ width: [...text].length * 20 }) : key === "createLinearGradient" ? (...args) => { drawn.push([key, ...args]); return { addColorStop: (...stop) => drawn.push(["addColorStop", ...stop]) }; } : (...args) => drawn.push([key,...args]), set: (_, key, value) => { drawn.push(["set", key, value]); return true; } });
const browser = { document: { fonts: { ready: Promise.resolve() }, createElement: () => ({ getContext: () => context, toBlob: callback => callback(new Blob(["canvas"], { type: "image/png" })) }) } };
class FakeImage { set src(value) { queueMicrotask(() => this.onload()); } }
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module: mod, exports: mod.exports, structuredClone, Blob, Image: FakeImage,
    fetch: async (url, options) => { httpRequests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ data: "mock", mimeType: "image/png", prompt: "mock" }) }; },
    window: browser, document: browser.document, process: { env: { GEMINI_API_KEY: "mock-only" } },
    URL: { createObjectURL: blob => { blobs.push(blob); return "blob:test"; }, revokeObjectURL: () => {} },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@google/genai") return { GoogleGenAI: class { interactions = { create: async input => { requests.push(input); return { output_image: { data: "mock", mime_type: "image/jpeg" } }; } }; } };
      if (name === "@/lib/mediaStorage") return {
        sourceHash: JSON.stringify, getMediaAsset: async id => { assetReads.push(id); return null; },
        blobToBase64: async () => "canvas", base64ToBlob: () => new Blob(["mock"], { type: "image/png" }),
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
  await scene.generateStoryboardLayer({...input,layerId:"bg"});
  prompt = requests[1].input.find(item=>item.type==="text").text;
  assert.ok(prompt.includes("clean empty canvas"));
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
  directCut.storyboard.elements[0].assetId = "legacy-polluted";
  directCut.storyboard.elements[0].assetSourceHash = "old";
  directCut.storyboard.elements[0].text = "비 오는 도서관";
  directCut.storyboard.elements[1].text = "붉은 우산";
  const directBefore = JSON.stringify(directCut);
  assetReads.length = 0;
  const client = load("src/lib/visualClient.ts");
  const directResult = await client.requestSceneImage(project, ep, directCut, "direct");
  assert.equal(httpRequests.length, 1);
  assert.equal(httpRequests[0].action, "scene-image");
  assert.equal(httpRequests[0].referenceMode, "direct");
  assert.equal(httpRequests[0].storyboard.elements.length, 2);
  assert.equal(httpRequests[0].storyboard.elements[0].text, "비 오는 도서관");
  assert.equal(httpRequests[0].storyboard.elements[1].text, "붉은 우산");
  assert.ok(!assetReads.includes("legacy-polluted"), "stale raster never enters AI reference");
  assert.equal(directResult.sourceHash, sceneHash(project, ep, directCut));
  assert.equal(JSON.stringify(directCut), directBefore);
  await assert.rejects(client.requestSceneImage(project, ep, directCut), /레이어를 먼저/);
  assert.equal(httpRequests.length, 1, "strict mode remains guarded without an API call");
  const callsBefore = requests.length;
  await scene.generateSceneImage({ ...input, referenceMode: "direct", storyboard: directCut.storyboard });
  assert.equal(requests.length, callsBefore + 1, "one model call for combined changes");
  const directPrompt = requests.at(-1).input.find(item => item.type === "text").text;
  assert.ok(directPrompt.includes("SINGLE image generation") && directPrompt.includes("PARTIAL canvas"));
  assert.ok(directPrompt.includes("비 오는 도서관") && directPrompt.includes("붉은 우산"));
  assert.ok(!directPrompt.includes("비밀대사") && !directPrompt.includes("가이드비밀"));
  console.log("PASS: combined changes use one scene API/model request, stale raster exclusion, full current contract, source hash and strict-mode compatibility (mock)");
  // Regression from supplied SVG: x=510, width=390 touches right edge.
  const speech = {...base("speech","speech","...하은아, 전진 좌표가 아니라 좌측 회전 각도가 최대로 들어가 있어."),x:510,y:95,width:390,height:216};
  const fitted = typography.fitOverlayToCanvas(speech,900,1600);
  assert.ok(fitted.x+fitted.width<=888);
  assert.equal(speech.x,510,"saved source must remain untouched");
  for (const rotation of [-175,-90,-37,0,37,90,175]) {
    const element=typography.fitOverlayToCanvas({...speech,x:-200,y:1500,width:1000,height:600,rotation,tailX:2,tailY:-1},900,1600);
    const rad=rotation*Math.PI/180;
    for (const [x,y] of [[0,0],[element.width,0],[0,element.height],[element.width,element.height],[element.tailX*element.width,element.tailY*element.height]]) {
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
  console.log("PASS: clean references, server prompt isolation, immutable data, art-only hashes, font layout/no truncation, safe margins and PNG text rendering (mock AI/canvas)");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
