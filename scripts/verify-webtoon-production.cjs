/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const cache = new Map(), requests = [];
let response;
const client = { interactions: { create: async input => { requests.push(input); return response(input); } } };
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS} }).outputText,
    {module:mod,exports:mod.exports,crypto:require('node:crypto').webcrypto,structuredClone,process:{env:{GEMINI_API_KEY:'test-only'}},console,
    require(name) { if(name==='server-only')return {}; if(name==='@google/genai') return {GoogleGenAI:class {constructor(){return client;}}};
      if(name.startsWith('@/')) return load('src/'+name.slice(2)+'.ts');
      if(name.startsWith('./')) return load(require('node:path').posix.join(require('node:path').posix.dirname(file),name)+'.ts');
      return require(name); } });
  return mod.exports;
}
const element = {id:'speech',type:'speech',text:'두려워도 물러서지 않겠다. 지금은 모두를 지켜야 해.',x:300,y:100,width:350,height:160,rotation:0,zIndex:1,balloonStyle:'normal'};
async function main(){
  const {balloonTail,balloonMarkup}=load('src/lib/webtoonDecoration.ts');
  const {layoutStoryboardText,overlayOutsideCanvas}=load('src/lib/storyboardText.ts');
  const {BALLOON_STYLES,PANEL_RATIOS,panelDimensions}=load('src/lib/webtoonDesign.ts');
  const {arrangeWebtoonLettering,splitLetteringText}=load('src/lib/webtoonLettering.ts');
  const {editableWebtoonDocument,webtoonFlowLayout}=load('src/lib/webtoonFlow.ts');
  for(const width of [180,400,800]) for(const height of [100,300,700]) for(const [tailX,tailY] of [[-2,.5],[3,.5],[.5,-2],[.5,3],[3,3]]){
    const e={...element,width,height,tailX,tailY}, t=balloonTail(e);
    assert.ok(Math.hypot(t.x-t.edgeX,t.y-t.edgeY)<=32.001,'tail never reaches a distant face');
    const ax=t.cx+Math.cos(t.angle+t.delta)*t.rx, ay=t.cy+Math.sin(t.angle+t.delta)*t.ry;
    const bx=t.cx+Math.cos(t.angle-t.delta)*t.rx, by=t.cy+Math.sin(t.angle-t.delta)*t.ry;
    assert.ok(Math.hypot(ax-bx,ay-by)<=18.1,'wide balloons retain a narrow tail');
  }
  assert.equal(balloonTail({...element,speechRole:'thought'}).enabled,false);
  assert.ok(balloonMarkup({...element,balloonStyle:'whisper',tailVisible:false}).includes('stroke-dasharray'), 'tail-free whisper keeps its quiet voice');
  for(const style of BALLOON_STYLES){const markup=balloonMarkup({...element,balloonStyle:style});assert.ok(!/NaN|undefined/.test(markup));assert.equal(Boolean(markup),style!=='none');}
  const korean='상대가 준비하기 전에 공격해야 한다. 하지만 모두의 안전도 지켜야 한다! '.repeat(12);
  assert.equal(splitLetteringText(korean).join(''),korean,'splitting preserves exact input text');
  for(const ratio of PANEL_RATIOS){
    const source={version:2,aspectRatio:ratio,...panelDimensions(ratio),elements:[{...element,text:korean,placement:'art'},{...element,id:'join',balloonStyle:'connected',text:'안 돼요.\n\n지금 힘을 쓰면 우리의 정체가 드러납니다.',placement:'after'}]};
    const copy=JSON.stringify(source), arranged=arrangeWebtoonLettering(source), layout=webtoonFlowLayout(arranged);
    assert.equal(JSON.stringify(source),copy,'automatic placement does not mutate source');
    assert.equal(layout.overflow,undefined,ratio+' long dialogue remains inside expanded whitespace');
    assert.equal(JSON.stringify(editableWebtoonDocument(arranged)),JSON.stringify(arranged),'reopening is idempotent');
    assert.equal(arranged.elements.filter(e=>e.id.startsWith('speech')).map(e=>e.text).join(''),korean);
    for(const e of arranged.elements){
      assert.ok(e.y+e.height<=layout.art.y+.01||e.y>=layout.art.y+layout.art.height-.01,'speech leaves the art visible');
      assert.ok(!overlayOutsideCanvas(e,layout.document.width,layout.document.height));
      assert.ok(layoutStoryboardText(e,'sans-serif').fontSize>=source.width*35/900-.02,'35px reading-scale text survives');
    }
  }
  const joined=layoutStoryboardText({...element,balloonStyle:'connected',width:500,height:420,text:'안 돼요.\n\n정체가 드러납니다.'},'sans-serif');
  assert.ok(new Set(joined.positions.map(p=>p.x)).size===2,'connected dialogue has distinct lobe centers');
  const {reviewWebtoonLettering}=load('src/lib/webtoonQuality.ts');
  const source={version:2,aspectRatio:'3:4',width:900,height:1200,elements:[{...element,placement:'canvas',y:400}]};
  assert.ok(reviewWebtoonLettering(source,{status:'checked',issues:[],protectedRegions:[{x:.3,y:.1,width:.5,height:.5,label:'얼굴'}]}).some(s=>s.includes('얼굴')));
  const {generateStoryboardLayout,generateSceneImage}=load('src/lib/gemini.ts');
  const direction={beat:'anticipation',acting:'겁을 숨긴 미소',lighting:'눈 주변의 깊은 그림자',effects:'효과 절제',continuity:'오른손의 검',readingPath:'눈에서 검으로'};
  const input={context:{title:'검증',genre:'판타지',setting:'성문',artDirection:{preset:'action-contrast',custom:''}},episode:{number:1,title:'대치',synopsis:'대치',neighbors:'이전 컷: 오른손에 검'},cut:{angle:'클로즈업',description:'겁을 숨긴 대치',dialogue:element.text,soundEffect:'',aspectRatio:'1:4'},characters:[]};
  response=async()=>({output_text:JSON.stringify({backgroundDescription:'성문의 역광',direction,flow:{before:200,after:300,inset:60,align:'right'},elements:[{...element,balloonStyle:'radiant',speechRole:'thought',tailVisible:false,textColor:'#ffffff',balloonFill:'#111111'}]})});
  const storyboard=await generateStoryboardLayout(input);
  assert.equal(storyboard.height,3600);assert.equal(storyboard.direction.acting,direction.acting);assert.equal(storyboard.elements[1].textColor,'#ffffff');
  assert.ok(requests.at(-1).input.includes(input.episode.neighbors));
  response=async request=>request.response_format.schema?.properties?.people?{output_text:JSON.stringify({people:[]})}:request.response_format.type==='image'?{output_image:{data:'test-image',mime_type:'image/jpeg'}}:{output_text:JSON.stringify({issues:[],protectedRegions:[{x:.1,y:.2,width:.2,height:.2,label:'얼굴'}]})};
  const result=await generateSceneImage({...input,storyboard,layoutImage:{data:'reference',mimeType:'image/png'},references:[],stage:'finish',revision:'그림자를 더 깊게'});
  assert.equal(result.review.status,'checked');assert.equal(result.review.issues.length,0);
  const imageRequest=requests.findLast(r=>r.response_format.type==='image');
  assert.equal(imageRequest.response_format.aspect_ratio,'1:4');assert.equal(imageRequest.response_format.image_size,'2K');
  assert.ok(result.prompt.includes(direction.lighting));assert.ok(result.prompt.includes('그림자를 더 깊게'));
  response=async request=>{if(request.response_format.type==='image')return {output_image:{data:'preserved',mime_type:'image/jpeg'}};throw Error('review offline');};
  const preserved=await generateSceneImage({...input,storyboard,layoutImage:{data:'reference',mimeType:'image/png'},references:[],stage:'finish'});
  assert.equal(preserved.data,'preserved');assert.equal(preserved.review.status,'unavailable');
  console.log('PASS: narrow short tails, 11 styles, Korean text preservation, all 7 panel ratios, automatic whitespace, idempotent reopening, connected text and protected-region checks');
  console.log('PASS: mocked AI direction/style persistence, neighboring context, tall native output, natural-language revision, image review and review-failure preservation');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
