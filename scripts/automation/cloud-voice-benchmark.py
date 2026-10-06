"""One-clip benchmark, exclusively on a GitHub runner. No local model execution."""
import os
if os.environ.get("GITHUB_ACTIONS") != "true":
    raise RuntimeError("Only GitHub cloud execution is allowed")
import json, time, hashlib, random
from pathlib import Path
import numpy as np
import torch
import torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
item=json.loads(Path("/tmp/serkanses-benchmark.json").read_text())
assert hashlib.sha256(Path("/tmp/serkanses-reference.wav").read_bytes()).hexdigest()=="421ffce7125ca2bb286519a5f45d98a8d2db4027b730ebeb61e75fee057e5016"
torch.set_num_threads(2)
started=time.monotonic()
model=ChatterboxMultilingualTTS.from_pretrained(device="cpu",t3_model="v3")
load_seconds=time.monotonic()-started
random.seed(20261002);np.random.seed(20261002);torch.manual_seed(20261002)
started=time.monotonic()
wave=model.generate(item["text"],language_id="tr",audio_prompt_path="/tmp/serkanses-reference.wav",exaggeration=.5,temperature=.8,cfg_weight=.3)
elapsed=time.monotonic()-started
duration=wave.shape[-1]/model.sr
assert 0<duration<=30
output=Path(".cache/serkanses")/(item["key"]+".wav")
assert not output.exists(),"Existing audio is preserved"
torchaudio.save(str(output),wave.cpu(),model.sr)
output.with_suffix(".json").write_text(json.dumps({"state":"completed","outputHash":hashlib.sha256(output.read_bytes()).hexdigest(),"source":"github-cloud-cpu-v3"}))
print(json.dumps({"loadSeconds":round(load_seconds,2),"generationSeconds":round(elapsed,2),"audioSeconds":round(duration,2),"clips":1}),flush=True)
