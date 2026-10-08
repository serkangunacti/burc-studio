"""Align the existing transcript to the complete audio on GitHub Actions only.

No Gemini requests and no speech synthesis: stable-ts aligns Turkish words on
the runner. Newlines retain the 14 original scene boundaries.
"""
import json
import math
import os
import sys
from pathlib import Path


def scene_starts(segments, scenes, duration_seconds, minimum_scene_gap_seconds):
    if not isinstance(duration_seconds, (int, float)) or not math.isfinite(duration_seconds) or duration_seconds <= 0:
        raise ValueError("Konuşma zamanlaması: ses süresi geçersiz")
    if (
        not isinstance(minimum_scene_gap_seconds, (int, float))
        or not math.isfinite(minimum_scene_gap_seconds)
        or minimum_scene_gap_seconds <= 0
    ):
        raise ValueError("Konuşma zamanlaması: en kısa sahne aralığı geçersiz")
    if not scenes or len(segments) != len(scenes):
        raise ValueError("Konuşma zamanlaması: bütün sahneler eşleşmedi")
    candidates = []
    for index, (segment, text) in enumerate(zip(segments, scenes)):
        if " ".join(segment["text"].split()) != " ".join(text.split()):
            raise ValueError("Konuşma zamanlaması: mevcut metin eşleşmedi")
        words = segment.get("words", [])
        if not words:
            raise ValueError("Konuşma zamanlaması: sözcükler eksik")
        first_valid_start = next((
            word.get("start") for word in words
            if isinstance(word.get("start"), (int, float))
            and not isinstance(word.get("start"), bool)
            and math.isfinite(word["start"])
            and 0 <= word["start"] < duration_seconds
        ), None)
        candidates.append(0.0 if index == 0 else first_valid_start)

    starts = [None] * len(scenes)
    starts[0] = 0.0
    last_anchor_index = 0
    last_anchor_time = 0.0
    for index in range(1, len(scenes)):
        candidate = candidates[index]
        if candidate is not None:
            if candidate <= last_anchor_time:
                raise ValueError("Konuşma zamanlaması: sahne başlangıçları sıralı değil")
            remaining_scene_count = len(scenes) - index
            has_room_before = candidate - last_anchor_time >= minimum_scene_gap_seconds
            has_room_after = duration_seconds - candidate >= remaining_scene_count * minimum_scene_gap_seconds
            if has_room_before and has_room_after:
                starts[index] = candidate
                last_anchor_index = index
                last_anchor_time = candidate
                continue
        if any(
            later is not None
            and later - last_anchor_time >= (later_index - last_anchor_index) * minimum_scene_gap_seconds
            and duration_seconds - later >= (len(scenes) - later_index) * minimum_scene_gap_seconds
            for later_index, later in enumerate(candidates[index + 1:], start=index + 1)
        ):
            raise ValueError("Konuşma zamanlaması: iç sahne zamanlaması eksik veya sırasız")

        # stable-ts marks words it could not place at the end of a clip with
        # start=end=audio duration. Keep the complete narration and estimate
        # only that unaligned trailing scene range from the existing text.
        weights = [max(1, len("".join(scene.split()))) for scene in scenes]
        total_weight = sum(weights[last_anchor_index:])
        remaining_seconds = duration_seconds - last_anchor_time
        remaining_scene_count = len(scenes) - last_anchor_index
        if total_weight <= 0 or remaining_seconds < remaining_scene_count * minimum_scene_gap_seconds:
            raise ValueError("Konuşma zamanlaması: son sahneler için ses aralığı kalmadı")
        distributable_seconds = remaining_seconds - remaining_scene_count * minimum_scene_gap_seconds
        elapsed_weight = 0
        previous_start = last_anchor_time
        for boundary in range(last_anchor_index + 1, len(scenes)):
            elapsed_weight += weights[boundary - 1]
            elapsed_minimum = (boundary - last_anchor_index) * minimum_scene_gap_seconds
            starts[boundary] = (
                last_anchor_time
                + elapsed_minimum
                + distributable_seconds * elapsed_weight / total_weight
            )
            if starts[boundary] - previous_start < minimum_scene_gap_seconds:
                raise ValueError("Konuşma zamanlaması: son sahneler için ses aralığı kalmadı")
            previous_start = starts[boundary]
        if duration_seconds - previous_start < minimum_scene_gap_seconds:
            raise ValueError("Konuşma zamanlaması: son sahneler için ses aralığı kalmadı")
        break

    return starts


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("Konuşma analizi yalnız GitHub Actions üzerinde çalışır")
    import stable_whisper
    import torch

    torch.set_num_threads(2)
    audio, manifest, output = sys.argv[1:]
    request = json.loads(Path(manifest).read_text())
    scenes = request["scenes"]
    duration_seconds = request["durationSeconds"]
    minimum_scene_gap_seconds = request["minimumSceneGapSeconds"]
    model = stable_whisper.load_model("small", device="cpu")
    result = model.align(audio, "\n".join(scenes), language="tr", original_split=True, verbose=None, remove_instant_words=False)
    if result is None:
        raise ValueError("Konuşma zamanlaması çıkarılamadı")
    starts = scene_starts(result.to_dict()["segments"], scenes, duration_seconds, minimum_scene_gap_seconds)
    Path(output).write_text(json.dumps({"sceneStarts": starts}))


if __name__ == "__main__":
    main()
