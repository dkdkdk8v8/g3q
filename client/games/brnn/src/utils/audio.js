import { Howl, Howler } from 'howler';

/**
 * Audio Manager using Howler.js
 */

const effects = {};
let currentMusic = null;
let currentMusicPath = null;
let wasMusicPlaying = false;

export const AudioUtils = {
    playEffect(src, volume = 1.0) {
        if (!src) return;

        if (!effects[src]) {
            effects[src] = new Howl({
                src: [src],
                volume: volume,
                preload: true,
                html5: false,
            });
        } else {
            effects[src].volume(volume);
        }

        effects[src].play();
    },

    playMusic(src, volume = 0.5) {
        if (!src) return;

        if (currentMusic && currentMusicPath === src) {
            if (!currentMusic.playing()) {
                currentMusic.play();
                wasMusicPlaying = true;
            }
            currentMusic.volume(volume);
            return;
        }

        if (currentMusic) {
            currentMusic.stop();
            currentMusic.unload();
        }

        currentMusicPath = src;
        currentMusic = new Howl({
            src: [src],
            html5: false,
            loop: true,
            volume: volume,
            preload: true,
        });

        currentMusic.play();
        wasMusicPlaying = true;
    },

    stopMusic() {
        if (currentMusic) {
            currentMusic.stop();
        }
        wasMusicPlaying = false;
    },

    pauseMusic() {
        if (currentMusic) {
            currentMusic.pause();
        }
        wasMusicPlaying = false;
    },

    setMusicVolume(volume) {
        if (currentMusic) {
            currentMusic.volume(volume);
        }
    },

    suspend() {
        if (currentMusic && currentMusic.playing()) {
            currentMusic.pause();
            wasMusicPlaying = true;
        } else {
            wasMusicPlaying = false;
        }
        Howler.mute(true);
    },

    resume() {
        Howler.mute(false);
        if (wasMusicPlaying && currentMusic) {
            currentMusic.play();
        }
    }
};
