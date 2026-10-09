import {describe,expect,it} from 'vitest';
import {shouldRunScheduledRender} from './schedule-preflight.mjs';

describe('zamanlanmış render ön kontrolü',()=>{
  it('manuel çalıştırmayı kota saatine bağlı tutmaz',()=>{
    expect(shouldRunScheduledRender({eventName:'workflow_dispatch',now:'2026-11-02T07:10:00Z'}).shouldRun).toBe(true);
  });
  it('zamanlanmış renderı 05:00 TSİ saatinde engellemeden başlatır',()=>{
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T02:00:00Z',workflowRuns:[]})).toMatchObject({shouldRun:true});
  });
  it('aynı Türkiye günündeki başarılı zamanlanmış renderı yedek cronlarda yinelemez',()=>{
    const workflowRuns=[{event:'schedule',status:'completed',conclusion:'success',created_at:'2026-11-02T02:05:00Z'}];
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T03:15:00Z',workflowRuns})).toMatchObject({shouldRun:false});
  });
  it('başarısız veya önceki günün renderı varsa yedek çalışmaya izin verir',()=>{
    const workflowRuns=[
      {event:'schedule',status:'completed',conclusion:'failure',created_at:'2026-11-02T02:05:00Z'},
      {event:'schedule',status:'completed',conclusion:'success',created_at:'2026-11-01T02:05:00Z'},
    ];
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T03:15:00Z',workflowRuns})).toMatchObject({shouldRun:true});
  });
});
