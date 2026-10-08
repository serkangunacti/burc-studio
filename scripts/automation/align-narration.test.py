import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("alignment", Path(__file__).with_name("align-narration.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AlignmentTests(unittest.TestCase):
    def test_interpolates_only_the_unaligned_trailing_scene_within_audio(self):
        scenes = ["Giriş", "Koç.", "Kapanış."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 1.0}]},
            {"text": scenes[1], "words": [{"start": 5.0, "end": 6.0}]},
            {"text": scenes[2], "words": [{"start": 14.0, "end": 14.0}]},
        ]
        starts = module.scene_starts(segments, scenes, 14.0, 1.0)
        self.assertEqual(starts[:2], [0.0, 5.0])
        self.assertAlmostEqual(starts[2], 25 / 3)
        self.assertLess(starts[2], 14.0)

    def test_rejects_a_late_anchor_that_leaves_too_little_time_for_the_trailing_scenes(self):
        scenes = ["Giriş", "Koç.", "Kapanış."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 1.0}]},
            {"text": scenes[1], "words": [{"start": 13.0, "end": 13.2}]},
            {"text": scenes[2], "words": [{"start": 14.0, "end": 14.0}]},
        ]
        starts = module.scene_starts(segments, scenes, 14.0, 1.0)
        self.assertEqual(starts[0], 0.0)
        self.assertAlmostEqual(starts[1], 72 / 17)
        self.assertAlmostEqual(starts[2], 133 / 17)
        self.assertGreaterEqual(starts[1], 1.0)
        self.assertGreaterEqual(starts[2] - starts[1], 1.0)
        self.assertGreaterEqual(14.0 - starts[2], 1.0)

    def test_reserves_the_minimum_duration_for_a_short_unaligned_closing_scene(self):
        long_comment = "Uzun yorum " + "kelime " * 150
        scenes = ["Giriş", long_comment, "Kapanış."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 1.0}]},
            {"text": scenes[1], "words": [{"start": 100.0, "end": 105.0}]},
            {"text": scenes[2], "words": [{"start": 119.68, "end": 119.68}]},
        ]
        starts = module.scene_starts(segments, scenes, 119.68, 1.0)
        self.assertGreaterEqual(starts[2] - starts[1], 1.0)
        self.assertGreaterEqual(119.68 - starts[2], 1.0)

    def test_does_not_hide_an_unaligned_scene_before_a_later_valid_anchor(self):
        scenes = ["Giriş", "İlk yorum", "İkinci yorum", "Kapanış"]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 1.0}]},
            {"text": scenes[1], "words": [{"start": 4.0, "end": 5.0}]},
            {"text": scenes[2], "words": [{"start": 20.0, "end": 20.0}]},
            {"text": scenes[3], "words": [{"start": 12.0, "end": 13.0}]},
        ]
        with self.assertRaisesRegex(ValueError, "iç sahne zamanlaması"):
            module.scene_starts(segments, scenes, 14.0, 1.0)

    def test_retains_scene_order_without_loading_a_model(self):
        scenes = ["Giriş.", "Koç.", "Kapanış."]
        segments = [{"text": text, "words": [{"start": i * 5 + .2, "end": i * 5 + 4}]} for i, text in enumerate(scenes)]
        self.assertEqual(module.scene_starts(segments, scenes, 20.0, 1.0), [0, 5.2, 10.2])

    def test_rejects_missing_words_changed_text_and_invalid_scene_starts(self):
        with self.assertRaises(ValueError):
            module.scene_starts([{"text": "Metin.", "words": []}], ["Metin."], 20.0, 1.0)
        with self.assertRaises(ValueError):
            module.scene_starts([{"text": "Başka.", "words": [{"start": 0, "end": 1}]}], ["Metin."], 20.0, 1.0)
        for word in [
            {"start": float("nan"), "end": 1},
            {"start": None, "end": 1},
            {"start": -1, "end": 1},
            {"start": 20, "end": 20},
        ]:
            with self.subTest(word=word):
                starts = module.scene_starts(
                    [
                        {"text": "Giriş", "words": [{"start": 0.1, "end": 1}]},
                        {"text": "Metin.", "words": [word]},
                    ],
                    ["Giriş", "Metin."],
                    20.0,
                    1.0,
                )
                self.assertEqual(starts[0], 0.0)
                self.assertGreater(starts[1], 0.0)
                self.assertLess(starts[1], 20.0)

    def test_accepts_overlapping_word_bounds_when_scene_boundaries_are_ordered(self):
        scenes = ["İlk sahne.", "İkinci sahne."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 5.2}, {"start": 4.9, "end": 5.5}, {"start": None, "end": None}]},
            {"text": scenes[1], "words": [{"start": 5.1, "end": 7.0}]},
        ]
        self.assertEqual(module.scene_starts(segments, scenes, 10.0, 1.0), [0.0, 5.1])

    def test_rejects_unordered_scene_boundaries(self):
        scenes = ["İlk sahne.", "İkinci sahne."]
        segments = [
            {"text": scenes[0], "words": [{"start": 0.1, "end": 5.2}]},
            {"text": scenes[1], "words": [{"start": 0.0, "end": 7.0}]},
        ]
        with self.assertRaises(ValueError):
            module.scene_starts(segments, scenes, 10.0, 1.0)


if __name__ == "__main__":
    unittest.main()
