package game

import (
	"compoment/jsondiytag"
	"compoment/uid"
	"compoment/util"
	"fmt"
	"service/comm"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"sort"
	"sync"
	"time"

	deadlock "github.com/sasha-s/go-deadlock"
	"github.com/sirupsen/logrus"
)

type RoomManager struct {
	QZNNRooms  map[string]*qznn.QZNNRoom
	ManagerMu  deadlock.RWMutex `json:"-"`
	isDraining bool             // 是否处于排空模式（无感知更新用）
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
		go DefaultMgr.cleanupLoop()
	})
	return DefaultMgr
}

func (rm *RoomManager) SetDrainMode(enable bool) {
	rm.ManagerMu.Lock()
	defer rm.ManagerMu.Unlock()
	rm.isDraining = enable
}

func (rm *RoomManager) GetPlayerRoom(userID string) *qznn.QZNNRoom {
	rm.ManagerMu.RLock()
	rooms := make([]*qznn.QZNNRoom, 0, len(rm.QZNNRooms))
	for _, room := range rm.QZNNRooms {
		rooms = append(rooms, room)
	}
	rm.ManagerMu.RUnlock()

	for _, room := range rooms {
		// Fix: 使用 GetPlayerByID 替代直接遍历 room.Players，避免数据竞争
		if _, ok := room.GetPlayerByID(userID); ok {
			return room
		}
	}
	return nil
}

func (rm *RoomManager) GetRoomByRoomId(roomId string) *qznn.QZNNRoom {
	rm.ManagerMu.RLock()
	defer rm.ManagerMu.RUnlock()
	return rm.QZNNRooms[roomId]
}

func (rm *RoomManager) JoinOrCreateNNRoom(user *modelClient.ModelUser,
	player *qznn.Player, level int, bankerType int, roomCfg *qznn.LobbyConfig) (*qznn.QZNNRoom, error) {
	// 如果处于排空模式，拒绝新的匹配请求
	if rm.isDraining {
		return nil, comm.ErrServerMaintenance
	}

	// Fix: 使用快照方式遍历，避免长时间持有锁，且避免 rm.mu -> room.mu 的锁嵌套
	rm.ManagerMu.RLock()
	rooms := make([]*qznn.QZNNRoom, 0, len(rm.QZNNRooms))
	for _, room := range rm.QZNNRooms {
		rooms = append(rooms, room)
	}
	rm.ManagerMu.RUnlock()

	type roomHolder struct {
		Room      *qznn.QZNNRoom
		PlayerNum int
	}
	var sortPlayerRoom []roomHolder
	var targetRoom *qznn.QZNNRoom
	// 遍历快照
	for _, room := range rooms {
		// 1. 核心检查：确认玩家是否已经在该房间中
		if alreadyPlayer, ok := room.GetPlayerByID(player.ID); ok {
			//客户端弹框，确认要不要重新进入
			room.PushPlayer(alreadyPlayer, comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: qznn.PushRoom,
				Data:     qznn.PushRoomStruct{Room: room}})
			return nil, comm.ErrPlayerInRoom
		}
		//2. 在遍历的同时，寻找一个合适的房间 (如果尚未找到)这样可以避免多次遍历
		if room.Config.BankerType == bankerType && room.Config.Level == level {
			// 避免加入即将被释放的房间
			num := room.GetPlayerCount()
			if num == 0 && time.Since(room.CreateAt) > time.Minute {
				continue
			}
			// 检查房间人数是否未满
			if num < room.GetPlayerCap() {
				sortPlayerRoom = append(sortPlayerRoom, roomHolder{Room: room, PlayerNum: num})
			}
		}
	}
	//todo::注意这里，如果无感发布，不会有问题。如果房间异常直接关闭进程
	//确认用户没有在任何房间,但是记录了gameID
	if user.GameId != "" {
		//把用户的lockBalance 被gameId锁了，更新user
		var err1 error
		user, err1 = modelClient.RecoveryGameId(player.ID, user.GameId)
		if err1 != nil {
			return nil, err1
		}
	}

	if user.Balance < roomCfg.MinBalance {
		return nil, comm.NewMyError("用户余额不足")
	} else {
		player.Balance = user.Balance
	}

	// 3. 循环结束，此时已确认玩家不在任何房间内
	// 如果找到了合适的房间，则尝试加入
	sort.Slice(sortPlayerRoom, func(i, j int) bool {
		return sortPlayerRoom[i].PlayerNum > sortPlayerRoom[j].PlayerNum
	})
	for _, r := range sortPlayerRoom {
		targetRoom = r.Room
		break
	}

	if targetRoom != nil {
		if _, err := targetRoom.AddPlayer(player); err != nil {
			return nil, err
		}
		return targetRoom, nil
	}

	roomID := fmt.Sprintf("%s_%d_%d_"+qznn.GameName, util.EncodeToBase36(uid.Generate()), bankerType, level)
	newRoom := qznn.NewRoom(roomID, bankerType, level)
	_, err := newRoom.AddPlayer(player)
	if err != nil {
		return nil, err
	}
	newRoom.OnBotAction = nil //RobotForQZNNRoom
	rm.ManagerMu.Lock()
	rm.QZNNRooms[roomID] = newRoom
	rm.ManagerMu.Unlock()
	return newRoom, nil
}

func (rm *RoomManager) cleanupLoop() {
	for {
		time.Sleep(time.Second * 10)
		rm.ManagerMu.RLock()
		rooms := make(map[string]*qznn.QZNNRoom, len(rm.QZNNRooms))
		for id, r := range rm.QZNNRooms {
			rooms[id] = r
		}
		rm.ManagerMu.RUnlock()

		var delRooms []string
		for id, r := range rooms {
			if r.GetPlayerCount() == 0 && time.Since(r.CreateAt) > time.Minute {
				delRooms = append(delRooms, id)
			}
		}
		if len(delRooms) > 0 {
			var roomsToDestroy []*qznn.QZNNRoom
			rm.ManagerMu.Lock()
			for _, id := range delRooms {
				if r, ok := rm.QZNNRooms[id]; ok && r.GetPlayerCount() == 0 {
					// 移除锁内的 r.Destory()，防止 AB-BA 死锁
					delete(rm.QZNNRooms, id)
					roomsToDestroy = append(roomsToDestroy, r)
					logrus.WithField("roomId", id).Info("RoomManager-ReleaseRoom")
				}
			}
			rm.ManagerMu.Unlock()
			// Fix: 在锁外执行销毁，避免持有 rm.mu 时等待 room 锁 (AB-BA 死锁)
			for _, r := range roomsToDestroy {
				r.Destory()
			}
		}
	}
}

// GetAllRooms 获取所有房间信息（用于管理端查询）
func (rm *RoomManager) GetAllRooms() string {
	rm.ManagerMu.RLock()
	// Fix: 使用快照模式，避免在持有 rm.mu 时进行序列化 (R-W-R 死锁风险)
	// 移除之前的 defer rm.mu.RUnlock() 和直接序列化 rm.QZNNRooms 的代码
	rooms := make(map[string]*qznn.QZNNRoom, len(rm.QZNNRooms))
	for k, v := range rm.QZNNRooms {
		rooms[k] = v
	}
	rm.ManagerMu.RUnlock()

	allRooms, _ := jsondiytag.MarshalWithCustomTag(rooms)
	return string(allRooms)
}
