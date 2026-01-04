package game

import (
	"encoding/json"
	"fmt"
	"service/comm"
	"service/mainClient/game/qznn"
	"sync"
	"time"
)

type RoomManager struct {
	QZNNRooms map[string]*qznn.QZNNRoom
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
			QZNNRooms: make(map[string]*qznn.QZNNRoom),
		}
	})
	return DefaultMgr
}

func (rm *RoomManager) SetDrainMode(enable bool) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.isDraining = enable
}

func (rm *RoomManager) GetPlayerRoom(userID string) *qznn.QZNNRoom {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for _, room := range rm.QZNNRooms {
		// Fix: 使用 GetPlayerByID 替代直接遍历 room.Players，避免数据竞争
		if _, ok := room.GetPlayerByID(userID); ok {
			return room
		}
	}
	return nil
}

func (rm *RoomManager) GetRoomByRoomId(roomId string) *qznn.QZNNRoom {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.QZNNRooms[roomId]
}

func (rm *RoomManager) JoinOrCreateNNRoom(player *qznn.Player, level int, bankerType int) (*qznn.QZNNRoom, error) {
	// 如果处于排空模式，拒绝新的匹配请求
	if rm.isDraining {
		return nil, comm.ErrServerMaintenance
	}

	// 使用写锁，确保“检查玩家是否在房间”和“加入房间”的操作是原子的
	// 避免在检查和加入之间发生并发变更
	rm.mu.Lock()
	var targetRoom *qznn.QZNNRoom
	// 遍历所有房间
	for _, room := range rm.QZNNRooms {
		// 1. 核心检查：确认玩家是否已经在该房间中
		// GetPlayerByID 内部使用了读锁，配合外层的 rm.mu 写锁是安全的
		if alreadyPlayer, ok := room.GetPlayerByID(player.ID); ok {
			rm.mu.Unlock()
			//客户端弹框，确认要不要重新进入
			room.PushPlayer(alreadyPlayer, comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: qznn.PushRoom,
				Data:     qznn.PushRoomStruct{Room: room, SelfId: player.ID}})
			return nil, comm.ErrPlayerInRoom
		}
		// 2. 在遍历的同时，寻找一个合适的房间 (如果尚未找到)
		// 这样可以避免多次遍历
		if targetRoom == nil {
			if room.Config.BankerType == bankerType && room.Config.Level == level {
				// 检查房间人数是否未满
				if room.GetPlayerCount() < room.GetPlayerCap() {
					targetRoom = room
				}
			}
		}
	}
	rm.mu.Unlock()
	// 3. 循环结束，此时已确认玩家不在任何房间内
	// 如果找到了合适的房间，则尝试加入
	if targetRoom != nil {
		if _, err := targetRoom.AddPlayer(player); err != nil {
			return nil, err
		}
		return targetRoom, nil
	}

	roomID := fmt.Sprintf("R_%d_%d_%d", time.Now().UnixMilli(), bankerType, level)
	newRoom := qznn.NewRoom(roomID, bankerType, level)
	newRoom.AddPlayer(player)
	newRoom.OnBotAction = nil //RobotForQZNNRoom
	rm.mu.Lock()
	rm.QZNNRooms[roomID] = newRoom
	rm.mu.Unlock()
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
