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

    def test_rejects_missing_words_changed_text_and_zero_duration(self):
        for segment in [
            {"text": "Metin.", "words": []},
            {"text": "Başka.", "words": [{"start": 0, "end": 1}]},
            {"text": "Metin.", "words": [{"start": 1, "end": 1}]},
        ]:
            with self.assertRaises(ValueError):
                module.scene_starts([segment], ["Metin."])


if __name__ == "__main__":
    unittest.main()
