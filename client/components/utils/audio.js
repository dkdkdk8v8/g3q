import { Howl, Howler } from 'howler';

/**
 * AudioUtils - 音频管理器 (基于 Howler.js)
 *
 * 提供音效播放、背景音乐循环、页面可见性切换时的暂停/恢复。
 * 使用 Web Audio API (html5: false) 以获得低延迟。
 */

const effects = {};
let currentMusic = null;
let currentMusicPath = null;
let wasMusicPlaying = false;

export const AudioUtils = {
    /**
     * 播放音效 (一次性)
     * @param {string} src - 音频文件路径
     * @param {number} volume - 音量 (0.0 ~ 1.0)
     */
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

    /**
     * 播放背景音乐 (循环)
     * @param {string} src - 音频文件路径
     * @param {number} volume - 音量 (0.0 ~ 1.0)
     */
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

    /** 停止背景音乐 */
    stopMusic() {
        if (currentMusic) {
            currentMusic.stop();
        }
        wasMusicPlaying = false;
    },

    /** 暂停背景音乐 */
    pauseMusic() {
        if (currentMusic) {
            currentMusic.pause();
        }
        wasMusicPlaying = false;
    },

    /** 设置背景音乐音量 */
    setMusicVolume(volume) {
        if (currentMusic) {
            currentMusic.volume(volume);
        }
    },

    /**
     * 挂起所有音频 (App 进入后台时调用)
     */
    suspend() {
        if (currentMusic && currentMusic.playing()) {
            currentMusic.pause();
            wasMusicPlaying = true;
        } else {
            wasMusicPlaying = false;
        }
        Howler.mute(true);
    },

    /**
     * 恢复音频 (App 回到前台时调用)
     */
    resume() {
        Howler.mute(false);
        if (wasMusicPlaying && currentMusic) {
            currentMusic.play();
        }
    }
};
