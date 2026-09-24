import { createBuffer, normalizePeak, toSamples } from "./dsp";
import { dbToGain, type EnhanceParams, type TimeRange } from "./types";

/**
 * Sound-enhancement chain — docs/site/01-audio-editor.md §4.
 *
 * Signal order matters: gate first (so the compressor never lifts the noise
 * floor), then the filters and the compressor in one OfflineAudioContext
 * render, then normalize last so the output lands at a predictable level.
 *
 * Everything except the gate is a native Web Audio node, which is both faster
 * and better tested than anything we would write by hand.
 */
export async function enhance(
  buffer: AudioBuffer,
  range: TimeRange,
  params: EnhanceParams,
): Promise<AudioBuffer> {
  const { from, to } = toSamples(buffer, range);
  if (to <= from) throw new Error("Empty selection");

  // Work on the selection only, then paste it back over the original.
  const region = slice(buffer, from, to);
  let processed = params.gate ? noiseGate(region, params.gateThresholdDb) : region;
  processed = await renderChain(processed, params);
  if (params.normalize) {
    processed = normalizePeak(
      processed,
      { start: 0, end: processed.length / processed.sampleRate },
      params.normalizeDb,
    );
  }

  return paste(buffer, processed, from, to);
}

function slice(buffer: AudioBuffer, from: number, to: number): AudioBuffer {
  const out = createBuffer(buffer.numberOfChannels, to - from, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(buffer.getChannelData(c).subarray(from, to).slice(), c);
  }
  return out;
}

/**
 * Put the processed region back. The render can come out a hair shorter or
 * longer than the source region, so copy only what both sides have and leave
 * the surrounding audio untouched.
 */
function paste(
  original: AudioBuffer,
  region: AudioBuffer,
  from: number,
  to: number,
): AudioBuffer {
  const out = createBuffer(original.numberOfChannels, original.length, original.sampleRate);
  const span = Math.min(to - from, region.length);
  for (let c = 0; c < original.numberOfChannels; c++) {
    const dst = out.getChannelData(c);
    dst.set(original.getChannelData(c).slice(), 0);
    const src = region.getChannelData(Math.min(c, region.numberOfChannels - 1));
    dst.set(src.subarray(0, span), from);
  }
  return out;
}

/** highpass → presence EQ → compressor, rendered offline in one pass. */
async function renderChain(buffer: AudioBuffer, params: EnhanceParams): Promise<AudioBuffer> {
  if (!params.highpass && !params.presence && !params.compressor) return buffer;

  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  let node: AudioNode = source;

  if (params.highpass) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = params.highpassHz;
    hp.Q.value = 0.707;
    node.connect(hp);
    node = hp;
  }

  if (params.presence) {
    const eq = ctx.createBiquadFilter();
    eq.type = "peaking";
    eq.frequency.value = 3000;
    eq.Q.value = 1;
    eq.gain.value = params.presenceDb;
    node.connect(eq);
    node = eq;
  }

  if (params.compressor) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = params.compThresholdDb;
    comp.ratio.value = params.compRatio;
    comp.knee.value = 6;
    comp.attack.value = 0.005;
    comp.release.value = 0.15;
    node.connect(comp);
    node = comp;
  }

  node.connect(ctx.destination);
  source.start();
  return ctx.startRendering();
}

/**
 * Downward gate with attack/release ramps. Hard gating on a per-sample
 * threshold chatters badly on speech, so the gain follows an envelope:
 * 5 ms to open, 60 ms to close, computed from a short RMS window.
 */
function noiseGate(buffer: AudioBuffer, thresholdDb: number): AudioBuffer {
  const threshold = dbToGain(thresholdDb);
  const sampleRate = buffer.sampleRate;
  const window = Math.max(Math.round(0.01 * sampleRate), 1); // 10 ms RMS window
  const attack = Math.max(Math.round(0.005 * sampleRate), 1);
  const release = Math.max(Math.round(0.06 * sampleRate), 1);

  const out = createBuffer(buffer.numberOfChannels, buffer.length, sampleRate);
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  // Hoisted: calling getChannelData() per sample would be tens of millions of
  // method calls on a few minutes of stereo audio.
  const input: Float32Array[] = [];
  for (let c = 0; c < channels; c++) input.push(buffer.getChannelData(c));

  // One shared envelope across channels so stereo imaging never wobbles.
  const envelope = new Float32Array(length);
  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    let frame = 0;
    for (let c = 0; c < channels; c++) {
      const v = input[c][i];
      frame += v * v;
    }
    sumSquares += frame / channels;
    if (i >= window) {
      let old = 0;
      for (let c = 0; c < channels; c++) {
        const v = input[c][i - window];
        old += v * v;
      }
      sumSquares -= old / channels;
    }
    envelope[i] = Math.sqrt(sumSquares / Math.min(i + 1, window));
  }

  const gainCurve = new Float32Array(length);
  let current = 0;
  for (let i = 0; i < length; i++) {
    const target = envelope[i] >= threshold ? 1 : 0;
    const step = target > current ? 1 / attack : 1 / release;
    current = target > current ? Math.min(current + step, 1) : Math.max(current - step, 0);
    gainCurve[i] = current;
  }

  for (let c = 0; c < channels; c++) {
    const src = input[c];
    const dst = out.getChannelData(c);
    for (let i = 0; i < length; i++) dst[i] = src[i] * gainCurve[i];
  }
  return out;
}
