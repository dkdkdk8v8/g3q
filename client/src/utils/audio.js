import { Howl, Howler } from 'howler';

/**
 * Audio Manager
 * Effects uses Howler.js (Web Audio API) for low latency.
 * Music uses native HTML5 Audio for streaming and better control separation.
 */

// Cache for sound effects
const effects = {};

// Music State
let currentMusic = null; // Will be an instance of Audio
let currentMusicPath = null;
let wasMusicPlaying = false; // Track if music was playing before suspend
let currentMusicVolume = 0.5; // Store volume to re-apply

export const AudioUtils = {
    /**
     * Play a sound effect (one-shot).
     * @param {string} src - Path to the audio file.
     * @param {number} volume - Volume (0.0 to 1.0).
     */
    playEffect(src, volume = 1.0) {
        if (!src) return;

        // Ensure global mute is off when trying to play an effect (defensive)
        if (Howler._muted) {
            Howler.mute(false);
        }

        if (!effects[src]) {
            effects[src] = new Howl({
                src: [src],
                volume: volume,
                preload: true,
                html5: false, // Force Web Audio API for low latency
            });
        } else {
            effects[src].volume(volume);
        }

        // Play creates a new sound instance ID
        effects[src].play();
    },

    /**
     * Play background music (loop) using native Audio.
     * @param {string} src - Path to the audio file.
     * @param {number} volume - Volume (0.0 to 1.0).
     */
    playMusic(src, volume = 0.5) {
        if (!src) return;
        currentMusicVolume = volume;

        // If already playing this track
        if (currentMusic && currentMusicPath === src) {
            if (currentMusic.paused) {
                currentMusic.play().catch(e => console.warn("Music playback failed:", e));
                wasMusicPlaying = true;
            }
            currentMusic.volume = volume;
            return;
        }

        // Stop previous music
        if (currentMusic) {
            currentMusic.pause();
            currentMusic.currentTime = 0;
            currentMusic = null;
        }

        currentMusicPath = src;
        currentMusic = new Audio(src);
        currentMusic.loop = true;
        currentMusic.volume = volume;

        currentMusic.play().catch(e => console.warn("Music playback failed:", e));
        wasMusicPlaying = true;
    },

    /**
     * Stop the background music.
     */
    stopMusic() {
        if (currentMusic) {
            currentMusic.pause();
            currentMusic.currentTime = 0;
        }
        wasMusicPlaying = false;
    },

    /**
     * Pause the background music.
     */
    pauseMusic() {
        if (currentMusic) {
            currentMusic.pause();
        }
        wasMusicPlaying = false;
    },

    /**
     * Set music volume.
     */
    setMusicVolume(volume) {
        currentMusicVolume = volume;
        if (currentMusic) {
            currentMusic.volume = volume;
        }
    },

    /**
     * Suspend all audio (Global Mute + Pause Music)
     * Used when app goes to background
     */
    suspend() {
        // Handle Music
        if (currentMusic && !currentMusic.paused) {
            currentMusic.pause();
            wasMusicPlaying = true;
        } else {
            // If it was already paused/stopped, we shouldn't resume it automatically
            wasMusicPlaying = false;
        }

        // Handle Howler (Effects)
        Howler.mute(true);
    },

    /**
     * Resume audio (Global Unmute + Resume Music if was playing)
     * Used when app comes to foreground
     */
    resume() {
        // Handle Howler (Effects)
        Howler.mute(false);

        // Handle Music
        if (wasMusicPlaying && currentMusic) {
            currentMusic.play().catch(e => console.warn("Music resume failed:", e));
        }
    }
};
