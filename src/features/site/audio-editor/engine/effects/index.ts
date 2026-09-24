import { AudioEffect, type EffectInstance, type EffectNodes, type EffectScope } from "./Effect";
import {
  BassEffect,
  CompressorEffect,
  DenoiseEffect,
  DepthEffect,
  FadeEffect,
  FadeInOutEffect,
  GainEffect,
  HighpassEffect,
  InvertEffect,
  LowpassEffect,
  NoiseGateEffect,
  NormalizeEffect,
  PitchShiftEffect,
  PresenceEffect,
  ReverseEffect,
  DelayEffect,
  DistortionEffect,
  EchoEffect,
  ChorusEffect,
  ReverbEffect,
  SilenceEffect,
  StereoWidthEffect,
  TrebleEffect,
  VocalIsolateEffect,
  VocalRemoveEffect,
  VocalSplitEffect,
} from "./builtin";

export * from "./Effect";

/**
 * Effect registry — docs/site/01-audio-editor.md §4.
 *
 * Adding an effect is: write the subclass, add it to this list. The panel is
 * generated from each effect's `params`, so no UI has to change.
 */
const ALL: AudioEffect[] = [
  new GainEffect(),
  new DenoiseEffect(),
  new BassEffect(),
  new TrebleEffect(),
  new HighpassEffect(),
  new LowpassEffect(),
  new PresenceEffect(),
  new CompressorEffect(),
  new PitchShiftEffect(),
  new DepthEffect(),
  new FadeInOutEffect(),
  new VocalSplitEffect(),
  new EchoEffect(),
  new DelayEffect(),
  new ReverbEffect(),
  new ChorusEffect(),
  new DistortionEffect(),
  new StereoWidthEffect(),
  new VocalRemoveEffect(),
  new VocalIsolateEffect(),
  new NormalizeEffect(),
  new FadeEffect(),
  new NoiseGateEffect(),
  new ReverseEffect(),
  new InvertEffect(),
  new SilenceEffect(),
];

const BY_ID = new Map(ALL.map((e) => [e.id, e]));

export function getEffect(effectId: string): AudioEffect | undefined {
  return BY_ID.get(effectId);
}

export function effectsForScope(scope: EffectScope): AudioEffect[] {
  return ALL.filter((e) => e.scopes.includes(scope));
}

/** Effects offered on a track or the master bus can only be the live ones. */
export function liveEffectsForScope(scope: EffectScope): AudioEffect[] {
  return effectsForScope(scope).filter((e) => e.isLive);
}

export function makeInstance(effectId: string): EffectInstance | null {
  const effect = getEffect(effectId);
  if (!effect) return null;
  return {
    id: crypto.randomUUID(),
    effectId,
    enabled: true,
    params: effect.defaults(),
  };
}

/**
 * Wire a chain of effect instances into `ctx`, in order.
 *
 * Returns null when nothing is enabled, so callers can skip inserting a
 * pointless pass-through. Unknown ids are ignored rather than fatal: a
 * project saved by a newer build should still open.
 */
export function buildChain(
  ctx: BaseAudioContext,
  instances: EffectInstance[],
): EffectNodes | null {
  let head: AudioNode | null = null;
  let tail: AudioNode | null = null;

  for (const instance of instances) {
    if (!instance.enabled) continue;
    const effect = getEffect(instance.effectId);
    if (!effect) continue;
    const nodes = effect.build(ctx, effect.resolve(instance.params));
    if (!nodes) continue;
    if (!head) head = nodes.input;
    else tail?.connect(nodes.input);
    tail = nodes.output;
  }

  return head && tail ? { input: head, output: tail } : null;
}

/** Apply a chain to a buffer offline, for destructive use on a selection. */
export async function renderChain(
  buffer: AudioBuffer,
  instances: EffectInstance[],
): Promise<AudioBuffer> {
  let out = buffer;
  for (const instance of instances) {
    if (!instance.enabled) continue;
    const effect = getEffect(instance.effectId);
    if (!effect) continue;
    const next = await effect.render(out, effect.resolve(instance.params));
    if (next) out = next;
  }
  return out;
}
