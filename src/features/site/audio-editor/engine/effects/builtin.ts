import * as dsp from "../dsp";
import { dbToGain, type FadeCurve } from "../types";
import { AudioEffect, type EffectNodes, type EffectParams, type EffectScope } from "./Effect";

/**
 * The built-in effects — docs/site/01-audio-editor.md §4.
 *
 * Note which ones can be live. Anything expressible as Web Audio nodes
 * (gain, filters, compression) is adjustable in real time on a track or the
 * master bus. Anything that must look at the whole buffer before it can act
 * (normalise) or reorder it (reverse) can only be a one-shot render on a
 * selection — no amount of wishing makes those live.
 */

const whole = (b: AudioBuffer) => ({ start: 0, end: b.duration });

/* --------------------------------------------------------- live effects */

export class GainEffect extends AudioEffect {
  readonly id = "gain";
  readonly nameKey = "audio.fx.gain";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "db", labelKey: "audio.fx.gainDb", min: -36, max: 24, step: 0.5, default: 0, unit: "dB" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createGain();
    node.gain.value = dbToGain(params.db);
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    (nodes.input as GainNode).gain.value = dbToGain(params.db);
  }

  render(buffer: AudioBuffer, params: EffectParams): AudioBuffer {
    return dsp.gain(buffer, whole(buffer), params.db);
  }
}

export class HighpassEffect extends AudioEffect {
  readonly id = "highpass";
  readonly nameKey = "audio.fx.highpass";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "hz", labelKey: "audio.fx.cutoff", min: 20, max: 400, step: 5, default: 80, unit: "Hz" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createBiquadFilter();
    node.type = "highpass";
    node.frequency.value = params.hz;
    node.Q.value = 0.707;
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    (nodes.input as BiquadFilterNode).frequency.value = params.hz;
  }
}

export class LowpassEffect extends AudioEffect {
  readonly id = "lowpass";
  readonly nameKey = "audio.fx.lowpass";
  // Was missing "selection" while its twin Highpass had it — an oversight, not
  // a decision: both are live nodes, so both render offline for free.
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "hz", labelKey: "audio.fx.cutoff", min: 1000, max: 20000, step: 100, default: 16000, unit: "Hz" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createBiquadFilter();
    node.type = "lowpass";
    node.frequency.value = params.hz;
    node.Q.value = 0.707;
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    (nodes.input as BiquadFilterNode).frequency.value = params.hz;
  }
}

/**
 * Bass and Treble are shelving filters — they lift or cut everything below
 * (or above) a corner frequency, which is what a tone control does. Peaking
 * filters like Presence only touch a band around their centre, so they cannot
 * stand in for these.
 */
export class BassEffect extends AudioEffect {
  readonly id = "bass";
  readonly nameKey = "audio.fx.bass";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "db", labelKey: "audio.fx.boost", min: -24, max: 24, step: 0.5, default: 0, unit: "dB" },
    { key: "hz", labelKey: "audio.fx.corner", min: 40, max: 500, step: 10, default: 200, unit: "Hz" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createBiquadFilter();
    node.type = "lowshelf";
    node.frequency.value = params.hz;
    node.gain.value = params.db;
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const node = nodes.input as BiquadFilterNode;
    node.frequency.value = params.hz;
    node.gain.value = params.db;
  }
}

export class TrebleEffect extends AudioEffect {
  readonly id = "treble";
  readonly nameKey = "audio.fx.treble";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "db", labelKey: "audio.fx.boost", min: -24, max: 24, step: 0.5, default: 0, unit: "dB" },
    { key: "hz", labelKey: "audio.fx.corner", min: 1500, max: 12000, step: 100, default: 4000, unit: "Hz" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createBiquadFilter();
    node.type = "highshelf";
    node.frequency.value = params.hz;
    node.gain.value = params.db;
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const node = nodes.input as BiquadFilterNode;
    node.frequency.value = params.hz;
    node.gain.value = params.db;
  }
}

export class PresenceEffect extends AudioEffect {
  readonly id = "presence";
  readonly nameKey = "audio.fx.presence";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "hz", labelKey: "audio.fx.centre", min: 500, max: 8000, step: 100, default: 3000, unit: "Hz" },
    { key: "db", labelKey: "audio.fx.boost", min: -18, max: 18, step: 0.5, default: 3, unit: "dB" },
    { key: "q", labelKey: "audio.fx.width", min: 0.3, max: 6, step: 0.1, default: 1 },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createBiquadFilter();
    node.type = "peaking";
    node.frequency.value = params.hz;
    node.gain.value = params.db;
    node.Q.value = params.q;
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const node = nodes.input as BiquadFilterNode;
    node.frequency.value = params.hz;
    node.gain.value = params.db;
    node.Q.value = params.q;
  }
}

export class CompressorEffect extends AudioEffect {
  readonly id = "compressor";
  readonly nameKey = "audio.fx.compressor";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "threshold", labelKey: "audio.fx.threshold", min: -60, max: 0, step: 1, default: -22, unit: "dB" },
    { key: "ratio", labelKey: "audio.fx.ratio", min: 1, max: 20, step: 0.5, default: 4 },
    { key: "attack", labelKey: "audio.fx.attack", min: 0, max: 100, step: 1, default: 5, unit: "ms" },
    { key: "release", labelKey: "audio.fx.release", min: 10, max: 1000, step: 10, default: 150, unit: "ms" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const node = ctx.createDynamicsCompressor();
    node.threshold.value = params.threshold;
    node.ratio.value = params.ratio;
    node.knee.value = 6;
    node.attack.value = params.attack / 1000;
    node.release.value = params.release / 1000;
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const node = nodes.input as DynamicsCompressorNode;
    node.threshold.value = params.threshold;
    node.ratio.value = params.ratio;
    node.attack.value = params.attack / 1000;
    node.release.value = params.release / 1000;
  }
}

/* ------------------------------------------------- render-only effects */

export class NormalizeEffect extends AudioEffect {
  readonly id = "normalize";
  readonly nameKey = "audio.fx.normalize";
  // Peak normalisation needs the loudest sample of the whole region before
  // it can pick a gain, so it cannot exist as a streaming node.
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [
    { key: "target", labelKey: "audio.fx.target", min: -12, max: 0, step: 0.5, default: -1, unit: "dBFS" },
  ];

  render(buffer: AudioBuffer, params: EffectParams): AudioBuffer {
    return dsp.normalizePeak(buffer, whole(buffer), params.target);
  }
}

export class ReverseEffect extends AudioEffect {
  readonly id = "reverse";
  readonly nameKey = "audio.fx.reverse";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [];

  render(buffer: AudioBuffer): AudioBuffer {
    return dsp.reverse(buffer, whole(buffer));
  }
}

export class InvertEffect extends AudioEffect {
  readonly id = "invert";
  readonly nameKey = "audio.fx.invert";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [];

  render(buffer: AudioBuffer): AudioBuffer {
    return dsp.invert(buffer, whole(buffer));
  }
}

export class SilenceEffect extends AudioEffect {
  readonly id = "silence";
  readonly nameKey = "audio.fx.silence";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [];

  render(buffer: AudioBuffer): AudioBuffer {
    return dsp.silenceRange(buffer, whole(buffer));
  }
}

export class FadeEffect extends AudioEffect {
  readonly id = "fade";
  readonly nameKey = "audio.fx.fade";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [
    { key: "direction", labelKey: "audio.fx.direction", min: 0, max: 1, step: 1, default: 0 },
    { key: "curve", labelKey: "audio.fx.curve", min: 0, max: 3, step: 1, default: 0 },
  ];

  render(buffer: AudioBuffer, params: EffectParams): AudioBuffer {
    const curves: FadeCurve[] = ["linear", "exponential", "logarithmic", "s-curve"];
    return dsp.fade(
      buffer,
      whole(buffer),
      params.direction === 0 ? "in" : "out",
      curves[Math.round(params.curve)] ?? "linear",
    );
  }
}

export class PitchShiftEffect extends AudioEffect {
  readonly id = "pitch-shift";
  readonly nameKey = "audio.fx.pitchShift";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "semitones", labelKey: "audio.fx.semitones", min: -12, max: 12, step: 1, default: 0, unit: "st" },
    { key: "cents", labelKey: "audio.fx.cents", min: -100, max: 100, step: 1, default: 0, unit: "ct" },
  ];

  build(ctx: BaseAudioContext, _params: EffectParams): EffectNodes {
    const input = ctx.createGain();
    const output = ctx.createGain();
    input.connect(output);
    return { input, output };
  }

  render(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> | AudioBuffer {
    const semitones = params.semitones ?? 0;
    const cents = params.cents ?? 0;
    if (semitones === 0 && cents === 0) return buffer;
    return dsp.pitchShiftAsync(buffer, semitones, cents);
  }
}

/**
 * Noise gate. Render-only: the envelope follower is a sample loop, and
 * running it live would mean an AudioWorklet — a worthwhile future addition,
 * but a different piece of work.
 */
export class NoiseGateEffect extends AudioEffect {
  readonly id = "gate";
  readonly nameKey = "audio.fx.gate";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [
    { key: "threshold", labelKey: "audio.fx.threshold", min: -70, max: -10, step: 1, default: -45, unit: "dB" },
  ];

  async render(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> {
    const { enhance } = await import("../enhance");
    return enhance(buffer, whole(buffer), {
      highpass: false,
      highpassHz: 80,
      gate: true,
      gateThresholdDb: params.threshold,
      compressor: false,
      compThresholdDb: -22,
      compRatio: 4,
      presence: false,
      presenceDb: 0,
      normalize: false,
      normalizeDb: -1,
    });
  }
}

/**
 * Denoise / Noise Reduction.
 *
 * Live multi-stage denoiser combining:
 * 1. Hum & rumble filter: 60Hz highpass Butterworth to cut AC line hum and mic rumble.
 * 2. High-frequency hiss cut: smooth lowpass shelf to attenuate hiss and static.
 * 3. Dynamic expander / noise suppressor: attenuates quiet background noise floor.
 */
export class DenoiseEffect extends AudioEffect {
  readonly id = "denoise";
  readonly nameKey = "audio.fx.denoise";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "threshold", labelKey: "audio.fx.threshold", min: -70, max: -10, step: 1, default: -42, unit: "dB" },
    { key: "reduction", labelKey: "audio.fx.reductionAmount", min: 3, max: 36, step: 1, default: 18, unit: "dB" },
    { key: "hissCut", labelKey: "audio.fx.hissCut", min: 2000, max: 20000, step: 500, default: 14000, unit: "Hz" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const input = ctx.createGain();
    const output = ctx.createGain();

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "highpass";
    humFilter.frequency.value = 60;
    humFilter.Q.value = 0.707;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = params.hissCut ?? 14000;
    hissFilter.Q.value = 0.707;

    const comp = ctx.createDynamicsCompressor();
    const thresh = params.threshold ?? -42;
    const red = params.reduction ?? 18;
    comp.threshold.value = thresh;
    comp.ratio.value = Math.max(2, red / 2.5);
    comp.knee.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.08;

    input.connect(humFilter);
    humFilter.connect(hissFilter);
    hissFilter.connect(comp);
    comp.connect(output);

    return {
      input,
      output,
      parts: { humFilter, hissFilter, comp },
    };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const hissFilter = parts.hissFilter as BiquadFilterNode | undefined;
    const comp = parts.comp as DynamicsCompressorNode | undefined;

    const thresh = params.threshold ?? -42;
    const red = params.reduction ?? 18;

    if (hissFilter) hissFilter.frequency.value = params.hissCut ?? 14000;
    if (comp) {
      comp.threshold.value = thresh;
      comp.ratio.value = Math.max(2, red / 2.5);
    }
  }

  async render(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> {
    const { enhance } = await import("../enhance");
    return enhance(buffer, whole(buffer), {
      highpass: true,
      highpassHz: 60,
      gate: true,
      gateThresholdDb: params.threshold ?? -42,
      compressor: false,
      compThresholdDb: -22,
      compRatio: 4,
      presence: false,
      presenceDb: 0,
      normalize: false,
      normalizeDb: -1,
    });
  }
}

/* ------------------------------------------------- more live effects */

/**
 * Echo. A delay line feeding back into itself, mixed against the dry signal.
 *
 * Feedback is capped below 1 in the parameter range: at or above unity the
 * loop never decays and the output climbs until it clips.
 */
export class DelayEffect extends AudioEffect {
  readonly id = "delay";
  readonly nameKey = "audio.fx.delay";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "time", labelKey: "audio.fx.delayTime", min: 20, max: 1500, step: 10, default: 300, unit: "ms" },
    { key: "feedback", labelKey: "audio.fx.feedback", min: 0, max: 85, step: 1, default: 35, unit: "%" },
    { key: "mix", labelKey: "audio.fx.mix", min: 0, max: 100, step: 1, default: 30, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const dry = ctx.createGain();

    delay.delayTime.value = params.time / 1000;
    feedback.gain.value = params.feedback / 100;
    wet.gain.value = params.mix / 100;
    dry.gain.value = 1;

    input.connect(dry);
    dry.connect(output);
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(output);

    return { input, output, parts: { delay, feedback, wet } };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const delay = parts.delay as DelayNode | undefined;
    const feedback = parts.feedback as GainNode | undefined;
    const wet = parts.wet as GainNode | undefined;
    if (delay) delay.delayTime.value = params.time / 1000;
    if (feedback) feedback.gain.value = params.feedback / 100;
    if (wet) wet.gain.value = params.mix / 100;
  }
}

/**
 * Tape / Analog Echo.
 *
 * Distinct from plain digital Delay: incorporates a lowpass tone filter in
 * the feedback loop so successive repeats progressively darken, capturing the
 * classic warm acoustic decay of tape and vintage analog echo machines.
 */
export class EchoEffect extends AudioEffect {
  readonly id = "echo";
  readonly nameKey = "audio.fx.echo";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly allowMultiple = true;
  readonly params = [
    { key: "time", labelKey: "audio.fx.delayTime", min: 20, max: 1200, step: 10, default: 240, unit: "ms" },
    { key: "feedback", labelKey: "audio.fx.feedback", min: 0, max: 85, step: 1, default: 40, unit: "%" },
    { key: "tone", labelKey: "audio.fx.echoTone", min: 500, max: 16000, step: 100, default: 3200, unit: "Hz" },
    { key: "mix", labelKey: "audio.fx.mix", min: 0, max: 100, step: 1, default: 35, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const delay = ctx.createDelay(2);
    const filter = ctx.createBiquadFilter();
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const dry = ctx.createGain();

    filter.type = "lowpass";
    filter.frequency.value = params.tone;
    filter.Q.value = 0.707;
    delay.delayTime.value = params.time / 1000;
    feedback.gain.value = params.feedback / 100;
    wet.gain.value = params.mix / 100;
    dry.gain.value = 1;

    // Dry path
    input.connect(dry);
    dry.connect(output);

    // Wet path with feedback loop through damping filter
    input.connect(delay);
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);
    filter.connect(wet);
    wet.connect(output);

    return { input, output, parts: { delay, filter, feedback, wet } };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const delay = parts.delay as DelayNode | undefined;
    const filter = parts.filter as BiquadFilterNode | undefined;
    const feedback = parts.feedback as GainNode | undefined;
    const wet = parts.wet as GainNode | undefined;
    if (delay) delay.delayTime.value = params.time / 1000;
    if (filter) filter.frequency.value = params.tone;
    if (feedback) feedback.gain.value = params.feedback / 100;
    if (wet) wet.gain.value = params.mix / 100;
  }
}

/**
 * Chorus.
 *
 * Modulation effect that splits the signal, applies an LFO-modulated micro-delay
 * to create pitch variance, and recombines it with the dry signal. Gives lush
 * spatial depth, shimmering thickness, and a soft ambient reverberation.
 */
export class ChorusEffect extends AudioEffect {
  readonly id = "chorus";
  readonly nameKey = "audio.fx.chorus";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "rate", labelKey: "audio.fx.chorusRate", min: 0.1, max: 5, step: 0.1, default: 1.5, unit: "Hz" },
    { key: "depth", labelKey: "audio.fx.chorusDepth", min: 0.5, max: 15, step: 0.5, default: 3.5, unit: "ms" },
    { key: "delay", labelKey: "audio.fx.delayTime", min: 10, max: 40, step: 1, default: 20, unit: "ms" },
    { key: "mix", labelKey: "audio.fx.mix", min: 0, max: 100, step: 1, default: 50, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes | null {
    if (typeof ctx.createOscillator !== "function") return null;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const delay = ctx.createDelay(0.1);
    const dry = ctx.createGain();
    const wet = ctx.createGain();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    delay.delayTime.value = params.delay / 1000;
    lfo.type = "sine";
    lfo.frequency.value = params.rate;
    lfoGain.gain.value = params.depth / 1000;

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();

    wet.gain.value = params.mix / 100;
    dry.gain.value = 1;

    input.connect(dry);
    dry.connect(output);

    input.connect(delay);
    delay.connect(wet);
    wet.connect(output);

    return { input, output, parts: { delay, lfo, lfoGain, wet } };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const delay = parts.delay as DelayNode | undefined;
    const lfo = parts.lfo as OscillatorNode | undefined;
    const lfoGain = parts.lfoGain as GainNode | undefined;
    const wet = parts.wet as GainNode | undefined;

    if (delay) delay.delayTime.value = params.delay / 1000;
    if (lfo) lfo.frequency.value = params.rate;
    if (lfoGain) lfoGain.gain.value = params.depth / 1000;
    if (wet) wet.gain.value = params.mix / 100;
  }
}

/**
 * Reverb, as a convolution against a synthesised impulse: noise under an
 * exponential decay. A recording of a real room would sound better, but
 * shipping one means shipping a megabyte of audio inside the extension.
 *
 * A ConvolverNode's buffer cannot be tweaked in place, so changing the decay
 * means building a new impulse — which is why `update` only rebuilds when the
 * length actually moved, and leaves the mix slider free to be dragged.
 */
export class ReverbEffect extends AudioEffect {
  readonly id = "reverb";
  readonly nameKey = "audio.fx.reverb";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "seconds", labelKey: "audio.fx.decay", min: 0.2, max: 6, step: 0.1, default: 1.8, unit: "s" },
    { key: "mix", labelKey: "audio.fx.mix", min: 0, max: 100, step: 1, default: 25, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes | null {
    if (typeof ctx.createConvolver !== "function") return null;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const convolver = ctx.createConvolver();
    const wet = ctx.createGain();
    const dry = ctx.createGain();

    convolver.buffer = impulse(ctx, params.seconds);
    wet.gain.value = params.mix / 100;
    dry.gain.value = 1;

    input.connect(dry);
    dry.connect(output);
    input.connect(convolver);
    convolver.connect(wet);
    wet.connect(output);

    return { input, output, parts: { convolver, wet } };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const wet = parts.wet as GainNode | undefined;
    if (wet) wet.gain.value = params.mix / 100;

    const convolver = parts.convolver as ConvolverNode | undefined;
    if (!convolver) return;
    const rate = convolver.context.sampleRate;
    const wanted = Math.max(1, Math.round(params.seconds * rate));
    if (!convolver.buffer || Math.abs(convolver.buffer.length - wanted) > rate * 0.05) {
      convolver.buffer = impulse(convolver.context, params.seconds);
    }
  }
}

function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.round(Math.min(Math.max(seconds, 0.05), 6) * rate));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      // noise under an exponential tail
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  return buffer;
}

/** Saturation / overdrive, as a waveshaper curve. */
export class DistortionEffect extends AudioEffect {
  readonly id = "distortion";
  readonly nameKey = "audio.fx.distortion";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "drive", labelKey: "audio.fx.drive", min: 1, max: 100, step: 1, default: 25, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes | null {
    if (typeof ctx.createWaveShaper !== "function") return null;
    const node = ctx.createWaveShaper();
    node.curve = driveCurve(params.drive);
    node.oversample = "2x";
    return { input: node, output: node };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    (nodes.input as WaveShaperNode).curve = driveCurve(params.drive);
  }
}

function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const amount = Math.max(1, drive) * 2;
  const size = 1024;
  const out = new Float32Array(new ArrayBuffer(size * 4));
  for (let i = 0; i < size; i++) {
    const x = (i * 2) / size - 1;
    out[i] = ((3 + amount) * x * 20 * Math.PI) / (Math.PI + amount * Math.abs(x)) / 20;
  }
  return out;
}

/**
 * Stereo width via mid/side: separate what the two channels SHARE (mid) from
 * what they differ by (side), scale the side, recombine. 0% collapses to
 * mono, 200% doubles the difference.
 */
export class StereoWidthEffect extends AudioEffect {
  readonly id = "width";
  readonly nameKey = "audio.fx.stereoWidth";
  readonly scopes: EffectScope[] = ["master", "track", "clip"];
  readonly params = [
    { key: "width", labelKey: "audio.fx.widthAmount", min: 0, max: 200, step: 5, default: 100, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes | null {
    if (typeof ctx.createChannelSplitter !== "function") return null;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    const leftToL = ctx.createGain();
    const rightToL = ctx.createGain();
    const leftToR = ctx.createGain();
    const rightToR = ctx.createGain();

    input.connect(splitter);
    splitter.connect(leftToL, 0);
    splitter.connect(rightToL, 1);
    splitter.connect(leftToR, 0);
    splitter.connect(rightToR, 1);
    leftToL.connect(merger, 0, 0);
    rightToL.connect(merger, 0, 0);
    leftToR.connect(merger, 0, 1);
    rightToR.connect(merger, 0, 1);
    merger.connect(output);

    const nodes: EffectNodes = { input, output, parts: { leftToL, rightToL, leftToR, rightToR } };
    this.update(nodes, params);
    return nodes;
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const w = Math.max(0, params.width) / 100;
    // L' = mid + w*side, R' = mid - w*side, written as direct channel gains
    const same = 0.5 * (1 + w);
    const cross = 0.5 * (1 - w);
    const set = (node: AudioNode | undefined, value: number) => {
      if (node) (node as GainNode).gain.value = value;
    };
    set(parts.leftToL, same);
    set(parts.rightToL, cross);
    set(parts.leftToR, cross);
    set(parts.rightToR, same);
  }
}

/**
 * Depth (Spatial Depth / 3D Soundstage).
 *
 * Implements an acoustic space depth algorithm using early reflection micro-delays,
 * high-frequency distance damping (biquad lowpass), and crossfeed to place audio
 * into a deep, realistic 3D acoustic field.
 */
export class DepthEffect extends AudioEffect {
  readonly id = "depth";
  readonly nameKey = "audio.fx.depth";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "depth", labelKey: "audio.fx.depthAmount", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    { key: "space", labelKey: "audio.fx.depthSpace", min: 10, max: 100, step: 1, default: 40, unit: "%" },
    { key: "damping", labelKey: "audio.fx.depthDamping", min: 1000, max: 16000, step: 100, default: 6000, unit: "Hz" },
    { key: "mix", labelKey: "audio.fx.mix", min: 0, max: 100, step: 1, default: 40, unit: "%" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes | null {
    if (typeof ctx.createDelay !== "function") return null;
    const input = ctx.createGain();
    const output = ctx.createGain();

    const dry = ctx.createGain();
    const wet = ctx.createGain();

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = params.damping ?? 6000;
    filter.Q.value = 0.707;

    const delayL = ctx.createDelay(0.2);
    const delayR = ctx.createDelay(0.2);

    const crossL = ctx.createGain();
    const crossR = ctx.createGain();

    const depthFactor = (params.depth ?? 50) / 100;
    const spaceFactor = (params.space ?? 40) / 100;
    const baseDelay = 0.008 + spaceFactor * 0.035;

    delayL.delayTime.value = baseDelay;
    delayR.delayTime.value = baseDelay * 1.35;

    crossL.gain.value = 0.25 * depthFactor;
    crossR.gain.value = 0.25 * depthFactor;

    input.connect(dry);
    dry.connect(output);

    input.connect(filter);
    filter.connect(delayL);
    filter.connect(delayR);

    delayL.connect(crossR);
    crossR.connect(delayR);

    delayR.connect(crossL);
    crossL.connect(delayL);

    delayL.connect(wet);
    delayR.connect(wet);

    wet.connect(output);

    const mix = (params.mix ?? 40) / 100;
    wet.gain.value = mix;
    dry.gain.value = 1 - mix * 0.3;

    return {
      input,
      output,
      parts: { filter, delayL, delayR, crossL, crossR, dry, wet },
    };
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const filter = parts.filter as BiquadFilterNode | undefined;
    const delayL = parts.delayL as DelayNode | undefined;
    const delayR = parts.delayR as DelayNode | undefined;
    const crossL = parts.crossL as GainNode | undefined;
    const crossR = parts.crossR as GainNode | undefined;
    const dry = parts.dry as GainNode | undefined;
    const wet = parts.wet as GainNode | undefined;

    const depthFactor = (params.depth ?? 50) / 100;
    const spaceFactor = (params.space ?? 40) / 100;
    const baseDelay = 0.008 + spaceFactor * 0.035;

    if (filter) filter.frequency.value = params.damping ?? 6000;
    if (delayL) delayL.delayTime.value = baseDelay;
    if (delayR) delayR.delayTime.value = baseDelay * 1.35;
    if (crossL) crossL.gain.value = 0.25 * depthFactor;
    if (crossR) crossR.gain.value = 0.25 * depthFactor;

    const mix = (params.mix ?? 40) / 100;
    if (wet) wet.gain.value = mix;
    if (dry) dry.gain.value = 1 - mix * 0.3;
  }

  render(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> | AudioBuffer {
    return this.renderViaGraph(buffer, params);
  }
}

/**
 * Fade In / Out effect as an optional effect.
 */
export class FadeInOutEffect extends AudioEffect {
  readonly id = "fade-in-out";
  readonly nameKey = "audio.fx.fadeInOut";
  readonly scopes: EffectScope[] = ["clip", "track", "selection"];
  readonly params = [
    { key: "fadeIn", labelKey: "audio.fadeIn", min: 0, max: 30, step: 0.1, default: 1, unit: "s" },
    { key: "fadeOut", labelKey: "audio.fadeOut", min: 0, max: 30, step: 0.1, default: 1, unit: "s" },
  ];

  build(ctx: BaseAudioContext, _params: EffectParams): EffectNodes {
    const node = ctx.createGain();
    node.gain.value = 1;
    return { input: node, output: node };
  }

  update(_nodes: EffectNodes, _params: EffectParams): void {
    // Scheduled during envelope processing
  }

  render(buffer: AudioBuffer, params: EffectParams): AudioBuffer {
    let out = buffer;
    const fadeIn = params.fadeIn ?? 0;
    const fadeOut = params.fadeOut ?? 0;
    if (fadeIn > 0) {
      out = dsp.fade(out, { start: 0, end: Math.min(fadeIn, out.duration) }, "in", "linear");
    }
    if (fadeOut > 0) {
      const start = Math.max(0, out.duration - fadeOut);
      out = dsp.fade(out, { start, end: out.duration }, "out", "linear");
    }
    return out;
  }
}

/* --------------------------------------------- vocal / instrument split */

/**
 * Karaoke: cancel whatever is identical in both channels.
 *
 * Be plain about what this is and is not. Real stem separation needs a trained
 * model (Demucs and its relatives) — tens of megabytes of weights and seconds
 * of compute per minute of audio, which is not something to hide inside a
 * browser extension. This is the classic centre-channel trick: a lead vocal is
 * usually mixed dead centre, so L−R removes it. It takes the bass and kick
 * with it, because those are centred too, and it does nothing whatsoever to a
 * mono recording — the panel says so rather than letting the name promise more.
 */
export class VocalRemoveEffect extends AudioEffect {
  readonly id = "vocal-remove";
  readonly nameKey = "audio.fx.vocalRemove";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [
    { key: "amount", labelKey: "audio.fx.amount", min: 0, max: 100, step: 5, default: 100, unit: "%" },
  ];

  render(buffer: AudioBuffer, params: EffectParams): AudioBuffer {
    return dsp.centreChannel(buffer, "remove", params.amount / 100);
  }
}

/**
 * The mirror of the above: keep what the channels share, drop what they do
 * not. Leaves a centred vocal plus anything else mixed centre — a rough
 * a-cappella, not a clean stem.
 */
export class VocalIsolateEffect extends AudioEffect {
  readonly id = "vocal-isolate";
  readonly nameKey = "audio.fx.vocalIsolate";
  readonly scopes: EffectScope[] = ["selection"];
  readonly params = [
    { key: "amount", labelKey: "audio.fx.amount", min: 0, max: 100, step: 5, default: 100, unit: "%" },
  ];

  render(buffer: AudioBuffer, params: EffectParams): AudioBuffer {
    return dsp.centreChannel(buffer, "isolate", params.amount / 100);
  }
}

/**
 * Advanced Vocal and Instrument Splitter (Live & Offline).
 *
 * Provides real-time separation using Crossover Bass Preservation and
 * Mid/Side phase cancellation:
 *  - Mode 0 (Karaoke / Beat): Cancels center vocals while preserving low-end
 *    bass and kick drums (< bassPreserve Hz) as well as wide stereo instruments.
 *  - Mode 1 (Vocal / Acapella): Extracts center mid vocals and focuses on vocal
 *    formant frequencies while suppressing side instrumentals and sub-bass rumble.
 */
export class VocalSplitEffect extends AudioEffect {
  readonly id = "vocal-split";
  readonly nameKey = "audio.fx.vocalSplit";
  readonly scopes: EffectScope[] = ["master", "track", "clip", "selection"];
  readonly params = [
    { key: "mode", labelKey: "audio.fx.splitMode", min: 0, max: 1, step: 1, default: 0 },
    { key: "amount", labelKey: "audio.fx.amount", min: 0, max: 100, step: 1, default: 100, unit: "%" },
    { key: "bassPreserve", labelKey: "audio.fx.bassPreserve", min: 40, max: 400, step: 5, default: 180, unit: "Hz" },
    { key: "vocalFocus", labelKey: "audio.fx.vocalFocus", min: 1000, max: 6000, step: 100, default: 3800, unit: "Hz" },
  ];

  build(ctx: BaseAudioContext, params: EffectParams): EffectNodes | null {
    if (typeof ctx.createChannelSplitter !== "function" || typeof ctx.createChannelMerger !== "function") {
      return null;
    }

    const input = ctx.createGain();
    input.channelCount = 2;
    input.channelCountMode = "explicit";
    const output = ctx.createGain();
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    input.connect(splitter);

    // --- Bass preservation crossover path (for Karaoke mode) ---
    const bassFilterL = ctx.createBiquadFilter();
    bassFilterL.type = "lowpass";
    bassFilterL.Q.value = 0.707;
    const bassFilterR = ctx.createBiquadFilter();
    bassFilterR.type = "lowpass";
    bassFilterR.Q.value = 0.707;

    const bassGainL = ctx.createGain();
    const bassGainR = ctx.createGain();

    splitter.connect(bassFilterL, 0);
    splitter.connect(bassFilterR, 1);
    bassFilterL.connect(bassGainL);
    bassFilterR.connect(bassGainR);
    bassGainL.connect(merger, 0, 0);
    bassGainR.connect(merger, 0, 1);

    // --- Mid/High side cancellation path (for Karaoke mode) ---
    const highFilterL = ctx.createBiquadFilter();
    highFilterL.type = "highpass";
    highFilterL.Q.value = 0.707;
    const highFilterR = ctx.createBiquadFilter();
    highFilterR.type = "highpass";
    highFilterR.Q.value = 0.707;

    splitter.connect(highFilterL, 0);
    splitter.connect(highFilterR, 1);

    const sideL_to_L = ctx.createGain();
    const sideR_to_L = ctx.createGain();
    const sideL_to_R = ctx.createGain();
    const sideR_to_R = ctx.createGain();

    highFilterL.connect(sideL_to_L);
    highFilterR.connect(sideR_to_L);
    highFilterL.connect(sideL_to_R);
    highFilterR.connect(sideR_to_R);

    sideL_to_L.connect(merger, 0, 0);
    sideR_to_L.connect(merger, 0, 0);
    sideL_to_R.connect(merger, 0, 1);
    sideR_to_R.connect(merger, 0, 1);

    const dryHighL = ctx.createGain();
    const dryHighR = ctx.createGain();
    highFilterL.connect(dryHighL);
    highFilterR.connect(dryHighR);
    dryHighL.connect(merger, 0, 0);
    dryHighR.connect(merger, 0, 1);

    // --- Vocal isolation path (for Vocal mode) ---
    const midSumL = ctx.createGain();
    midSumL.gain.value = 0.5;
    const midSumR = ctx.createGain();
    midSumR.gain.value = 0.5;
    const midSumNode = ctx.createGain();

    splitter.connect(midSumL, 0);
    splitter.connect(midSumR, 1);
    midSumL.connect(midSumNode);
    midSumR.connect(midSumNode);

    const vocalHighpass = ctx.createBiquadFilter();
    vocalHighpass.type = "highpass";
    vocalHighpass.frequency.value = 160;
    vocalHighpass.Q.value = 0.707;

    const vocalLowpass = ctx.createBiquadFilter();
    vocalLowpass.type = "lowpass";
    vocalLowpass.Q.value = 0.707;

    const vocalGain = ctx.createGain();

    midSumNode.connect(vocalHighpass);
    vocalHighpass.connect(vocalLowpass);
    vocalLowpass.connect(vocalGain);
    vocalGain.connect(merger, 0, 0);
    vocalGain.connect(merger, 0, 1);

    // Dry bypass path for vocal mode
    const dryL = ctx.createGain();
    const dryR = ctx.createGain();
    splitter.connect(dryL, 0);
    splitter.connect(dryR, 1);
    dryL.connect(merger, 0, 0);
    dryR.connect(merger, 0, 1);

    merger.connect(output);

    const nodes: EffectNodes = {
      input,
      output,
      parts: {
        bassFilterL,
        bassFilterR,
        bassGainL,
        bassGainR,
        highFilterL,
        highFilterR,
        sideL_to_L,
        sideR_to_L,
        sideL_to_R,
        sideR_to_R,
        dryHighL,
        dryHighR,
        vocalHighpass,
        vocalLowpass,
        vocalGain,
        dryL,
        dryR,
      },
    };

    this.update(nodes, params);
    return nodes;
  }

  update(nodes: EffectNodes, params: EffectParams): void {
    const parts = nodes.parts ?? {};
    const mode = Math.round(params.mode ?? 0) === 1 ? 1 : 0;
    const mix = Math.min(Math.max(params.amount ?? 100, 0), 100) / 100;
    const bassHz = Math.min(Math.max(params.bassPreserve ?? 180, 20), 500);
    const vocalHz = Math.min(Math.max(params.vocalFocus ?? 3800, 1000), 8000);

    const bassFilterL = parts.bassFilterL as BiquadFilterNode | undefined;
    const bassFilterR = parts.bassFilterR as BiquadFilterNode | undefined;
    const bassGainL = parts.bassGainL as GainNode | undefined;
    const bassGainR = parts.bassGainR as GainNode | undefined;

    const highFilterL = parts.highFilterL as BiquadFilterNode | undefined;
    const highFilterR = parts.highFilterR as BiquadFilterNode | undefined;
    const sideL_to_L = parts.sideL_to_L as GainNode | undefined;
    const sideR_to_L = parts.sideR_to_L as GainNode | undefined;
    const sideL_to_R = parts.sideL_to_R as GainNode | undefined;
    const sideR_to_R = parts.sideR_to_R as GainNode | undefined;
    const dryHighL = parts.dryHighL as GainNode | undefined;
    const dryHighR = parts.dryHighR as GainNode | undefined;

    const vocalLowpass = parts.vocalLowpass as BiquadFilterNode | undefined;
    const vocalGain = parts.vocalGain as GainNode | undefined;
    const dryL = parts.dryL as GainNode | undefined;
    const dryR = parts.dryR as GainNode | undefined;

    if (bassFilterL) bassFilterL.frequency.value = bassHz;
    if (bassFilterR) bassFilterR.frequency.value = bassHz;
    if (highFilterL) highFilterL.frequency.value = bassHz;
    if (highFilterR) highFilterR.frequency.value = bassHz;
    if (vocalLowpass) vocalLowpass.frequency.value = vocalHz;

    if (mode === 0) {
      // Karaoke / Beat Mode (Cancel center vocal, keep bass & stereo sides)
      if (bassGainL) bassGainL.gain.value = 1;
      if (bassGainR) bassGainR.gain.value = 1;

      // Side signal (L - R)/2
      if (sideL_to_L) sideL_to_L.gain.value = 0.5 * mix;
      if (sideR_to_L) sideR_to_L.gain.value = -0.5 * mix;
      if (sideL_to_R) sideL_to_R.gain.value = -0.5 * mix;
      if (sideR_to_R) sideR_to_R.gain.value = 0.5 * mix;

      if (dryHighL) dryHighL.gain.value = 1 - mix;
      if (dryHighR) dryHighR.gain.value = 1 - mix;

      if (vocalGain) vocalGain.gain.value = 0;
      if (dryL) dryL.gain.value = 0;
      if (dryR) dryR.gain.value = 0;
    } else {
      // Vocal / Acapella Mode (Keep center vocal, suppress sides & bass)
      if (bassGainL) bassGainL.gain.value = 0;
      if (bassGainR) bassGainR.gain.value = 0;

      if (sideL_to_L) sideL_to_L.gain.value = 0;
      if (sideR_to_L) sideR_to_L.gain.value = 0;
      if (sideL_to_R) sideL_to_R.gain.value = 0;
      if (sideR_to_R) sideR_to_R.gain.value = 0;

      if (dryHighL) dryHighL.gain.value = 0;
      if (dryHighR) dryHighR.gain.value = 0;

      if (vocalGain) vocalGain.gain.value = mix;
      if (dryL) dryL.gain.value = 1 - mix;
      if (dryR) dryR.gain.value = 1 - mix;
    }
  }

  render(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> | AudioBuffer {
    if (buffer.numberOfChannels === 1) {
      const stereoCtx = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
      const stereo = stereoCtx.createBuffer(2, buffer.length, buffer.sampleRate);
      stereo.getChannelData(0).set(buffer.getChannelData(0));
      stereo.getChannelData(1).set(buffer.getChannelData(0));
      return this.renderViaGraph(stereo, params);
    }
    return this.renderViaGraph(buffer, params);
  }
}

