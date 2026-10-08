import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("alignment", Path(__file__).with_name("align-narration.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AlignmentTests(unittest.TestCase):
    def test_retains_scene_order_without_loading_a_model(self):
        scenes = ["Giriş.", "Koç.", "Kapanış."]
        segments = [{"text": text, "words": [{"start": i * 5 + .2, "end": i * 5 + 4}]} for i, text in enumerate(scenes)]
        self.assertEqual(module.scene_starts(segments, scenes), [0, 5.2, 10.2])

    def test_rejects_missing_words_changed_text_and_invalid_scene_starts(self):
        for segment in [
            {"text": "Metin.", "words": []},
            {"text": "Başka.", "words": [{"start": 0, "end": 1}]},
            {"text": "Metin.", "words": [{"start": float("nan"), "end": 1}]},
            {"text": "Metin.", "words": [{"start": None, "end": 1}]},
        ]:
            with self.assertRaises(ValueError):
                module.scene_starts([segment], ["Metin."])

    def test_accepts_overlapping_word_bounds_when_scene_boundaries_are_ordered(self):
        scenes = ["İlk sahne.", "İkinci sahne."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 5.2}, {"start": 4.9, "end": 5.5}, {"start": None, "end": None}]},
            {"text": scenes[1], "words": [{"start": 5.1, "end": 7.0}]},
        ]
        self.assertEqual(module.scene_starts(segments, scenes), [0.0, 5.1])

    def test_rejects_unordered_scene_boundaries(self):
        scenes = ["İlk sahne.", "İkinci sahne."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 5.2}]},
            {"text": scenes[1], "words": [{"start": 0.0, "end": 7.0}]},
        ]
        with self.assertRaises(ValueError):
            module.scene_starts(segments, scenes)


if __name__ == "__main__":
    unittest.main()
