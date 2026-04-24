"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { playSfx } from "@/lib/sfx";
import { useScramble } from "@/hooks/useScramble";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import { useTagFilter } from "@/hooks/useTagFilter";
import { useCardCarouselState, useCarouselNav } from "@/hooks/useCardCarousel";
import { useDashboardURLSync } from "@/hooks/useDashboardURLSync";
import type { NewsCard } from "@/lib/news";
import { CH } from "@/lib/news-colors";
import ParallaxDots from "@/components/home/ParallaxDots";
import BiasBar from "@/components/world/BiasBar";
import CategoryHeadline from "@/components/world/CategoryHeadline";
import NewsDetailModal from "@/components/world/NewsDetailModal";

// NewsGlobe pulls in three.js (~500KB). Split it into its own chunk so the
// world route's first paint ships without it; loads on client mount only.
const NewsGlobe = dynamic(() => import("@/components/world/NewsGlobe"), { ssr: false });

/* ═══════════ DATA ═══════════ */
const HOUR=3600*1000,DAY=24*HOUR;
// Active card summary is hard-capped so the expanded card height stays
// predictable; cut at the last complete word before the limit.
const ACTIVE_SUMMARY_MAX=160;
function truncateAtWord(text: string | null | undefined, max: number): string {
  if(!text||text.length<=max)return text||"";
  const slice=text.slice(0,max);
  const lastSpace=slice.lastIndexOf(" ");
  const cut=lastSpace>0?slice.slice(0,lastSpace):slice;
  return cut.replace(/[.,;:!?—-]+$/,"")+"…";
}
// Date.now() is called per-render — long-lived tabs need live elapsed times.
function timeStr(ts: number): string {const d=Date.now()-ts;if(d<HOUR)return Math.max(1,Math.round(d/60000))+"m";if(d<DAY)return Math.round(d/HOUR)+"h";return Math.round(d/DAY)+"d";}

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
  const [mode,setMode]=useState<"live"|"history">("live");
  const { NEWS, newsSource, baseFeed, liveCount, historyCount } = useNewsFeed(mode);

  const { activeId, setActiveId, hoveredId, setHoveredId, activeItem, activeCat, expandedId } = useCardCarouselState(baseFeed);

  const resetTagsRef = useRef<() => void>(() => {});
  const resetTagsStable = useCallback(() => { resetTagsRef.current(); }, []);
  const { activeTags, setActiveTags, toggleTag, filteredNews, availableTags } = useTagFilter(baseFeed, activeCat, mode);
  useEffect(() => { resetTagsRef.current = () => setActiveTags([]); }, [setActiveTags]);

  const { jumpToFirst } = useCarouselNav({
    baseFeed, filteredNews, activeCat,
    setActiveId, setHoveredId,
    carouselId: "feed-carousel",
    resetTags: resetTagsStable,
  });

  // Deep-link dashboard state via the URL. Read once on mount, write on
  // change. Enables sharing a view + native back-button navigation.
  useDashboardURLSync({ mode, setMode, activeId, setActiveId, activeTags, setActiveTags });

  const [focusItem,setFocusItem]=useState<(NewsCard & {_ts?:number})|null>(null);
  const [detailItem,setDetailItem]=useState<NewsCard|null>(null);
  const [viewH,setViewH]=useState(()=>typeof window!=="undefined"?window.innerHeight:900);
  const [viewW,setViewW]=useState(()=>typeof window!=="undefined"?window.innerWidth:1400);
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
  const barRefs=useRef<Record<string, HTMLDivElement | null>>({});

  const lineSourceRef=useRef<{x: number; y: number} | null>(null);
  const svgPathRef=useRef<SVGPathElement | null>(null);

  // Active-card glass FX — ref-driven CSS custom properties (--mx/--my/
  // --near-edge/--near-right-edge) avoid per-frame React re-renders.
  const activeCardElRef=useRef<HTMLDivElement | null>(null);
  const cardMouseTargetRef=useRef<{x: number; y: number}>({x:0.5,y:0.5});
  const cardMouseCurrentRef=useRef<{x: number; y: number}>({x:0.5,y:0.5});
  const lerpRafRef=useRef<number | null>(null);

  const writeFxVars=(x: number, y: number)=>{
    const el=activeCardElRef.current;
    if(!el)return;
    const nearRightEdge=Math.max(0,(x-0.5)*2.4);
    const nearLeftEdge=Math.max(0,(0.5-x)*2.4)*0.25;
    const nearEdge=nearRightEdge+nearLeftEdge;
    el.style.setProperty("--mx",String(x));
    el.style.setProperty("--my",String(y));
    el.style.setProperty("--near-right-edge",String(nearRightEdge));
    el.style.setProperty("--near-edge",String(nearEdge));
  };

  const startLerp=(speed=0.09)=>{
    if(lerpRafRef.current)cancelAnimationFrame(lerpRafRef.current);
    const tick=()=>{
      const {x:tx,y:ty}=cardMouseTargetRef.current;
      const cur=cardMouseCurrentRef.current;
      const dx=tx-cur.x, dy=ty-cur.y;
      if(Math.abs(dx)<0.003&&Math.abs(dy)<0.003){
        cardMouseCurrentRef.current={x:tx,y:ty};
        writeFxVars(tx,ty);
        lerpRafRef.current=null;
        return;
      }
      const nx=cur.x+dx*speed, ny=cur.y+dy*speed;
      cardMouseCurrentRef.current={x:nx,y:ny};
      writeFxVars(nx,ny);
      lerpRafRef.current=requestAnimationFrame(tick);
    };
    lerpRafRef.current=requestAnimationFrame(tick);
  };

  useEffect(()=>()=>{ if(lerpRafRef.current) cancelAnimationFrame(lerpRafRef.current); },[]);

  // Snap both displays back to labels whenever the active mode changes, so a
  // stale count from a prior hover doesn't linger on the newly-active side.
  const prevModeRef=useRef(mode);
  useEffect(()=>{
    if(prevModeRef.current===mode)return;
    prevModeRef.current=mode;
    snapLive("LIVE");
    snapHist("HISTORY");
  },[mode,snapLive,snapHist]);

  // ID set of items currently in the feed (mode-filtered). Drives which globe
  // markers are rendered and clickable — markers whose items are all outside
  // the current feed get hidden and excluded from hit-testing.
  const visibleIds=useMemo(()=>new Set(baseFeed.map(n=>n.id)),[baseFeed]);

  // After a tag toggle, jump to the first card in the current category matching the filter.
  // Deps are intentionally just [activeTags] — adding activeId would infinite-loop (we
  // setActiveId inside), and adding filteredNews would re-fire on every feed update.
  useEffect(()=>{
    if(activeTags.length===0)return;
    const firstInCat=filteredNews.find(n=>n.cat===activeCat);
    if(firstInCat&&firstInCat.id!==activeId)setActiveId(firstInCat.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(()=>{
    let raf: number | null = null, stop = false;
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
    // activeItem is recomputed each render; using activeId avoids firing on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeId]);

  const handleGlobeDrag=useCallback(()=>{setFocusItem(null);lineSourceRef.current=null;if(svgPathRef.current)svgPathRef.current.style.opacity="0";},[]);
  const handleClick=(item: NewsCard)=>{
    if(item.id===activeId){
      playSfx("click");
      // Re-focus globe and restore connection line only if this card has a location
      if(item.lat||item.lng){
        setFocusItem({...item,_ts:Date.now()});
        const bar=barRefs.current[item.id];
        if(bar){const r=bar.getBoundingClientRect();lineSourceRef.current={x:r.left+r.width/2,y:r.top+r.height/2};}
      }
    }else{
      playSfx("tick");
      setActiveId(item.id);
    }
  };
  const handleMarkerClick=useCallback((_locKey: string, itemIds: string[])=>{
    if(!itemIds||!itemIds.length)return;
    // Globe markers are built from the full NEWS set, but the feed is filtered
    // by mode (live/history). Restrict target selection to items actually in
    // the current feed — otherwise setActiveId gets bounced back by the
    // "active not in baseFeed" guard, producing the visual of the globe
    // snapping back to the previously-active card.
    const feedIds=new Set(baseFeed.map(n=>n.id));
    const visible=itemIds.filter(id=>feedIds.has(id));
    if(!visible.length)return;
    let targetId: string;
    if(expandedId && visible.includes(expandedId)){const curIdx=visible.indexOf(expandedId);targetId=visible[(curIdx+1)%visible.length];}
    else{targetId=visible[0];}
    if(targetId!=null){playSfx("tick-data-9");setActiveTags([]);setActiveId(targetId);}
    // setActiveTags/setActiveId are stable across renders; omitting avoids useless re-creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[expandedId,baseFeed]);


  return(<>
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
      <CategoryHeadline cat={activeCat} count={filteredNews.filter(n=>n.cat===activeCat).length} onJump={jumpToFirst} centered={isMobile} empty={baseFeed.length===0}/>

      {/* ── LIVE / HISTORY TOGGLE ── */}
      <div
        role="switch"
        tabIndex={0}
        aria-label="Feed mode"
        aria-checked={mode==="history"}
        onClick={()=>{
          const newMode=mode==="live"?"history":"live";
          const onNewActive=(newMode==="live"&&liveHover)||(newMode==="history"&&historyHover);
          if(onNewActive){
            setScrambleSuppressed(true);
            pendingDelayRef.current=true;
          }
          setMode(newMode);
        }}
        onKeyDown={(e)=>{
          if(e.key==="Enter"||e.key===" "){
            e.preventDefault();
            const newMode=mode==="live"?"history":"live";
            setMode(newMode);
          }
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
          fontFamily:"var(--font-jetbrains-mono),monospace",
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
          const renderTag=(tag: string)=>{
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
                fontFamily:"var(--font-jetbrains-mono),monospace",
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
            return(<div key={item.id}
              ref={isActive?(el)=>{activeCardElRef.current=el;}:undefined}
              role="button"
              tabIndex={absOff>4?-1:0}
              aria-label={item.title}
              aria-pressed={isActive}
              onClick={()=>handleClick(item)}
              onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();handleClick(item);}}}
              onMouseEnter={e=>{
                setHoveredId(item.id);
                if(isActive){
                  const r=e.currentTarget.getBoundingClientRect();
                  cardMouseTargetRef.current={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
                  startLerp(0.09);
                }
              }}
              onMouseLeave={()=>{
                setHoveredId(null);
                if(isActive){
                  cardMouseTargetRef.current={x:0.5,y:0.5};
                  startLerp(0.09);
                }
              }}
              onMouseMove={isActive?(e=>{
                const r=e.currentTarget.getBoundingClientRect();
                cardMouseTargetRef.current={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
                if(!lerpRafRef.current) startLerp(0.18);
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
                {/* SVG filter for liquid distortion — used by Layer 2 below */}
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

                {/* Layer 2: flowing color refraction — positions track the --mx/--my
                    vars written via ref in writeFxVars (no React re-render per frame). */}
                <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1,borderRadius:"0 10px 10px 0",
                  background:"radial-gradient(ellipse 130% 70% at calc(-10% + var(--mx, 0.5) * 55%) calc(15% + var(--my, 0.5) * 55%), rgba(255,42,109,0.18) 0%, transparent 55%), radial-gradient(ellipse 110% 80% at calc(55% + var(--mx, 0.5) * 50%) calc(var(--my, 0.5) * 75%), rgba(0,240,255,0.15) 0%, transparent 50%), radial-gradient(ellipse 90% 100% at calc(30% + var(--mx, 0.5) * 35%) calc(85% - var(--my, 0.5) * 45%), rgba(5,255,161,0.10) 0%, transparent 45%)",
                  filter:`url(#liq-${item.id})`,
                  WebkitMaskImage:"linear-gradient(to bottom,transparent 0%,black 10%,black 90%,transparent 100%)",
                  maskImage:"linear-gradient(to bottom,transparent 0%,black 10%,black 90%,transparent 100%)",
                  mixBlendMode:"screen"}}/>

                {/* Layer 3: pointer-following specular — driven by --mx/--my/
                    --near-edge/--near-right-edge custom properties. */}
                {(()=>{
                  const accRgb=item.cat==='world'?'255,42,109':item.cat==='investments'?'5,255,161':item.cat==='science'?'217,70,239':'0,240,255';
                  return(<>
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:2,borderRadius:"0 10px 10px 0",
                      background:`radial-gradient(ellipse 50% 42% at calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%), rgba(255,255,255, calc(0.11 * (1 - var(--near-edge, 0)))) 0%, rgba(255,255,255, calc(0.025 * (1 - var(--near-edge, 0)))) 50%, transparent 72%), radial-gradient(ellipse 55% 48% at calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%), rgba(${accRgb}, calc(var(--near-edge, 0) * 0.5)) 0%, rgba(${accRgb}, calc(var(--near-edge, 0) * 0.14)) 38%, transparent 65%)`}}/>
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:3,borderRadius:"0 10px 10px 0",
                      boxShadow:`inset calc((var(--mx, 0.5) - 0.5) * 14px) calc((var(--my, 0.5) - 0.5) * 14px) 40px rgba(${accRgb}, calc(0.03 + var(--near-edge, 0) * 0.09)), inset 0 0 0 0.5px rgba(${accRgb}, calc(0.03 + var(--mx, 0.5) * 0.1 + var(--near-edge, 0) * 0.12))`}}/>
                    {/* Right-edge halo — bar glow bleeds into glass when cursor is near right */}
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:2,borderRadius:"0 10px 10px 0",
                      background:`radial-gradient(ellipse 35% 85% at 100% 50%, rgba(${accRgb}, calc(var(--near-right-edge, 0) * 0.28)) 0%, rgba(${accRgb}, calc(var(--near-right-edge, 0) * 0.08)) 45%, transparent 70%)`,
                      WebkitMaskImage:"linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
                      maskImage:"linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
                      mixBlendMode:"screen"}}/>
                  </>);
                })()}
              </>}
              {isActive&&<>
                {/* Hidden ref at right-center for connection line */}
                <div ref={el=>{barRefs.current[item.id]=el;}} style={{position:"absolute",right:2,top:"50%",width:2,height:2,pointerEvents:"none",zIndex:4}}/>
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
                      {/* stdDeviation is an SVG attr — can't be CSS-var'd.
                          Using a fixed middle value; the path's opacity still
                          breathes via --near-right-edge below. */}
                      <feGaussianBlur stdDeviation="6"/>
                    </filter>
                  </defs>
                  <path d="M 540,2 Q 568,2,568,13 L 568,263 Q 568,273,540,273 Q 560,273,560,263 L 560,13 Q 560,2,540,2 Z"
                    fill={acc} filter={`url(#bz-glow-${item.id})`}
                    style={{opacity:"calc(0.35 + var(--near-right-edge, 0) * 0.55)"}}/>
                  <path d="M 540,2 Q 568,2,568,13 L 568,263 Q 568,273,540,273 Q 560,273,560,263 L 560,13 Q 560,2,540,2 Z"
                    fill={`url(#bz-${item.id})`}/>
                </svg>
              </>}
              <div style={{position:"relative",zIndex:1,overflow:"hidden"}}>
                <div style={ST.row1}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                    <span style={ST.time}>{timeStr(item.dateTs)}</span>
                    <span style={{...ST.src,color:acc,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.src}</span>
                    {item.sourceCount>1&&<span style={{fontSize:10,color:"#858eaa",fontFamily:"var(--font-jetbrains-mono),monospace",letterSpacing:1}}>+{item.sourceCount-1}</span>}
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
                      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
                    return <span key={t} style={{padding:"2px 10px",border:`1px solid ${on?acc:acc+"55"}`,borderRadius:4,color:on?"#0a0b12":acc,fontSize:11,fontWeight:700,letterSpacing:1.5,fontFamily:"var(--font-jetbrains-mono),monospace",background:on?acc:`${acc}14`,transition:"background 0.15s ease, color 0.15s ease, border-color 0.15s ease"}}>#{t}</span>;
                  })}
                </div>}
                {!isActive&&<div style={ST.preview}>{item.summary.slice(0,110)}…</div>}
                {isActive&&<>
                  <div style={{overflow:"hidden",marginTop:10}}>
                    <div style={{paddingRight:14}}>
                      <div style={ST.expText}>{truncateAtWord(item.summary,ACTIVE_SUMMARY_MAX)}</div>
                      <div style={{...ST.foot,marginTop:10}}>
                        {item.cat!=="cyber"&&item.cat!=="science"&&<BiasBar bias={item.bias}/>}
                        {item.cat!=="cyber"&&item.cat!=="science"&&<span style={{...ST.rel,color:item.rel>70?"#05ffa1":item.rel>59?"#f5c518":"#ff2a6d",borderColor:item.rel>70?"#05ffa133":item.rel>59?"#f5c51833":"#ff2a6d33"}}>{item.rel}%</span>}
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
                        {item.place&&<span style={{fontSize:12,color:"#858eaa",fontFamily:"var(--font-jetbrains-mono),monospace",marginLeft:"auto"}}>📍 {item.place}</span>}
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
          <NewsGlobe news={NEWS} focusItem={focusItem} isLocked={expandedId!==null} lineSourceRef={lineSourceRef} svgPathRef={svgPathRef} onUserDrag={handleGlobeDrag} onMarkerClick={handleMarkerClick} mode={mode} visibleIds={visibleIds}/>
        </div>
      )}

      <NewsDetailModal item={detailItem} onClose={()=>setDetailItem(null)} accent={detailItem?CH[detailItem.cat]:"#00f0ff"}/>

    </div>
  </>);
}

/* ═══════════ STYLES ═══════════ */
const ST: Record<string, React.CSSProperties> = {
  root:{position:"relative",width:"100vw",height:"100vh",overflow:"hidden",background:"#0d0e14",fontFamily:"var(--font-jetbrains-mono),monospace",color:"#f0f1f5"},
  bgGrid:{position:"absolute",inset:0,zIndex:0,opacity:.02,backgroundImage:"linear-gradient(#858eaa 1px,transparent 1px),linear-gradient(90deg,#858eaa 1px,transparent 1px)",backgroundSize:"50px 50px"},
  bgGrad:{position:"absolute",inset:0,zIndex:0,background:"radial-gradient(ellipse at 72% 78%,#12141d 0%,transparent 50%),radial-gradient(ellipse at 30% 15%,#181a25 0%,transparent 40%)"},
  feedWrap:{position:"absolute",top:0,height:"100vh",zIndex:10,pointerEvents:"auto",overflow:"hidden"},
  carousel:{position:"relative",height:"100%",width:"100%",overflow:"hidden",WebkitMaskImage:"linear-gradient(to bottom,transparent 0%,transparent 20%,black 30%,black 75%,transparent 85%)",maskImage:"linear-gradient(to bottom,transparent 0%,transparent 20%,black 30%,black 75%,transparent 85%)"},
  globeWrap:{position:"absolute",top:"25vh",height:"90vh",zIndex:12,pointerEvents:"auto"},
  row1:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10},
  src:{fontSize:12,fontWeight:700,letterSpacing:2,fontFamily:"var(--font-jetbrains-mono),monospace",textTransform:"uppercase"},
  time:{fontSize:11,color:"#858eaa",fontFamily:"var(--font-jetbrains-mono),monospace",letterSpacing:1,flex:"none"},
  itemTitle:{fontSize:18,fontWeight:700,color:"#f0f1f5",lineHeight:1.4,marginBottom:6,letterSpacing:0.5},
  preview:{fontSize:13,color:"#858eaa",lineHeight:1.55},
  expText:{fontSize:14,lineHeight:1.75,color:"#b2b7c7"},
  foot:{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"},
  rel:{fontSize:11,fontWeight:700,padding:"2px 8px",border:"1px solid",borderRadius:4,fontFamily:"var(--font-jetbrains-mono),monospace"},
};
