/**
 * Effect base class — docs/site/01-audio-editor.md §4.
 *
 * One class per effect, carrying everything about it: its parameters, how to
 * build it as live Web Audio nodes, and/or how to render it into samples.
 * Adding an effect is writing one subclass and listing it in the registry —
 * no switch statements to extend, no panel code to touch, because the UI is
 * generated from `params`.
 *
 * The split between `build` and `render` is the important part:
 *
 *  - `build` makes a node chain. Everything it powers is NON-DESTRUCTIVE and
 *    therefore adjustable live: drag a slider and you hear it immediately,
 *    because nothing is being rewritten — the graph just changes.
 *  - `render` transforms a buffer. Needed for anything that cannot be a
 *    node: normalise has to scan the whole buffer before it knows the gain,
 *    reverse has to reorder samples. These stay one-shot and destructive.
 *
 * An effect may implement either or both.
 */

export type EffectScope = "master" | "track" | "clip" | "selection";

export interface EffectParam {
  key: string;
  labelKey: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** shown after the value, e.g. dB or Hz */
  unit?: string;
}

export type EffectParams = Record<string, number>;

/** A built chain: callers connect into `input` and take audio from `output`. */
export interface EffectNodes {
  input: AudioNode;
  output: AudioNode;
  /**
   * Whatever `update()` needs to retune later. A one-node effect finds its
   * node at `input`, but anything with an inner topology — a delay line and
   * its feedback, a wet/dry pair — would otherwise be unreachable once built,
   * and the slider would go dead the moment playback started.
   */
  parts?: Record<string, AudioNode>;
}

/** An effect placed on a track or the master bus, with its settings. */
export interface EffectInstance {
  id: string;
  effectId: string;
  enabled: boolean;
  params: EffectParams;
}

export abstract class AudioEffect {
  abstract readonly id: string;
  abstract readonly nameKey: string;
  abstract readonly params: EffectParam[];
  /** where this effect is offered */
  abstract readonly scopes: EffectScope[];
  /** whether multiple instances of this effect can be added in the same chain */
  readonly allowMultiple?: boolean;

  /** Live node chain, or null when this effect is render-only. */
  build(_ctx: BaseAudioContext, _params: EffectParams): EffectNodes | null {
    return null;
  }

  /**
   * Push new parameter values onto nodes that are ALREADY PLAYING.
   *
   * Without this a live effect was only live in name: the graph was built
   * once when playback started, so moving a slider changed nothing until you
   * stopped and pressed play again. Subclasses that build nodes override it.
   */
  update(_nodes: EffectNodes, _params: EffectParams): void {}

  /**
   * Offline transform.
   *
   * Effects that build nodes get this FOR FREE: the default runs the same
   * chain through an OfflineAudioContext. Without it, an effect could offer
   * itself on a selection and then silently do nothing when applied, because
   * it had a `build` but no `render` — a trap the test suite caught.
   *
   * Only effects that cannot be expressed as nodes at all (normalise needs
   * the peak of the whole region; reverse reorders samples) override this.
   */
  render(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> | AudioBuffer | null {
    return this.isLive ? this.renderViaGraph(buffer, params) : null;
  }

  protected async renderViaGraph(buffer: AudioBuffer, params: EffectParams): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const nodes = this.build(ctx, params);
    if (!nodes) return buffer;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(nodes.input);
    nodes.output.connect(ctx.destination);
    source.start();
    return ctx.startRendering();
  }

  get isLive(): boolean {
    return this.build !== AudioEffect.prototype.build;
  }

  get isRenderable(): boolean {
    return this.isLive || this.render !== AudioEffect.prototype.render;
  }

  defaults(): EffectParams {
    const out: EffectParams = {};
    for (const p of this.params) out[p.key] = p.default;
    return out;
  }

  /** Fill in any parameter the stored instance is missing (added later, say). */
  resolve(params: EffectParams): EffectParams {
    return { ...this.defaults(), ...params };
  }
}
