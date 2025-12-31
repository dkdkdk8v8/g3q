package game

import (
	"fmt"
	"service/comm"
	"sync"
)

type RoomManager struct {
	rooms      map[string]*Room
	playerRoom map[string]string // userID -> roomID
	mu         sync.RWMutex      `json:"-"`
	isDraining bool              // 是否处于排空模式（无感知更新用）
}

var (
	DefaultMgr *RoomManager
	once       sync.Once
)

func GetMgr() *RoomManager {
	once.Do(func() {
		DefaultMgr = &RoomManager{
			rooms:      make(map[string]*Room),
			playerRoom: make(map[string]string),
		}
	})
	return DefaultMgr
}

func (rm *RoomManager) SetDrainMode(enable bool) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.isDraining = enable
}

func (rm *RoomManager) JoinOrCreateRoom(gameType string, player *Player, onStart func(*Room)) (*Room, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// 如果处于排空模式，拒绝新的匹配请求
	if rm.isDraining {
		return nil, comm.NewMyError(500002, "服务器正在准备更新，请稍后再试")
	}

	for _, room := range rm.rooms {
		if room.Type == gameType && len(room.Players) < room.MaxPlayers {
			if _, err := room.AddPlayer(player); err != nil {
				return nil, err
			}
			rm.playerRoom[player.ID] = room.ID
			return room, nil
		}
	}

	roomID := fmt.Sprintf("R_%s_%d", gameType, len(rm.rooms)+1)
	playerMax := 5
	if gameType == "brnn" {
		playerMax = 1000
	}

	newRoom := NewRoom(roomID, gameType, playerMax)
	newRoom.OnStart = onStart
	newRoom.AddPlayer(player)
	rm.rooms[roomID] = newRoom
	rm.playerRoom[player.ID] = roomID

	return newRoom, nil
}

func (rm *RoomManager) SetPlayerRoom(userID string, roomID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.playerRoom[userID] = roomID
}

func (rm *RoomManager) RemovePlayer(userID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.playerRoom, userID)
}

func (rm *RoomManager) GetRoomByPlayerID(userID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	roomID, ok := rm.playerRoom[userID]
	if !ok {
		return nil
	}
	return rm.rooms[roomID]
}

// GetRoomCount 获取当前活跃房间数
func (rm *RoomManager) GetRoomCount() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return len(rm.rooms)
}
