# Voice Transcription Research

## Goal

Long-term product target:

- Capture voice chat during TRPG sessions.
- Produce timestamped transcripts with speaker labels.
- Extract GM-supporting memory from the transcript, while keeping the GM approval flow.
- Avoid AI GM / AI NPC replacement. The system observes, organizes, and assists the human GM.

## Product Constraints

- Japanese TRPG sessions are the first-class target.
- Low running cost matters.
- Browser-first UX is desirable, but voice capture may require a companion server or bot.
- Speaker labels are not cosmetic. The tool needs to distinguish GM, PLs, NPC-like speech by GM, and table talk.
- Raw voice and API keys are sensitive; local-first and explicit consent should be core UX.

## Findings

### Browser microphone capture

Browser microphone capture is viable for the local user's mic, but it does not solve voice chat capture by itself.

- `getUserMedia` can capture the user's own microphone.
- `getDisplayMedia` can capture shared screen/window media and sometimes system/tab audio, but behavior depends on browser and OS.
- This route is useful for a manual "record this tab/app" MVP, but speaker labels from mixed audio would require diarization.

Risk:

- Mixed system audio gives weaker speaker identity.
- Capturing Discord/Zoom/etc. from the browser is fragile and permission-heavy.

### Web Speech API

The Web Speech API is not a good foundation for this product.

- Browser support is limited.
- Chrome can send audio to a server-side recognition service, so it is not a reliable offline/local path.
- It does not provide the control needed for timestamped multi-speaker session logs.

Use only as a demo fallback, not as the main architecture.

### OpenAI transcription

OpenAI Realtime transcription is a good candidate for low-latency transcript display.

- Realtime transcription sessions can be connected via WebSocket or WebRTC.
- Supported transcription models include `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe-latest`, and `whisper-1`.
- Realtime transcription supports server-side VAD and incremental transcript deltas.
- Batch audio transcription has diarized JSON response shapes in the API reference, so post-session diarized processing may be possible.

Open question:

- Validate Japanese diarization quality and pricing on actual TRPG-like audio before committing.

### Deepgram

Deepgram supports diarization for prerecorded and streaming transcription.

- Diarization assigns speaker labels at word level.
- Streaming diarization is available on supported models.
- It is likely practical for live session logs when we can stream a single mixed audio source.

Open question:

- Japanese accuracy and diarization stability need real sample tests.

### AssemblyAI

AssemblyAI has strong diarization documentation, including streaming diarization.

- Batch diarization returns utterances with speaker labels, timestamps, words, and confidence.
- Japanese is listed as supported for speaker diarization in current docs.
- Streaming diarization can attach speaker labels to real-time turn events, with labels improving as more context accumulates.

Open question:

- Need to compare latency and Japanese TRPG vocabulary accuracy against OpenAI and Deepgram.

### Discord voice capture

Discord is a compelling first integration, but it changes the architecture.

- Official Discord voice connections are UDP-based and use Opus at 48 kHz.
- Discord is migrating voice/video to E2EE and requires DAVE support for future compatibility.
- `@discordjs/voice` supports sending and receiving audio, but its own docs state that audio receive is not documented by Discord, so stability is not guaranteed.
- If we can receive per-user audio streams, speaker attribution becomes much easier than diarizing mixed audio.

Implication:

- Discord bot capture is high-value but should not be the first dependency of the MVP unless the project accepts bot/server complexity.

## Architecture Options

### Option A: Browser-only manual capture

Flow:

1. User starts recording in the web app.
2. Browser captures mic or chosen tab/window audio.
3. App streams audio to transcription API.
4. If audio is mixed, API diarization labels speakers.
5. User maps `Speaker A/B/C` to player names.

Pros:

- Fastest prototype.
- No Discord bot or server-side voice gateway required.
- Works with any voice chat app if the user can capture audio.

Cons:

- Speaker diarization quality is uncertain.
- System audio capture differs by OS/browser.
- Browser cannot reliably access each participant separately.

Best use:

- First live transcription spike.
- Provider comparison harness.

### Option B: Discord bot capture

Flow:

1. User invites a bot to the Discord voice channel.
2. Bot receives per-user Opus streams.
3. Server transcodes/resamples streams.
4. Each user stream is transcribed separately or tagged before mixing.
5. Web app receives speaker-labeled transcript events.

Pros:

- Best speaker identity path.
- Natural for many online TRPG tables.
- Enables per-player consent/status indicators.

Cons:

- Requires backend/bot service.
- Discord audio receive is not officially stable.
- E2EE/DAVE compatibility must be tracked.

Best use:

- Serious alpha after browser-only transcription is validated.

### Option C: Local companion recorder

Flow:

1. User runs a local desktop/CLI companion.
2. Companion captures system audio or virtual audio devices.
3. Companion streams audio to the web app or directly to provider APIs.
4. Web app handles transcripts and GM memory.

Pros:

- More reliable system audio capture than browser-only.
- Can support virtual audio routing and local Whisper later.

Cons:

- Installation friction.
- Cross-platform maintenance.

Best use:

- Power-user mode after core product value is proven.

## Recommendation

Start with Option A, but design the transcript data model so Option B can plug in later.

Immediate next milestone:

1. Add a "Live Log" domain model:
   - session id
   - source type: `manual`, `browser-mic`, `browser-mixed-audio`, `discord-user-stream`
   - transcript segments: id, speaker id, speaker label, start/end time, text, confidence, source user id, raw provider metadata
   - speaker map: provider label/user id to display name and role
2. Build a transcript import/playback UI without live audio first.
3. Add provider adapter interfaces:
   - batch transcribe
   - streaming transcribe
   - optional diarization
4. Run a provider spike with short Japanese TRPG-like samples.
5. Only after that, implement browser audio capture.

Provider order for spikes:

1. OpenAI Realtime transcription: good fit with existing LLM direction.
2. AssemblyAI streaming diarization: strong diarization ergonomics.
3. Deepgram streaming diarization: compare latency and Japanese accuracy.

## Sources

- OpenAI Realtime transcription: https://developers.openai.com/api/docs/guides/realtime-transcription
- OpenAI audio API reference: https://developers.openai.com/api/reference/audio/createTranscription
- MDN SpeechRecognition: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- MDN Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Deepgram diarization: https://developers.deepgram.com/docs/diarization/
- AssemblyAI speaker diarization: https://www.assemblyai.com/docs/speech-to-text/speaker-diarization/
- AssemblyAI streaming diarization: https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels
- Discord voice connections: https://docs.discord.com/developers/topics/voice-connections
- discord.js voice package: https://discord.js.org/docs/packages/voice/main
