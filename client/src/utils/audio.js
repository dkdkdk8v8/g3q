import { Howl } from 'howler';

/**
 * Audio Manager using Howler.js
 * Solves latency issues by using Web Audio API.
 */

// Cache for sound effects
const effects = {};
let currentMusic = null;
let currentMusicPath = null;

export const AudioUtils = {
    /**
     * Play a sound effect (one-shot).
     * @param {string} src - Path to the audio file.
     * @param {number} volume - Volume (0.0 to 1.0).
     */
    playEffect(src, volume = 1.0) {
        if (!src) return;

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
     * Play background music (loop).
     * @param {string} src - Path to the audio file.
     * @param {number} volume - Volume (0.0 to 1.0).
     */
    playMusic(src, volume = 0.5) {
        if (!src) return;

        // If already playing this track, just update volume
        if (currentMusic && currentMusicPath === src) {
            if (!currentMusic.playing()) {
                currentMusic.play();
            }
            currentMusic.volume(volume);
            return;
        }

        // Stop previous music
        if (currentMusic) {
            currentMusic.stop();
            currentMusic.unload(); // Unload to free resources if switching tracks
        }

        currentMusicPath = src;
        currentMusic = new Howl({
            src: [src],
            html5: true, // Use HTML5 Audio for larger files (music) to save memory/bandwidth
            loop: true,
            volume: volume,
            preload: true,
        });

        currentMusic.play();
    },

    /**
     * Stop the background music.
     */
    stopMusic() {
        if (currentMusic) {
            currentMusic.stop();
            // Optional: reset path if you want to force reload next time
            // currentMusicPath = null; 
        }
    },

    /**
     * Pause the background music.
     */
    pauseMusic() {
        if (currentMusic) {
            currentMusic.pause();
        }
    },

    /**
     * Set music volume.
     */
    setMusicVolume(volume) {
        if (currentMusic) {
            currentMusic.volume(volume);
        }
    }
};
