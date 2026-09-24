import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, Plus, Power, Trash2 } from "lucide-react";
import {
  effectsForScope,
  getEffect,
  liveEffectsForScope,
  makeInstance,
  type EffectInstance,
  type EffectScope,
} from "./engine/effects";
import * as P from "./engine/project";
import type { Project, Track } from "./engine/project";
import { renderClip } from "./engine/render";
import { DEFAULT_FADE_SECONDS, formatTime, type TimeRange } from "./engine/types";
import { Button, Field, Segmented, Select, Slider, Toggle } from "@/shared/ui";
import { ValueSlider } from "./ValueSlider";
import { report } from "./engine/activity";
import { effectiveRange, useAudioEditor } from "./store";
import { TrackRecorder } from "./TrackRecorder";

function InfoHint({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <span className="ae__info-hint" tabIndex={0} aria-label={text} title={text}>
      <Info size={12} />
      <span className="ae__info-tooltip">{text}</span>
    </span>
  );
}

/**
 * Effects, split by where they act — docs/site/01-audio-editor.md §4.
 *
 *   Clip      live chain on the selected clip
 *   Track     live chain on the selected track
 *   Master    live chain over the whole mix
 *   Selection one-shot, destructive, on a time range
 *
 * The first three are the same idea at three sizes, and all three are LISTS:
 * what you added is visible and deletable. Only the fourth rewrites samples,
 * where the sole way back is undo — which is why a clip chain exists at all.
 *
 * The first two have NO Apply button on purpose: they are Web Audio nodes,
 * so moving a slider changes the graph and you hear it at once. Only the
 * third writes samples, and only it needs a deliberate action — because
 * only it costs an undo step.
 *
 * Every control here is generated from each effect `params` array, so adding
 * an effect means writing one class in ./engine/effects and nothing else.
 */
export function EffectsPanel() {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const selection = useAudioEditor((s) => s.selection);
  const selectedClipIds = useAudioEditor((s) => s.selectedClipIds);
  const selectedTrackId = useAudioEditor((s) => s.selectedTrackId);
  const pick = useAudioEditor((s) => s.pick);
  const [scope, setScope] = useState<EffectScope | null>(null);
  const [selectionEffectId, setSelectionEffectId] = useState<string>("normalize");

  /**
   * The panel follows what you just picked: a clip opens Clip, a track header
   * opens Track, dragging a range opens Selection, clicking empty space shows
   * nothing. Keyed on `pick.seq`, not on the selection itself, so a manual
   * tab change survives until the NEXT pick instead of being yanked back.
   */
  useEffect(() => {
    if (pick.kind === "none") setScope(null);
    else if (pick.kind === "clip") setScope("clip");
    else if (pick.kind === "track") setScope("track");
    else setScope("selection");
  }, [pick.seq, pick.kind]);

  /**
   * A clicked clip counts as a range too. Before this, selecting a clip and
   * finding the Selection tab still greyed out was a dead end with nothing on
   * screen explaining it — you had to know that clicking a clip and dragging
   * out a time range are different things.
   *
   * effectiveRange allocates, so it is computed here rather than passed to
   * useAudioEditor as a selector (zustand v5 compares snapshots by identity).
   */
  const range = useMemo(
    () => effectiveRange({ project, selection, selectedClipIds }),
    [project, selection, selectedClipIds],
  );
  const hasSelection = range !== null;

  // Selection effects need a selection. Offering the tab without one meant
  // "apply to everything", which is how a fade ended up covering a whole
  // song. Fall back to Track the moment the selection goes away.
  const hasTrack = selectedTrackId !== null;
  const nothingPicked =
    scope === null || (!hasSelection && selectedClipIds.length === 0 && !hasTrack);

  const active: EffectScope | null = nothingPicked
    ? null
    : (scope === "selection" && !hasSelection) || (scope === "clip" && selectedClipIds.length === 0)
      ? "track"
      : scope;

  return (
    <aside className="ae__side">
      <div className="ae__side-head">
        <h2>{t("audio.effects")}</h2>
      </div>

      <div className="ae__fx-tabs" role="tablist">
        {/* widest scope first, narrowing to the one-off at the end */}
        {(["master", "track", "clip", "selection"] as const).map((id) => {
          const locked =
            (id === "selection" && !hasSelection) || (id === "clip" && selectedClipIds.length === 0);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              disabled={locked}
              title={
                locked
                  ? t(id === "clip" ? "audio.fx.needClip" : "audio.fx.needSelection")
                  : undefined
              }
              className={`ae__fx-tab ${active === id ? "ae__fx-tab--active" : ""}`}
              onClick={() => setScope(id)}
            >
              {t(`audio.fx.scope${id[0].toUpperCase()}${id.slice(1)}`)}
            </button>
          );
        })}
      </div>

      {active === null ? (
        <p className="ae__hint">{t("audio.fx.nothingPicked")}</p>
      ) : active === "selection" && range ? (
        <SelectionEffects
          range={range}
          trackIds={range.trackIds}
          selectedEffectId={selectionEffectId}
          onEffectChange={setSelectionEffectId}
        />
      ) : (
        <LiveChain scope={active === "selection" ? "track" : active} />
      )}
    </aside>
  );
}

/* ------------------------------------------------------- live chains */

function LiveChain({
  scope,
}: {
  scope: "master" | "track" | "clip";
}) {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const selectedClipIds = useAudioEditor((s) => s.selectedClipIds);
  const selectedTrackId = useAudioEditor((s) => s.selectedTrackId);
  const selection = useAudioEditor((s) => s.selection);
  const commit = useAudioEditor((s) => s.commit);
  const playing = useAudioEditor((s) => s.playing);

  // Parameters retune the running graph, but ADDING or REMOVING an effect
  // needs nodes that do not exist yet, so those wait for playback to stop.
  const structuralLocked = playing;

  // "the track" means the one holding the selected clip, else the one the
  // time selection covers, else the first — so the panel is never blank.
  const track: Track | null =
    scope === "track"
      ? (project.tracks.find((x) => x.id === selectedTrackId) ??
        (selectedClipIds[0] ? P.findClip(project, selectedClipIds[0])?.track : null) ??
        project.tracks.find((x) => selection?.trackIds.includes(x.id)) ??
        project.tracks[0] ??
        null)
      : null;

  /**
   * The clip scope edits ONE clip — the first picked. Several clips could be
   * edited at once, but then removing an effect would have to guess what to do
   * with clips whose chains had since diverged, and a wrong guess silently
   * deletes processing. One clip, plainly named, is honest.
   */
  const clip = scope === "clip" && selectedClipIds[0]
    ? P.findClip(project, selectedClipIds[0])?.clip ?? null
    : null;

  const chain =
    scope === "master" ? project.masterEffects
    : scope === "clip" ? (clip?.effects ?? [])
    : (track?.effects ?? []);
  const available = liveEffectsForScope(scope);

  const withChain = (next: EffectInstance[]): Project =>
    scope === "master"
      ? { ...project, masterEffects: next }
      : scope === "clip"
        ? clip
          ? P.setClipEffects(project, clip.id, next)
          : project
        : {
            ...project,
            tracks: project.tracks.map((x) => (x.id === track?.id ? { ...x, effects: next } : x)),
          };

  const label = (key: string) => ({
    key,
    params: {
      name:
        scope === "master" ? t("audio.fx.scopeMaster")
        : scope === "clip" ? (clip?.name ?? "")
        : (track?.name ?? ""),
    },
  });

  const add = (effectId: string) => {
    const instance = makeInstance(effectId);
    if (!instance) return;
    if (scope === "clip" && clip && effectId === "fade-in-out") {
      instance.params.fadeIn = clip.fadeIn > 0 ? clip.fadeIn : (instance.params.fadeIn ?? 1);
      instance.params.fadeOut = clip.fadeOut > 0 ? clip.fadeOut : (instance.params.fadeOut ?? 1);
      const p = P.replaceClip(project, {
        ...clip,
        fadeIn: instance.params.fadeIn,
        fadeOut: instance.params.fadeOut,
        effects: [...(clip.effects ?? []), instance],
      });
      commit(p, label("audio.cmd.addEffect"));
      return;
    }
    commit(withChain([...chain, instance]), label("audio.cmd.addEffect"));
  };

  const remove = (id: string) => {
    const target = chain.find((x) => x.id === id);
    if (scope === "clip" && clip && target?.effectId === "fade-in-out") {
      const p = P.replaceClip(project, {
        ...clip,
        fadeIn: 0,
        fadeOut: 0,
        effects: (clip.effects ?? []).filter((x) => x.id !== id),
      });
      commit(p, label("audio.cmd.removeEffect"));
      return;
    }
    commit(withChain(chain.filter((x) => x.id !== id)), label("audio.cmd.removeEffect"));
  };

  const toggle = (id: string) => {
    commit(
      withChain(chain.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))),
      label("audio.cmd.toggleEffect"),
    );
  };

  /**
   * One commit per drag. ValueSlider holds the in-flight value itself, so the
   * store is written exactly once — when the pointer comes up.
   */
  const setParam = (id: string, key: string, value: number) => {
    const target = chain.find((x) => x.id === id);
    const nextChain = chain.map((x) =>
      x.id === id ? { ...x, params: { ...x.params, [key]: value } } : x,
    );
    if (scope === "clip" && clip && target?.effectId === "fade-in-out") {
      const p = P.replaceClip(project, {
        ...clip,
        ...(key === "fadeIn" ? { fadeIn: value } : {}),
        ...(key === "fadeOut" ? { fadeOut: value } : {}),
        effects: nextChain,
      });
      commit(p, label("audio.cmd.effectParam"));
      return;
    }
    commit(withChain(nextChain), label("audio.cmd.effectParam"));
  };

  if (scope === "track" && !track) {
    return <p className="ae__hint">{t("audio.fx.noTrack")}</p>;
  }
  if (scope === "clip" && !clip) {
    return <p className="ae__hint">{t("audio.fx.needClip")}</p>;
  }

  const scopeHint =
    scope === "master"
      ? t("audio.fx.masterHint")
      : scope === "clip"
        ? t("audio.fx.clipHint", { name: clip?.name })
        : t("audio.fx.trackHint", { name: track?.name });

  return (
    <>
      <BuiltIns
        scope={scope}
        track={track}
        clip={clip}
        scopeHint={scopeHint}
      />

      {scope === "track" && track && <TrackRecorder track={track} />}

      {chain.map((instance) => {
        const effect = getEffect(instance.effectId);
        if (!effect) return null;
        const values = effect.resolve(instance.params);
        return (
          <section key={instance.id} className="ae__group ae__fx">
            <h3>
              <button
                type="button"
                className={`ae__fx-power ${instance.enabled ? "ae__fx-power--on" : ""}`}
                disabled={structuralLocked}
                title={structuralLocked ? t("audio.pauseToChange") : t("audio.fx.toggle")}
                onClick={() => toggle(instance.id)}
              >
                <Power size={11} />
              </button>
              <span className="ae__fx-name">{t(effect.nameKey)}</span>
              <button
                type="button"
                className="ae__fx-remove"
                disabled={structuralLocked}
                title={structuralLocked ? t("audio.pauseToChange") : t("audio.fx.remove")}
                onClick={() => remove(instance.id)}
              >
                <Trash2 size={12} />
              </button>
            </h3>

            {effect.params.map((param) =>
              param.key === "mode" ? (
                <Field key={param.key} label={t(param.labelKey)}>
                  <Segmented
                    value={String(values[param.key])}
                    onChange={(v) => setParam(instance.id, param.key, Number(v))}
                    options={[
                      { value: "0", label: t("audio.fx.karaokeMode") },
                      { value: "1", label: t("audio.fx.vocalMode") },
                    ]}
                  />
                </Field>
              ) : (
                <Field
                  key={param.key}
                  label={`${t(param.labelKey)}${param.unit ? ` (${param.unit})` : ""}`}
                >
                  <ValueSlider
                    value={values[param.key]}
                    onCommit={(v) => setParam(instance.id, param.key, v)}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                  />
                </Field>
              )
            )}
          </section>
        );
      })}

      {/* The shared Select has no disabled state, and adding one to the UI kit
          for this would change a component the New Tab also uses. Swapping in
          an explanation is clearer anyway. */}
      {structuralLocked ? (
        <p className="ae__hint">{t("audio.pauseToChange")}</p>
      ) : (
        <Field
          label={
            <span>
              {t("audio.fx.add")}
              {chain.length === 0 && <InfoHint text={t("audio.fx.empty")} />}
            </span>
          }
        >
          <Select
            value=""
            onChange={(v) => v && add(v)}
            options={[
              { value: "", label: t("audio.fx.choose") },
              ...available
                .filter((e) => {
                  if (e.allowMultiple) return true;
                  return !chain.some((inst) => inst.effectId === e.id);
                })
                .map((e) => ({ value: e.id, label: t(e.nameKey) })),
            ]}
          />
        </Field>
      )}
    </>
  );
}

/* --------------------------------------------------- selection effects */

function SelectionEffects({
  range,
  trackIds,
  selectedEffectId = "normalize",
  onEffectChange,
}: {
  range: TimeRange;
  trackIds: string[];
  selectedEffectId?: string;
  onEffectChange?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const playing = useAudioEditor((s) => s.playing);
  const busy = useAudioEditor((s) => s.busy);
  const commit = useAudioEditor((s) => s.commit);
  const setError = useAudioEditor((s) => s.setError);

  const [effectId, setEffectId] = useState(selectedEffectId);
  const [params, setParams] = useState<Record<string, number>>({});
  const [fadeSeconds, setFadeSeconds] = useState(DEFAULT_FADE_SECONDS);

  useEffect(() => {
    setEffectId(selectedEffectId);
  }, [selectedEffectId]);

  const effect = getEffect(effectId);

  // The tab is only reachable with a range — an explicit selection or the
  // clip you clicked — so there is no "apply to everything" fallback to get
  // wrong, which is what once made a fade cover a whole song.
  const disabled =
    !effect || range.end <= range.start || busy || playing || project.tracks.length === 0;
  const why = playing ? t("audio.pauseToApply") : undefined;
  const values = effect ? effect.resolve(params) : {};

  /**
   * A fade covers a fixed length at the edge, never the whole span. Applying
   * a fade with nothing selected used to ramp across the entire song, which
   * is not what anyone means by "fade in".
   */
  const target = (): TimeRange => {
    if (effectId !== "fade") return range;
    const span = Math.min(fadeSeconds, range.end - range.start);
    return values.direction === 0
      ? { start: range.start, end: range.start + span }
      : { start: range.end - span, end: range.end };
  };

  const apply = async () => {
    if (!effect || disabled) return;
    const where = target();
    try {
      // report() paints the banner BEFORE the DSP starts; without that yield
      // the whole render happens in one blocked turn and the user sees only a
      // frozen page.
      const next = await report("audio.applying", (progress) =>
        P.applyEffectToRange(
          project,
          where,
          trackIds,
          (buffer) => effect.render(buffer, values) ?? buffer,
          renderClip,
          progress,
        ),
      );
      commit(next, {
        key: "audio.cmd.applyEffect",
        params: {
          name: t(effect.nameKey),
          range: `${formatTime(where.start)}–${formatTime(where.end)}`,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <Field
        label={
          <span>
            {t("audio.fx.effect")}
            <InfoHint text={t("audio.fx.selectionHint")} />
          </span>
        }
      >
        <Select
          value={effectId}
          onChange={(v) => {
            setEffectId(v);
            onEffectChange?.(v);
            setParams({});
          }}
          options={effectsForScope("selection").map((e) => ({
            value: e.id,
            label: t(e.nameKey),
          }))}
        />
      </Field>

      {effectId === "fade" && (
        <Field
          label={
            <span>
              {t("audio.fadeLength")}
              <InfoHint text={t("audio.fadeLengthDesc")} />
            </span>
          }
        >
          <Slider value={fadeSeconds} onChange={setFadeSeconds} min={0.1} max={30} step={0.1} />
        </Field>
      )}

      {effect?.params.map((param) =>
        param.key === "direction" || param.key === "curve" || param.key === "mode" ? (
          <Field key={param.key} label={t(param.labelKey)}>
            <Segmented
              value={String(values[param.key])}
              onChange={(v) => setParams((p) => ({ ...p, [param.key]: Number(v) }))}
              options={
                param.key === "mode"
                  ? [
                      { value: "0", label: t("audio.fx.karaokeMode") },
                      { value: "1", label: t("audio.fx.vocalMode") },
                    ]
                  : param.key === "direction"
                    ? [
                        { value: "0", label: t("audio.fadeIn") },
                        { value: "1", label: t("audio.fadeOut") },
                      ]
                    : [
                        { value: "0", label: t("audio.curveLinear") },
                        { value: "1", label: t("audio.curveExp") },
                        { value: "2", label: t("audio.curveLog") },
                        { value: "3", label: t("audio.curveS") },
                      ]
              }
            />
          </Field>
        ) : (
          <Field
            key={param.key}
            label={`${t(param.labelKey)}${param.unit ? ` (${param.unit})` : ""}`}
          >
            <Slider
              value={values[param.key]}
              onChange={(v) => setParams((p) => ({ ...p, [param.key]: v }))}
              min={param.min}
              max={param.max}
              step={param.step}
            />
          </Field>
        ),
      )}

      <Button variant="primary" title={why} disabled={disabled} onClick={() => void apply()}>
        <Plus size={15} />
        {t("audio.fx.applyToSelection")}
      </Button>
    </>
  );
}

/* ------------------------------------------------------ built-in controls */

/**
 * The controls every scope has before you add anything: the ones that are
 * properties of the thing itself rather than effects placed on it.
 *
 *   Track   Volume · Balance · Speed
 *   Master  Volume
 *   Clip    Volume · Fade in · Fade out
 *
 * They are not entries in the effect chain because they cannot be removed —
 * a track without a volume is not a thing. Listing them as deletable effects
 * would promise a Remove button that could not work.
 *
 * Every slider follows the same rule as the faders in the track header:
 * dragging updates the tree without touching history, and exactly one undo
 * step lands when the pointer comes up.
 */
function BuiltIns({
  scope,
  track,
  clip,
  scopeHint,
}: {
  scope: "master" | "track" | "clip";
  track: Track | null;
  clip: P.Clip | null;
  scopeHint?: string;
}) {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const commit = useAudioEditor((s) => s.commit);

  const label = scope === "master" ? t("audio.fx.scopeMaster") : (track?.name ?? clip?.name ?? "");
  const apply = (next: Project, key: string) => commit(next, { key, params: { name: label } });

  const title = (
    <h3>
      <span className="ae__fx-name">{t("audio.fx.builtIn")}</span>
      {scopeHint && <InfoHint text={scopeHint} />}
    </h3>
  );

  if (scope === "master") {
    return (
      <section className="ae__group ae__fx">
        {title}
        <Field label={`${t("audio.fx.volume")} (dB)`}>
          <ValueSlider
            value={Math.round(project.masterVolumeDb ?? 0)}
            onCommit={(v) => apply({ ...project, masterVolumeDb: v }, "audio.cmd.masterVolume")}
            min={-40}
            max={12}
          />
        </Field>
      </section>
    );
  }

  if (scope === "track" && track) {
    const speed = P.trackSpeed(track);
    const speedPercent = Math.round((speed ?? 1) * 100);
    const patchTrack = (patch: Partial<Track>, key: string) =>
      apply(
        {
          ...project,
          tracks: project.tracks.map((x) => (x.id === track.id ? { ...x, ...patch } : x)),
        },
        key,
      );

    return (
      <section className="ae__group ae__fx">
        {title}

        <Field label={`${t("audio.fx.volume")} (dB)`}>
          <ValueSlider
            value={Math.round(track.volumeDb)}
            onCommit={(v) => patchTrack({ volumeDb: v }, "audio.cmd.trackVolume")}
            min={-40}
            max={12}
          />
        </Field>

        <Field
          label={
            <span>
              {t("audio.fx.balance")}
              <InfoHint text={t("audio.fx.balanceDesc")} />
            </span>
          }
        >
          <ValueSlider
            value={Math.round(track.pan * 100)}
            onCommit={(v) => patchTrack({ pan: v / 100 }, "audio.cmd.trackPan")}
            min={-100}
            max={100}
            step={5}
          />
        </Field>

        <Field
          label={
            <span>
              {`${t("audio.fx.speed")} (%)`}
              <InfoHint text={speed === null ? t("audio.fx.speedMixed") : t("audio.fx.speedDesc")} />
            </span>
          }
        >
          <ValueSlider
            value={speedPercent}
            onCommit={(v) => apply(P.setTrackSpeed(project, track.id, v / 100), "audio.cmd.speed")}
            min={25}
            max={400}
            step={5}
          />
        </Field>

        {speedPercent !== 100 && (
          <Field
            label={
              <span>
                {t("audio.fx.preservePitch")}
                <InfoHint text={t("audio.fx.preservePitchDesc")} />
              </span>
            }
          >
            <Toggle
              checked={P.trackPreservesPitch(track)}
              onChange={(v) =>
                apply(P.setTrackPreservePitch(project, track.id, v), "audio.cmd.preservePitch")
              }
            />
          </Field>
        )}
      </section>
    );
  }

  if (scope === "clip" && clip) {
    const speedPercent = Math.round(P.clipRate(clip) * 100);
    const patchClip = (patch: Partial<P.Clip>, key: string) =>
      apply(P.replaceClip(project, { ...clip, ...patch }), key);

    return (
      <section className="ae__group ae__fx">
        {title}

        <Field label={`${t("audio.fx.volume")} (dB)`}>
          <ValueSlider
            value={Math.round(clip.gainDb)}
            onCommit={(v) => patchClip({ gainDb: v }, "audio.cmd.clipGain")}
            min={-36}
            max={24}
          />
        </Field>

        <Field
          label={
            <span>
              {`${t("audio.fx.speed")} (%)`}
              <InfoHint text={t("audio.fx.speedDesc")} />
            </span>
          }
        >
          <ValueSlider
            value={speedPercent}
            onCommit={(v) => apply(P.setClipSpeed(project, clip.id, v / 100), "audio.cmd.speed")}
            min={25}
            max={400}
            step={5}
          />
        </Field>

        {speedPercent !== 100 && (
          <Field
            label={
              <span>
                {t("audio.fx.preservePitch")}
                <InfoHint text={t("audio.fx.preservePitchDesc")} />
              </span>
            }
          >
            <Toggle
              checked={clip.preservePitch === true}
              onChange={(v) =>
                apply(P.setClipPreservePitch(project, clip.id, v), "audio.cmd.preservePitch")
              }
            />
          </Field>
        )}
      </section>
    );
  }

  return null;
}
