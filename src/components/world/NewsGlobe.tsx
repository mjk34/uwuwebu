"use client";

import { memo, useEffect, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { isReducedMotion } from "@/lib/motion";
import { CH, C3 } from "@/lib/news-colors";
import { ll3, decodeTopo, extractPolys, createLandMask, maskLookup, genDots } from "@/lib/topology";
import { CAPITALS, WARRING, CONFLICTS } from "@/lib/globe-capitals";
import type { NewsCard } from "@/lib/news";

type LineSource = { x: number; y: number } | null;

type NewsGlobeProps = {
  news: NewsCard[];
  focusItem: NewsCard | null;
  isLocked: boolean;
  lineSourceRef: RefObject<LineSource>;
  svgPathRef: RefObject<SVGPathElement | null>;
  onUserDrag: () => void;
  onMarkerClick: (locKey: string, itemIds: string[]) => void;
  mode: "live" | "history";
  visibleIds: Set<string>;
};

function NewsGlobe({ news, focusItem, isLocked, lineSourceRef, svgPathRef, onUserDrag, onMarkerClick, mode, visibleIds }: NewsGlobeProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S = useRef<any>({ labels: {}, targetRot: { x: 0.22, y: 0 }, currentRot: { x: 0.22, y: 0 }, dragging: false, dragMoved: false, lastMouse: { x: 0, y: 0 }, autoRotate: true, frame: null, defaultX: 0.22 });

  useEffect(()=>{
    const el=mountRef.current;if(!el)return;const st=S.current;
    // News arrives async from R2; defer globe init until we have items so the
    // locMarkers map isn't built from an empty feed (which would leave the
    // focus-line branch permanently dark).
    if(!news||news.length===0)return;
    const w=el.clientWidth,h=el.clientHeight;
    // Cancellation plumbing: unmount should abort the atlas fetch, block deferred
    // builders from touching a disposed scene, and let cleanup dispose THREE resources.
    let cancelled=false;
    const initTimeouts: number[]=[];
    const abortCtrl=typeof AbortController!=="undefined"?new AbortController():null;
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(36,w/h,0.1,100);camera.position.z=3.5;
    // Preflight WebGL: three.js's WebGLRenderer logs console.error before throwing,
    // which Next.js dev overlay surfaces even when caught. Probe first.
    const probe=document.createElement("canvas");
    const gl=probe.getContext("webgl2")||probe.getContext("webgl")||probe.getContext("experimental-webgl");
    if(!gl){console.warn("Globe: WebGL unavailable, skipping render.");return;}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locMap: Record<string, any>={};
    news.forEach(item=>{if(!item.lat&&!item.lng)return;const k=`${item.lat},${item.lng}`;if(!locMap[k])locMap[k]={lat:item.lat,lng:item.lng,items:[],place:item.place};locMap[k].items.push(item);});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locMarkers: Record<string, any>={};
    Object.entries(locMap).forEach(([k,loc])=>{
      const pos=ll3(loc.lat,loc.lng,1.03);
      const firstCol=C3[loc.items[0].cat as keyof typeof C3]||0xffffff;
      const dot=new THREE.Mesh(new THREE.SphereGeometry(0.008,8,8),new THREE.MeshBasicMaterial({color:firstCol}));dot.position.copy(pos);dot.userData.locKey=k;group.add(dot);
      const ring=new THREE.Mesh(new THREE.RingGeometry(0.012,0.025,16),new THREE.MeshBasicMaterial({color:firstCol,transparent:true,opacity:0.3,side:THREE.DoubleSide}));ring.position.copy(pos);ring.lookAt(0,0,0);group.add(ring);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const colors=loc.items.map((i: any)=>C3[i.cat as keyof typeof C3]||0xffffff);
      locMarkers[k]={dot,ring,pos:pos.clone(),items:loc.items,colors,colorIdx:0,place:loc.place};
    });
    st.locMarkers=locMarkers;

    const labels: Record<string, HTMLDivElement>={};
    Object.entries(locMarkers).forEach(([k,m])=>{if(!m.place)return;
      const lbl=document.createElement("div");
      lbl.style.cssText=`position:absolute;pointer-events:none;font:700 18px var(--font-jetbrains-mono),monospace;color:#00f0ff;background:rgba(13,14,20,0.92);padding:5px 12px;border-radius:5px;border:1px solid #00f0ff44;white-space:nowrap;opacity:0;transition:opacity .3s,color .3s,border-color .3s;z-index:5;letter-spacing:1.5px;text-transform:uppercase;`;
      lbl.textContent=m.place;el.appendChild(lbl);labels[k]=lbl;});
    st.labels=labels;

    // Capital city markers — data + WARRING set live in lib/globe-capitals.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capMarkers: any[]=[];
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
      lbl.style.cssText=`position:absolute;pointer-events:none;font:500 13px var(--font-jetbrains-mono),monospace;color:${labelColor};background:rgba(13,14,20,0.85);padding:3px 8px;border-radius:4px;border:1px solid ${labelBorder};white-space:nowrap;opacity:0;transition:opacity .25s;z-index:4;letter-spacing:1px;text-transform:uppercase;`;
      lbl.textContent=cap.name;el.appendChild(lbl);
      capMarkers.push({pos:pos.clone(),outerRing,innerRing,blocker,lbl});
    });
    st.capMarkers=capMarkers;

    // Conflict arc definitions live in lib/globe-capitals.ts.
    const capMap: Record<string, typeof CAPITALS[number]>={};CAPITALS.forEach(c=>capMap[c.name]=c);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conflictArcs: any[]=[];
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

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH??""}/data/countries-50m.json`,abortCtrl?{signal:abortCtrl.signal}:undefined)
      .then(r=>r.json()).then(topo=>{
        if(cancelled)return;
        const decoded=decodeTopo(topo);
        // Use 'countries' for mask (properly split at antimeridian)
        const polys=extractPolys(topo,decoded);
        const mask=createLandMask(polys);

        // Borders
        const segs: number[]=[];decoded.forEach(arc=>{for(let i=0;i<arc.length-1;i++){
          const p1=ll3(arc[i][1],arc[i][0],1.003),p2=ll3(arc[i+1][1],arc[i+1][0],1.003);segs.push(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z);}});
        const bg=new THREE.BufferGeometry();bg.setAttribute("position",new THREE.Float32BufferAttribute(segs,3));
        group.add(new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:0x00f0ff,transparent:true,opacity:0.45})));
        // Coast dots
        const cp: number[]=[];decoded.forEach(arc=>arc.forEach(([lng,lat])=>{
          const p=ll3(lat,lng,1.002);cp.push(p.x,p.y,p.z);}));
        const cg=new THREE.BufferGeometry();cg.setAttribute("position",new THREE.Float32BufferAttribute(cp,3));
        group.add(new THREE.Points(cg,new THREE.PointsMaterial({color:0x00f0ff,size:0.004,sizeAttenuation:true,transparent:true,opacity:0.45})));
        // Land + ocean dots — both built, one visible at a time based on mode
        initTimeouts.push(window.setTimeout(()=>{
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
        initTimeouts.push(window.setTimeout(()=>{
          if(cancelled)return;
          const TW=800,TH=400;
          const cvs=document.createElement("canvas");cvs.width=TW;cvs.height=TH;
          const ctx=cvs.getContext("2d");
          if(!ctx)return;
          const img=ctx.createImageData(TW,TH);
          const nz=(x: number,y: number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
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
          const ctx2=cvs2.getContext("2d");
          if(!ctx2)return;
          ctx2.filter="blur(1.5px)";ctx2.drawImage(cvs,0,0);
          const tex=new THREE.CanvasTexture(cvs2);
          coreMat.map=tex;coreMat.needsUpdate=true;
        },80));
      }).catch(()=>{});

    /* ── Input ── */

    const onD=(e: MouseEvent)=>{
      st.dragging=true;st.dragMoved=false;st.autoRotate=false;st._tiltRecovering=false;clearTimeout(st._returnTimer);st.lastMouse={x:e.clientX,y:e.clientY};st._downPos={x:e.clientX,y:e.clientY};el.style.cursor="grabbing";
      if(st._locked&&st._onUserDrag)st._onUserDrag();
    };
    const onM=(e: MouseEvent)=>{if(!st.dragging)return;
      const dx=e.clientX-st._downPos.x,dy=e.clientY-st._downPos.y;
      if(dx*dx+dy*dy>16)st.dragMoved=true;
      st.targetRot.y+=(e.clientX-st.lastMouse.x)*.005;st.targetRot.x+=(e.clientY-st.lastMouse.y)*.005;st.targetRot.x=Math.max(-1,Math.min(1,st.targetRot.x));st.lastMouse={x:e.clientX,y:e.clientY};};
    const onU=(e: MouseEvent)=>{
      const wasClick=st.dragging&&!st.dragMoved;
      st.dragging=false;el.style.cursor="grab";
      if(!st._locked){st._returnTimer=window.setTimeout(()=>{if(st._locked)return;st.autoRotate=true;st._tiltRecovering=true;},5000);}
      // Screen-space proximity click — find all markers near click point
      if(wasClick&&st._onMarkerClick){
        const rect=el.getBoundingClientRect();
        const cx=e.clientX-rect.left,cy=e.clientY-rect.top;
        const cw2=el.clientWidth;
        const sclF=rect.width/cw2;
        const RADIUS=40*sclF; // 40px hit radius in screen space
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nearby: any[]=[];
        const proj=new THREE.Vector3();
        const vis=st._visibleIds as Set<string> | undefined;
        Object.entries(locMarkers).forEach(([k,m])=>{
          // Skip markers with no items in the current feed — they're hidden
          // in render and should not be clickable either.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if(vis&&!m.items.some((i: any)=>vis.has(i.id)))return;
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
          const allItems: string[]=[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nearby.forEach(n=>n.m.items.forEach((i: any)=>allItems.push(i.id)));
          st._onMarkerClick(nearby[0].k,allItems);
        }
      }
    };
    el.addEventListener("mousedown",onD);window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);

    // Track mouse position over globe for capital hover
    const onHover=(e: MouseEvent)=>{const r=el.getBoundingClientRect();st._mouseX=e.clientX-r.left;st._mouseY=e.clientY-r.top;};
    const onLeave=()=>{st._mouseX=-999;st._mouseY=-999;};
    el.addEventListener("mousemove",onHover);el.addEventListener("mouseleave",onLeave);

    // Touch
    const onTS=(e: TouchEvent)=>{const t=e.touches[0];st.dragging=true;st.autoRotate=false;st._tiltRecovering=false;clearTimeout(st._returnTimer);st.lastMouse={x:t.clientX,y:t.clientY};if(st._locked&&st._onUserDrag)st._onUserDrag();};
    const onTM=(e: TouchEvent)=>{if(!st.dragging)return;const t=e.touches[0];st.targetRot.y+=(t.clientX-st.lastMouse.x)*.005;st.targetRot.x+=(t.clientY-st.lastMouse.y)*.005;st.targetRot.x=Math.max(-1,Math.min(1,st.targetRot.x));st.lastMouse={x:t.clientX,y:t.clientY};};
    const onTE=()=>{st.dragging=false;if(!st._locked){st._returnTimer=window.setTimeout(()=>{if(st._locked)return;st.autoRotate=true;st._tiltRecovering=true;},5000);}};
    el.addEventListener("touchstart",onTS,{passive:true});window.addEventListener("touchmove",onTM,{passive:true});window.addEventListener("touchend",onTE);

    let t=0;const v3=new THREE.Vector3();const PI2=Math.PI*2;
    const animate=()=>{st.frame=requestAnimationFrame(animate);t+=0.016;
      if(!isReducedMotion()&&!st._locked&&st.autoRotate&&!st.dragging)st.targetRot.y+=0.0008;
      // Normalize rotation to shortest path (prevents accumulation)
      while(st.targetRot.y-st.currentRot.y>Math.PI)st.targetRot.y-=PI2;
      while(st.targetRot.y-st.currentRot.y<-Math.PI)st.targetRot.y+=PI2;
      // Tilt recovery: very slow lerp back to default (paused during drag)
      const xRate=isReducedMotion()?1:((st._tiltRecovering&&!st.dragging)?0.002:(st._locked?0.025:0.012));
      if(st._tiltRecovering&&!st.dragging){st.targetRot.x=st.defaultX;if(Math.abs(st.currentRot.x-st.defaultX)<0.001)st._tiltRecovering=false;}
      st.currentRot.x+=(st.targetRot.x-st.currentRot.x)*xRate;
      st.currentRot.y+=(st.targetRot.y-st.currentRot.y)*(isReducedMotion()?1:0.012);
      // Keep values in range
      st.currentRot.y=((st.currentRot.y%PI2)+PI2)%PI2;
      st.targetRot.y=((st.targetRot.y%PI2)+PI2)%PI2;
      group.rotation.x=st.currentRot.x;group.rotation.y=st.currentRot.y;group.updateMatrixWorld();
      if(!isReducedMotion()){
        ring1.rotation.x=Math.sin(t*.25)*.4;ring1.rotation.z=Math.cos(t*.2)*.3;
        ring2.rotation.x=Math.cos(t*.3)*.4+1;ring2.rotation.z=Math.sin(t*.15)*.5;
      }

      // Conflict arcs — animate traveling projectiles along bezier curves
      if(!isReducedMotion()&&st.conflictArcs){
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        st.conflictArcs.forEach((arc: any)=>{
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
      const visSet=st._visibleIds as Set<string> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.entries(st.locMarkers as Record<string, any>).forEach(([k,m])=>{
        // Project first so we can cheaply cull both out-of-feed and
        // back-of-globe markers before doing any per-frame work.
        v3.copy(m.pos).applyMatrix4(group.matrixWorld).project(camera);
        const front=v3.z<1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasVisible=visSet?m.items.some((i: any)=>visSet.has(i.id)):true;
        const shouldRender=hasVisible&&front;
        if(m.dot.visible!==shouldRender){m.dot.visible=shouldRender;m.ring.visible=shouldRender;}
        if(!shouldRender){const lbl=st.labels[k];if(lbl&&lbl.style.opacity!=="0")lbl.style.opacity="0";return;}
        // Check if any item at this location is focused
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const focItem=m.items.find((i: any)=>i.id===st._focusId);
        const foc=!!focItem;
        const pulse=1+Math.sin(t*3)*.15;
        m.dot.scale.setScalar(foc?1.3:1);m.ring.scale.setScalar(foc?1.2*pulse:pulse);m.ring.material.opacity=foc?0.4:0.1+Math.sin(t*3)*.06;

        // Color cycling for multi-item locations (every 2s), or lock to focused item color
        if(foc){
          const col=C3[focItem.cat as keyof typeof C3]||0xffffff;
          m.dot.material.color.setHex(col);m.ring.material.color.setHex(col);
        }else if(m.colors.length>1){
          const ci=Math.floor(t/2)%m.colors.length;
          if(ci!==m.colorIdx){m.colorIdx=ci;m.dot.material.color.setHex(m.colors[ci]);m.ring.material.color.setHex(m.colors[ci]);}
        }

        const ix=(v3.x*.5+.5)*cw, iy=(-v3.y*.5+.5)*ch;
        const lbl=st.labels[k];
        if(lbl){
          lbl.style.left=`${ix-lbl.offsetWidth/2}px`;lbl.style.top=`${iy-56}px`;lbl.style.opacity=foc?"1":"0";
          if(foc){const hc=CH[focItem.cat as keyof typeof CH]||"#00ccff";lbl.style.color=hc;lbl.style.borderColor=hc+"44";}
        }
        // Connection line from expanded news bar to globe marker
        if(foc&&svgPathRef?.current&&lineSourceRef?.current){
          const ls=lineSourceRef.current;
          const gx=ix+rect.left/scl;
          const gy=iy+rect.top/scl;
          const cpx1=ls.x+(gx-ls.x)*.3,cpy1=ls.y;
          const cpx2=ls.x+(gx-ls.x)*.7,cpy2=gy;
          svgPathRef.current.setAttribute("d",`M${ls.x},${ls.y} C${cpx1},${cpy1} ${cpx2},${cpy2} ${gx},${gy}`);
          svgPathRef.current.setAttribute("stroke",CH[focItem.cat as keyof typeof CH]||"#00ccff");
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (st.capMarkers||[]).forEach((cap: any)=>{
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      capMarkers.forEach((c: any)=>{if(el.contains(c.lbl))el.removeChild(c.lbl);});
      // Walk scene graph and release GPU resources. Without this, every /world
      // unmount orphans ~120k-point BufferGeometries, ring/arc meshes, and the
      // ocean CanvasTexture — a leak on each route change.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scene.traverse((obj: any)=>{
        if(obj.geometry)obj.geometry.dispose();
        const mats=obj.material?(Array.isArray(obj.material)?obj.material:[obj.material]):[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mats.forEach((m: any)=>{
          for(const k in m){const v=m[k];if(v&&typeof v==="object"&&v.isTexture)v.dispose();}
          m.dispose();
        });
      });
      scene.clear();
      renderer.dispose();
      if(el.contains(renderer.domElement))el.removeChild(renderer.domElement);
    };
    // Globe init must run once per `news` identity. The refs (lineSourceRef,
    // svgPathRef) and `mode` are threaded through the state object on purpose
    // — including them would rebuild the entire Three.js scene on mode toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[news]);

  useEffect(()=>{S.current._onUserDrag=onUserDrag;},[onUserDrag]);
  useEffect(()=>{S.current._onMarkerClick=onMarkerClick;},[onMarkerClick]);
  useEffect(()=>{S.current._visibleIds=visibleIds;},[visibleIds]);
  // svgPathRef is a ref — intentionally not a dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{S.current._locked=isLocked;if(isLocked){clearTimeout(S.current._returnTimer);S.current._tiltRecovering=false;}if(!isLocked){S.current.autoRotate=true;S.current._focusId=null;if(svgPathRef?.current)svgPathRef.current.style.opacity="0";}},[isLocked]);
  useEffect(()=>{if(!focusItem){S.current._focusId=null;return;}const st=S.current;st._focusId=focusItem.id;if(focusItem.lat||focusItem.lng){st.targetRot.y=-Math.PI/2-(focusItem.lng??0)*Math.PI/180;const tiltMult=(focusItem.lat??0)<0?1.6:0.4;st.targetRot.x=(focusItem.lat??0)*Math.PI/180*tiltMult+st.defaultX;st.autoRotate=false;}},[focusItem]);
  // Toggle land/ocean dot visibility when mode changes
  useEffect(()=>{const st=S.current;if(st.landDots)st.landDots.visible=mode!=="history";if(st.oceanDots)st.oceanDots.visible=mode==="history";},[mode]);

  return (
    <div
      ref={mountRef}
      role="application"
      aria-label="Interactive 3D globe with news story markers. Drag to rotate, click markers to focus a story."
      style={{width:"100%",height:"100%",cursor:"grab",position:"relative",overflow:"hidden"}}
    />
  );
}

export default memo(NewsGlobe);
