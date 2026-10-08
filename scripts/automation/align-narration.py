"""Align the existing transcript to the complete audio on GitHub Actions only.

No Gemini requests and no speech synthesis: stable-ts aligns Turkish words on
the runner. Newlines retain the 14 original scene boundaries.
"""
import json
import math
import os
import sys
from pathlib import Path


def scene_starts(segments, scenes):
    if len(segments) != len(scenes):
        raise ValueError("Konuşma zamanlaması: bütün sahneler eşleşmedi")
    starts = []
    previous_end = 0.0
    for index, (segment, text) in enumerate(zip(segments, scenes)):
        if " ".join(segment["text"].split()) != " ".join(text.split()):
            raise ValueError("Konuşma zamanlaması: mevcut metin eşleşmedi")
        words = segment.get("words", [])
        if not words:
            raise ValueError("Konuşma zamanlaması: sözcükler eksik")
        for word in words:
            start, end = word["start"], word["end"]
            if not math.isfinite(start) or not math.isfinite(end) or end <= start or start < previous_end - 0.04:
                raise ValueError("Konuşma zamanlaması: sözcük süresi geçersiz")
            previous_end = end
        starts.append(0.0 if index == 0 else words[0]["start"])
    return starts


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("Konuşma analizi yalnız GitHub Actions üzerinde çalışır")
    import stable_whisper
    import torch

    torch.set_num_threads(2)
    audio, manifest, output = sys.argv[1:]
    scenes = json.loads(Path(manifest).read_text())["scenes"]
    model = stable_whisper.load_model("small", device="cpu")
    result = model.align(audio, "\n".join(scenes), language="tr", original_split=True, verbose=None, remove_instant_words=False)
    if result is None:
        raise ValueError("Konuşma zamanlaması çıkarılamadı")
    starts = scene_starts(result.to_dict()["segments"], scenes)
    Path(output).write_text(json.dumps({"sceneStarts": starts}))


if __name__ == "__main__":
    main()
