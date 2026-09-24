import { audioParts, type AudioPart } from "./compose";
import { getSourceBlob } from "./store";
import type { TimelineTrack } from "./model";

/**
 * Preview playback for everything on an audio track.
 *
 * This exists because the preview simply had no way to play them. The hidden
 * `<video>` element plays the sound of the clip it happens to be showing and
 * nothing else, so imported music and voiceover were silent right up until
 * export — audible in the finished file, never while editing, which is the
 * one moment you need to hear them to place them.
 *
 * Web Audio is the only option that can do it: several sources have to be
 * heard AT ONCE and at sample-accurate offsets, and a pile of `<audio>`
 * elements can do neither. Each part becomes an `AudioBufferSourceNode`
 * scheduled against the context clock, through a per-part gain node that
 * carries its level and its fades.
 *
 * Decoded buffers are cached per source, so scrubbing back and forth does
 * not decode the same file again. That is memory the editor did not spend
 * before — a three-minute stereo track is ~30MB — which is the deliberate
 * trade for hearing the mix at all.
 */

export interface ScheduledPart {
  node: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioPreview {
  private context: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private playing: ScheduledPart[] = [];
  private master: GainNode | null = null;
  /**
   * Bumped by every stop/dispose. `start` decodes buffers asynchronously, so
   * without this a play-then-immediately-pause would let the parts scheduled
   * after the stop start anyway — audio with nothing left to silence it.
   */
  private generation = 0;

  /** Created lazily and on a user gesture, since browsers suspend contexts made any other way. */
  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private async bufferFor(sourceId: string): Promise<AudioBuffer | null> {
    const hit = this.buffers.get(sourceId);
    if (hit) return hit;

    const pending = (async () => {
      const blob = await getSourceBlob(sourceId);
      if (!blob) return null;
      try {
        // decodeAudioData handles plain audio files directly; for a video
        // container it is unreliable, so those go through mediabunny
        return await this.decode(blob);
      } catch {
        return null;
      }
    })();

    this.buffers.set(sourceId, pending);
    return pending;
  }

  private async decode(blob: Blob): Promise<AudioBuffer | null> {
    const context = this.ensureContext();
    if (blob.type.startsWith("audio/")) {
      try {
        return await context.decodeAudioData(await blob.arrayBuffer());
      } catch {
        // fall through to the container reader below
      }
    }

    const mb = await import("mediabunny");
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return null;

      const duration = await track.computeDuration();
      const sink = new mb.AudioBufferSink(track);

      let out: AudioBuffer | null = null;
      for await (const { buffer, timestamp } of sink.buffers()) {
        if (!out) {
          out = context.createBuffer(
            buffer.numberOfChannels,
            Math.max(1, Math.ceil(duration * buffer.sampleRate)),
            buffer.sampleRate,
          );
        }
        const at = Math.round(timestamp * out.sampleRate);
        for (let c = 0; c < out.numberOfChannels; c++) {
          const from = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
          const room = out.length - at;
          if (room <= 0) break;
          out.copyToChannel(from.subarray(0, Math.min(from.length, room)), c, at);
        }
      }
      return out;
    } finally {
      input.dispose();
    }
  }

  /**
   * Start every part that is still audible at or after `fromTime`.
   *
   * A part already underway is started mid-buffer with the matching offset
   * rather than skipped, so pressing play in the middle of a music bed comes
   * in where it should instead of waiting for the next one to begin.
   */
  /**
   * Start every part still audible at the current playhead.
   *
   * `getTime` is a callback rather than a number on purpose. Decoding has to
   * finish before anything can be scheduled, and on a first play that can take
   * seconds for a large file — during which the picture has been running. If
   * the reference points were taken before decoding, that whole delay became a
   * PERMANENT offset between sound and picture. Both the playhead and the
   * context clock are therefore read in the same instant, after all decoding,
   * so a slow start means the sound joins slightly late rather than staying
   * behind forever.
   *
   * A part already underway is joined mid-buffer rather than skipped, so
   * pressing play in the middle of a music bed comes in where it should.
   */
  async start(tracks: TimelineTrack[], getTime: () => number): Promise<void> {
    this.stop();
    const generation = this.generation;
    const context = this.ensureContext();
    if (context.state === "suspended") await context.resume();
    if (generation !== this.generation) return;

    const parts = audioParts(tracks);
    // decode everything first, in parallel — buffers are cached, so this only
    // costs real time on the first play of each file
    const buffers = await Promise.all(parts.map((part) => this.bufferFor(part.sourceId)));

    // playback may have been stopped, or the engine torn down, while decoding
    if (generation !== this.generation || this.context !== context) return;

    const fromTime = getTime();
    const startedAt = context.currentTime;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const buffer = buffers[i];
      if (!buffer) continue;
      if (part.timelineStart + part.duration <= fromTime) continue;

      // where in the part we are joining, and therefore where in the source
      const into = Math.max(0, fromTime - part.timelineStart);
      const remaining = part.duration - into;
      if (remaining <= 0) continue;

      const node = context.createBufferSource();
      node.buffer = buffer;
      const gain = context.createGain();
      node.connect(gain).connect(this.master!);

      const when = startedAt + Math.max(0, part.timelineStart - fromTime);
      applyEnvelope(gain, part, when, into, remaining);
      node.start(when, part.offset + into, remaining);
      this.playing.push({ node, gain });
    }
  }

  stop(): void {
    this.generation++;
    for (const { node } of this.playing) {
      try {
        node.stop();
      } catch {
        // already finished; nothing to stop
      }
      node.disconnect();
    }
    this.playing = [];
  }

  /** Drop everything, including decoded buffers — call when the editor closes. */
  dispose(): void {
    this.stop();
    this.buffers.clear();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}

/**
 * Level and fades as scheduled ramps rather than per-frame writes.
 *
 * `into` is how far into the part playback is joining: a fade-in already
 * finished by that point has to be skipped, or it would restart from silence
 * halfway through the music.
 */
function applyEnvelope(gain: GainNode, part: AudioPart, when: number, into: number, remaining: number): void {
  const level = part.gain;
  const fadeInLeft = Math.max(0, part.fadeIn - into);

  if (fadeInLeft > 0) {
    // start at whatever the fade had already reached, not at zero
    gain.gain.setValueAtTime(level * (into / Math.max(part.fadeIn, 1e-6)), when);
    gain.gain.linearRampToValueAtTime(level, when + fadeInLeft);
  } else {
    gain.gain.setValueAtTime(level, when);
  }

  if (part.fadeOut > 0) {
    const fadeOutStart = when + Math.max(0, remaining - part.fadeOut);
    gain.gain.setValueAtTime(level, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, when + remaining);
  }
}
