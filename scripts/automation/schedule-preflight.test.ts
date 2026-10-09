import {describe,expect,it} from 'vitest';
import {shouldRunScheduledRender} from './schedule-preflight.mjs';

describe('zamanlanmış render ön kontrolü',()=>{
  it('manuel çalıştırmayı kota saatine bağlı tutmaz',()=>{
    expect(shouldRunScheduledRender({eventName:'workflow_dispatch',now:'2026-11-02T07:10:00Z'}).shouldRun).toBe(true);
  });
  it('günlük kota yenilenmeden önce hazırlığı atlar',()=>{
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T07:10:00Z'})).toMatchObject({shouldRun:false});
  });
  it('kota yenilendikten sonra henüz başarılı iş yoksa devam eder',()=>{
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T08:10:00Z',workflowRuns:[]})).toMatchObject({shouldRun:true});
  });
  it('aynı Türkiye günündeki başarılı zamanlanmış renderı yedek cronlarda yinelemez',()=>{
    const workflowRuns=[{event:'schedule',status:'completed',conclusion:'success',created_at:'2026-11-02T08:10:00Z'}];
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T08:40:00Z',workflowRuns})).toMatchObject({shouldRun:false});
  });
  it('kota yenilenmeden önce başarıyla atlanan erken cron sonraki yedeği durdurmaz',()=>{
    const workflowRuns=[{event:'schedule',status:'completed',conclusion:'success',created_at:'2026-11-02T07:10:00Z'}];
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T08:40:00Z',workflowRuns})).toMatchObject({shouldRun:true});
  });
  it('başarısız veya önceki günün renderı varsa kurtarma çalışmasına izin verir',()=>{
    const workflowRuns=[
      {event:'schedule',status:'completed',conclusion:'failure',created_at:'2026-11-02T08:10:00Z'},
      {event:'schedule',status:'completed',conclusion:'success',created_at:'2026-11-01T08:10:00Z'},
    ];
    expect(shouldRunScheduledRender({eventName:'schedule',now:'2026-11-02T08:40:00Z',workflowRuns})).toMatchObject({shouldRun:true});
  });
});
