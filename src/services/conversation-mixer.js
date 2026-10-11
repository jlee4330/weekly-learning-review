// Mix only for the archive: never send this output to the speakers or WebRTC.
export class ConversationMixer {
  constructor(microphone) {
    this.context = new AudioContext();
    this.output = this.context.createMediaStreamDestination();
    this.student = this.context.createMediaStreamSource(microphone);
    this.gain = this.context.createGain();
    // Leave headroom if the two speakers overlap.
    this.gain.gain.value = 0.5;
    this.student.connect(this.gain);
    this.gain.connect(this.output);
    this.stream = this.output.stream;
  }
  setAgent(stream) {
    this.agent?.disconnect();
    this.agent = null;
    if (this.closed || !stream?.getAudioTracks().length) return;
    this.agent = this.context.createMediaStreamSource(stream);
    this.agent.connect(this.gain);
  }
  async ready() {
    let timer;
    try {
      await Promise.race([
        this.context.resume(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('AUDIO_MIXER_TIMEOUT')), 5000); }),
      ]);
      if (!this.closed && this.context.state !== 'running') throw Error('AUDIO_MIXER_UNAVAILABLE');
    } finally { clearTimeout(timer); }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.student.disconnect(); this.agent?.disconnect(); this.gain.disconnect();
    this.stream.getTracks().forEach(track => track.stop());
    this.context.close().catch(() => {});
  }
}
