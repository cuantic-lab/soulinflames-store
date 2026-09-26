import * as THREE from './vendor/three.module.js';

const host = document.getElementById('studio');
const fallback = document.getElementById('product-fallback');
const status = document.getElementById('viewer-status');
const motionButton = document.getElementById('motion-toggle');
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
let moving = !reduceQuery.matches;
let visible = true;
let targetRotation = -.13, rotation = -.13, lastInteraction = performance.now();
let targetTilt = 0, tilt = 0, pointer = null;
let renderer;

// A real, open garment shell: independent front/back panels joined at the
// shoulders, hollow sleeve tubes, an open collar and an open lower hem.
function gridGeometry(columns, rows, point) {
  const positions=[], uvs=[], indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const u=col/columns,v=row/rows,p=point(u,v);positions.push(...p);uvs.push(u,v);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,d,a,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
const clamp=THREE.MathUtils.clamp;
function panelPoint(u,v,front) {
  const n=u*2-1, x0=n*.94, ax=Math.abs(x0);
  const neck=Math.sqrt(Math.max(0,1-Math.pow(x0/.32,2)));
  const top=ax<.32?1.21-(front?.16:-.018)*neck:1.21-(ax-.32)*.25/.62;
  const hem=-1.35+.015*Math.cos(n*5)+.009*Math.sin(n*13);
  const y=hem+(top-hem)*v;
  const width=1+.015*Math.sin(v*Math.PI)-.018*Math.sin(v*2.7);
  let x=x0*(1+(width-1)*(1-Math.abs(n)));
  const arm=clamp((y-.30)/.66,0,1);
  const edgeDepth=y>.30?.23*Math.sqrt(Math.max(0,1-Math.pow((y-.63)/.33,2))):0;
  const section=Math.pow(Math.max(0,1-n*n),.48);
  const centerDepth=.26+.012*Math.cos(y*2);
  let z=centerDepth*section+edgeDepth*Math.pow(Math.abs(n),8);
  const topDepth=ax<.32?.20*neck:0;
  const shoulderBlend=Math.pow(clamp((v-.80)/.20,0,1),2)*(1-Math.pow(Math.abs(n),5));
  z=z*(1-shoulderBlend)+topDepth*shoulderBlend;
  // Draped folds: irregular, low-amplitude vertical folds and tension creases.
  const seamFade=Math.sin(Math.PI*u), topFade=Math.sin(Math.PI*v);
  const folds=(.048*Math.sin(x0*12+y*.75)+.018*Math.sin(x0*23-y*1.8+.5))*topFade;
  const diagonal=.019*Math.sin(y*18+ax*11)*Math.exp(-Math.pow((y-.43)/.6,2))*Math.pow(Math.abs(n),3);
  z+=(folds+diagonal)*seamFade;
  x+=.008*Math.sin(y*5+n)*topFade*seamFade;
  return [x,y,(front?1:-1)*z];
}
function sleevePoint(side,u,v){
  const theta=u*Math.PI*2;
  const x=side*(.94+v*.51);
  const cy=.63-v*.30,ry=.33-v*.065,rz=.23+v*.012;
  const wave=.013*Math.sin(v*12+theta*3)*Math.sin(Math.PI*v);
  return [x+side*.017*Math.sin(theta)*Math.sin(Math.PI*v),cy+(ry+wave)*Math.cos(theta), (rz+wave)*Math.sin(theta)];
}
function makeWeave(){
  const size=256,data=new Uint8Array(size*size*4);let seed=12345;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(seed*1664525+1013904223)>>>0;
    const n=seed/4294967296,thread=Math.sin(x*Math.PI)*.1+Math.cos((x+(y%4<2?0:2))*Math.PI/2)*Math.cos(y*Math.PI/2);
    const value=clamp(126+thread*21+(n-.5)*21,0,255),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,size,size);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(15,18);map.needsUpdate=true;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;return map;
}
const clothGLSL=`
uniform float uTime;
uniform float uMotion;
varying vec3 vClothPosition;
vec3 displaceCloth(vec3 p){
 float loose=pow(clamp((1.16-p.y)/2.51,0.,1.),1.6);
 float sleeve=smoothstep(.82,1.45,abs(p.x))*.5;
 float strength=(loose+ sleeve)*uMotion;
 p.z += strength*(.017*sin(p.x*3.8+uTime*.95)+.009*sin(p.y*5.-uTime*1.18+p.x*2.));
 p.x += strength*.009*sin(uTime*.73+p.y*2.2);
 p.y += strength*.007*sin(uTime*.83+p.x*3.);
 return p;
}`;
const time={value:0}, motion={value:moving?1:0};
function animateMaterial(material,{logos=false,emblem,wordmark}={}){
 material.onBeforeCompile=shader=>{
   shader.uniforms.uTime=time;shader.uniforms.uMotion=motion;
   shader.vertexShader=clothGLSL+'\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClothPosition = position;\ntransformed=displaceCloth(transformed);');
   if(logos){
    shader.uniforms.emblem={value:emblem};shader.uniforms.wordmark={value:wordmark};
    shader.fragmentShader='uniform sampler2D emblem;\nuniform sampler2D wordmark;\nvarying vec3 vClothPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 euv=vec2(vClothPosition.x/.55+.5,(vClothPosition.y-.55)/.55+.5);
      vec2 wuv=vec2(-vClothPosition.x/1.38+.5,(vClothPosition.y-.75)/.55+.5);
      float ink=0.;
      if(vClothPosition.z>.10 && euv.x>0. && euv.x<1. && euv.y>0. && euv.y<1.) ink=1.-texture2D(emblem,euv).r;
      if(vClothPosition.z<-.10 && wuv.x>0. && wuv.x<1. && wuv.y>0. && wuv.y<1.) ink=1.-texture2D(wordmark,wuv).r;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.87),smoothstep(.08,.9,ink));`);
   }
 };
 material.customProgramCacheKey=()=>logos?'cloth-logo-v1':'cloth-v1';
 return material;
}
async function start(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
 renderer.setClearColor(0x070707,0);host.prepend(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Interactive 3D Faith tee');renderer.domElement.setAttribute('role','img');
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(32,1,.1,40);
 camera.position.set(0,.1,6.4);camera.lookAt(0,-.12,0);
 const garment=new THREE.Group();scene.add(garment);
 const loader=new THREE.TextureLoader();const [emblem,wordmark]=await Promise.all([loader.loadAsync('assets/emblem-source.png'),loader.loadAsync('assets/wordmark.png')]);
 emblem.anisotropy=wordmark.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const weave=makeWeave();weave.anisotropy=4;
 const cloth=animateMaterial(new THREE.MeshPhysicalMaterial({color:0x171719,roughness:.93,metalness:0,sheen:.30,sheenColor:new THREE.Color(0x9b9b9b),sheenRoughness:.85,bumpMap:weave,bumpScale:.0019,side:THREE.DoubleSide}),{logos:true,emblem,wordmark});
 const plain=animateMaterial(new THREE.MeshPhysicalMaterial({color:0x151517,roughness:.95,metalness:0,sheen:.25,sheenColor:new THREE.Color(0x999999),bumpMap:weave,bumpScale:.002,side:THREE.DoubleSide}));
 const depth=animateMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}));
 function add(geometry,material){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;garment.add(mesh);return mesh;}
 add(gridGeometry(96,90,(u,v)=>panelPoint(u,v,true)),cloth);
 const backGeo=gridGeometry(96,90,(u,v)=>panelPoint(1-u,v,false));add(backGeo,cloth);
 for(const side of [-1,1]){
  add(gridGeometry(80,35,(u,v)=>sleevePoint(side,side===1?u:1-u,v)),plain);
  // Narrow sleeve hems, modeled as a folded material band rather than a decal.
  add(gridGeometry(80,5,(u,v)=>{const p=sleevePoint(side,u,.966+v*.034);p[1]+=.004*Math.cos(u*Math.PI*2);p[2]+=.004*Math.sin(u*Math.PI*2);return p;}),plain);
 }
 const collar=gridGeometry(128,10,(u,v)=>{const a=u*Math.PI*2,c=Math.cos(a),s=Math.sin(a);return [(.32+v*.009)*s,1.21-(c>0?.16*c:.018*c)+v*.060,(.20+v*.009)*c];});add(collar,plain);
 // Ribbed collar stitches follow the open neckline.
 const rib=gridGeometry(256,5,(u,v)=>{const a=u*Math.PI*2,c=Math.cos(a),s=Math.sin(a),r=.002*Math.cos(u*256*Math.PI);return[(.323+v*.006+r)*s,1.21-(c>0?.16*c:.018*c)+v*.055,(.203+v*.006+r)*c];});add(rib,plain);
 for(const front of [true,false])add(gridGeometry(96,5,(u,v)=>{const p=panelPoint(front?u:1-u,.012+v*.015,front);p[2]+=(front?1:-1)*.003;return p;}),plain);
 const hemi=new THREE.HemisphereLight(0xc6c9d1,0x272523,1.35);scene.add(hemi);
 const key=new THREE.SpotLight(0xfff8ec,52,20,.56,.90,1.8);key.position.set(-2.5,4.8,3);key.target.position.set(0,0,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0003;key.shadow.normalBias=.012;key.shadow.radius=8;key.shadow.blurSamples=16;scene.add(key,key.target);
 const rim=new THREE.DirectionalLight(0xedefff,2.9);rim.position.set(3,2.4,-2.7);scene.add(rim);
 const soft=new THREE.DirectionalLight(0xf0f0f0,1.0);soft.position.set(-3,.6,1.5);scene.add(soft);
 const backlight=new THREE.DirectionalLight(0xeeeeee,1.0);backlight.position.set(0,2,-4);scene.add(backlight);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({color:0x000000,opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.72;floor.receiveShadow=true;scene.add(floor);
 let width=0,height=0;
 function resize(){width=host.clientWidth;height=host.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.position.z=width/height<.8?8.7:6.1;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(host);resize();
 function setSide(side){targetRotation=Math.round(rotation/(Math.PI*2))*Math.PI*2+(side==='back'?Math.PI:0);lastInteraction=performance.now();}
 document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setSide(button.dataset.view)));
 host.addEventListener('pointerdown',event=>{if(event.button!==0&&event.pointerType==='mouse')return;pointer={x:event.clientX,y:event.clientY,rotation:targetRotation,tilt:targetTilt};host.setPointerCapture(event.pointerId);host.classList.add('dragging');lastInteraction=performance.now();});
 host.addEventListener('pointermove',event=>{if(!pointer)return;targetRotation=pointer.rotation+(event.clientX-pointer.x)*.010;targetTilt=clamp(pointer.tilt+(event.clientY-pointer.y)*.0025,-.2,.2);lastInteraction=performance.now();});
 const up=()=>{pointer=null;host.classList.remove('dragging');};host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('lostpointercapture',up);
 host.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();targetRotation=event.key==='Home'?0:targetRotation+(event.key==='ArrowLeft'?-.3:.3);lastInteraction=performance.now();}});
 let elapsed=0,last=performance.now();
 const frame=now=>{requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(!visible||document.hidden)return;
 if(moving)elapsed+=dt;time.value=elapsed;motion.value=THREE.MathUtils.damp(motion.value,moving?1:0,4,dt);
 if(moving&&!pointer&&now-lastInteraction>9000)targetRotation+=dt*.045;
 rotation=THREE.MathUtils.damp(rotation,targetRotation,9,dt);tilt=THREE.MathUtils.damp(tilt,targetTilt,7,dt);garment.rotation.set(tilt,rotation,moving?.007*Math.sin(elapsed*.6):0);garment.position.y=moving?.015*Math.sin(elapsed*.8):0;
 const front=Math.cos(rotation)>0;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.view==='front')===front)));
 renderer.render(scene,camera);
 };
 renderer.render(scene,camera);fallback.hidden=true;host.classList.add('ready');host.dataset.ready='true';status.textContent='DRAG TO ROTATE';requestAnimationFrame(frame);
 new IntersectionObserver(entries=>visible=entries[0].isIntersecting,{threshold:0}).observe(host);
 motionButton.addEventListener('click',()=>{moving=!moving;motionButton.textContent=moving?'PAUSE MOTION':'RESUME MOTION';motionButton.setAttribute('aria-pressed',String(!moving));});
 reduceQuery.addEventListener('change',event=>{moving=!event.matches;motionButton.textContent=moving?'PAUSE MOTION':'RESUME MOTION';});
 motionButton.textContent=moving?'PAUSE MOTION':'RESUME MOTION';
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;status.textContent='PRODUCT VIEW';});
}
start().catch(error=>{console.error('3D viewer unavailable:',error);if(renderer)renderer.domElement.remove();fallback.hidden=false;status.textContent='PRODUCT VIEW — 3D UNAVAILABLE';motionButton.hidden=true;document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{fallback.src=`assets/faith-${button.dataset.view}.png`;}));});
