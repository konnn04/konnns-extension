import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square } from "lucide-react";
import type { Track } from "./engine/project";
import * as P from "./engine/project";
import { decodeFile } from "./engine/decode";
import { formatTime } from "./engine/types";
import { Button, Field, Select } from "@/shared/ui";
import { useAudioEditor } from "./store";

interface TrackRecorderProps {
  track: Track;
}

export function TrackRecorder({ track }: TrackRecorderProps) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  const busy = useAudioEditor((s) => s.busy);
  const play = useAudioEditor((s) => s.play);
  const pause = useAudioEditor((s) => s.pause);
  const commit = useAudioEditor((s) => s.commit);
  const selectClip = useAudioEditor((s) => s.selectClip);
  const setPlayhead = useAudioEditor((s) => s.setPlayhead);
  const setError = useAudioEditor((s) => s.setError);
  const setIsRecording = useAudioEditor((s) => s.setIsRecording);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startPlayheadRef = useRef<number>(0);

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const inputs = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(inputs);
      if (inputs.length > 0 && (!selectedDeviceId || !inputs.some((d) => d.deviceId === selectedDeviceId))) {
        setSelectedDeviceId(inputs[0].deviceId);
      }
    } catch (e) {
      console.warn("Could not enumerate audio devices", e);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    void loadDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", loadDevices);
      return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
    }
  }, [loadDevices]);

  // Handle recorded finish and decode into a clip
  const handleFinishRecording = useCallback(
    async (chunks: BlobPart[], mimeType: string, startPos: number) => {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
      if (blob.size < 100) return;

      try {
        const { buffer, origin } = await decodeFile(blob, "Record");
        if (buffer.duration < 0.1) return;

        const currentProject = useAudioEditor.getState().project;
        const currentTrack = currentProject.tracks.find((t) => t.id === track.id) ?? track;
        const clipCount = currentTrack.clips.length + 1;
        const clipName = `Rec ${clipCount}`;

        const { project: nextProject, clip } = P.addClipToTrack(
          currentProject,
          track.id,
          buffer,
          clipName,
          startPos,
          origin,
        );

        commit(nextProject, {
          key: "audio.cmd.recordClip",
          params: { name: clipName },
        });

        selectClip(clip.id);
        setPlayhead(startPos + buffer.duration);
      } catch (err) {
        console.error("Failed to decode recorded audio", err);
        setError("audio.errDecode");
      }
    },
    [track, commit, selectClip, setPlayhead, setError],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recorder", e);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setIsRecording(false);
    if (useAudioEditor.getState().playing) {
      pause();
    }
  }, [pause, setIsRecording]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // refresh device labels now that permission is granted
      void loadDevices();

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      const startPos = useAudioEditor.getState().playhead;
      startPlayheadRef.current = startPos;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const capturedChunks = [...chunksRef.current];
        const capturedMime = recorder.mimeType;
        void handleFinishRecording(capturedChunks, capturedMime, startPlayheadRef.current);
      };

      recorder.start(100);
      setRecording(true);
      setIsRecording(true);
      setRecordDuration(0);

      // Start playback so existing tracks play simultaneously (overdub)
      const currentProj = useAudioEditor.getState().project;
      if (currentProj.tracks.length > 0 && P.projectDuration(currentProj) > startPos) {
        play();
      }
    } catch (err) {
      console.error("Recording start error", err);
      setError("audio.errMicPermission");
      stopRecording();
    }
  }, [selectedDeviceId, loadDevices, play, handleFinishRecording, stopRecording, setError, setIsRecording]);

  // Space key stops recording when recording is active
  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, stopRecording]);

  // Live timer ticker while recording
  useEffect(() => {
    if (!recording) return;
    const startTime = performance.now();
    const startPos = startPlayheadRef.current;
    const timer = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      setRecordDuration(elapsed);
      if (!useAudioEditor.getState().playing) {
        setPlayhead(startPos + elapsed);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [recording, setPlayhead]);

  // Clean up mic stream and flags if component unmounts while recording
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }
      setIsRecording(false);
    };
  }, [setIsRecording]);

  const micOptions =
    devices.length > 0
      ? devices.map((d, index) => ({
          value: d.deviceId,
          label: d.label || `${t("audio.mic")} ${index + 1}`,
        }))
      : [{ value: "", label: t("audio.defaultMic") }];

  return (
    <section className="ae__group ae__recorder">
      <h3>
        <span className="ae__fx-name">{t("audio.recordTitle")}</span>
      </h3>

      <Field label={t("audio.selectMic")}>
        <Select
          value={selectedDeviceId}
          onChange={(v) => setSelectedDeviceId(v)}
          options={micOptions}
        />
      </Field>

      {recording ? (
        <div className="ae__recorder-active">
          <span className="ae__recorder-indicator">
            <span className="ae__recorder-dot" />
            <span className="ae__recorder-time">{formatTime(recordDuration)}</span>
          </span>
          <Button variant="danger" onClick={stopRecording}>
            <Square size={13} />
            {t("audio.stopRecord")}
          </Button>
        </div>
      ) : (
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => void startRecording()}
          title={t("audio.recordHint")}
        >
          <Mic size={15} />
          {t("audio.startRecord")}
        </Button>
      )}
    </section>
  );
}
