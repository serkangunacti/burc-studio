import {Fragment} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {linearTiming,TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {SaturnMark} from '@/lib/brand/saturn-mark';
import {SIGN_SLUGS} from '@/lib/zodiac/signs';
import {graphemeLength} from '@/lib/text/turkish';
import {INTRO_FRAMES,OUTRO_FRAMES,SIGN_FRAMES,TRANSITION_FRAMES} from '@/remotion/reels';
import {FORMAT_SIZES,type SlideProps,type ReelsProps,type SignSlideData} from '@/remotion/slide-types';
import {TarotCardArt} from '@/remotion/tarot/tarot-card';
import {BODY_FONT,waitForFonts} from '../pastel-v1/fonts';
import {ZodiacGlyph} from '../pastel-v1/zodiac';

export {waitForFonts};
type Kind = 'horoscope'|'tarot'|'weekly';
const LABELS = {horoscope:'GÜNLÜK BURÇ',tarot:'GÜNLÜK TAROT',weekly:'HAFTALIK BURÇ'};
const INK='#302044',MUTED='#70617c',LINE='#cab9dc',ACCENT='#bd6549';
const BACKDROPS=['#eee8f7','#f4e7ef','#e5edf7','#f5e9dd','#e8efe8','#efe6f4','#f0eaf7'];

function Orbit({phase=0}:{phase?:number}) {
  return <><div style={{position:'absolute',right:-145,top:255,width:650,height:650,border:`2px solid ${LINE}`,borderRadius:650,transform:`rotate(${phase}deg)`}}><div style={{position:'absolute',top:65,left:102}}><SaturnMark size={42} color={ACCENT} strokeWidth={4}/></div></div><div style={{position:'absolute',right:-20,top:340,width:460,height:460,border:`1px solid ${LINE}`,borderRadius:460}} /></>;
}

function Scores({slide}:{slide:SignSlideData}) {
  return <div style={{display:'flex',gap:34,paddingTop:18,borderTop:`1px solid ${LINE}`,fontSize:24,color:MUTED}}>{[['Aşk',slide.scores.love],['Para',slide.scores.money],['Sağlık',slide.scores.health]].map(([label,value])=><span key={label}>{label} <strong style={{color:INK}}>{value}/5</strong></span>)}</div>;
}

export function CosmicSlide({kind='horoscope',phase=0,reels=false,...props}:SlideProps & {kind?:Kind;phase?:number;reels?:boolean}) {
  const {slide,brand,format,variant}=props;
  const sign=slide.type==='sign' ? slide : null;
  const length=sign ? graphemeLength(sign.body) : 0;
  const bodySize=reels ? 44 : kind==='weekly' ? length>780 ? 27 : 29 : kind==='tarot' ? 30 : length>360 ? 34 : 36;
  return <AbsoluteFill lang="tr" style={{...FORMAT_SIZES[format],backgroundColor:BACKDROPS[((variant%7)+7)%7],color:INK,fontFamily:BODY_FONT,fontSize:32,lineHeight:1.35,fontStyle:'normal',fontWeight:400,letterSpacing:'normal',textAlign:'left',overflow:'hidden',padding:'64px 80px 60px'}}>
    <Orbit phase={phase}/>
    <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${LINE}`,paddingBottom:24,fontSize:22,letterSpacing:2}}><span style={{display:'flex',alignItems:'center',gap:12}}><SaturnMark size={30} color={INK} strokeWidth={5}/>KOZMİK ARKAN</span>{slide.type!=='cta' && <span style={{color:ACCENT,maxWidth:480,textAlign:'right'}}>{slide.dateLabel}</span>}</div>
    <div style={{position:'relative',display:'flex',gap:16,marginTop:28,fontSize:23,letterSpacing:2}}><span style={{backgroundColor:INK,color:'#fff9ef',padding:'10px 16px'}}>{LABELS[kind]}</span><span style={{border:`1px solid ${LINE}`,padding:'10px 16px'}}>{slide.audience==='kadin'?'KADIN':'ERKEK'}</span></div>
    <div style={{position:'relative',flex:1,display:'flex',flexDirection:'column',minHeight:0,padding:'32px 0 24px'}}>
      {slide.type==='cover' && <>
        <div style={{marginTop:64,fontSize:graphemeLength(slide.hook)>45?80:92,fontWeight:700,lineHeight:1.1,maxWidth:860}}>{slide.hook}</div>
        <div style={{width:160,height:4,backgroundColor:ACCENT,marginTop:46}}/>
        <p style={{fontSize:32,color:MUTED,lineHeight:1.5,maxWidth:740}}>{kind==='tarot'?'Günün kartını bul, sana uyan mesajı keşfet.':kind==='weekly'?'Haftanın ritmini keşfet, kendi burcuna göz at.':'Bugünün küçük molası, yarının büyük farkı olabilir.'}</p>
        <div style={{marginTop:'auto',fontSize:25,color:ACCENT}}>{slide.partLabel ?? '12 BURÇ · KENDİ YORUMUNU BUL →'}</div>
        <div style={{display:'flex',gap:22,marginTop:30}}>{SIGN_SLUGS.map(sign=><ZodiacGlyph key={sign} sign={sign} size={50} color={MUTED} strokeWidth={4}/>)}</div>
      </>}
      {sign && <>
        <div style={{display:'flex',alignItems:'center',gap:24}}><ZodiacGlyph sign={sign.sign} size={74} color={ACCENT} strokeWidth={5}/><div><div data-slot="sign-name" style={{fontSize:82,fontWeight:700,lineHeight:1.2}}>{sign.signName}</div><div style={{fontSize:24,color:MUTED}}>{sign.dateRange}</div></div></div>
        <div style={{display:'flex',alignItems:'center',gap:32,flex:1,minHeight:0,padding:'22px 0'}}>
          {kind==='tarot' && sign.tarotCard && <div style={{width:reels?230:190,flexShrink:0}}><TarotCardArt cardId={sign.tarotCard.id} width={reels?230:190}/><div style={{fontSize:22,color:ACCENT,textAlign:'center',marginTop:12}}>{sign.tarotCard.name}</div></div>}
          <div style={{flex:1,minWidth:0}}>
            <div data-slot="headline" style={{fontSize:reels?58:kind==='weekly'?44:50,lineHeight:1.18,fontWeight:700,marginBottom:24}}>{sign.headline}</div>
            <div data-slot="body" style={{fontSize:bodySize,lineHeight:kind==='weekly'?1.32:1.4}}>{sign.body}</div>
          </div>
        </div>
        <Scores slide={sign}/>
        <div style={{display:'flex',gap:30,fontSize:24,color:MUTED,marginTop:14}}><span style={{display:'flex',alignItems:'center',gap:10}}><span style={{width:18,height:18,backgroundColor:sign.luckyColor.hex,border:`1px solid ${LINE}`,borderRadius:18}}/>{sign.luckyColor.name}</span><span>Şanslı sayı: {sign.luckyNumber}</span></div>
      </>}
      {slide.type==='cta' && <div style={{margin:'auto 0'}}><div style={{fontSize:90,fontWeight:700,lineHeight:1.1}}>Sana uyan<br/>notu kaydet.</div><div style={{width:160,height:4,backgroundColor:ACCENT,margin:'48px 0'}}/><div style={{fontSize:34,lineHeight:1.5,color:MUTED}}>Yarın yeni yorumlarla burada buluşalım.</div></div>}
    </div>
    <div style={{position:'relative',display:'flex',justifyContent:brand.position==='bottom-right'?'flex-end':'center',borderTop:`1px solid ${LINE}`,paddingTop:20,minHeight:45,fontSize:24,color:MUTED}}>{brand.enabled && brand.handle && <span data-slot="watermark" style={{display:'flex',alignItems:'center',gap:10,opacity:brand.opacity}}><SaturnMark size={28} color={INK} strokeWidth={5}/>@{brand.handle}</span>}{slide.type==='cta' && (!brand.enabled || !brand.handle) && <span>Yarın yeni yorumlarla buradayız</span>}</div>
  </AbsoluteFill>;
}

function CosmicScene({props,kind,index,total}:{props:SlideProps;kind:Kind;index?:number;total?:number}) {
  const frame=useCurrentFrame();
  const opacity=interpolate(frame,[0,12],[0,1],{extrapolateRight:'clamp'});
  const y=Math.round(interpolate(frame,[0,18],[26,0],{extrapolateRight:'clamp'}));
  return <AbsoluteFill style={{backgroundColor:BACKDROPS[((props.variant%7)+7)%7]}}><div style={{position:'absolute',top:120+y,left:0,width:1080,height:1350,opacity}}><CosmicSlide {...props} kind={kind} phase={frame/6} reels /></div>{index!==undefined && <div style={{position:'absolute',top:1515,left:80,width:920,color:MUTED,fontSize:24,fontFamily:BODY_FONT}}>{index+1} / {total} · Kendi burcunu bul<div style={{marginTop:16,height:3,width:Math.round(920*(index+1)/(total ?? 12)),backgroundColor:ACCENT}}/></div>}</AbsoluteFill>;
}

export function CosmicReels({kind='horoscope',...reels}:ReelsProps & {kind?:Kind}) {
  const common={brand:reels.brand,format:'4x5' as const,variant:reels.variant};
  const timing=linearTiming({durationInFrames:TRANSITION_FRAMES});
  return <AbsoluteFill style={{backgroundColor:BACKDROPS[((reels.variant%7)+7)%7]}}><TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={INTRO_FRAMES}><CosmicScene kind={kind} props={{...common,slide:{type:'cover',audience:reels.audience,dateLabel:reels.dateLabel,hook:reels.hook}}}/></TransitionSeries.Sequence>
    {reels.signs.map((sign,index)=><Fragment key={sign.sign}><TransitionSeries.Transition presentation={fade()} timing={timing}/><TransitionSeries.Sequence durationInFrames={SIGN_FRAMES}><CosmicScene kind={kind} index={index} total={reels.signs.length} props={{...common,slide:{...sign,type:'sign',audience:reels.audience,dateLabel:reels.dateLabel,body:sign.short}}}/></TransitionSeries.Sequence></Fragment>)}
    <TransitionSeries.Transition presentation={fade()} timing={timing}/><TransitionSeries.Sequence durationInFrames={OUTRO_FRAMES}><CosmicScene kind={kind} props={{...common,slide:{type:'cta',audience:reels.audience}}}/></TransitionSeries.Sequence>
  </TransitionSeries></AbsoluteFill>;
}

export const PastelCosmicSlide=(props:SlideProps)=><CosmicSlide {...props}/>;
export const PastelCosmicTarotSlide=(props:SlideProps)=><CosmicSlide {...props} kind="tarot"/>;
export const PastelCosmicWeeklySlide=(props:SlideProps)=><CosmicSlide {...props} kind="weekly"/>;
export const PastelCosmicReels=(props:ReelsProps)=><CosmicReels {...props}/>;
export const PastelCosmicTarotReels=(props:ReelsProps)=><CosmicReels {...props} kind="tarot"/>;
export const PastelCosmicWeeklyReels=(props:ReelsProps)=><CosmicReels {...props} kind="weekly"/>;
