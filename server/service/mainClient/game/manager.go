package game

import (
	"encoding/json"
	"fmt"
	"service/comm"
	"service/mainClient/game/nn"
	"sync"
	"time"
)

type RoomManager struct {
	QZNNRooms map[string]*nn.QZNNRoom
	//playerRoom map[string]string // userID -> roomID
	mu         sync.RWMutex `json:"-"`
	isDraining bool         // 是否处于排空模式（无感知更新用）
}

var (
	DefaultMgr *RoomManager
	once       sync.Once
)

func GetMgr() *RoomManager {
	once.Do(func() {
		DefaultMgr = &RoomManager{
			QZNNRooms: make(map[string]*nn.QZNNRoom),
		}
	})
	return DefaultMgr
}

func (rm *RoomManager) SetDrainMode(enable bool) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.isDraining = enable
}

func (rm *RoomManager) GetPlayerRoom(userID string) *nn.QZNNRoom {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for _, room := range rm.QZNNRooms {
		for _, player := range room.Players {
			if player == nil {
				continue
			}
			if player.ID == userID {
				return room
			}
		}
	}
	return nil
}

func (rm *RoomManager) GetRoomByRoomId(roomId string) *nn.QZNNRoom {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.QZNNRooms[roomId]
}

func (rm *RoomManager) JoinOrCreateNNRoom(player *nn.Player, config *nn.LobbyConfig) (*nn.QZNNRoom, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// 如果处于排空模式，拒绝新的匹配请求
	if rm.isDraining {
		return nil, comm.NewMyError(500002, "服务器正在准备更新，请稍后再试")
	}

	for _, room := range rm.QZNNRooms {
		if len(room.Players) < room.GetPlayerCap() {
			if _, err := room.AddPlayer(player); err != nil {
				return nil, err
			}
			return room, nil
		}
	}

	roomID := fmt.Sprintf("R_%d_%d_%d", time.Now().Unix(), config.BankerType, config.Level)
	newRoom := nn.NewRoom(roomID)
	if config != nil {
		newRoom.Config = *config
	}
	newRoom.AddPlayer(player)
	newRoom.OnBotJoin = RobotEnterRoom
	rm.QZNNRooms[roomID] = newRoom

	return newRoom, nil
}

// GetRoomCount 获取当前活跃房间数
func (rm *RoomManager) GetRoomCount() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return len(rm.QZNNRooms)
}

// GetAllRooms 获取所有房间信息（用于管理端查询）
func (rm *RoomManager) GetAllRooms() string {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	allRooms, _ := json.Marshal(rm.QZNNRooms)
	return string(allRooms)
}
