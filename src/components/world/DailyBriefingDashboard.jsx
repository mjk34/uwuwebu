"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import * as THREE from "three";
import { playSfx } from "@/lib/sfx";
import { useScramble } from "@/hooks/useScramble";
import { fetchNews } from "@/lib/news";
import NewsDetailModal from "@/components/world/NewsDetailModal";

/* ═══════════ REDUCED MOTION ═══════════ */
let _reducedMotion=false;
if(typeof window!=="undefined"){
  try{
    const mql=window.matchMedia("(prefers-reduced-motion: reduce)");
    _reducedMotion=mql.matches;
    mql.addEventListener("change",(e)=>{_reducedMotion=e.matches;});
  }catch{}
}

/* ═══════════ PARALLAX DOTS BACKGROUND ═══════════ */
const PX_RED=[255,42,109],PX_CYAN=[0,240,255];
const PX_GAP=44,PX_DOT=0.8,PX_WAVE_SPEED=180,PX_WAVE_WIDTH=200,PX_WAVE_INT=6.0,PX_DISPLACE=6;
function ParallaxDots(){const canvasRef=useRef(null);const stRef=useRef({dots:[],w:0,h:0});const rafRef=useRef(0);
useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;const s=stRef.current;
const resize=()=>{const dpr=window.devicePixelRatio||1;s.w=window.innerWidth;s.h=window.innerHeight;canvas.width=s.w*dpr;canvas.height=s.h*dpr;canvas.style.width=s.w+"px";canvas.style.height=s.h+"px";ctx.setTransform(dpr,0,0,dpr,0,0);const dots=[];for(let x=-PX_GAP;x<s.w+PX_GAP;x+=PX_GAP)for(let y=-PX_GAP;y<s.h+PX_GAP;y+=PX_GAP)dots.push({bx:x,by:y,op:0.4+Math.random()*0.25});s.dots=dots;};
resize();window.addEventListener("resize",resize);
const t0=performance.now();let pos=new Float32Array(s.dots.length*3);
const draw=()=>{const now=performance.now();const elapsed=(now-t0)/1000;ctx.clearRect(0,0,s.w,s.h);const cx=s.w/2,cy=s.h/2;const cycle=elapsed%PX_WAVE_INT;const waveR=_reducedMotion?-99999:cycle*PX_WAVE_SPEED;const maxDist=Math.sqrt(cx*cx+cy*cy);const fade=1-(waveR/(maxDist+PX_WAVE_WIDTH));const{dots}=s;const len=dots.length;if(pos.length<len*3)pos=new Float32Array(len*3);
for(let i=0;i<len;i++){const d=dots[i];const rx=d.bx-cx,ry=d.by-cy;const dist=Math.sqrt(rx*rx+ry*ry);const wfDist=Math.abs(dist-waveR);let ox=0,oy=0,brighten=0;if(!_reducedMotion&&wfDist<PX_WAVE_WIDTH&&dist>1){const intensity=(1-wfDist/PX_WAVE_WIDTH)*fade;const a=Math.atan2(ry,rx);ox=Math.cos(a)*intensity*PX_DISPLACE;oy=Math.sin(a)*intensity*PX_DISPLACE;brighten=intensity*0.5;}const off=i*3;pos[off]=d.bx+ox;pos[off+1]=d.by+oy;pos[off+2]=brighten;}
// Glow pass
for(let i=0;i<len;i++){const off=i*3;const brighten=pos[off+2];if(brighten<0.05)continue;const fx=pos[off],fy=pos[off+1];if(fx<-30||fx>s.w+30||fy<-30||fy>s.h+30)continue;const glowR=PX_DOT*(8+brighten*18);const glowOp=Math.min(0.5,brighten*0.6);const grad=ctx.createRadialGradient(fx,fy,0,fx,fy,glowR);grad.addColorStop(0,`rgba(${PX_CYAN[0]},${PX_CYAN[1]},${PX_CYAN[2]},${glowOp})`);grad.addColorStop(0.35,`rgba(${PX_CYAN[0]},${PX_CYAN[1]},${PX_CYAN[2]},${glowOp*0.35})`);grad.addColorStop(1,`rgba(${PX_CYAN[0]},${PX_CYAN[1]},${PX_CYAN[2]},0)`);ctx.beginPath();ctx.arc(fx,fy,glowR,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();}
// Dot pass
for(let i=0;i<len;i++){const off=i*3;const fx=pos[off],fy=pos[off+1];if(fx<-5||fx>s.w+5||fy<-5||fy>s.h+5)continue;const brighten=pos[off+2];const t=Math.min(1,brighten*2);const cr=PX_RED[0]+(PX_CYAN[0]-PX_RED[0])*t;const cg=PX_RED[1]+(PX_CYAN[1]-PX_RED[1])*t;const cb=PX_RED[2]+(PX_CYAN[2]-PX_RED[2])*t;const op=Math.min(1,dots[i].op+brighten);ctx.fillStyle=`rgba(${cr|0},${cg|0},${cb|0},${op})`;ctx.fillRect(fx-PX_DOT,fy-PX_DOT,PX_DOT*2,PX_DOT*2);}
rafRef.current=requestAnimationFrame(draw);};rafRef.current=requestAnimationFrame(draw);
return()=>{cancelAnimationFrame(rafRef.current);window.removeEventListener("resize",resize);};
},[]);
return <canvas ref={canvasRef} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}/>;
}



/* ═══════════ DATA ═══════════ */
const HOUR=3600*1000,DAY=24*HOUR;
// LIVE feed = items inside this window AND unread; everything older OR read
// rolls into HISTORY. Pipeline retains 30 days; dashboard shows that full
// window split between the two buckets.
const LIVE_WINDOW=3*DAY;
// Hard cap on cards displayed per category. Pipeline can hold dozens per
// cat across the 30-day window; surfacing more than this overwhelms the
// vertical carousel.
const PER_CAT_CAP=10;
const NOW=Date.now();
function timeStr(ts){const d=NOW-ts;if(d<HOUR)return Math.max(1,Math.round(d/60000))+"m";if(d<DAY)return Math.round(d/HOUR)+"h";return Math.round(d/DAY)+"d";}

// NEWS is loaded inside AppInner via fetchNews() — see useEffect on mount.

const ALL_TAGS = {
  world:["WAR","POLITICS","DIPLOMACY","CLIMATE","DISASTER","SOCIETY","HEALTH","CRIME"],
  investments:["MACRO","MARKETS","CRYPTO","CORPORATE","BANKING","COMMODITIES","REALESTATE","CURRENCY"],
  tech:["BREACH","RANSOMWARE","NATIONSTATE","EXPLOIT","MALWARE","PHISHING","INFRA","PRIVACY"],
};

const C3={world:0xff2a6d,investments:0x05ffa1,tech:0x00f0ff};
const CH={world:"#ff2a6d",investments:"#05ffa1",tech:"#00f0ff"};

/* ═══════════ CATEGORY HEADLINE ═══════════ */
const CAT_LABELS={world:"W.O.R.L.D",investments:"M.O.N.E.Y",tech:"C.Y.B.3.R"};
const CAT_CYCLE=["world","investments","tech"];
function CategoryHeadline({cat,onClick,centered=false}){
  const label=CAT_LABELS[cat]||"WORLD NEWS";
  const color=CH[cat]||"#00f0ff";
  const nextCat=CAT_CYCLE[(CAT_CYCLE.indexOf(cat)+1)%CAT_CYCLE.length];
  const nextColor=CH[nextCat]||"#00f0ff";
  const{display,scrambleTo,snapTo}=useScramble(label,{duration:260,interval:16});
  // Separate scramble for the chevron affordance — short fixed-length string,
  // so disable length scaling and run a tight window.
  const chev=useScramble(">>",{duration:220,interval:16,scaleByLength:false});
  const prevCat=useRef(cat);
  const [hover,setHover]=useState(false);
  useEffect(()=>{
    if(prevCat.current!==cat){prevCat.current=cat;scrambleTo(label);}
    else{snapTo(label);}
  },[cat,label]);
  return(
    <div
      onClick={()=>{scrambleTo(label);chev.scrambleTo(">>");onClick?.();}}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        position:"absolute",
        left:centered?"50%":"calc(5vw + 50px)",
        top:centered?"14vh":"150px",
        transform:centered?"translateX(-50%)":undefined,
        textAlign:centered?"center":undefined,
        fontFamily:"'JetBrains Mono',monospace",
        fontSize:"clamp(36px,5vw,68px)",fontWeight:900,
        letterSpacing:"0.12em",color,lineHeight:1,
        zIndex:15,pointerEvents:"auto",userSelect:"none",
        cursor:"pointer",fontVariantNumeric:"tabular-nums",
        opacity:0.92,
        textShadow:`0 0 14px ${color}55, 0 0 40px ${color}33`,
        whiteSpace:"nowrap",
      }}
    >
      {display}
      {/* Skip-to-next-category affordance: chevrons render in the next cat's
          color so the click target previews where it'll take you. Absolute
          positioning keeps the label centered as if the chevrons weren't
          present — they hang off the right edge instead of pushing the text. */}
      <span style={{
        position:"absolute",
        left:"100%",
        top:0,
        marginLeft:"0.4em",
        color:nextColor,
        textShadow:`0 0 14px ${nextColor}55, 0 0 40px ${nextColor}33`,
        opacity:hover?1:0,
        transition:"opacity 0.18s ease",
        pointerEvents:"none",
      }}>{chev.display}</span>
    </div>
  );
}

function ll3(lat,lng,r){const p=(90-lat)*Math.PI/180,t=(lng+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));}

function decodeTopo(topo){const{scale,translate}=topo.transform;return topo.arcs.map(arc=>{let x=0,y=0;return arc.map(([dx,dy])=>{x+=dx;y+=dy;return[x*scale[0]+translate[0],y*scale[1]+translate[1]];});});}
function getArc(d,i){return i>=0?d[i]:[...d[~i]].reverse();}
function getRing(d,indices){let c=[];indices.forEach(i=>{const a=getArc(d,i);c=c.concat(c.length?a.slice(1):a);});return c;}
function extractPolys(topo,d){const p=[];topo.objects.countries.geometries.forEach(g=>{const add=a=>{const ext=getRing(d,a[0]),h=a.slice(1).map(x=>getRing(d,x));const lngs=ext.map(c=>c[0]),lats=ext.map(c=>c[1]);p.push({ext,holes:h,minLng:Math.min(...lngs),maxLng:Math.max(...lngs),minLat:Math.min(...lats),maxLat:Math.max(...lats),wide:Math.max(...lngs)-Math.min(...lngs)>180});};if(g.type==="Polygon")add(g.arcs);else if(g.type==="MultiPolygon")g.arcs.forEach(add);});return p;}
function inRing(x,y,r){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins;}return ins;}

// Rasterize polygons to a canvas bitmap — Canvas2D fill() handles complex polygons natively
function createLandMask(polys,MW=2048,MH=1024){
  const c=document.createElement("canvas");c.width=MW;c.height=MH;
  const ctx=c.getContext("2d");
  ctx.fillStyle="#000";ctx.fillRect(0,0,MW,MH);
  function lngToX(lng){return(lng+180)/360*MW;}
  function latToY(lat){return(90-lat)/180*MH;}
  function drawFilled(ext,holes){
    ctx.fillStyle="#fff";ctx.strokeStyle="#fff";ctx.lineWidth=6;
    ctx.beginPath();
    ext.forEach(([lng,lat],i)=>{const x=lngToX(lng),y=latToY(lat);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.closePath();ctx.fill();ctx.stroke();
    if(holes.length){ctx.fillStyle="#000";holes.forEach(hole=>{
      ctx.beginPath();hole.forEach(([lng,lat],i)=>{const x=lngToX(lng),y=latToY(lat);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.closePath();ctx.fill();});}
  }
  polys.forEach(p=>{
    if(!p.wide){
      drawFilled(p.ext,p.holes);
    }else{
      // Split antimeridian-crossing polygon into two non-crossing halves
      // Version A: shift negative lngs by +360 (fills the right/eastern side)
      const extA=p.ext.map(([ln,la])=>[ln<0?ln+360:ln,la]);
      const holesA=p.holes.map(h=>h.map(([ln,la])=>[ln<0?ln+360:ln,la]));
      drawFilled(extA,holesA);
      // Version B: shift positive lngs by -360 (fills the left/western side)
      const extB=p.ext.map(([ln,la])=>[ln>0?ln-360:ln,la]);
      const holesB=p.holes.map(h=>h.map(([ln,la])=>[ln>0?ln-360:ln,la]));
      drawFilled(extB,holesB);
    }
  });
  return ctx.getImageData(0,0,MW,MH);
}

function maskLookup(lat,lng,mask,MW=2048,MH=1024){
  if(lat<-62||lat>84)return false;
  const x=Math.floor((lng+180)/360*MW)%MW;
  const y=Math.floor((90-lat)/180*MH);
  if(x<0||x>=MW||y<0||y>=MH)return false;
  return mask.data[(y*MW+x)*4]>128;
}

function genDots(n,mask,invert=false){const GR=(1+Math.sqrt(5))/2,pts=[];for(let i=0;i<n;i++){const th=Math.acos(1-2*(i+.5)/n),ph=2*Math.PI*i/GR;const lat=90-th*180/Math.PI;let lng=(ph*180/Math.PI)%360-180;if(lat<-62||lat>84)continue;const isLand=maskLookup(lat,lng,mask);const show=invert?!isLand:isLand;if(show){const p=ll3(lat,lng,1.0);pts.push(p.x,p.y,p.z);}}return new Float32Array(pts);}

/* ═══════════ BIAS BAR ═══════════ */
function BiasBar({bias}){
  const pct=Math.round(((bias+1)/2)*100); // 0=left, 50=neutral, 100=right
  const abs=Math.abs(bias);
  const isL=bias<-0.15, isR=bias>0.15;
  const dotColor=isL?"#00f0ff":isR?"#ff2a6d":"#ffffff";
  const dotSize=6+Math.round(abs*10);
  const shadow=`0 0 ${Math.round(abs*8)+4}px ${dotColor}99`;
  const valColor=isL?"#00f0ff":isR?"#ff2a6d":"#ffffff";
  return(
    <div style={{display:"flex",alignItems:"center",gap:7,fontFamily:"'JetBrains Mono',monospace"}}>
      <span style={{fontSize:11,color:"#00f0ff",fontWeight:700,letterSpacing:1}}>0</span>
      <div style={{position:"relative",width:80,height:3,background:"rgba(133,142,170,0.1)",borderRadius:2}}>
        {/* solid fill from center toward dot */}
        <div style={{
          position:"absolute",top:0,bottom:0,borderRadius:2,
          left:isL?`${pct}%`:"50%",
          right:isR?`${100-pct}%`:"50%",
          background:dotColor,
        }}/>
        {/* center tick */}
        <div style={{position:"absolute",left:"calc(50% - 0.5px)",top:-3,width:1,height:9,background:"rgba(133,142,170,0.2)"}}/>
        {/* dot */}
        <div style={{
          position:"absolute",
          width:dotSize,height:dotSize,borderRadius:"50%",
          background:dotColor,
          top:`${-(dotSize/2)+1.5}px`,
          left:`calc(${pct}% - ${dotSize/2}px)`,
          boxShadow:shadow,
          transition:"all 0.25s ease",
        }}/>
      </div>
      <span style={{fontSize:11,color:"#ff2a6d",fontWeight:700,letterSpacing:1}}>100</span>
      <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",border:`1px solid ${valColor}33`,borderRadius:4,fontFamily:"'JetBrains Mono',monospace",color:valColor}}>{pct}</span>
    </div>
  );
}

/* ═══════════ GLOBE ═══════════ */
function Globe({news,hoveredId,focusItem,isLocked,lineSourceRef,svgPathRef,cssScale,onUserDrag,onMarkerClick,mode,visibleIds}){
  const mountRef=useRef(null);
  const S=useRef({markers:{},labels:{},targetRot:{x:0.22,y:0},currentRot:{x:0.22,y:0},dragging:false,dragMoved:false,lastMouse:{x:0,y:0},autoRotate:true,frame:null,defaultX:0.22});

  useEffect(()=>{
    const el=mountRef.current;if(!el)return;const st=S.current;
    const w=el.clientWidth,h=el.clientHeight;
    // Cancellation plumbing: unmount should abort the atlas fetch, block deferred
    // builders from touching a disposed scene, and let cleanup dispose THREE resources.
    let cancelled=false;
    const initTimeouts=[];
    const abortCtrl=typeof AbortController!=="undefined"?new AbortController():null;
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(36,w/h,0.1,100);camera.position.z=3.5;
    // Preflight WebGL: three.js's WebGLRenderer logs console.error before throwing,
    // which Next.js dev overlay surfaces even when caught. Probe first.
    const probe=document.createElement("canvas");
    const gl=probe.getContext("webgl2")||probe.getContext("webgl")||probe.getContext("experimental-webgl");
    if(!gl){console.warn("Globe: WebGL unavailable, skipping render.");return;}
    let renderer;
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    }catch(err){
      console.warn("Globe: WebGL renderer init failed, skipping.",err);
      return;
    }
    renderer.setSize(w,h);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x000000,0);el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x224466,0.8));
    const d1=new THREE.DirectionalLight(0x44aaff,0.5);d1.position.set(4,3,5);scene.add(d1);
    const group=new THREE.Group();group.rotation.x=0.22;st.group=group;scene.add(group);

    const coreMat=new THREE.MeshBasicMaterial({color:0x0d0e14,depthWrite:true});
    const coreMesh=new THREE.Mesh(new THREE.SphereGeometry(0.998,48,48),coreMat);
    group.add(coreMesh);
    const ring1=new THREE.Mesh(new THREE.TorusGeometry(1.02,0.002,6,80),new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:0.3}));group.add(ring1);
    const ring2=new THREE.Mesh(new THREE.TorusGeometry(1.04,0.0015,6,80),new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:0.12}));group.add(ring2);

    // Group news by location — one marker per unique lat/lng
    const locMap={};
    news.forEach(item=>{if(!item.lat&&!item.lng)return;const k=`${item.lat},${item.lng}`;if(!locMap[k])locMap[k]={lat:item.lat,lng:item.lng,items:[],place:item.place};locMap[k].items.push(item);});

    const locMarkers={};
    Object.entries(locMap).forEach(([k,loc])=>{
      const pos=ll3(loc.lat,loc.lng,1.03);
      const firstCol=C3[loc.items[0].cat]||0xffffff;
      const dot=new THREE.Mesh(new THREE.SphereGeometry(0.008,8,8),new THREE.MeshBasicMaterial({color:firstCol}));dot.position.copy(pos);dot.userData.locKey=k;group.add(dot);
      const ring=new THREE.Mesh(new THREE.RingGeometry(0.012,0.025,16),new THREE.MeshBasicMaterial({color:firstCol,transparent:true,opacity:0.3,side:THREE.DoubleSide}));ring.position.copy(pos);ring.lookAt(0,0,0);group.add(ring);
      const colors=loc.items.map(i=>C3[i.cat]||0xffffff);
      const hexColors=loc.items.map(i=>CH[i.cat]||"#00ccff");
      locMarkers[k]={dot,ring,pos:pos.clone(),items:loc.items,colors,hexColors,colorIdx:0,place:loc.place};
    });
    st.locMarkers=locMarkers;
    // Also keep per-item lookup to locKey
    const itemToLoc={};
    Object.entries(locMap).forEach(([k,loc])=>{loc.items.forEach(item=>{itemToLoc[item.id]=k;});});
    st.itemToLoc=itemToLoc;

    const dotMeshes=Object.values(locMarkers).map(m=>m.dot);

    const labels={};
    Object.entries(locMarkers).forEach(([k,m])=>{if(!m.place)return;
      const lbl=document.createElement("div");
      lbl.style.cssText=`position:absolute;pointer-events:none;font:700 18px 'JetBrains Mono',monospace;color:#00f0ff;background:rgba(13,14,20,0.92);padding:5px 12px;border-radius:5px;border:1px solid #00f0ff44;white-space:nowrap;opacity:0;transition:opacity .3s,color .3s,border-color .3s;z-index:5;letter-spacing:1.5px;text-transform:uppercase;`;
      lbl.textContent=m.place;el.appendChild(lbl);labels[k]=lbl;});
    st.labels=labels;

    // Capital city markers — top 10 economies, hover to reveal name
    const CAPITALS=[
      {name:"Washington, D.C.",lat:38.91,lng:-77.04},
      {name:"Beijing",lat:39.90,lng:116.41},
      {name:"Tokyo",lat:35.68,lng:139.65},
      {name:"Berlin",lat:52.52,lng:13.41},
      {name:"New Delhi",lat:28.61,lng:77.21},
      {name:"London",lat:51.51,lng:-0.13},
      {name:"Paris",lat:48.86,lng:2.35},
      {name:"Rome",lat:41.90,lng:12.50},
      {name:"Brasília",lat:-15.80,lng:-47.89},
      {name:"Moscow",lat:55.76,lng:37.62},
      {name:"Ottawa",lat:45.42,lng:-75.70},
      {name:"Mexico City",lat:19.43,lng:-99.13},
      {name:"Abu Dhabi",lat:24.45,lng:54.65},
      {name:"Tehran",lat:35.69,lng:51.39},
      {name:"Canberra",lat:-35.28,lng:149.13},
      {name:"Seoul",lat:37.57,lng:126.98},
      {name:"Jerusalem",lat:31.77,lng:35.23},
      {name:"Cairo",lat:30.04,lng:31.24},
      {name:"Nuuk",lat:64.17,lng:-51.74},
      {name:"Algiers",lat:36.75,lng:3.06},
      {name:"Tripoli",lat:32.90,lng:13.18},
      {name:"Khartoum",lat:15.50,lng:32.56},
      {name:"Kyiv",lat:50.45,lng:30.52},
      {name:"Ulaanbaatar",lat:47.92,lng:106.91},
      {name:"Astana",lat:51.17,lng:71.43},
      {name:"Buenos Aires",lat:-34.60,lng:-58.38},
      {name:"Caracas",lat:10.48,lng:-66.90},
      {name:"Havana",lat:23.11,lng:-82.37},
      {name:"Santiago",lat:-33.45,lng:-70.67},
      {name:"Lima",lat:-12.05,lng:-77.04},
      {name:"Panama City",lat:8.98,lng:-79.52},
      {name:"Kabul",lat:34.53,lng:69.17},
      {name:"Sana'a",lat:15.37,lng:44.19},
      {name:"Baghdad",lat:33.31,lng:44.37},
      {name:"Ankara",lat:39.93,lng:32.86},
      {name:"Islamabad",lat:33.68,lng:73.05},
    ];
    const WARRING=new Set(["Moscow","Kyiv","Washington, D.C.","Tehran","Jerusalem","Islamabad","Kabul"]);
    const capMarkers=[];
    CAPITALS.forEach(cap=>{
      const pos=ll3(cap.lat,cap.lng,1.025);
      const isWar=WARRING.has(cap.name);
      const markerColor=isWar?0xff7733:0x00f0ff;
      const labelColor=isWar?"#ffb088":"#858eaa";
      const labelBorder=isWar?"#ff884455":"#858eaa33";
      // Outer ring
      const outerRing=new THREE.Mesh(new THREE.RingGeometry(0.028,0.032,24),new THREE.MeshBasicMaterial({color:markerColor,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
      outerRing.position.copy(pos);outerRing.lookAt(0,0,0);group.add(outerRing);
      // Inner ring
      const innerRing=new THREE.Mesh(new THREE.RingGeometry(0.014,0.018,24),new THREE.MeshBasicMaterial({color:markerColor,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
      innerRing.position.copy(pos);innerRing.lookAt(0,0,0);group.add(innerRing);
      // Center blocker (background color)
      const blocker=new THREE.Mesh(new THREE.CircleGeometry(0.014,24),new THREE.MeshBasicMaterial({color:0x0d0e14,side:THREE.DoubleSide}));
      blocker.position.copy(pos).multiplyScalar(1.001);blocker.lookAt(0,0,0);group.add(blocker);
      const lbl=document.createElement("div");
      lbl.style.cssText=`position:absolute;pointer-events:none;font:500 13px 'JetBrains Mono',monospace;color:${labelColor};background:rgba(13,14,20,0.85);padding:3px 8px;border-radius:4px;border:1px solid ${labelBorder};white-space:nowrap;opacity:0;transition:opacity .25s;z-index:4;letter-spacing:1px;text-transform:uppercase;`;
      lbl.textContent=cap.name;el.appendChild(lbl);
      capMarkers.push({pos:pos.clone(),outerRing,innerRing,blocker,lbl});
    });
    st.capMarkers=capMarkers;

    // Conflict arcs — red/orange attack lines between capitals
    const CONFLICTS=[
      // Russia-Ukraine war (bidirectional)
      {from:"Kyiv",to:"Moscow",color:0xff3322},
      {from:"Moscow",to:"Kyiv",color:0xff3322},
      // US+Israel vs Iran
      {from:"Washington, D.C.",to:"Tehran",color:0xff5522},
      {from:"Jerusalem",to:"Tehran",color:0xff5522},
      {from:"Tehran",to:"Washington, D.C.",color:0xff5522},
      {from:"Tehran",to:"Jerusalem",color:0xff5522},
      // Pakistan-Afghanistan (bidirectional)
      {from:"Islamabad",to:"Kabul",color:0xff4422},
      {from:"Kabul",to:"Islamabad",color:0xff4422},
    ];
    const capMap={};CAPITALS.forEach(c=>capMap[c.name]=c);
    const conflictArcs=[];
    CONFLICTS.forEach((c,i)=>{
      const from=capMap[c.from],to=capMap[c.to];if(!from||!to)return;
      const start=ll3(from.lat,from.lng,1.01),end=ll3(to.lat,to.lng,1.01);
      // Quadratic bezier: midpoint lifted based on great-circle distance
      const mid=start.clone().lerp(end,0.5);
      const dist=start.distanceTo(end);
      mid.normalize().multiplyScalar(1+dist*0.38);
      const curve=new THREE.QuadraticBezierCurve3(start,mid,end);
      const pts=curve.getPoints(72);
      // Arc line — thin, pulsing
      const arcGeo=new THREE.BufferGeometry().setFromPoints(pts);
      const arcMat=new THREE.LineBasicMaterial({color:c.color,transparent:true,opacity:0.28});
      const arcLine=new THREE.Line(arcGeo,arcMat);group.add(arcLine);
      // Traveling projectile (head)
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.007,10,10),new THREE.MeshBasicMaterial({color:0xffaa55}));
      group.add(head);
      // Glow halo around head
      const glow=new THREE.Mesh(new THREE.SphereGeometry(0.016,10,10),new THREE.MeshBasicMaterial({color:c.color,transparent:true,opacity:0.3}));
      group.add(glow);
      conflictArcs.push({curve,head,glow,arcMat,offset:i*0.18,color:c.color});
    });
    st.conflictArcs=conflictArcs;

    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json",abortCtrl?{signal:abortCtrl.signal}:undefined)
      .then(r=>r.json()).then(topo=>{
        if(cancelled)return;
        const decoded=decodeTopo(topo);
        // Use 'countries' for mask (properly split at antimeridian)
        const polys=extractPolys(topo,decoded);
        const mask=createLandMask(polys);

        // Borders
        const segs=[];decoded.forEach(arc=>{for(let i=0;i<arc.length-1;i++){
          const p1=ll3(arc[i][1],arc[i][0],1.003),p2=ll3(arc[i+1][1],arc[i+1][0],1.003);segs.push(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z);}});
        const bg=new THREE.BufferGeometry();bg.setAttribute("position",new THREE.Float32BufferAttribute(segs,3));
        group.add(new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:0x00f0ff,transparent:true,opacity:0.45})));
        // Coast dots
        const cp=[];decoded.forEach(arc=>arc.forEach(([lng,lat])=>{
          const p=ll3(lat,lng,1.002);cp.push(p.x,p.y,p.z);}));
        const cg=new THREE.BufferGeometry();cg.setAttribute("position",new THREE.Float32BufferAttribute(cp,3));
        group.add(new THREE.Points(cg,new THREE.PointsMaterial({color:0x00f0ff,size:0.004,sizeAttenuation:true,transparent:true,opacity:0.45})));
        // Land + ocean dots — both built, one visible at a time based on mode
        initTimeouts.push(setTimeout(()=>{
          if(cancelled)return;
          const landData=genDots(120000,mask,false);
          const landGeom=new THREE.BufferGeometry();landGeom.setAttribute("position",new THREE.BufferAttribute(landData,3));
          const landMesh=new THREE.Points(landGeom,new THREE.PointsMaterial({color:0x0097a7,size:0.006,sizeAttenuation:true,transparent:true,opacity:0.55}));
          const oceanData=genDots(120000,mask,true);
          const oceanGeom=new THREE.BufferGeometry();oceanGeom.setAttribute("position",new THREE.BufferAttribute(oceanData,3));
          const oceanMesh=new THREE.Points(oceanGeom,new THREE.PointsMaterial({color:0x0097a7,size:0.009,sizeAttenuation:true,transparent:true,opacity:0.55}));
          landMesh.visible=mode!=="history";
          oceanMesh.visible=mode==="history";
          group.add(landMesh);group.add(oceanMesh);
          st.landDots=landMesh;st.oceanDots=oceanMesh;
        },30));

        // Ocean texture — also using mask
        initTimeouts.push(setTimeout(()=>{
          if(cancelled)return;
          const TW=800,TH=400;
          const cvs=document.createElement("canvas");cvs.width=TW;cvs.height=TH;
          const ctx=cvs.getContext("2d");
          const img=ctx.createImageData(TW,TH);
          const nz=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
          for(let py=0;py<TH;py++){
            const lat=90-(py/TH)*180;
            for(let px=0;px<TW;px++){
              const lng=(px/TW)*360-180;
              const i=(py*TW+px)*4;
              const isLandPx=maskLookup(lat,lng,mask);
              const n=nz(px*.04,py*.04)*.08;
              if(isLandPx){
                img.data[i]=13;img.data[i+1]=14;img.data[i+2]=20;
              }else{
                const depth=Math.abs(lat)/90;
                img.data[i]=Math.min(255,4+n*8);
                img.data[i+1]=Math.min(255,6+depth*6+n*10);
                img.data[i+2]=Math.min(255,16+depth*10+n*12);
              }
              img.data[i+3]=255;
            }
          }
          ctx.putImageData(img,0,0);
          const cvs2=document.createElement("canvas");cvs2.width=TW;cvs2.height=TH;
          const ctx2=cvs2.getContext("2d");ctx2.filter="blur(1.5px)";ctx2.drawImage(cvs,0,0);
          const tex=new THREE.CanvasTexture(cvs2);
          coreMat.map=tex;coreMat.needsUpdate=true;
        },80));
      }).catch(()=>{});

    /* ── Input ── */
    const raycaster=new THREE.Raycaster();raycaster.params.Mesh={threshold:0.02};
    const mouse=new THREE.Vector2();

    const onD=e=>{
      st.dragging=true;st.dragMoved=false;st.autoRotate=false;st._tiltRecovering=false;clearTimeout(st._returnTimer);st.lastMouse={x:e.clientX,y:e.clientY};st._downPos={x:e.clientX,y:e.clientY};el.style.cursor="grabbing";
      if(st._locked&&st._onUserDrag)st._onUserDrag();
    };
    const onM=e=>{if(!st.dragging)return;
      const dx=e.clientX-st._downPos.x,dy=e.clientY-st._downPos.y;
      if(dx*dx+dy*dy>16)st.dragMoved=true;
      st.targetRot.y+=(e.clientX-st.lastMouse.x)*.005;st.targetRot.x+=(e.clientY-st.lastMouse.y)*.005;st.targetRot.x=Math.max(-1,Math.min(1,st.targetRot.x));st.lastMouse={x:e.clientX,y:e.clientY};};
    const onU=e=>{
      const wasClick=st.dragging&&!st.dragMoved;
      st.dragging=false;el.style.cursor="grab";
      if(!st._locked){st._returnTimer=setTimeout(()=>{if(st._locked)return;st.autoRotate=true;st._tiltRecovering=true;},5000);}
      // Screen-space proximity click — find all markers near click point
      if(wasClick&&st._onMarkerClick){
        const rect=el.getBoundingClientRect();
        const cx=e.clientX-rect.left,cy=e.clientY-rect.top;
        const cw2=el.clientWidth,ch2=el.clientHeight;
        const sclF=rect.width/cw2;
        const RADIUS=40*sclF; // 40px hit radius in screen space
        const nearby=[];
        const proj=new THREE.Vector3();
        const vis=st._visibleIds;
        Object.entries(locMarkers).forEach(([k,m])=>{
          // Skip markers with no items in the current feed — they're hidden
          // in render and should not be clickable either.
          if(vis&&!m.items.some(i=>vis.has(i.id)))return;
          proj.copy(m.pos).applyMatrix4(group.matrixWorld).project(camera);
          if(proj.z>=1)return; // behind globe
          const sx=(proj.x*.5+.5)*rect.width;
          const sy=(-proj.y*.5+.5)*rect.height;
          const dx=sx-cx,dy=sy-cy;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<RADIUS)nearby.push({k,m,dist});
        });
        if(nearby.length>0){
          nearby.sort((a,b)=>a.dist-b.dist);
          // Collect all items from all nearby locations
          const allItems=[];
          nearby.forEach(n=>n.m.items.forEach(i=>allItems.push(i.id)));
          st._onMarkerClick(nearby[0].k,allItems);
        }
      }
    };
    el.addEventListener("mousedown",onD);window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);

    // Track mouse position over globe for capital hover
    const onHover=e=>{const r=el.getBoundingClientRect();st._mouseX=e.clientX-r.left;st._mouseY=e.clientY-r.top;};
    const onLeave=()=>{st._mouseX=-999;st._mouseY=-999;};
    el.addEventListener("mousemove",onHover);el.addEventListener("mouseleave",onLeave);

    // Touch
    const onTS=e=>{const t=e.touches[0];st.dragging=true;st.autoRotate=false;st._tiltRecovering=false;clearTimeout(st._returnTimer);st.lastMouse={x:t.clientX,y:t.clientY};if(st._locked&&st._onUserDrag)st._onUserDrag();};
    const onTM=e=>{if(!st.dragging)return;const t=e.touches[0];st.targetRot.y+=(t.clientX-st.lastMouse.x)*.005;st.targetRot.x+=(t.clientY-st.lastMouse.y)*.005;st.targetRot.x=Math.max(-1,Math.min(1,st.targetRot.x));st.lastMouse={x:t.clientX,y:t.clientY};};
    const onTE=()=>{st.dragging=false;if(!st._locked){st._returnTimer=setTimeout(()=>{if(st._locked)return;st.autoRotate=true;st._tiltRecovering=true;},5000);}};
    el.addEventListener("touchstart",onTS,{passive:true});window.addEventListener("touchmove",onTM,{passive:true});window.addEventListener("touchend",onTE);

    let t=0;const v3=new THREE.Vector3();const PI2=Math.PI*2;
    const animate=()=>{st.frame=requestAnimationFrame(animate);t+=0.016;
      if(!_reducedMotion&&!st._locked&&st.autoRotate&&!st.dragging)st.targetRot.y+=0.0008;
      // Normalize rotation to shortest path (prevents accumulation)
      while(st.targetRot.y-st.currentRot.y>Math.PI)st.targetRot.y-=PI2;
      while(st.targetRot.y-st.currentRot.y<-Math.PI)st.targetRot.y+=PI2;
      // Tilt recovery: very slow lerp back to default (paused during drag)
      const xRate=_reducedMotion?1:((st._tiltRecovering&&!st.dragging)?0.002:(st._locked?0.025:0.012));
      if(st._tiltRecovering&&!st.dragging){st.targetRot.x=st.defaultX;if(Math.abs(st.currentRot.x-st.defaultX)<0.001)st._tiltRecovering=false;}
      st.currentRot.x+=(st.targetRot.x-st.currentRot.x)*xRate;
      st.currentRot.y+=(st.targetRot.y-st.currentRot.y)*(_reducedMotion?1:0.012);
      // Keep values in range
      st.currentRot.y=((st.currentRot.y%PI2)+PI2)%PI2;
      st.targetRot.y=((st.targetRot.y%PI2)+PI2)%PI2;
      group.rotation.x=st.currentRot.x;group.rotation.y=st.currentRot.y;group.updateMatrixWorld();
      if(!_reducedMotion){
        ring1.rotation.x=Math.sin(t*.25)*.4;ring1.rotation.z=Math.cos(t*.2)*.3;
        ring2.rotation.x=Math.cos(t*.3)*.4+1;ring2.rotation.z=Math.sin(t*.15)*.5;
      }

      // Conflict arcs — animate traveling projectiles along bezier curves
      if(!_reducedMotion&&st.conflictArcs){
        st.conflictArcs.forEach(arc=>{
          const phase=((t*0.24+arc.offset)%1);
          const pos=arc.curve.getPoint(phase);
          arc.head.position.copy(pos);
          arc.glow.position.copy(pos);
          // Head fades in and out near endpoints (impact burst)
          const fadeEdge=0.08;
          let intensity=1;
          if(phase<fadeEdge)intensity=phase/fadeEdge;
          else if(phase>1-fadeEdge)intensity=(1-phase)/fadeEdge;
          arc.head.material.opacity=intensity*0.75;
          arc.head.material.transparent=true;
          arc.glow.material.opacity=(0.25+0.15*Math.sin(t*4+arc.offset*6))*intensity;
          // Arc line subtle pulse
          arc.arcMat.opacity=0.22+0.12*Math.sin(t*1.5+arc.offset*4);
        });
      }

      // Use clientWidth for internal coords (unaffected by CSS transform)
      const cw=el.clientWidth,ch=el.clientHeight;
      const rect=el.getBoundingClientRect();
      const scl=rect.width/cw; // CSS scale factor

      let drewLine=false;
      const visSet=st._visibleIds;
      Object.entries(st.locMarkers).forEach(([k,m])=>{
        // Project first so we can cheaply cull both out-of-feed and
        // back-of-globe markers before doing any per-frame work.
        v3.copy(m.pos).applyMatrix4(group.matrixWorld).project(camera);
        const front=v3.z<1;
        const hasVisible=visSet?m.items.some(i=>visSet.has(i.id)):true;
        const shouldRender=hasVisible&&front;
        if(m.dot.visible!==shouldRender){m.dot.visible=shouldRender;m.ring.visible=shouldRender;}
        if(!shouldRender){const lbl=st.labels[k];if(lbl&&lbl.style.opacity!=="0")lbl.style.opacity="0";return;}
        // Check if any item at this location is focused
        const focItem=m.items.find(i=>i.id===st._focusId);
        const foc=!!focItem;
        const pulse=1+Math.sin(t*3)*.15;
        m.dot.scale.setScalar(foc?1.3:1);m.ring.scale.setScalar(foc?1.2*pulse:pulse);m.ring.material.opacity=foc?0.4:0.1+Math.sin(t*3)*.06;

        // Color cycling for multi-item locations (every 2s), or lock to focused item color
        if(foc){
          const col=C3[focItem.cat]||0xffffff;
          m.dot.material.color.setHex(col);m.ring.material.color.setHex(col);
        }else if(m.colors.length>1){
          const ci=Math.floor(t/2)%m.colors.length;
          if(ci!==m.colorIdx){m.colorIdx=ci;m.dot.material.color.setHex(m.colors[ci]);m.ring.material.color.setHex(m.colors[ci]);}
        }

        const ix=(v3.x*.5+.5)*cw, iy=(-v3.y*.5+.5)*ch;
        const lbl=st.labels[k];
        if(lbl){
          lbl.style.left=`${ix-lbl.offsetWidth/2}px`;lbl.style.top=`${iy-56}px`;lbl.style.opacity=foc?"1":"0";
          if(foc){const hc=CH[focItem.cat]||"#00ccff";lbl.style.color=hc;lbl.style.borderColor=hc+"44";}
        }
        // Connection line from expanded news bar to globe marker
        if(foc&&svgPathRef?.current&&lineSourceRef?.current){
          const ls=lineSourceRef.current;
          const gx=ix+rect.left/scl;
          const gy=iy+rect.top/scl;
          const cpx1=ls.x+(gx-ls.x)*.3,cpy1=ls.y;
          const cpx2=ls.x+(gx-ls.x)*.7,cpy2=gy;
          svgPathRef.current.setAttribute("d",`M${ls.x},${ls.y} C${cpx1},${cpy1} ${cpx2},${cpy2} ${gx},${gy}`);
          svgPathRef.current.setAttribute("stroke",CH[focItem.cat]||"#00ccff");
          svgPathRef.current.style.opacity="1";
          drewLine=true;
        }
      });
      // If no marker drew a line this frame, hide it (prevents stale lines persisting)
      if(!drewLine&&svgPathRef?.current&&svgPathRef.current.style.opacity!=="0"){
        svgPathRef.current.style.opacity="0";
      }

      // Capital city labels — show on hover proximity
      const capV=new THREE.Vector3();
      const mxS=st._mouseX||0,myS=st._mouseY||0;
      const hoverR=30*(rect.width/cw);
      (st.capMarkers||[]).forEach(cap=>{
        capV.copy(cap.pos).applyMatrix4(group.matrixWorld);
        const onFront=capV.dot(camera.position)>0; // dot product: positive = facing camera
        if(cap.outerRing.visible!==onFront){cap.outerRing.visible=onFront;cap.innerRing.visible=onFront;cap.blocker.visible=onFront;}
        // Back-facing: skip projection and DOM writes — can't be hovered either.
        if(!onFront){if(cap.lbl.style.opacity!=="0")cap.lbl.style.opacity="0";return;}
        capV.project(camera);
        const sx=(capV.x*.5+.5)*rect.width,sy=(-capV.y*.5+.5)*rect.height;
        const ix=(capV.x*.5+.5)*cw,iy=(-capV.y*.5+.5)*ch;
        const dx=sx-mxS,dy=sy-myS;
        const near=(dx*dx+dy*dy<hoverR*hoverR);
        cap.lbl.style.left=`${ix-cap.lbl.offsetWidth/2}px`;cap.lbl.style.top=`${iy-40}px`;
        cap.lbl.style.opacity=near?"1":"0";
      });

      renderer.render(scene,camera);};
    animate();
    const onR=()=>{const nw=el.clientWidth,nh=el.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);};
    window.addEventListener("resize",onR);
    return()=>{
      cancelled=true;
      abortCtrl?.abort();
      initTimeouts.forEach(clearTimeout);
      clearTimeout(st._returnTimer);
      cancelAnimationFrame(st.frame);
      el.removeEventListener("mousedown",onD);window.removeEventListener("mousemove",onM);window.removeEventListener("mouseup",onU);
      el.removeEventListener("touchstart",onTS);window.removeEventListener("touchmove",onTM);window.removeEventListener("touchend",onTE);
      window.removeEventListener("resize",onR);
      el.removeEventListener("mousemove",onHover);el.removeEventListener("mouseleave",onLeave);
      Object.values(labels).forEach(l=>{if(el.contains(l))el.removeChild(l);});
      capMarkers.forEach(c=>{if(el.contains(c.lbl))el.removeChild(c.lbl);});
      // Walk scene graph and release GPU resources. Without this, every /world
      // unmount orphans ~120k-point BufferGeometries, ring/arc meshes, and the
      // ocean CanvasTexture — a leak on each route change.
      scene.traverse(obj=>{
        if(obj.geometry)obj.geometry.dispose();
        const mats=obj.material?(Array.isArray(obj.material)?obj.material:[obj.material]):[];
        mats.forEach(m=>{
          for(const k in m){const v=m[k];if(v&&typeof v==="object"&&v.isTexture)v.dispose();}
          m.dispose();
        });
      });
      scene.clear();
      renderer.dispose();
      if(el.contains(renderer.domElement))el.removeChild(renderer.domElement);
    };
  },[]);

  useEffect(()=>{S.current._hoveredId=hoveredId;},[hoveredId]);
  useEffect(()=>{S.current._onUserDrag=onUserDrag;},[onUserDrag]);
  useEffect(()=>{S.current._onMarkerClick=onMarkerClick;},[onMarkerClick]);
  useEffect(()=>{S.current._visibleIds=visibleIds;},[visibleIds]);
  useEffect(()=>{S.current._locked=isLocked;if(isLocked){clearTimeout(S.current._returnTimer);S.current._tiltRecovering=false;}if(!isLocked){S.current.autoRotate=true;S.current._focusId=null;if(svgPathRef?.current)svgPathRef.current.style.opacity="0";}},[isLocked]);
  useEffect(()=>{if(!focusItem){S.current._focusId=null;return;}const st=S.current;st._focusId=focusItem.id;if(focusItem.lat||focusItem.lng){st.targetRot.y=-Math.PI/2-focusItem.lng*Math.PI/180;const tiltMult=focusItem.lat<0?1.6:0.4;st.targetRot.x=focusItem.lat*Math.PI/180*tiltMult+st.defaultX;st.autoRotate=false;}},[focusItem]);
  // Toggle land/ocean dot visibility when mode changes
  useEffect(()=>{const st=S.current;if(st.landDots)st.landDots.visible=mode!=="history";if(st.oceanDots)st.oceanDots.visible=mode==="history";},[mode]);

  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab",position:"relative",overflow:"hidden"}}/>;
}

/* ═══════════ APP ═══════════ */
// These are computed at runtime from viewport height — no fixed canvas
const ACTIVE_EXTRA_TOP=0;

// Skip SSR: inner component reads window.innerWidth/innerHeight during render,
// which causes hydration mismatch against the actual client viewport.
const _subNoop=()=>()=>{};
const _snapTrue=()=>true;
const _snapFalse=()=>false;
export default function App(){
  const mounted=useSyncExternalStore(_subNoop,_snapTrue,_snapFalse);
  if(!mounted)return null;
  return <AppInner/>;
}

function AppInner(){
  // Live news feed from R2 via /api/news proxy. Empty until first fetch
  // resolves; downstream useMemos all key off this array, so they recompute
  // when it lands.
  const [NEWS,setNEWS]=useState([]);
  // "live" once R2 returns data; "fallback" if we landed on the bundled
  // public/news.json (R2 unreachable). Drives the LIVE-dot color.
  const [newsSource,setNewsSource]=useState("live");
  useEffect(()=>{
    let cancelled=false;
    fetchNews().then(feed=>{
      if(cancelled)return;
      // Drop cards that still have mock-LLM placeholder synthesis text. These
      // sneak in when Stage 6 falls back to the mock client (no fixture for a
      // given cluster). With real Claude wired up they should disappear; this
      // filter is the belt-and-suspenders so a half-failed run can't leak
      // "Cluster synthesis placeholder headline." into the carousel.
      const isPlaceholder=n=>{
        const t=(n.title||"").toLowerCase();
        const s=(n.summary||"").toLowerCase();
        return t.includes("placeholder")||s.includes("placeholder");
      };
      setNEWS(feed.cards.filter(n=>!isPlaceholder(n)));
      setNewsSource(feed.source);
    }).catch(err=>{
      console.error("[news] fetch failed",err);
    });
    return()=>{cancelled=true;};
  },[]);
  const [hoveredId,setHoveredId]=useState(null);
  const [focusItem,setFocusItem]=useState(null);
  const [activeId,setActiveId]=useState(null);
  // Selected card for the detail modal — null = closed.
  const [detailItem,setDetailItem]=useState(null);
  const [viewH,setViewH]=useState(()=>typeof window!=="undefined"?window.innerHeight:900);
  const [viewW,setViewW]=useState(()=>typeof window!=="undefined"?window.innerWidth:1400);
  const [cardMouse,setCardMouse]=useState({x:0.5,y:0.5});
  const [activeTags,setActiveTags]=useState([]);
  const [mode,setMode]=useState("live"); // "live" | "history"
  const [liveHover,setLiveHover]=useState(false);
  const [historyHover,setHistoryHover]=useState(false);
  const [hoverDelayed,setHoverDelayed]=useState(false);
  const [scrambleSuppressed,setScrambleSuppressed]=useState(false);
  const pendingDelayRef=useRef(false);
  useEffect(()=>{
    if(!pendingDelayRef.current)return;
    pendingDelayRef.current=false;
    setHoverDelayed(true);
    const t=setTimeout(()=>setHoverDelayed(false),200);
    return ()=>clearTimeout(t);
  },[mode]);
  const{display:liveDisplay,scrambleTo:scrambleLive,snapTo:snapLive}=useScramble("LIVE",{duration:240,interval:18});
  const{display:histDisplay,scrambleTo:scrambleHist,snapTo:snapHist}=useScramble("HISTORY",{duration:240,interval:18});
  // TODO(phase2-auth): bookmark/read state. Disabled until Discord OAuth +
  // professor-rs bookmark API land — see project memory `news_bookmarks_design`.
  // const [bookmarkedIds,setBookmarkedIds]=useState(()=>new Set());
  // const [readIds,setReadIds]=useState(()=>new Set());
  // const toggleBookmark=useCallback(id=>{
  //   setBookmarkedIds(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n;});
  // },[]);
  // const toggleRead=useCallback(id=>{
  //   setReadIds(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n;});
  // },[]);
  const barRefs=useRef({});

  const lineSourceRef=useRef(null),svgPathRef=useRef(null);
  const lerpRafRef=useRef(null);
  const cardMouseTargetRef=useRef({x:0.5,y:0.5});

  // Base feed: split purely by age. Read-state filter is disabled until auth
  // lands — see TODO(phase2-auth) above.
  // Cap each category to PER_CAT_CAP, keeping the most-recent N. NEWS may
  // arrive in any order from R2; sort by recency first so the cap keeps the
  // freshest headlines, then regroup by cat (CAT_CYCLE order) for display so
  // the carousel shows all of one cat together before the next.
  const capPerCat=useCallback(items=>{
    const byRecency=[...items].sort((a,b)=>b.dateTs-a.dateTs);
    const counts={};
    const kept=byRecency.filter(n=>{
      counts[n.cat]=(counts[n.cat]||0)+1;
      return counts[n.cat]<=PER_CAT_CAP;
    });
    const catRank=Object.fromEntries(CAT_CYCLE.map((c,i)=>[c,i]));
    return kept.sort((a,b)=>(catRank[a.cat]??99)-(catRank[b.cat]??99)||b.dateTs-a.dateTs);
  },[]);

  const baseFeed=useMemo(()=>{
    const isOld=n=>(NOW-n.dateTs)>LIVE_WINDOW;
    const eligible=NEWS.filter(n=>mode==="live"?!isOld(n):isOld(n));
    return capPerCat(eligible);
  },[mode,NEWS,capPerCat]);

  // Totals for both sides — counts reflect the post-cap visible feed so the
  // hover number matches what's actually scrollable. Hover on the inactive
  // side recomputes from NEWS since baseFeed only covers the active mode.
  const liveCount=useMemo(()=>capPerCat(NEWS.filter(n=>(NOW-n.dateTs)<=LIVE_WINDOW)).length,[NEWS,capPerCat]);
  const historyCount=useMemo(()=>capPerCat(NEWS.filter(n=>(NOW-n.dateTs)>LIVE_WINDOW)).length,[NEWS,capPerCat]);

  // Snap both displays back to labels whenever the active mode changes, so a
  // stale count from a prior hover doesn't linger on the newly-active side.
  const prevModeRef=useRef(mode);
  useEffect(()=>{
    if(prevModeRef.current===mode)return;
    prevModeRef.current=mode;
    snapLive("LIVE");
    snapHist("HISTORY");
  },[mode,snapLive,snapHist]);

  // If the active item isn't in the current feed, auto-select first of feed
  useEffect(()=>{
    if(baseFeed.length===0)return;
    if(!baseFeed.find(n=>n.id===activeId)){
      setActiveId(baseFeed[0].id);
    }
  },[baseFeed,activeId]);

  const activeItem=baseFeed.find(n=>n.id===activeId)||baseFeed[0]||NEWS[0];
  const expandedId=activeItem?.id??null;
  const activeCat=activeItem?.cat||"world";

  // Reset tag filters when moving between categories or modes
  useEffect(()=>{setActiveTags([]);},[activeCat,mode]);

  const toggleTag=useCallback(t=>{
    setActiveTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]);
  },[]);

  // Filtered feed: tag filter applies only to active category; other categories pass through.
  // TODO(phase2-auth): re-enable BOOKMARK/READ pseudo-tag branches when auth lands.
  const filteredNews=useMemo(()=>{
    if(activeTags.length===0)return baseFeed;
    return baseFeed.filter(n=>{
      if(n.cat!==activeCat)return true;
      return activeTags.some(t=>n.tags.includes(t));
    });
  },[activeTags,activeCat,baseFeed]);

  // Ref mirror so stable event handlers (wheel) always see the latest filtered list
  const filteredNewsRef=useRef(filteredNews);
  useEffect(()=>{filteredNewsRef.current=filteredNews;},[filteredNews]);

  // ID set of items currently in the feed (mode-filtered). Drives which globe
  // markers are rendered and clickable — markers whose items are all outside
  // the current feed get hidden and excluded from hit-testing.
  const visibleIds=useMemo(()=>new Set(baseFeed.map(n=>n.id)),[baseFeed]);

  // Only show filter toggles for tags that exist in current category's cards in current feed.
  // TODO(phase2-auth): in history mode, append BOOKMARK/READ when those Sets exist.
  const availableTags=useMemo(()=>{
    const catItems=baseFeed.filter(n=>n.cat===activeCat);
    const tagSet=new Set();
    catItems.forEach(n=>n.tags.forEach(t=>tagSet.add(t)));
    return ALL_TAGS[activeCat].filter(t=>tagSet.has(t));
  },[activeCat,baseFeed]);

  // After a tag toggle, jump to the first card in the current category matching the filter
  useEffect(()=>{
    if(activeTags.length===0)return;
    const firstInCat=filteredNews.find(n=>n.cat===activeCat);
    if(firstInCat&&firstInCat.id!==activeId)setActiveId(firstInCat.id);
  },[activeTags]);

  // Mobile: drop the globe + connection line, center the feed & headline.
  const isMobile=viewW<1550;

  // Card is locked to 564×275 on desktop. On narrow viewports (< ~624px)
  // the card shrinks proportionally to fit the viewport minus tight gutters,
  // and geometry constants (spacing, offsets, svg viewBox) scale with it.
  const DESKTOP_CARD_W=564;
  const DESKTOP_CARD_H=275;
  const cardLeftOffset=isMobile?12:40;
  const cardRightMargin=isMobile?12:20;
  const cardW=isMobile
    ?Math.min(DESKTOP_CARD_W,viewW-cardLeftOffset-cardRightMargin)
    :DESKTOP_CARD_W;
  const cardScale=cardW/DESKTOP_CARD_W;
  const cardH=Math.round(DESKTOP_CARD_H*cardScale);

  // Responsive position constants derived from live viewport height
  const MIDDLE_Y=Math.round(viewH*0.40);
  const ITEM_SPACING=Math.round(175*cardScale);
  const ACTIVE_EXTRA_BOTTOM=Math.round(109*cardScale);

  // Responsive layout — cap gap between feed right-edge and globe left-edge at 60px
  const MAX_GAP=60;
  const feedWidth=cardW+cardLeftOffset+cardRightMargin;
  const globeWidth=viewW*0.55;
  const naturalFeedLeft=viewW*0.05;
  const naturalGlobeLeft=viewW*(1-0.02-0.55); // right:2vw, width:55vw
  const naturalGap=naturalGlobeLeft-(naturalFeedLeft+feedWidth);
  let feedLeft,globeLeft;
  if(isMobile){
    feedLeft=(viewW-feedWidth)/2;
    globeLeft=0;
  }else if(naturalGap<=MAX_GAP){
    feedLeft=naturalFeedLeft;
    globeLeft=naturalGlobeLeft;
  }else{
    const totalWidth=feedWidth+MAX_GAP+globeWidth;
    feedLeft=(viewW-totalWidth)/2;
    globeLeft=feedLeft+feedWidth+MAX_GAP;
  }

  useEffect(()=>{
    const u=()=>{setViewH(window.innerHeight);setViewW(window.innerWidth);};
    window.addEventListener("resize",u);
    return()=>window.removeEventListener("resize",u);
  },[]);

  const CATS_ORDER=['world','investments','tech'];
  const jumpToFirst=useCallback(()=>{
    const currentCatIdx=CATS_ORDER.indexOf(activeCat);
    // Try categories in order, skip any that have no items in the current feed
    for(let i=1;i<=CATS_ORDER.length;i++){
      const nextCat=CATS_ORDER[(currentCatIdx+i)%CATS_ORDER.length];
      const target=baseFeed.find(n=>n.cat===nextCat);
      if(target){playSfx("tick");setActiveId(target.id);return;}
    }
  },[activeCat,baseFeed]);
  useEffect(()=>{
    let raf=null,stop=false;
    const endTime=Date.now()+500;
    const tick=()=>{
      if(stop)return;
      const item=activeItem;if(!item){raf=requestAnimationFrame(tick);return;}
      // Only update line source if the item has a location (no-location cards → no line)
      if(item.lat||item.lng){
        const bar=barRefs.current[item.id];
        if(bar){const r=bar.getBoundingClientRect();lineSourceRef.current={x:r.left+r.width/2,y:r.top+r.height/2};}
      }
      if(Date.now()<endTime)raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const item=activeItem;if(!item)return;
    if(item.lat||item.lng)setFocusItem({...item,_ts:Date.now()});
    else{setFocusItem(null);lineSourceRef.current=null;if(svgPathRef.current)svgPathRef.current.style.opacity="0";}
    return()=>{stop=true;if(raf)cancelAnimationFrame(raf);};
  },[activeId]);

  const handleGlobeDrag=useCallback(()=>{setFocusItem(null);lineSourceRef.current=null;if(svgPathRef.current)svgPathRef.current.style.opacity="0";},[]);
  const handleClick=item=>{
    if(item.id===activeId){
      playSfx("click");
      // Re-focus globe and restore connection line only if this card has a location
      if(item.lat||item.lng){
        // eslint-disable-next-line react-hooks/purity
        setFocusItem({...item,_ts:Date.now()});
        const bar=barRefs.current[item.id];
        if(bar){const r=bar.getBoundingClientRect();lineSourceRef.current={x:r.left+r.width/2,y:r.top+r.height/2};}
      }
    }else{
      playSfx("tick");
      setActiveId(item.id);
    }
  };
  const handleMarkerClick=useCallback((locKey,itemIds)=>{
    if(!itemIds||!itemIds.length)return;
    // Globe markers are built from the full NEWS set, but the feed is filtered
    // by mode (live/history). Restrict target selection to items actually in
    // the current feed — otherwise setActiveId gets bounced back by the
    // "active not in baseFeed" guard, producing the visual of the globe
    // snapping back to the previously-active card.
    const feedIds=new Set(baseFeed.map(n=>n.id));
    const visible=itemIds.filter(id=>feedIds.has(id));
    if(!visible.length)return;
    let targetId;
    if(visible.includes(expandedId)){const curIdx=visible.indexOf(expandedId);targetId=visible[(curIdx+1)%visible.length];}
    else{targetId=visible[0];}
    if(targetId!=null){playSfx("tick-data-9");setActiveTags([]);setActiveId(targetId);}
  },[expandedId,baseFeed]);

  // Wheel / touch-swipe scroll through items (cyclic within filtered feed)
  useEffect(()=>{
    const el=document.getElementById("feed-carousel");if(!el)return;
    let lock=false;
    const advance=dir=>{
      if(lock)return;
      lock=true;setTimeout(()=>{lock=false;},250);
      setHoveredId(null);playSfx("tick");
      setActiveId(curId=>{
        const fn=filteredNewsRef.current;
        if(fn.length===0)return curId;
        const fIdx=fn.findIndex(n=>n.id===curId);
        const safeIdx=fIdx<0?0:fIdx;
        const nextF=(safeIdx+dir+fn.length)%fn.length;
        const nextItem=fn[nextF];
        const cur=fn[safeIdx];
        // Clear tag filter if cycling into a different category
        if(cur&&nextItem.cat!==cur.cat)setActiveTags([]);
        return nextItem.id;
      });
    };
    const onWheel=e=>{e.preventDefault();advance(e.deltaY>0?1:-1);};

    // Touch swipe: vertical gesture advances one item per swipe (threshold
    // 40px). Below 8px of movement we let the event fall through as a tap so
    // onClick still fires on cards. preventDefault on sustained vertical
    // movement so the page doesn't scroll while we're consuming the swipe.
    const SWIPE_THRESHOLD=40;
    const LOCK_MOVE=8;
    let touchStartY=null;
    const onTouchStart=e=>{
      if(e.touches.length!==1){touchStartY=null;return;}
      touchStartY=e.touches[0].clientY;
    };
    const onTouchMove=e=>{
      if(touchStartY==null)return;
      const dy=e.touches[0].clientY-touchStartY;
      if(Math.abs(dy)>LOCK_MOVE)e.preventDefault();
    };
    const onTouchEnd=e=>{
      if(touchStartY==null)return;
      const t=e.changedTouches&&e.changedTouches[0];
      const endY=t?t.clientY:null;
      const startY=touchStartY;
      touchStartY=null;
      if(endY==null)return;
      const dy=endY-startY;
      if(Math.abs(dy)<SWIPE_THRESHOLD)return;
      // Swipe up (dy<0) advances forward, swipe down reverses — matches wheel.
      advance(dy<0?1:-1);
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    el.addEventListener("touchstart",onTouchStart,{passive:true});
    el.addEventListener("touchmove",onTouchMove,{passive:false});
    el.addEventListener("touchend",onTouchEnd);
    el.addEventListener("touchcancel",onTouchEnd);
    return()=>{
      el.removeEventListener("wheel",onWheel);
      el.removeEventListener("touchstart",onTouchStart);
      el.removeEventListener("touchmove",onTouchMove);
      el.removeEventListener("touchend",onTouchEnd);
      el.removeEventListener("touchcancel",onTouchEnd);
    };
  },[]);

  return(<>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');::selection{background:#00f0ff;color:#0d0e14}@keyframes meshPulse{0%,100%{opacity:.32}50%{opacity:.78}}@keyframes glowPulse{0%,100%{opacity:.45}50%{opacity:1}}`}</style>
    <div style={ST.root}>
      <ParallaxDots/>
      <div style={ST.bgGrid}/>
      <div style={ST.bgGrad}/>
      {!isMobile&&(
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",zIndex:25,pointerEvents:"none"}}>
          <path ref={svgPathRef} fill="none" stroke="none" strokeWidth="2" strokeDasharray="8 5" opacity="0" style={{transition:"opacity .5s"}}/>
        </svg>
      )}

      {/* ── CATEGORY HEADLINE ── */}
      <CategoryHeadline cat={activeCat} onClick={jumpToFirst} centered={isMobile}/>

      {/* ── LIVE / HISTORY TOGGLE ── */}
      <div
        onClick={()=>{
          const newMode=mode==="live"?"history":"live";
          const onNewActive=(newMode==="live"&&liveHover)||(newMode==="history"&&historyHover);
          if(onNewActive){
            setScrambleSuppressed(true);
            pendingDelayRef.current=true;
          }
          setMode(newMode);
        }}
        style={{
          position:"absolute",top:"6vh",left:"50%",
          transform:"translateX(-50%)",zIndex:20,
          cursor:"pointer",userSelect:"none",
          display:"flex",alignItems:"center",
          background:"rgba(10,11,18,0.82)",
          border:`1px solid ${mode==="live"?"#00f0ff66":"#ff2a6d66"}`,
          borderRadius:999,padding:isMobile?2.5:5,
          backdropFilter:"blur(8px)",
          WebkitBackdropFilter:"blur(8px)",
          fontFamily:"'JetBrains Mono',monospace",
          fontSize:isMobile?7.5:15,fontWeight:700,letterSpacing:isMobile?1.2:2.4,
          boxShadow:`0 4px 20px rgba(0,0,0,0.3), 0 0 18px ${mode==="live"?"rgba(0,240,255,0.15)":"rgba(255,42,109,0.15)"}`,
          transition:"border-color 0.35s ease, box-shadow 0.35s ease",
        }}
      >
        {/* sliding thumb with layered glass effect */}
        <div style={{
          position:"absolute",top:isMobile?2.5:5,bottom:isMobile?2.5:5,
          left:mode==="live"?(isMobile?2.5:5):"50%",
          width:`calc(50% - ${isMobile?2.5:5}px)`,
          borderRadius:999,
          overflow:"hidden",
          transition:"left 0.35s cubic-bezier(.4,0,.2,1)",
        }}>
          {/* Layer 1: backdrop blur */}
          <div style={{
            position:"absolute",inset:0,borderRadius:999,
            backdropFilter:"blur(14px) saturate(1.7) brightness(0.95)",
            WebkitBackdropFilter:"blur(14px) saturate(1.7) brightness(0.95)",
            background:"rgba(8,10,20,0.35)",
          }}/>
          {/* Layer 2: color refraction */}
          <div style={{
            position:"absolute",inset:0,borderRadius:999,
            background:`
              radial-gradient(ellipse 120% 85% at 20% 50%, rgba(255,42,109,0.16) 0%, transparent 55%),
              radial-gradient(ellipse 100% 90% at 65% 40%, rgba(0,240,255,0.14) 0%, transparent 50%),
              radial-gradient(ellipse 90% 100% at 40% 85%, rgba(5,255,161,0.09) 0%, transparent 45%)
            `,
            mixBlendMode:"screen",
          }}/>
          {/* Layer 3: top specular */}
          <div style={{
            position:"absolute",inset:0,borderRadius:999,
            background:"radial-gradient(ellipse 70% 80% at 50% 15%, rgba(255,255,255,0.15) 0%, transparent 60%)",
          }}/>
          {/* Layer 4: accent edge */}
          <div style={{
            position:"absolute",inset:0,borderRadius:999,pointerEvents:"none",
            border:`1px solid ${mode==="live"?"#00f0ff88":"#ff2a6d88"}`,
            transition:"border-color 0.35s ease",
          }}/>
        </div>
        {/* LIVE side: green dot + LIVE label always. When live is active,
            hovering scrambles the label to the live article count. When
            history is active, the side renders dull/disabled. */}
        <div
          onMouseEnter={()=>{
            setLiveHover(true);
            if(mode==="live"&&!hoverDelayed&&!scrambleSuppressed) scrambleLive(String(liveCount));
          }}
          onMouseLeave={()=>{
            setLiveHover(false);
            if(mode!=="live")return;
            if(!hoverDelayed&&!scrambleSuppressed) scrambleLive("LIVE");
            setScrambleSuppressed(false);
          }}
          style={{
            position:"relative",width:isMobile?85:170,flex:"none",
            padding:isMobile?"5.5px 10px":"11px 20px",
            color:mode==="live"?"#00f0ff":"#4a5164",
            transition:"color 0.35s ease",
            display:"flex",alignItems:"center",justifyContent:"center",gap:isMobile?4.5:9,
            overflow:"hidden",
          }}
        >
          {/* hover inner glow */}
          <div style={{
            position:"absolute",inset:0,borderRadius:999,pointerEvents:"none",
            boxShadow:(liveHover&&mode==="live"&&!hoverDelayed)?"inset 0 0 22px rgba(0,240,255,0.55), inset 0 0 10px rgba(0,240,255,0.35)":"inset 0 0 0 rgba(0,240,255,0)",
            background:(liveHover&&mode==="live"&&!hoverDelayed)?"radial-gradient(ellipse at center, rgba(0,240,255,0.12) 0%, transparent 70%)":"transparent",
            transition:"box-shadow 0.25s ease, background 0.25s ease",
          }}/>
          {/* Dot color signals data source: green pulse = live R2 feed,
              solid orange = bundled fallback (CORS broken or R2 down). */}
          <span title={mode==="live"?(newsSource==="fallback"?"using bundled fallback — live feed unreachable":"live feed"):undefined} style={{
            width:isMobile?4:8,height:isMobile?4:8,borderRadius:"50%",flex:"none",
            background:mode==="live"?(newsSource==="fallback"?"#ff9933":"#05ffa1"):"#1f2b28",
            boxShadow:mode==="live"?(newsSource==="fallback"?"0 0 10px #ff9933, 0 0 4px #ff9933":"0 0 10px #05ffa1, 0 0 4px #05ffa1"):"none",
            animation:mode==="live"&&newsSource!=="fallback"?"glowPulse 1.6s ease-in-out infinite":"none",
            transition:"background 0.35s ease",
          }}/>
          <span style={{
            position:"relative",fontVariantNumeric:"tabular-nums",
            display:"inline-block",textAlign:"center",
          }}>{mode==="live"?liveDisplay:"LIVE"}</span>
        </div>
        {/* HISTORY side: HISTORY label always. When history is active,
            hovering scrambles the label to the history article count.
            When live is active, the side renders dull/disabled. */}
        <div
          onMouseEnter={()=>{
            setHistoryHover(true);
            if(mode==="history"&&!hoverDelayed&&!scrambleSuppressed) scrambleHist(String(historyCount));
          }}
          onMouseLeave={()=>{
            setHistoryHover(false);
            if(mode!=="history")return;
            if(!hoverDelayed&&!scrambleSuppressed) scrambleHist("HISTORY");
            setScrambleSuppressed(false);
          }}
          style={{
            position:"relative",width:isMobile?85:170,flex:"none",
            padding:isMobile?"5.5px 10px":"11px 20px",
            color:mode==="history"?"#f0f1f5":"#4a5164",
            transition:"color 0.35s ease",
            display:"flex",alignItems:"center",justifyContent:"center",gap:isMobile?4.5:9,
            overflow:"hidden",
          }}
        >
          {/* hover inner glow */}
          <div style={{
            position:"absolute",inset:0,borderRadius:999,pointerEvents:"none",
            boxShadow:(historyHover&&mode==="history"&&!hoverDelayed)?"inset 0 0 22px rgba(255,42,109,0.55), inset 0 0 10px rgba(255,42,109,0.35)":"inset 0 0 0 rgba(255,42,109,0)",
            background:(historyHover&&mode==="history"&&!hoverDelayed)?"radial-gradient(ellipse at center, rgba(255,42,109,0.12) 0%, transparent 70%)":"transparent",
            transition:"box-shadow 0.25s ease, background 0.25s ease",
          }}/>
          {/* Invisible spacer matching the LIVE dot, so HISTORY text sits at
              the same visual offset inside its half. */}
          <span aria-hidden="true" style={{width:isMobile?4:8,height:isMobile?4:8,visibility:"hidden",flex:"none"}}/>
          <span style={{
            position:"relative",fontVariantNumeric:"tabular-nums",
            display:"inline-block",textAlign:"center",
          }}>{mode==="history"?histDisplay:"HISTORY"}</span>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{
        position:"absolute",left:feedLeft+cardLeftOffset,width:cardW,
        bottom:52,zIndex:15,pointerEvents:"auto",
        display:"flex",flexDirection:"column",gap:6,
        minHeight:50,justifyContent:"flex-start",
      }}>
        {(()=>{
          const firstRow=availableTags.slice(0,5);
          const secondRow=availableTags.slice(5);
          const renderTag=tag=>{
            const isMeta=tag==="BOOKMARK"||tag==="READ";
            const color=isMeta?"#d4d7e0":CH[activeCat];
            const active=activeTags.includes(tag);
            const label=isMeta?tag.charAt(0)+tag.slice(1).toLowerCase():tag;
            return(
              <button key={tag} onClick={()=>toggleTag(tag)} style={{
                padding:"4px 11px",
                border:`1px solid ${active?color:color+"44"}`,
                borderRadius:4,
                background:active?color:`${color}10`,
                color:active?"#0a0b12":color,
                fontSize:10,fontWeight:700,letterSpacing:1.5,
                fontFamily:"'JetBrains Mono',monospace",
                cursor:"pointer",userSelect:"none",
                transition:"background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
              }}>#{label}</button>
            );
          };
          return(<>
            <div style={{display:"flex",gap:6,justifyContent:"center"}}>{firstRow.map(renderTag)}</div>
            {secondRow.length>0&&<div style={{display:"flex",gap:6,justifyContent:"center"}}>{secondRow.map(renderTag)}</div>}
          </>);
        })()}
      </div>

      {/* ── NEWS FEED ── */}
      <div id="feed-wrap" style={{...ST.feedWrap,left:feedLeft,width:feedWidth}}>
        <div id="feed-carousel" style={ST.carousel}>
          {(()=>{
            const fActiveIdx=filteredNews.findIndex(n=>n.id===activeId);
            return filteredNews.map((item,fIdx)=>{
            const N=filteredNews.length;
            let offset=fIdx-fActiveIdx;
            if(offset>N/2)offset-=N;
            if(offset<-N/2)offset+=N;
            const isActive=offset===0;
            const acc=CH[item.cat];
            let y;
            if(offset===0){y=MIDDLE_Y;}
            else if(offset<0){y=MIDDLE_Y+offset*ITEM_SPACING-ACTIVE_EXTRA_TOP;}
            else{y=MIDDLE_Y+offset*ITEM_SPACING+ACTIVE_EXTRA_BOTTOM;}
            const absOff=Math.abs(offset);
            const op=absOff>4?0:1-absOff*0.12;
            const scl=1-absOff*0.04;
            return(<div key={item.id} onClick={()=>handleClick(item)}
              onMouseEnter={e=>{
                setHoveredId(item.id);
                if(isActive){
                  const r=e.currentTarget.getBoundingClientRect();
                  cardMouseTargetRef.current={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
                  if(lerpRafRef.current)cancelAnimationFrame(lerpRafRef.current);
                  const lerp=()=>{setCardMouse(c=>{const{x:tx,y:ty}=cardMouseTargetRef.current;const dx=tx-c.x,dy=ty-c.y;if(Math.abs(dx)<0.003&&Math.abs(dy)<0.003){lerpRafRef.current=null;return{x:tx,y:ty};}lerpRafRef.current=requestAnimationFrame(lerp);return{x:c.x+dx*0.09,y:c.y+dy*0.09};});};
                  lerpRafRef.current=requestAnimationFrame(lerp);
                }
              }}
              onMouseLeave={()=>{
                setHoveredId(null);
                if(isActive){
                  cardMouseTargetRef.current={x:0.5,y:0.5};
                  if(lerpRafRef.current)cancelAnimationFrame(lerpRafRef.current);
                  const lerp=()=>{setCardMouse(c=>{const dx=0.5-c.x,dy=0.5-c.y;if(Math.abs(dx)<0.004&&Math.abs(dy)<0.004){lerpRafRef.current=null;return{x:0.5,y:0.5};}lerpRafRef.current=requestAnimationFrame(lerp);return{x:c.x+dx*0.09,y:c.y+dy*0.09};});};
                  lerpRafRef.current=requestAnimationFrame(lerp);
                }
              }}
              onMouseMove={isActive?(e=>{
                const r=e.currentTarget.getBoundingClientRect();
                cardMouseTargetRef.current={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
                if(!lerpRafRef.current){
                  const lerp=()=>{setCardMouse(c=>{const{x:tx,y:ty}=cardMouseTargetRef.current;const dx=tx-c.x,dy=ty-c.y;if(Math.abs(dx)<0.003&&Math.abs(dy)<0.003){lerpRafRef.current=null;return{x:tx,y:ty};}lerpRafRef.current=requestAnimationFrame(lerp);return{x:c.x+dx*0.18,y:c.y+dy*0.18};});};
                  lerpRafRef.current=requestAnimationFrame(lerp);
                }
              }):undefined}
              style={{
                position:"absolute",top:y,left:cardLeftOffset,width:cardW,height:cardH,
                transform:`scale(${scl})`,transformOrigin:"left center",
                transition:"top 380ms cubic-bezier(0.22,1,0.36,1),transform 380ms cubic-bezier(0.22,1,0.36,1),opacity 300ms,border-left-color 250ms,background 250ms",
                opacity:op,zIndex:isActive?20:10-absOff,cursor:"pointer",
                padding:"18px 22px",borderLeft:`3px solid ${isActive?acc:"transparent"}`,
                background:isActive?"rgba(10,11,18,0.55)":(hoveredId===item.id?`${acc}04`:"transparent"),
                borderRadius:"0 10px 10px 0",pointerEvents:absOff>4?"none":"auto",
                overflow:isActive?"visible":"hidden",
              }}>
              {isActive&&<>
                {/* SVG filter for liquid distortion — static at rest, driven by cardMouse on hover */}
                <svg style={{position:"absolute",width:0,height:0,overflow:"hidden"}}>
                  <defs>
                    <filter id={`liq-${item.id}`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
                      <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="3" seed="8" result="noise"/>
                      <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G"/>
                    </filter>
                  </defs>
                </svg>

                {/* Layer 1: Asymmetric backdrop blur — heavy left, dissolves right */}
                <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,borderRadius:"0 10px 10px 0",
                  backdropFilter:"blur(18px) saturate(1.9) brightness(0.92)",
                  WebkitBackdropFilter:"blur(18px) saturate(1.9) brightness(0.92)",
                  WebkitMaskImage:"linear-gradient(to right,black 0%,black 50%,rgba(0,0,0,0.35) 80%,rgba(0,0,0,0.08) 100%), linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)",
                  maskImage:"linear-gradient(to right,black 0%,black 50%,rgba(0,0,0,0.35) 80%,rgba(0,0,0,0.08) 100%), linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)",
                  maskComposite:"intersect",
                  WebkitMaskComposite:"destination-in",
                  background:"rgba(8,10,20,0.38)"}}/>

                {/* Layer 2: Flowing color refraction — background dot palette (red/cyan/green) distorted through turbulence */}
                <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1,borderRadius:"0 10px 10px 0",
                  background:`
                    radial-gradient(ellipse 130% 70% at ${-10+cardMouse.x*55}% ${15+cardMouse.y*55}%, rgba(255,42,109,0.18) 0%, transparent 55%),
                    radial-gradient(ellipse 110% 80% at ${55+cardMouse.x*50}% ${cardMouse.y*75}%, rgba(0,240,255,0.15) 0%, transparent 50%),
                    radial-gradient(ellipse 90% 100% at ${30+cardMouse.x*35}% ${85-cardMouse.y*45}%, rgba(5,255,161,0.10) 0%, transparent 45%)
                  `,
                  filter:`url(#liq-${item.id})`,
                  WebkitMaskImage:"linear-gradient(to bottom,transparent 0%,black 10%,black 90%,transparent 100%)",
                  maskImage:"linear-gradient(to bottom,transparent 0%,black 10%,black 90%,transparent 100%)",
                  mixBlendMode:"screen"}}/>

                {/* Layer 3: Mouse-following specular — shifts hue toward accent near left/right edges */}
                {(()=>{
                  const nearRightEdge=Math.max(0,(cardMouse.x-0.5)*2.4); // 0 at center → 1 at right
                  const nearLeftEdge=Math.max(0,(0.5-cardMouse.x)*2.4)*0.25; // left side dampened to 25%
                  const nearEdge=nearRightEdge+nearLeftEdge;
                  const accRgb=item.cat==='world'?'255,42,109':item.cat==='investments'?'5,255,161':'0,240,255';
                  return(<>
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:2,borderRadius:"0 10px 10px 0",
                      background:`
                        radial-gradient(ellipse 50% 42% at ${cardMouse.x*100}% ${cardMouse.y*100}%,
                          rgba(255,255,255,${+(0.11*(1-nearEdge)).toFixed(3)}) 0%,
                          rgba(255,255,255,${+(0.025*(1-nearEdge)).toFixed(3)}) 50%,
                          transparent 72%),
                        radial-gradient(ellipse 55% 48% at ${cardMouse.x*100}% ${cardMouse.y*100}%,
                          rgba(${accRgb},${+(nearEdge*0.5).toFixed(3)}) 0%,
                          rgba(${accRgb},${+(nearEdge*0.14).toFixed(3)}) 38%,
                          transparent 65%)`}}/>
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:3,borderRadius:"0 10px 10px 0",
                      boxShadow:`inset ${(cardMouse.x-0.5)*14}px ${(cardMouse.y-0.5)*14}px 40px rgba(${accRgb},${+(0.03+nearEdge*0.09).toFixed(3)}), inset 0 0 0 0.5px rgba(${accRgb},${+(0.03+cardMouse.x*0.1+nearEdge*0.12).toFixed(3)})`}}/>
                    {/* Right-edge halo — bar glow bleeds into glass when cursor is near right */}
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:2,borderRadius:"0 10px 10px 0",
                      background:`radial-gradient(ellipse 35% 85% at 100% 50%, rgba(${accRgb},${+(nearRightEdge*0.28).toFixed(3)}) 0%, rgba(${accRgb},${+(nearRightEdge*0.08).toFixed(3)}) 45%, transparent 70%)`,
                      WebkitMaskImage:"linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
                      maskImage:"linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
                      mixBlendMode:"screen"}}/>
                  </>);
                })()}
              </>}
              {isActive&&<>
                {/* Hidden ref at right-center for connection line */}
                <div ref={el=>barRefs.current[item.id]=el} style={{position:"absolute",right:2,top:"50%",width:2,height:2,pointerEvents:"none",zIndex:4}}/>
                {/* Tapered bracket — glow intensifies as cursor approaches from right */}
                <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",zIndex:3,pointerEvents:"none",overflow:"visible"}} viewBox="0 0 564 275" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`bz-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={acc} stopOpacity="0"/>
                      <stop offset="16%"  stopColor={acc} stopOpacity="1"/>
                      <stop offset="84%"  stopColor={acc} stopOpacity="1"/>
                      <stop offset="100%" stopColor={acc} stopOpacity="0"/>
                    </linearGradient>
                    <filter id={`bz-glow-${item.id}`} x="-400%" y="-10%" width="900%" height="120%">
                      <feGaussianBlur stdDeviation={4+Math.max(0,(cardMouse.x-0.5)*2.4)*6}/>
                    </filter>
                  </defs>
                  <path d="M 540,2 Q 568,2,568,13 L 568,263 Q 568,273,540,273 Q 560,273,560,263 L 560,13 Q 560,2,540,2 Z"
                    fill={acc} filter={`url(#bz-glow-${item.id})`} opacity={+(0.35+Math.max(0,(cardMouse.x-0.5)*2.4)*0.55).toFixed(3)}/>
                  <path d="M 540,2 Q 568,2,568,13 L 568,263 Q 568,273,540,273 Q 560,273,560,263 L 560,13 Q 560,2,540,2 Z"
                    fill={`url(#bz-${item.id})`}/>
                </svg>
              </>}
              <div style={{position:"relative",zIndex:1,overflow:"hidden"}}>
                <div style={ST.row1}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                    <span style={ST.time}>{timeStr(item.dateTs)}</span>
                    <span style={{...ST.src,color:acc,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.src}</span>
                    {item.sourceCount>1&&<span style={{fontSize:10,color:"#858eaa",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>+{item.sourceCount-1}</span>}
                  </div>
                  {isActive&&(
                    <button
                      onClick={e=>{e.stopPropagation();setDetailItem(item);}}
                      title="View details"
                      aria-label="View details"
                      style={{
                        width:24,height:24,padding:0,flex:"none",
                        background:"transparent",border:`1px solid ${acc}55`,borderRadius:4,
                        color:acc,cursor:"pointer",display:"inline-flex",
                        alignItems:"center",justifyContent:"center",
                        transition:"background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.background=acc;e.currentTarget.style.borderColor=acc;e.currentTarget.style.color="#0a0b12";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=`${acc}55`;e.currentTarget.style.color=acc;}}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div style={ST.itemTitle}>{item.title}</div>
                {isActive&&item.tags&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4,marginBottom:2}}>
                  {item.tags.map(t=>{
                    const on=activeTags.includes(t);
                    return <span key={t} style={{padding:"2px 10px",border:`1px solid ${on?acc:acc+"55"}`,borderRadius:4,color:on?"#0a0b12":acc,fontSize:11,fontWeight:700,letterSpacing:1.5,fontFamily:"'JetBrains Mono',monospace",background:on?acc:`${acc}14`,transition:"background 0.15s ease, color 0.15s ease, border-color 0.15s ease"}}>#{t}</span>;
                  })}
                </div>}
                {!isActive&&<div style={ST.preview}>{item.summary.slice(0,110)}…</div>}
                {isActive&&<>
                  <div style={{overflow:"hidden",marginTop:10}}>
                    <div style={{paddingRight:14}}>
                      <div style={ST.expText}>{item.summary}</div>
                      <div style={{...ST.foot,marginTop:10}}>
                        <BiasBar bias={item.bias}/>
                        <span style={{...ST.rel,color:item.rel>85?"#05ffa1":item.rel>70?"#f5c518":"#ff2a6d",borderColor:item.rel>85?"#05ffa133":item.rel>70?"#f5c51833":"#ff2a6d33"}}>{item.rel}%</span>
                        {/* TODO(phase2-auth): bookmark + read buttons disabled until login lands. */}
                        {/*
                        {(()=>{
                          const bm=bookmarkedIds.has(item.clusterId);
                          const rd=readIds.has(item.clusterId);
                          const btnStyle=on=>({padding:"2px 6px",border:`1px solid ${on?acc:acc+"44"}`,borderRadius:4,background:on?acc:"transparent",color:on?"#0a0b12":acc,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",height:22,transition:"background 0.15s ease, color 0.15s ease, border-color 0.15s ease"});
                          return(<>
                            <button onClick={e=>{e.stopPropagation();toggleBookmark(item.clusterId);}} style={btnStyle(bm)} title={bm?"Remove bookmark":"Bookmark"}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill={bm?"currentColor":"none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                            </button>
                            <button onClick={e=>{e.stopPropagation();toggleRead(item.clusterId);}} style={btnStyle(rd)} title={rd?"Mark unread":"Mark read"}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                          </>);
                        })()}
                        */}
                        {item.place&&<span style={{fontSize:12,color:"#858eaa",fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto"}}>📍 {item.place}</span>}
                      </div>
                    </div>
                  </div>
                </>}
              </div>
            </div>);
          });
          })()}
        </div>
      </div>

      {/* ── GLOBE ── */}
      {!isMobile&&(
        <div id="globe-wrap" style={{...ST.globeWrap,left:globeLeft,width:globeWidth}}>
          <Globe news={NEWS} hoveredId={hoveredId} focusItem={focusItem} isLocked={expandedId!==null} lineSourceRef={lineSourceRef} svgPathRef={svgPathRef} cssScale={1} onUserDrag={handleGlobeDrag} onMarkerClick={handleMarkerClick} mode={mode} visibleIds={visibleIds}/>
        </div>
      )}

      <NewsDetailModal item={detailItem} onClose={()=>setDetailItem(null)} accent={detailItem?CH[detailItem.cat]:"#00f0ff"}/>

    </div>
  </>);
}

/* ═══════════ STYLES ═══════════ */
const ST={
  root:{position:"relative",width:"100vw",height:"100vh",overflow:"hidden",background:"#0d0e14",fontFamily:"'JetBrains Mono',monospace",color:"#f0f1f5"},
  bgGrid:{position:"absolute",inset:0,zIndex:0,opacity:.02,backgroundImage:"linear-gradient(#858eaa 1px,transparent 1px),linear-gradient(90deg,#858eaa 1px,transparent 1px)",backgroundSize:"50px 50px"},
  bgGrad:{position:"absolute",inset:0,zIndex:0,background:"radial-gradient(ellipse at 72% 78%,#12141d 0%,transparent 50%),radial-gradient(ellipse at 30% 15%,#181a25 0%,transparent 40%)"},
  feedWrap:{position:"absolute",top:0,height:"100vh",zIndex:10,pointerEvents:"auto",overflow:"hidden"},
  carousel:{position:"relative",height:"100%",width:"100%",overflow:"hidden",WebkitMaskImage:"linear-gradient(to bottom,transparent 0%,transparent 20%,black 30%,black 75%,transparent 85%)",maskImage:"linear-gradient(to bottom,transparent 0%,transparent 20%,black 30%,black 75%,transparent 85%)"},
  globeWrap:{position:"absolute",top:"25vh",height:"90vh",zIndex:12,pointerEvents:"auto"},
  row1:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10},
  src:{fontSize:12,fontWeight:700,letterSpacing:2,fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase"},
  time:{fontSize:11,color:"#858eaa",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1,flex:"none"},
  itemTitle:{fontSize:18,fontWeight:700,color:"#f0f1f5",lineHeight:1.4,marginBottom:6,letterSpacing:0.5},
  preview:{fontSize:13,color:"#858eaa",lineHeight:1.55},
  expText:{fontSize:14,lineHeight:1.75,color:"#b2b7c7"},
  foot:{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"},
  rel:{fontSize:11,fontWeight:700,padding:"2px 8px",border:"1px solid",borderRadius:4,fontFamily:"'JetBrains Mono',monospace"},
};
