# rad.io MVP User Journeys

## Journey 1: The "Local FM" Verification

**Persona**: First-time user testing if the app works.

1. **Start**: User lands on `rad.io` (served via HTTPS).
2. **Connect**: User clicks "Connect Device". Browser prompts for USB permission. User selects "HackRF One".
3. **Tuning**: Spectrum appears. User drags the frequency display to ~100 MHz (FM Broadcast band).
4. **Listen**: User sees a strong station signal on the waterfall. Clicks the center of the peak.
5. **Success**: Audio plays clearly (music/speech). "WFM" mode is auto-selected or easily manually selected.
6. **Exit**: User closes the tab. Audio stops immediately.

## Journey 2: The "NFM Scanning" Check

**Persona**: Hobbyist checking local repeater traffic.

1. **Setup**: Device already connected from previous session.
2. **Tune**: User inputs "146.520" (or similar local calling freq) into direct frequency entry or drags dial.
3. **Mode**: User switches mode to "NFM".
4. **Squelch**: Static is loud. User drags "Squelch" slider up until background noise cuts out.
5. **Traffic**: A signal appears on the waterfall. Squelch opens. Audio is heard.
6. **Success**: Intelligible voice traffic, squelch closes promptly when signal ends.

## Journey 3: The "Airband" Listener

**Persona**: Aviation enthusiast.

1. **Tune**: User scrolls frequency to 118-136 MHz range.
2. **Mode**: Switches to "AM".
3. **Visual Search**: Uses the waterfall to spot intermittent transmission bursts (control tower/pilots).
4. **Click-to-Tune**: Clicks on a fresh burst.
5. **Bandwidth**: Signal is wider than filter. User uses scroll wheel on the spectrum to widen the IF filter bandwidth slightly.
6. **Success**: Transmission is heard clearly.

## Journey 4: Failure & Recovery (The "USB Yank")

**Persona**: Anyone with a loose cable.

1. **State**: User is happily listening to music (Journey 1).
2. **Failure**: User accidentally bumps the USB cable. Connection is lost.
3. **Response**:
    - Audio stops immediately (no looping buffer).
    - UI shows a "Device Disconnected" toast/overlay (not a crash).
    - Spectrum freezes or goes black.
4. **Recovery**: User plugs cable back in.
5. **Resume**: App detects the device. User clicks "Reconnect" (or auto-reconnects).
6. **Success**: Streaming resumes at the same frequency and settings as before.

## Journey 5: Overload & Adjustment

**Persona**: User with a strong nearby transmitter.

1. **State**: User tunes to a frequency but sees "ghost" signals (aliasing) or the noise floor is inexplicably high.
2. **Diagnosis**: Spectrum display shows a "Clamping" or "Overload" warning indicator (visual clipping).
3. **Action**: User opens "Gain Controls".
4. **Adjustment**: User reduces "LNA Gain" or "VGA Gain".
5. **Success**: Noise floor drops, ghost signals disappear, real signals remain visible.

## Journey 6: Performance Check (The "Old Laptop")

**Persona**: User on lower-end hardware.

1. **Start**: User opens app on a dual-core laptop.
2. **Load**: Connects device at high sample rate (e.g., 20 MSPS - wait, MVP might cap this). Let's say 10 MSPS.
3. **Observation**: Audio begins to stutter (underrun).
4. **Feedback**: "Drop" counter in the status bar is incrementing. "CPU" indicator is red.
5. **Mitigation**: User lowers sample rate to 2 MSPS or 4 MSPS via settings.
6. **Success**: Audio becomes smooth. CPU indicator turns green/yellow.
