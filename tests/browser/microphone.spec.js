import {test,expect} from '@playwright/test';
test('microphone meter responds to audio, detects silence, and releases the track',async({page})=>{
 await page.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{
   const ctx=new AudioContext();await ctx.resume();
   const oscillator=ctx.createOscillator(),gain=ctx.createGain(),destination=ctx.createMediaStreamDestination();
   gain.gain.value=0;oscillator.connect(gain);gain.connect(destination);oscillator.start();
   window.testAudio={ctx,oscillator,gain,stream:destination.stream};return destination.stream;
  };
 });
 await page.goto('/');await page.getByRole('button',{name:'Start review',exact:true}).first().click();await page.getByRole('button',{name:'Test microphone',exact:true}).click();
 const meter=page.getByRole('meter');await expect(meter).toHaveAttribute('aria-valuenow','0');
 await page.evaluate(()=>window.testAudio.gain.gain.value=.1);
 await expect.poll(async()=>Number(await meter.getAttribute('aria-valuenow'))).toBeGreaterThan(30);
 await expect(page.getByRole('status')).toHaveText('Sound detected');
 await page.evaluate(()=>window.testAudio.gain.gain.value=0);
 await expect(meter).toHaveAttribute('aria-valuenow','0');await expect(page.getByRole('status')).toContainText('No sound detected');
 await page.getByRole('button',{name:'Stop test',exact:true}).click();
 expect(await page.evaluate(()=>window.testAudio.stream.getAudioTracks()[0].readyState)).toBe('ended');
 await page.evaluate(()=>{window.testAudio.oscillator.stop();window.testAudio.ctx.close()});
});
test('audio startup timeout explains the cause instead of hanging',async({page})=>{
 await page.addInitScript(()=>{
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{resume(){return new Promise(()=>{})}};
  navigator.mediaDevices.getUserMedia=async()=>new MediaStream();
 });
 await page.goto('/');await page.getByRole('button',{name:'Start review',exact:true}).first().click();await page.getByRole('button',{name:'Test microphone',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Audio processing did not start',{timeout:12000});
 await expect(page.getByRole('button',{name:'Test again',exact:true})).toBeEnabled();
});
test('device errors are distinguished from permission errors',async({page})=>{
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Unavailable','NotReadableError')}});
 await page.goto('/');await page.getByRole('button',{name:'Start review',exact:true}).first().click();await page.getByRole('button',{name:'Test microphone',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('The microphone could not be opened');
});
