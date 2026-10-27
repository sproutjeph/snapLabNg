class SnapLabPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const channel = input ? input[0] : undefined;
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}

registerProcessor("snaplab-pcm", SnapLabPcmProcessor);
