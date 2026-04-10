"""
Focus Drive OS - Alarm Audio Generator
=====================================
Generates a high-urgency, modern vehicle warning beep.
Output: alarm.mp3 → frontend/public/alarm.mp3

Audio characteristics:
  - Two-tone staccato beep (880Hz + 1320Hz alternating)
  - 2 beeps per second with sharp attack/release
  - 4 seconds total, seamless loop
  - Clean square-ish wave with slight softening (no harsh clipping)
"""

import numpy as np
from scipy.io import wavfile
import subprocess
import os

SAMPLE_RATE = 44100
DURATION = 4.0         # seconds (loops seamlessly)
BEEP_FREQ_1 = 880      # Hz — A5 (high, piercing)
BEEP_FREQ_2 = 1320     # Hz — E6 (harmonic tension)
BEEPS_PER_SEC = 2
BEEP_DUTY = 0.35       # 35% on, 65% off (sharp staccato)

OUTPUT_WAV = "alarm.wav"
OUTPUT_MP3 = os.path.join("..", "frontend", "public", "alarm.mp3")


def generate_tone(freq: float, duration: float, sr: int) -> np.ndarray:
    """
    Generate a 'softened square wave' — a square wave with the harsh
    harmonics filtered, giving a clean digital beep sound.
    """
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Base square wave
    wave = np.sign(np.sin(2 * np.pi * freq * t))
    # Soften by mixing with sine (70% square, 30% sine → clean but piercing)
    sine = np.sin(2 * np.pi * freq * t)
    return 0.7 * wave + 0.3 * sine


def apply_envelope(signal: np.ndarray, attack_ms: float = 5, release_ms: float = 5, sr: int = 44100) -> np.ndarray:
    """
    Apply sharp attack/release envelope to avoid clicks.
    Very short (5ms) for that digital staccato feel.
    """
    attack_samples = int(sr * attack_ms / 1000)
    release_samples = int(sr * release_ms / 1000)
    
    envelope = np.ones_like(signal)
    # Attack ramp
    if attack_samples > 0:
        envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
    # Release ramp
    if release_samples > 0:
        envelope[-release_samples:] = np.linspace(1, 0, release_samples)
    
    return signal * envelope


def main():
    total_samples = int(SAMPLE_RATE * DURATION)
    output = np.zeros(total_samples, dtype=np.float64)
    
    beep_period = 1.0 / BEEPS_PER_SEC         # 0.5 seconds per beep cycle
    beep_on_duration = beep_period * BEEP_DUTY # ~0.175 seconds of tone
    
    num_beeps = int(DURATION * BEEPS_PER_SEC)
    
    for i in range(num_beeps):
        start_time = i * beep_period
        start_sample = int(start_time * SAMPLE_RATE)
        on_samples = int(beep_on_duration * SAMPLE_RATE)
        
        # Alternate between the two frequencies for urgency
        freq = BEEP_FREQ_1 if i % 2 == 0 else BEEP_FREQ_2
        
        # Generate tone for this beep
        tone = generate_tone(freq, beep_on_duration, SAMPLE_RATE)
        tone = apply_envelope(tone, attack_ms=3, release_ms=8, sr=SAMPLE_RATE)
        
        # Place into output buffer
        end_sample = min(start_sample + on_samples, total_samples)
        actual_len = end_sample - start_sample
        output[start_sample:end_sample] = tone[:actual_len]
    
    # Normalize to 0.85 peak (leave headroom, avoid clipping)
    peak = np.max(np.abs(output))
    if peak > 0:
        output = output / peak * 0.85
    
    # Convert to 16-bit PCM
    pcm = (output * 32767).astype(np.int16)
    
    # Save as WAV first
    wavfile.write(OUTPUT_WAV, SAMPLE_RATE, pcm)
    print(f"[AlarmGen] WAV saved: {OUTPUT_WAV}")
    
    # Convert to MP3 using ffmpeg (if available) or save as WAV fallback
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", OUTPUT_WAV,
            "-codec:a", "libmp3lame", "-b:a", "192k",
            OUTPUT_MP3
        ], check=True, capture_output=True)
        print(f"[AlarmGen] MP3 saved: {OUTPUT_MP3}")
        os.remove(OUTPUT_WAV)
    except FileNotFoundError:
        # ffmpeg not available, try with scipy wav directly
        print("[AlarmGen] ffmpeg not found. Saving as WAV to public/alarm.mp3 (WAV data in .mp3 ext).")
        # Fallback: copy WAV as the output
        import shutil
        os.makedirs(os.path.dirname(OUTPUT_MP3), exist_ok=True)
        shutil.copy(OUTPUT_WAV, OUTPUT_MP3.replace(".mp3", ".wav"))
        # Also save a wav version the browser can play
        wav_path = os.path.join("..", "frontend", "public", "alarm.wav")
        shutil.copy(OUTPUT_WAV, wav_path)
        print(f"[AlarmGen] WAV fallback saved: {wav_path}")
        os.remove(OUTPUT_WAV)


if __name__ == "__main__":
    main()
