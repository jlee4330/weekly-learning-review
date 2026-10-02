// Relative digital input level, not calibrated sound pressure (dB SPL).
export function inputLevel(samples) {
  let sum=0;
  for(const sample of samples)sum+=sample*sample;
  const rms=Math.sqrt(sum/Math.max(samples.length,1));
  return Math.min(1,Math.max(0,(20*Math.log10(Math.max(rms,1e-8))+60)/54));
}
export function microphoneError(error,language='en') {
  const messages={
    NotAllowedError:['Microphone access is unavailable. Allow microphone access for this browser or app in both site permissions and system privacy settings, then retry.','마이크 접근이 차단되었습니다. 사이트 권한과 시스템 개인정보 보호 설정에서 사용 중인 브라우저 또는 앱의 마이크 접근을 허용한 뒤 재시도해 주세요.'],
    SecurityError:['This page is not allowed to use the microphone. Open it in a regular browser over HTTPS or localhost.','현재 페이지에서 마이크 사용이 차단되었습니다. 일반 브라우저에서 HTTPS 또는 localhost 주소로 열어 주세요.'],
    NotFoundError:['No microphone was found. Connect an input device and retry.','마이크 장치를 찾지 못했습니다. 입력 장치를 연결하고 다시 시도해 주세요.'],
    NotReadableError:['The microphone could not be opened. Check the input device and close other apps using it, then retry.','마이크를 열 수 없습니다. 입력 장치를 확인하고 마이크를 사용하는 다른 앱을 종료한 뒤 다시 시도해 주세요.'],
    OverconstrainedError:['The selected microphone is no longer available. Select another input device.','선택한 마이크를 사용할 수 없습니다. 다른 입력 장치를 선택해 주세요.'],
    MIC_UNSUPPORTED:['This browser or preview does not expose microphone access. Open the same address in Chrome or Safari.','현재 브라우저 또는 미리보기에서 마이크 기능을 제공하지 않습니다. 같은 주소를 Chrome 또는 Safari에서 열어 주세요.'],
    MIC_INSECURE:['Microphone access requires HTTPS or localhost.','마이크를 사용하려면 HTTPS 또는 localhost 주소로 접속해야 합니다.'],
    MIC_PERMISSION_TIMEOUT:['Microphone permission is still pending. Check the browser or app permission prompt, allow access, then retry.','마이크 권한 응답을 기다리다 시간이 지났습니다. 브라우저 또는 앱의 권한 요청을 확인하고 허용한 뒤 재시도해 주세요.'],
    AUDIO_START_TIMEOUT:['Audio processing did not start. Retry with this tab active. If using an in-app preview, try the same address in Chrome or Safari.','오디오 처리가 시작되지 않았습니다. 현재 탭을 활성화한 뒤 재시도해 주세요. 앱 내 미리보기라면 같은 주소를 Chrome 또는 Safari에서 열어 확인해 주세요.'],
    MIC_ENDED:['The microphone was disconnected. Reconnect it and test again.','마이크 연결이 끊겼습니다. 다시 연결한 뒤 테스트해 주세요.'],
  };
  const message=messages[error?.code||error?.message]||messages[error?.name]||['Microphone testing failed. Check the input device and retry.','마이크 테스트에 실패했습니다. 입력 장치를 확인한 뒤 다시 시도해 주세요.'];
  return message[language==='ko'?1:0];
}
export async function checkMicrophone(onLevel,{signal,deviceId='',onDevice=()=>{},onDevices=()=>{},onStatus=()=>{},onError=()=>{}}={}) {
  if(!window.isSecureContext)throw Error('MIC_INSECURE');
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context||!navigator.mediaDevices?.getUserMedia)throw Error('MIC_UNSUPPORTED');
  const ctx=new Context();
  const resumed=ctx.resume();resumed.catch(()=>{});
  let stream,source,analyser,silentOutput,timer,stopped=false;
  const waits=new Map();
  function bounded(promise,ms,code){return new Promise((resolve,reject)=>{
    const id=setTimeout(()=>{waits.delete(id);reject(Error(code))},ms);waits.set(id,reject);
    Promise.resolve(promise).then(value=>{clearTimeout(id);waits.delete(id);resolve(value)},error=>{clearTimeout(id);waits.delete(id);reject(error)});
  })}
  const stop=()=>{
    if(stopped)return;stopped=true;
    clearInterval(timer);signal?.removeEventListener('abort',stop);
    for(const [id,reject] of waits){clearTimeout(id);reject(Error('ABORTED'))}waits.clear();
    stream?.getTracks().forEach(t=>t.stop());
    source?.disconnect();analyser?.disconnect();silentOutput?.disconnect();
    if(ctx.state!=='closed')ctx.close().catch(()=>{});
  };
  signal?.addEventListener('abort',stop,{once:true});
  try{
    if(signal?.aborted)throw Error('ABORTED');
    const permission=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(deviceId?{deviceId:{exact:deviceId}}:{})}});
    // Permission prompts cannot be cancelled. Release a late grant after leaving.
    permission.then(value=>{if(stopped)value.getTracks().forEach(t=>t.stop())},()=>{});
    stream=await bounded(permission,20000,'MIC_PERMISSION_TIMEOUT');
    if(stopped||signal?.aborted){stream.getTracks().forEach(t=>t.stop());throw Error('ABORTED');}
    await bounded(resumed,8000,'AUDIO_START_TIMEOUT');
    if(ctx.state!=='running')throw Error('AUDIO_START_TIMEOUT');
    source=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=2048;
    silentOutput=ctx.createGain();silentOutput.gain.value=0;
    source.connect(analyser);analyser.connect(silentOutput);silentOutput.connect(ctx.destination);
    const track=stream.getAudioTracks()[0];
    onDevice(track?.label||'');
    navigator.mediaDevices.enumerateDevices?.().then(devices=>{if(!stopped)onDevices(devices.filter(d=>d.kind==='audioinput').map(d=>({id:d.deviceId,label:d.label})))}).catch(()=>{});
    const data=new Float32Array(analyser.fftSize);
    let displayed=0,lastSound=performance.now();
    timer=setInterval(()=>{
      if(track?.readyState==='ended'){onLevel(0);stop();onError(Error('MIC_ENDED'));return;}
      if(ctx.state!=='running'){onLevel(0);onStatus('paused');return;}
      if(track?.muted){onLevel(0);onStatus('muted');return;}
      analyser.getFloatTimeDomainData(data);
      const level=inputLevel(data);
      displayed=level>displayed?level:displayed*.72;
      onLevel(displayed<.01?0:displayed);
      if(level>.08){lastSound=performance.now();onStatus('signal');}
      else if(performance.now()-lastSound>3500)onStatus('silent');
    },50);
    return stop;
  }catch(error){stop();throw error;}
}
