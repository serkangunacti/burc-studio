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

// 1080x1920 Full-Screen Canlı Sinematik Reels Sahnesi
export function CosmicSlide({kind='horoscope',phase=0,reels=false,...props}:SlideProps & {kind?:Kind;phase?:number;reels?:boolean}) {
  const {slide,brand,format,variant}=props;
  const sign=slide.type==='sign' ? slide : null;
  const length=sign ? graphemeLength(sign.body) : 0;
  const bodySize=reels ? (length>400 ? 32 : length>280 ? 36 : 40) : kind==='weekly' ? length>780 ? 27 : 29 : kind==='tarot' ? 30 : length>360 ? 34 : 36;

  // Carousel (4x5 veya 1x1): Canlı Kozmik Cam Efektli (Glassmorphic) Tasarım
  if (!reels) {
    return <AbsoluteFill lang="tr" style={{
      ...FORMAT_SIZES[format],
      background: 'radial-gradient(circle at 60% 15%, rgba(138, 43, 226, 0.5) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(255, 20, 147, 0.4) 0%, transparent 50%), radial-gradient(circle at 20% 85%, rgba(0, 191, 255, 0.35) 0%, transparent 45%), linear-gradient(180deg, #0c071e 0%, #170d36 50%, #090417 100%)',
      color: '#ffffff',
      fontFamily: BODY_FONT,
      fontSize: 32,
      lineHeight: 1.35,
      fontStyle: 'normal',
      fontWeight: 400,
      letterSpacing: 'normal',
      textAlign: 'left',
      overflow: 'hidden',
      padding: '56px 64px 50px',
    }}>
      <Orbit phase={phase}/>
      {/* Üst Bar */}
      <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255, 255, 255, 0.18)',paddingBottom:20,fontSize:22,letterSpacing:2}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{background:'linear-gradient(135deg, #ffd166, #ff758c)',padding:8,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 15px rgba(255, 209, 102, 0.5)'}}>
            <SaturnMark size={26} color="#1b102e" strokeWidth={5}/>
          </div>
          <span style={{fontWeight:800,letterSpacing:3,color:'#fff'}}>KOZMİK ARKAN</span>
        </div>
        {slide.type!=='cta' && <span style={{background:'rgba(255, 255, 255, 0.12)',backdropFilter:'blur(12px)',padding:'6px 18px',borderRadius:20,border:'1px solid rgba(255, 255, 255, 0.25)',color:'#ffd166',fontSize:20,fontWeight:600}}>{slide.dateLabel}</span>}
      </div>

      <div style={{position:'relative',display:'flex',gap:14,marginTop:22,fontSize:20,letterSpacing:2}}>
        <span style={{background:'linear-gradient(90deg, #ff0844, #ffb199)',color:'#fff',padding:'8px 16px',borderRadius:16,fontWeight:700}}>{LABELS[kind]}</span>
        <span style={{background:'rgba(255, 255, 255, 0.1)',border:'1px solid rgba(255, 255, 255, 0.25)',padding:'8px 16px',borderRadius:16,color:'rgba(255, 255, 255, 0.85)'}}>{slide.audience==='kadin'?'KADIN':'ERKEK'}</span>
      </div>

      {/* Orta İçerik */}
      <div style={{position:'relative',flex:1,display:'flex',flexDirection:'column',minHeight:0,padding:'24px 0 16px',justifyContent:'center'}}>
        {slide.type==='cover' && <>
          <div style={{fontSize:graphemeLength(slide.hook)>45?72:84,fontWeight:900,lineHeight:1.15,background:'linear-gradient(135deg, #ffffff 30%, #ffd166 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',maxWidth:920,marginTop:20}}>
            {slide.hook}
          </div>
          <div style={{width:160,height:5,background:'linear-gradient(90deg, #ffd166, #ff758c)',borderRadius:4,boxShadow:'0 0 15px #ffd166',margin:'28px 0'}}/>
          <p style={{fontSize:30,color:'rgba(255, 255, 255, 0.85)',lineHeight:1.5,maxWidth:800}}>
            {kind==='tarot'?'Günün kartını bul, sana uyan mesajı keşfet.':kind==='weekly'?'Haftanın ritmini keşfet, kendi burcuna göz at.':'Bugünün küçük molası, yarının büyük farkı olabilir.'}
          </p>
          <div style={{marginTop:'auto',fontSize:22,fontWeight:700,color:'#ffd166',letterSpacing:2}}>
            {slide.partLabel ?? '12 BURÇ · KENDİ YORUMUNU BUL →'}
          </div>
          <div style={{display:'flex',gap:18,marginTop:20,background:'rgba(255, 255, 255, 0.08)',backdropFilter:'blur(20px)',border:'1px solid rgba(255, 255, 255, 0.18)',padding:'16px 24px',borderRadius:20}}>
            {SIGN_SLUGS.map(signKey=><ZodiacGlyph key={signKey} sign={signKey} size={46} color="#ffd166" strokeWidth={4}/>)}
          </div>
        </>}

        {sign && <>
          {/* Burç Başlığı */}
          <div style={{display:'flex',alignItems:'center',gap:20,background:'rgba(255, 255, 255, 0.1)',backdropFilter:'blur(20px)',border:'1px solid rgba(255, 255, 255, 0.22)',padding:'16px 26px',borderRadius:22,marginBottom:18}}>
            <div style={{width:80,height:80,borderRadius:20,background:'linear-gradient(135deg, #ffd166, #ff758c)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 20px rgba(255, 209, 102, 0.5)',flexShrink:0}}>
              <ZodiacGlyph sign={sign.sign} size={56} color="#1b102e" strokeWidth={5}/>
            </div>
            <div>
              <div data-slot="sign-name" style={{fontSize:68,fontWeight:900,lineHeight:1.1,color:'#fff'}}>{sign.signName}</div>
              <div style={{fontSize:22,color:'#ffd166',fontWeight:600}}>{sign.dateRange}</div>
            </div>
          </div>

          {/* Burç Yorum Metni */}
          <div style={{background:'rgba(255, 255, 255, 0.08)',backdropFilter:'blur(25px)',border:'1px solid rgba(255, 255, 255, 0.18)',padding:'28px 32px',borderRadius:24,flex:1,minHeight:0,display:'flex',flexDirection:'column',gap:16,justifyContent:'center'}}>
            {kind==='tarot' && sign.tarotCard && <div style={{width:160,flexShrink:0}}><TarotCardArt cardId={sign.tarotCard.id} width={160}/><div style={{fontSize:20,color:'#ffd166',textAlign:'center',marginTop:8}}>{sign.tarotCard.name}</div></div>}
            <div>
              <div data-slot="headline" style={{fontSize:kind==='weekly'?40:46,lineHeight:1.2,fontWeight:800,color:'#ffd166',marginBottom:14}}>
                {sign.headline}
              </div>
              <div data-slot="body" style={{fontSize:bodySize,lineHeight:1.38,color:'rgba(255, 255, 255, 0.95)'}}>
                {sign.body}
              </div>
            </div>
          </div>

          {/* Skorlar & Şanslı Bilgiler */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,marginTop:18}}>
            <div style={{display:'flex',gap:12}}>
              {[['Aşk',sign.scores.love,'#ff758c'],['Para',sign.scores.money,'#ffd166'],['Sağlık',sign.scores.health,'#06d6a0']].map(([label,val,col])=>(
                <div key={label as string} style={{background:'rgba(255, 255, 255, 0.1)',backdropFilter:'blur(15px)',border:`1px solid ${col as string}55`,padding:'8px 16px',borderRadius:16,fontSize:19,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{color:'rgba(255,255,255,0.8)'}}>{label}</span>
                  <strong style={{color:col as string,fontSize:22}}>{val}/5</strong>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:12}}>
              <div style={{background:'rgba(255, 255, 255, 0.1)',border:'1px solid rgba(255, 255, 255, 0.2)',padding:'8px 16px',borderRadius:16,fontSize:19,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:16,height:16,backgroundColor:sign.luckyColor.hex || '#ff758c',borderRadius:'50%'}}/>
                <span>{sign.luckyColor.name}</span>
              </div>
              <div style={{background:'rgba(255, 255, 255, 0.1)',border:'1px solid rgba(255, 255, 255, 0.2)',padding:'8px 16px',borderRadius:16,fontSize:19,fontWeight:600,color:'#ffd166'}}>
                Şans: <strong>{sign.luckyNumber}</strong>
              </div>
            </div>
          </div>
        </>}

        {slide.type==='cta' && <div style={{margin:'auto 0',textAlign:'center'}}>
          <div style={{fontSize:78,fontWeight:900,lineHeight:1.15,background:'linear-gradient(135deg, #ffffff 40%, #ffd166 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
            Sana Uyan<br/>Notu Kaydet ✨
          </div>
          <div style={{width:160,height:5,background:'linear-gradient(90deg, #ffd166, #ff758c)',borderRadius:4,margin:'32px auto'}}/>
          <div style={{fontSize:28,lineHeight:1.5,color:'rgba(255, 255, 255, 0.85)'}}>
            Yarın yeni yorumlarla burada buluşalım, sevgiyle kalın!
          </div>
        </div>}
      </div>

      {/* Alt Bar: Watermark */}
      <div style={{position:'relative',display:'flex',justify:brand.position==='bottom-right'?'flex-end':'center',borderTop:'1px solid rgba(255, 255, 255, 0.18)',paddingTop:16,minHeight:40,fontSize:22,color:'#ffd166',fontWeight:700}}>
        {brand.enabled && brand.handle && <span data-slot="watermark" style={{display:'flex',alignItems:'center',gap:10,opacity:brand.opacity}}><SaturnMark size={24} color="#ffd166" strokeWidth={5}/>@{brand.handle}</span>}
        {slide.type==='cta' && (!brand.enabled || !brand.handle) && <span>Yarın yeni yorumlarla buradayız</span>}
      </div>
    </AbsoluteFill>;
  }

  // REELS: 1080x1920 Tam Ekran Sinematik Tasarım
  return <AbsoluteFill lang="tr" style={{width:1080,height:1920,color:'#ffffff',fontFamily:BODY_FONT,padding:'100px 70px 140px',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'space-between',overflow:'hidden'}}>
    {/* Üst Bar: Logo, Kategori & Tarih */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255, 255, 255, 0.18)',paddingBottom:24}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <div style={{background:'linear-gradient(135deg, #ffd166, #ff758c)',padding:10,borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 20px rgba(255, 209, 102, 0.5)'}}>
          <SaturnMark size={32} color="#1b102e" strokeWidth={5}/>
        </div>
        <div>
          <span style={{fontSize:26,fontWeight:800,letterSpacing:3,color:'#fff',textShadow:'0 0 12px rgba(255,255,255,0.4)'}}>KOZMİK ARKAN</span>
          <div style={{fontSize:18,color:'rgba(255, 255, 255, 0.7)',letterSpacing:1.5}}>{LABELS[kind]} · {slide.audience==='kadin'?'KADIN':'ERKEK'}</div>
        </div>
      </div>
      {slide.type!=='cta' && <div style={{background:'rgba(255, 255, 255, 0.12)',backdropFilter:'blur(12px)',padding:'8px 20px',borderRadius:30,border:'1px solid rgba(255, 255, 255, 0.25)',fontSize:22,fontWeight:600,color:'#ffd166'}}>{slide.dateLabel}</div>}
    </div>

    {/* Orta Alan: İçerik */}
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',minHeight:0,padding:'30px 0'}}>
      {slide.type==='cover' && <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:28}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:10,background:'linear-gradient(90deg, #ff0844 0%, #ffb199 100%)',color:'#fff',padding:'12px 28px',borderRadius:30,fontSize:26,fontWeight:800,letterSpacing:3,boxShadow:'0 8px 30px rgba(255, 8, 68, 0.55)',animation:'pulse 2s infinite'}}>
          ✨ CANLARIM CİĞERLERİM ✨
        </div>
        <div style={{fontSize:graphemeLength(slide.hook)>45?72:86,fontWeight:900,lineHeight:1.15,background:'linear-gradient(135deg, #ffffff 30%, #ffd166 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',textShadow:'0 10px 30px rgba(0,0,0,0.5)',maxWidth:940}}>
          {slide.hook}
        </div>
        <div style={{width:200,height:5,background:'linear-gradient(90deg, #ffd166, #ff758c)',borderRadius:4,boxShadow:'0 0 15px #ffd166'}}/>
        <p style={{fontSize:34,color:'rgba(255, 255, 255, 0.85)',lineHeight:1.5,maxWidth:840,margin:0,fontWeight:400}}>
          {kind==='tarot'?'Günün tarot rehberliği ve kart enerjileri sizlerle.':'Bugünün gökyüzü enerjileri burcunuza ne fısıldıyor? Birlikte dinleyelim!'}
        </p>
        <div style={{marginTop:24,background:'rgba(255, 255, 255, 0.08)',backdropFilter:'blur(20px)',border:'1px solid rgba(255, 255, 255, 0.2)',padding:'20px 36px',borderRadius:24,display:'flex',gap:24,flexWrap:'wrap',justifyContent:'center',boxShadow:'0 15px 35px rgba(0,0,0,0.3)'}}>
          {SIGN_SLUGS.map(signKey=><ZodiacGlyph key={signKey} sign={signKey} size={52} color="#ffd166" strokeWidth={4}/>)}
        </div>
      </div>}

      {sign && <div style={{display:'flex',flexDirection:'column',gap:24}}>
        {/* Burç Başlığı ve İkonu */}
        <div style={{display:'flex',alignItems:'center',gap:24,background:'rgba(255, 255, 255, 0.1)',backdropFilter:'blur(20px)',border:'1px solid rgba(255, 255, 255, 0.25)',padding:'20px 32px',borderRadius:28,boxShadow:'0 12px 30px rgba(0,0,0,0.25)'}}>
          <div style={{width:100,height:100,borderRadius:24,background:'linear-gradient(135deg, #ffd166, #ff758c)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 25px rgba(255, 209, 102, 0.6)',flexShrink:0}}>
            <ZodiacGlyph sign={sign.sign} size={68} color="#1b102e" strokeWidth={5}/>
          </div>
          <div>
            <div data-slot="sign-name" style={{fontSize:72,fontWeight:900,lineHeight:1.1,color:'#fff',textShadow:'0 2px 10px rgba(0,0,0,0.3)'}}>{sign.signName}</div>
            <div style={{fontSize:24,color:'#ffd166',fontWeight:600,letterSpacing:1}}>{sign.dateRange}</div>
          </div>
        </div>

        {/* Burç Yorum Metni Kartı */}
        <div style={{background:'rgba(255, 255, 255, 0.08)',backdropFilter:'blur(25px)',border:'1px solid rgba(255, 255, 255, 0.18)',padding:'36px 40px',borderRadius:32,boxShadow:'0 20px 45px rgba(0,0,0,0.35)',display:'flex',flexDirection:'column',gap:20}}>
          <div data-slot="headline" style={{fontSize:52,lineHeight:1.2,fontWeight:800,color:'#ffd166',textShadow:'0 2px 15px rgba(255, 209, 102, 0.4)'}}>
            {sign.headline}
          </div>
          <div data-slot="body" style={{fontSize:bodySize,lineHeight:1.42,color:'rgba(255, 255, 255, 0.95)',fontWeight:400,textShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>
            {sign.body}
          </div>
        </div>

        {/* Skorlar & Şanslı Bilgiler */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:16}}>
            {[['Aşk',sign.scores.love,'#ff758c'],['Para',sign.scores.money,'#ffd166'],['Sağlık',sign.scores.health,'#06d6a0']].map(([label,val,col])=>(
              <div key={label as string} style={{background:'rgba(255, 255, 255, 0.1)',backdropFilter:'blur(15px)',border:`1px solid ${col as string}66`,padding:'12px 22px',borderRadius:20,fontSize:22,fontWeight:600,display:'flex',alignItems:'center',gap:10,boxShadow:`0 4px 15px ${(col as string)}33`}}>
                <span style={{color:'rgba(255,255,255,0.8)'}}>{label}</span>
                <strong style={{color:col as string,fontSize:26}}>{val}/5</strong>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:14}}>
            <div style={{background:'rgba(255, 255, 255, 0.1)',backdropFilter:'blur(15px)',border:'1px solid rgba(255, 255, 255, 0.2)',padding:'12px 22px',borderRadius:20,fontSize:22,fontWeight:600,display:'flex',alignItems:'center',gap:10}}>
              <span style={{width:20,height:20,backgroundColor:sign.luckyColor.hex || '#ff758c',borderRadius:'50%',boxShadow:`0 0 10px ${sign.luckyColor.hex || '#ff758c'}`}}/>
              <span>{sign.luckyColor.name}</span>
            </div>
            <div style={{background:'rgba(255, 255, 255, 0.1)',backdropFilter:'blur(15px)',border:'1px solid rgba(255, 255, 255, 0.2)',padding:'12px 22px',borderRadius:20,fontSize:22,fontWeight:600,color:'#ffd166'}}>
              Şans: <strong>{sign.luckyNumber}</strong>
            </div>
          </div>
        </div>
      </div>}

      {slide.type==='cta' && <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:32}}>
        <div style={{fontSize:88,fontWeight:900,lineHeight:1.15,background:'linear-gradient(135deg, #ffffff 40%, #ffd166 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          Sana Uyan Mesajı<br/>Kaydetmeyi Unutma ✨
        </div>
        <div style={{width:180,height:5,background:'linear-gradient(90deg, #ffd166, #ff758c)',borderRadius:4}}/>
        <div style={{fontSize:36,lineHeight:1.5,color:'rgba(255, 255, 255, 0.85)',maxWidth:780}}>
          Yarın yeni gökyüzü rehberliği ve burç yorumlarında buluşmak üzere, sevgiyle kalın!
        </div>
      </div>}
    </div>

    {/* Alt Bar: Watermark */}
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',borderTop:'1px solid rgba(255, 255, 255, 0.18)',paddingTop:24}}>
      <span style={{display:'flex',alignItems:'center',gap:12,fontSize:26,fontWeight:700,letterSpacing:2,color:'#ffd166',textShadow:'0 0 15px rgba(255, 209, 102, 0.6)'}}>
        <SaturnMark size={32} color="#ffd166" strokeWidth={5}/>
        @{brand.handle || 'kozmikarkan'}
      </span>
    </div>
  </AbsoluteFill>;
}

function CosmicScene({props,kind,index,total}:{props:SlideProps;kind:Kind;index?:number;total?:number}) {
  const frame=useCurrentFrame();
  const opacity=interpolate(frame,[0,10],[0,1],{extrapolateRight:'clamp'});
  const scale=interpolate(frame,[0,15],[0.97,1],{extrapolateRight:'clamp'});

  // Hareketli Aurora ve Nebula Gradyanı
  const auroraOffset = Math.sin(frame * 0.04) * 80;
  const glowPulse = Math.sin(frame * 0.08) * 0.2 + 0.8;

  return <AbsoluteFill style={{
    background: `radial-gradient(circle at ${50 + auroraOffset * 0.2}% 20%, rgba(138, 43, 226, 0.65) 0%, transparent 55%), radial-gradient(circle at ${80 - auroraOffset * 0.15}% 75%, rgba(255, 20, 147, 0.5) 0%, transparent 50%), radial-gradient(circle at 25% 85%, rgba(0, 191, 255, 0.45) 0%, transparent 45%), linear-gradient(180deg, #0c071e 0%, #170d36 50%, #090417 100%)`,
    overflow: 'hidden',
  }}>
    {/* 24 Adet Parıldayan Sinematik Yıldız Parçacıkları */}
    {Array.from({ length: 24 }).map((_, i) => {
      const sparkle = Math.sin((frame * 0.12) + i * 1.3) * 0.5 + 0.5;
      const x = (i * 47) % 94 + 3;
      const yPos = (i * 59) % 92 + 4;
      const size = 4 + (i % 4) * 2.5;
      const starColor = i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? '#00f5d4' : '#ff758c';
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${yPos}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: starColor,
            boxShadow: `0 0 ${size * 3}px ${starColor}`,
            opacity: 0.2 + sparkle * 0.8,
            transform: `scale(${0.7 + sparkle * 0.6})`,
          }}
        />
      );
    })}

    {/* Tam Ekran Slide Katmanı */}
    <div style={{position:'absolute',top:0,left:0,width:1080,height:1920,opacity,transform:`scale(${scale})`}}>
      <CosmicSlide {...props} kind={kind} phase={frame/4} reels />
    </div>

    {/* Alt Kısım: Dinamik Ses Frekansı (Audio Waveform) */}
    <div style={{position:'absolute',bottom:80,left:0,width:1080,display:'flex',flexDirection:'column',alignItems:'center',gap:12,pointerEvents:'none'}}>
      <div style={{display:'flex',alignItems:'center',gap:5}}>
        {Array.from({ length: 17 }).map((_, bar) => {
          const h = Math.round(10 + Math.abs(Math.sin((frame * 0.28) + bar * 0.65)) * 34 * glowPulse);
          return (
            <div
              key={bar}
              style={{
                width: 6,
                height: h,
                borderRadius: 4,
                background: 'linear-gradient(180deg, #ffd166 0%, #ff758c 100%)',
                boxShadow: '0 0 10px rgba(255, 209, 102, 0.7)',
              }}
            />
          );
        })}
      </div>

      {/* İlerleme Çubuğu */}
      {index!==undefined && <div style={{width:940,display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:20,fontWeight:700,letterSpacing:1.5,color:'rgba(255, 255, 255, 0.8)'}}>
          <span>{index + 1} / {total} · {props.slide.type==='sign' ? props.slide.signName : 'Burç'}</span>
          <span style={{color:'#ffd166'}}>Kozmik Anlatım 🎙️</span>
        </div>
        <div style={{height:6,width:'100%',backgroundColor:'rgba(255, 255, 255, 0.15)',borderRadius:4,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${Math.round(100*(index+1)/(total ?? 12))}%`,background:'linear-gradient(90deg, #ffd166, #ff758c)',borderRadius:4,boxShadow:'0 0 10px #ffd166'}}/>
        </div>
      </div>}
    </div>
  </AbsoluteFill>;
}

export function CosmicReels({kind='horoscope',...reels}:ReelsProps & {kind?:Kind}) {
  const common={brand:reels.brand,format:'4x5' as const,variant:reels.variant};
  const timing=linearTiming({durationInFrames:TRANSITION_FRAMES});
  return <AbsoluteFill style={{backgroundColor:'#0c071e'}}><TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={reels.sceneTiming?.introFrames ?? INTRO_FRAMES}><CosmicScene kind={kind} props={{...common,slide:{type:'cover',audience:reels.audience,dateLabel:reels.dateLabel,hook:reels.hook}}}/></TransitionSeries.Sequence>
    {reels.signs.map((sign,index)=><Fragment key={sign.sign}><TransitionSeries.Transition presentation={fade()} timing={timing}/><TransitionSeries.Sequence durationInFrames={reels.sceneTiming?.signFrames[index] ?? SIGN_FRAMES}><CosmicScene kind={kind} index={index} total={reels.signs.length} props={{...common,slide:{...sign,type:'sign',audience:reels.audience,dateLabel:reels.dateLabel,body:sign.body || sign.short}}}/></TransitionSeries.Sequence></Fragment>)}
    <TransitionSeries.Transition presentation={fade()} timing={timing}/><TransitionSeries.Sequence durationInFrames={reels.sceneTiming?.outroFrames ?? OUTRO_FRAMES}><CosmicScene kind={kind} props={{...common,slide:{type:'cta',audience:reels.audience}}}/></TransitionSeries.Sequence>
  </TransitionSeries></AbsoluteFill>;
}

export const PastelCosmicSlide=(props:SlideProps)=><CosmicSlide {...props}/>;
export const PastelCosmicTarotSlide=(props:SlideProps)=><CosmicSlide {...props} kind="tarot"/>;
export const PastelCosmicWeeklySlide=(props:SlideProps)=><CosmicSlide {...props} kind="weekly"/>;
export const PastelCosmicReels=(props:ReelsProps)=><CosmicReels {...props}/>;
export const PastelCosmicTarotReels=(props:ReelsProps)=><CosmicReels {...props} kind="tarot"/>;
export const PastelCosmicWeeklyReels=(props:ReelsProps)=><CosmicReels {...props} kind="weekly"/>;
