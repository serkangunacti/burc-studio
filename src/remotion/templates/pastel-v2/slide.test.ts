import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {sampleProps,sampleSign,SAMPLE_COVER,LONGEST_WEEKLY_BODY} from '@/remotion/fixtures';
import {getTemplate} from '..';
describe('onaylı yeni pastel sürümleri',()=>{
  it.each([['pastel@2','GÜNLÜK BURÇ'],['pastel-tarot@2','GÜNLÜK TAROT'],['pastel-weekly@2','HAFTALIK BURÇ']])('%s türünü ve kadın/erkek ayrımını her kartta gösterir',(version,label)=>{
    const Slide=getTemplate(version).Slide;
    const cover=renderToStaticMarkup(createElement(Slide,sampleProps(SAMPLE_COVER)));
    expect(cover).toContain(label);
    const card=renderToStaticMarkup(createElement(Slide,sampleProps({...sampleSign('oglak','erkek'),body:LONGEST_WEEKLY_BODY})));
    expect(card).toContain('ERKEK');
    expect(card).toContain(label);
    expect(card).toContain(LONGEST_WEEKLY_BODY);
    expect(card).toContain('Şanslı sayı');
  });
});
