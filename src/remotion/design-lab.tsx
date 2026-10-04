// Seçim için bağımsız örnekler. Üretim şablonlarına ve eski gönderilere bağlanmaz.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Composition, interpolate, registerRoot, Sequence, staticFile, useCurrentFrame } from 'remotion';

type Direction = 'pastel' | 'editorial' | 'night';
type Page = 'cover' | 'horoscope' | 'tarot';
type LabProps = { direction: Direction; page: Page; animated?: boolean };
const THEMES = {
  pastel: { bg: '#eee8f7', ink: '#302044', muted: '#70617c', accent: '#bd6549', paper: '#fff9ef', line: '#cab9dc', title: 'A · PASTEL KOZMİK', font: 'Arial, sans-serif' },
  editorial: { bg: '#f6f0e5', ink: '#27231f', muted: '#71665b', accent: '#8c313f', paper: '#fffaf1', line: '#c4b6a4', title: 'B · KREM EDİTORYAL', font: 'Georgia, serif' },
  night: { bg: '#101a32', ink: '#f9f4e9', muted: '#b4c1db', accent: '#e8c783', paper: '#1a2949', line: '#415579', title: 'C · GECE LACİVERTİ', font: 'Arial, sans-serif' },
} as const;

function Star({ size = 42, color }: { size?: number; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 100 100"><path d="M50 4 L60 38 L94 50 L60 61 L50 96 L39 61 L5 50 L39 38 Z" fill={color} /></svg>;
}

function TarotArt({ direction }: { direction: Direction }) {
  const t = THEMES[direction];
  return <svg width="300" height="430" viewBox="0 0 300 430">
    <rect x="2" y="2" width="296" height="426" rx={direction === 'editorial' ? 0 : 22} fill={t.bg} stroke={t.accent} strokeWidth="3" />
    <rect x="18" y="18" width="264" height="394" rx="12" fill="none" stroke={t.line} />
    <text x="150" y="52" textAnchor="middle" fontSize="20" fill={t.accent} fontFamily="Georgia">XVII</text>
    <path d="M150 82 L165 127 L212 142 L166 159 L150 205 L134 159 L88 142 L134 127 Z" fill={t.accent} />
    {[ [65,85],[234,85],[52,204],[246,204],[84,257],[216,257] ].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4" fill={t.accent} />)}
    <path d="M50 335 Q150 272 250 335 M50 353 Q150 290 250 353" stroke={t.muted} fill="none" strokeWidth="2" />
    <circle cx="150" cy="264" r="23" stroke={t.accent} fill="none" strokeWidth="2" />
    <path d="M150 290 L150 325 M130 316 L150 302 L172 316" stroke={t.accent} fill="none" strokeWidth="2" />
    <text x="150" y="390" textAnchor="middle" fontSize="24" fill={t.ink} fontFamily="Georgia">YILDIZ</text>
  </svg>;
}

export function DesignCard({ direction, page, animated = false }: LabProps) {
  const frame = useCurrentFrame();
  const t = THEMES[direction];
  const reveal = animated ? interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  const shift = Math.round((1 - reveal) * (direction === 'editorial' ? 90 : 42));
  const tarot = page === 'tarot';
  const night = direction === 'night';
  const editorial = direction === 'editorial';
  return <AbsoluteFill style={{ backgroundColor: t.bg, color: t.ink, fontFamily: 'Arial, sans-serif', padding: '78px 80px', overflow: 'hidden' }}>
    {direction === 'pastel' && <>
      <div style={{ position:'absolute', right:-145, top:255, width:650, height:650, border:`2px solid ${t.line}`, borderRadius:650, transform:`rotate(${animated ? frame / 6 : -15}deg)` }}><div style={{ position:'absolute', top:65, left:102 }}><Star color={t.accent} /></div></div>
      <div style={{ position:'absolute', right:-20, top:340, width:460, height:460, border:`1px solid ${t.line}`, borderRadius:460 }} />
    </>}
    {night && <div style={{ position:'absolute', inset:0 }}><svg width="1080" height="1350" viewBox="0 0 1080 1350"><path d="M770 210 L910 360 L780 525 L945 770 L755 960" stroke={t.line} strokeWidth="2" fill="none" />{[[770,210],[910,360],[780,525],[945,770],[755,960],[920,1040],[250,1120]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%2 ? 4 : 7} fill={t.accent} opacity={animated ? .6 + .4 * Math.sin((frame+i*10)/30) : .9} />)}</svg></div>}
    <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`${editorial ? 3 : 1}px solid ${t.line}`, paddingBottom:24, fontSize:24, letterSpacing:4 }}>
      <span>KOZMİK ARKAN</span><span style={{ color:t.accent }}>05 / 10 / 2026</span>
    </div>
    <div style={{ position:'relative', marginTop:40, display:'flex', gap:16, fontSize:24, letterSpacing:2 }}>
      <span style={{ backgroundColor:t.ink, color:t.bg, padding:'12px 18px' }}>{tarot ? 'GÜNLÜK TAROT' : 'GÜNLÜK BURÇ'}</span>
      <span style={{ padding:'12px 18px', border:`1px solid ${t.line}` }}>{tarot ? 'ERKEK' : 'KADIN'}</span>
    </div>
    <div style={{ position:'relative', flex:1, opacity:reveal, transform:`translateX(${editorial ? shift : 0}px) translateY(${editorial ? 0 : shift}px)`, paddingTop:page === 'cover' ? 95 : 52 }}>
      {page === 'cover' ? <>
        <div style={{ fontFamily:t.font, fontSize:editorial ? 116 : 100, lineHeight:1.05, maxWidth:810, fontWeight:editorial ? 400 : 600 }}>Mesajı<br />göndermeden<br />önce burcuna bak.</div>
        <div style={{ marginTop:56, width:160, height:4, backgroundColor:t.accent }} />
        <p style={{ fontSize:32, lineHeight:1.5, maxWidth:650, color:t.muted }}>Bugünün küçük molası,<br />yarının büyük farkı olabilir.</p>
        <div style={{ marginTop:58, fontSize:27, color:t.accent }}>12 BURÇ · KENDİ YORUMUNU BUL →</div>
      </> : <>
        <div style={{ display:'flex', alignItems:'baseline', gap:26 }}><span style={{ fontFamily:t.font, fontSize:112, fontWeight:editorial ? 400 : 600 }}>Koç</span><span style={{ fontSize:24, color:t.muted }}>21 MART – 20 NİSAN</span></div>
        {tarot ? <div style={{ display:'flex', gap:42, marginTop:35, alignItems:'center' }}>
          <div style={{ transform:animated && night ? `perspective(1000px) rotateY(${Math.round((1-reveal)*80)}deg)` : undefined }}><TarotArt direction={direction} /></div>
          <div style={{ width:490 }}><div style={{ color:t.accent, fontSize:25, letterSpacing:3 }}>XVII · YILDIZ</div><h1 style={{ fontFamily:t.font, fontSize:65, lineHeight:1.1, fontWeight:editorial ? 400 : 600, margin:'22px 0 30px' }}>Umuduna<br />alan aç.</h1><p style={{ fontSize:30, lineHeight:1.5, color:t.muted }}>Yeniden denemek istediğin şey ne? Bugün ilk küçük adımı seç.</p></div>
        </div> : <>
          <h1 style={{ fontFamily:t.font, fontSize:75, lineHeight:1.08, fontWeight:editorial ? 400 : 600, margin:'42px 0 46px', maxWidth:700 }}>Bugün biraz<br />yavaşla.</h1>
          {[
            ['01','AŞK','Söylemek istediğini sakin bir cümleyle anlat.'],
            ['02','İŞ','Önceliğini tek bir işe ver.'],
            ['03','PARA','Küçük harcamalarını gözden geçir.'],
          ].map(([n,label,body],i)=><div key={n} style={{ display:'flex', gap:24, padding:'22px 0', borderTop:`1px solid ${t.line}`, opacity:animated ? interpolate(frame,[18+i*8,32+i*8],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}) : 1 }}><span style={{ color:t.accent, fontSize:26, paddingTop:2 }}>{n}</span><div><div style={{ fontSize:21, color:t.accent, letterSpacing:3, marginBottom:10 }}>{label}</div><div style={{ fontSize:30, lineHeight:1.4, maxWidth:720 }}>{body}</div></div></div>)}
        </>}
        <div style={{ marginTop:tarot ? 64 : 28, fontSize:25, padding:'20px 24px', backgroundColor:t.paper, borderLeft:`4px solid ${t.accent}`, color:t.ink }}>GÜNÜN NOTU · {tarot ? 'Umudu küçük bir eyleme dönüştür.' : 'Cevap vermeden önce bir nefes al.'}</div>
      </>}
    </div>
    <div style={{ position:'relative', display:'flex', justifyContent:'space-between', borderTop:`1px solid ${t.line}`, paddingTop:24, color:t.muted, fontSize:21 }}><span>@kozmikarkan · kaydet & yeniden bak</span><span>TASARIM ÖRNEĞİ</span></div>
  </AbsoluteFill>;
}

function DesignVideo({ direction, voiceFile }: { direction: Direction; voiceFile?: string }) {
  const t = THEMES[direction];
  return <AbsoluteFill style={{ backgroundColor:t.bg }}>
    <div style={{ position:'absolute', top:120, left:0, width:1080, height:1350 }}>
      <Sequence from={0} durationInFrames={120}><DesignCard direction={direction} page="cover" animated /></Sequence>
      <Sequence from={120} durationInFrames={210}><DesignCard direction={direction} page="horoscope" animated /></Sequence>
      <Sequence from={330} durationInFrames={210}><DesignCard direction={direction} page="tarot" animated /></Sequence>
    </div>
    <div style={{ position:'absolute', bottom:240, left:80, color:t.muted, fontFamily:'Arial, sans-serif', fontSize:22 }}>Burç + tarot görünüm karşılaştırması · 18 saniye</div>
    <div style={{ position:'absolute', bottom:185, left:80, color:t.muted, fontFamily:'Arial, sans-serif', fontSize:20 }}>Ses: serkanses · Yapay zekâ ile üretilmiş onaylı ses</div>
    {voiceFile && <Audio src={staticFile(voiceFile)} />}
  </AbsoluteFill>;
}

function DesignLabRoot() {
  return <>{(['pastel','editorial','night'] as const).flatMap(direction=>[
    ...(['cover','horoscope','tarot'] as const).map(page=><Composition key={`${direction}-${page}`} id={`${direction}-${page}`} component={DesignCard} width={1080} height={1350} fps={30} durationInFrames={1} defaultProps={{direction,page}} />),
    <Composition key={`${direction}-video`} id={`${direction}-video`} component={DesignVideo} width={1080} height={1920} fps={30} durationInFrames={540} defaultProps={{direction}} />,
  ])}</>;
}

registerRoot(DesignLabRoot);
