<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const enterGame = (mode) => {
  router.push(`/game/${mode}`);
};

const rooms = [
    { type: 'primary', name: '初级场', base: 200, min: 4000, players: 83, colorClass: 'room-cyan' },
    { type: 'medium', name: '中级场', base: 900, min: 18000, players: 46, colorClass: 'room-blue' },
    { type: 'advanced', name: '高级场', base: 3000, min: 60000, players: 24, colorClass: 'room-purple' },
    { type: 'elite', name: '精英场', base: 20000, min: 400000, players: 9, colorClass: 'room-red' },
];
</script>

<template>
  <div class="lobby">
    <!-- 顶部标题栏 -->
    <div class="header">
        <div class="tab-group">
            <div class="tab active">斗牛</div>
        </div>
        <div class="close-btn">×</div>
    </div>

    <!-- 房间列表 -->
    <div class="room-container">
        <div 
            v-for="room in rooms" 
            :key="room.type" 
            class="room-card" 
            :class="room.colorClass"
            @click="enterGame(room.type)"
        >
            <div class="room-title">{{ room.name }}</div>
            <div class="room-info">
                <span class="base-badge">底分 {{ room.base }}</span>
            </div>
            <div class="room-footer">
                <div class="entry-limit">
                    <span class="coin-icon">🟡</span> {{ room.min }}
                </div>
                <div class="online-count">
                    👤 {{ room.players }}
                </div>
            </div>
        </div>
    </div>
    
    <!-- 底部按钮 -->
    <div class="footer-action">
        <div class="quick-start-btn">快速开始</div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  height: 100vh;
  background: radial-gradient(circle at center, #1e3a8a 0%, #0f172a 100%);
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
  font-family: sans-serif;
  color: white;
}

.header {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    margin-bottom: 30px;
    height: 50px;
}

.tab-group {
    background: rgba(0,0,0,0.3);
    border-radius: 20px;
    padding: 4px;
    display: flex;
}

.tab {
    padding: 6px 20px;
    border-radius: 16px;
    font-weight: bold;
    color: #94a3b8;
}

.tab.active {
    background: linear-gradient(to bottom, #2dd4bf, #0f766e);
    color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.close-btn {
    position: absolute;
    right: 0;
    width: 36px;
    height: 36px;
    background: linear-gradient(to bottom, #3b82f6, #1d4ed8);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 24px;
    font-weight: bold;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    border: 2px solid rgba(255,255,255,0.3);
    cursor: pointer;
}

.room-container {
    display: grid;
    grid-template-columns: 1fr 1fr; /* 双列布局 */
    gap: 16px;
    flex: 1;
    overflow-y: auto;
}

.room-card {
    border-radius: 12px;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.2);
    position: relative;
    overflow: hidden;
    min-height: 100px;
    transition: transform 0.1s;
}

.room-card:active {
    transform: scale(0.98);
}

/* 玻璃光泽 */
.room-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.2), transparent);
    pointer-events: none;
}

.room-cyan { background: linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%); }
.room-blue { background: linear-gradient(135deg, #60a5fa 0%, #1e40af 100%); }
.room-purple { background: linear-gradient(135deg, #c084fc 0%, #7e22ce 100%); }
.room-red { background: linear-gradient(135deg, #f87171 0%, #991b1b 100%); }

.room-title {
    font-size: 20px;
    font-weight: 900; /* Extra bold */
    text-shadow: 0 2px 2px rgba(0,0,0,0.3);
    margin-bottom: 8px;
    letter-spacing: 1px;
}

.room-info {
    display: flex;
    margin-bottom: auto;
}

.base-badge {
    background: rgba(0,0,0,0.4);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}

.room-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    margin-top: 12px;
    opacity: 0.9;
}

.entry-limit {
    font-weight: bold;
}

.footer-action {
    margin-top: 20px;
    display: flex;
    justify-content: center;
}

.quick-start-btn {
    background: linear-gradient(to bottom, #60a5fa, #2563eb);
    width: 80%;
    height: 50px;
    border-radius: 25px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    font-weight: bold;
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.5);
    border: 2px solid rgba(255,255,255,0.3);
}
</style>
