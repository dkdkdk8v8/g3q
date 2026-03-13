package game

import (
	"compoment/jsondiytag"
	"compoment/uid"
	"compoment/util"
	"encoding/json"
	"fmt"
	"service/mainClient/game/brnn"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// managerState holds the internal state of the RoomManager
type managerState struct {
	rooms       map[string]*qznn.QZNNRoom
	brnnRooms   map[string]*brnn.BRNNRoom // 多房间百人牛牛
	brnnCounter int                       // 房间编号计数器
	isDraining  bool
}

type RoomManager struct {
	opCh chan func(*managerState)
}

var (
	DefaultMgr *RoomManager
	once       sync.Once
)

func GetMgr() *RoomManager {
	once.Do(func() {
		DefaultMgr = &RoomManager{
			opCh: make(chan func(*managerState), 100),
		}
		go DefaultMgr.backend()
		go DefaultMgr.cleanupLoop()
	})
	return DefaultMgr
}

// backend is the single monitor goroutine that owns the state
func (rm *RoomManager) backend() {
	state := &managerState{
		rooms:      make(map[string]*qznn.QZNNRoom),
		brnnRooms:  make(map[string]*brnn.BRNNRoom),
		isDraining: false,
	}

	for op := range rm.opCh {
		op(state)
	}
}

func (rm *RoomManager) SetDrainMode(enable bool) {
	syncOp(rm, func(s *managerState) struct{} {
		s.isDraining = enable
		return struct{}{}
	})
}

func (rm *RoomManager) GetPlayerRoom(userID string) *qznn.QZNNRoom {
	return syncOp(rm, func(s *managerState) *qznn.QZNNRoom {
		for _, room := range s.rooms {
			if _, ok := room.GetPlayerByID(userID); ok {
				return room
			}
		}
		return nil
	})
}

func (rm *RoomManager) GetRoomByRoomId(roomId string) *qznn.QZNNRoom {
	return syncOp(rm, func(s *managerState) *qznn.QZNNRoom {
		return s.rooms[roomId]
	})
}

func (rm *RoomManager) CheckPlayerInRoom(userId string) (*qznn.QZNNRoom, *qznn.Player) {
	type result struct {
		r *qznn.QZNNRoom
		p *qznn.Player
	}
	res := syncOp(rm, func(s *managerState) result {
		for _, room := range s.rooms {
			if playerData, ok := room.GetPlayerByID(userId); ok {
				return result{r: room, p: playerData}
			}
		}
		return result{}
	})
	return res.r, res.p
}

func (rm *RoomManager) CreateRoom(roomCfg *qznn.LobbyConfig) *qznn.QZNNRoom {
	roomID := fmt.Sprintf("%s_%d_%d_"+qznn.GameName, util.EncodeToBase36(uid.Generate()), roomCfg.BankerType, roomCfg.Level)
	newRoom := qznn.NewRoom(roomID, roomCfg.BankerType, roomCfg.Level)
	return newRoom
}
func (rm *RoomManager) SelectRoom(user *modelClient.ModelUser,
	player *qznn.Player, roomCfg *qznn.LobbyConfig, excludeRoomId string) (*qznn.QZNNRoom, error) {

	targetRoom, err := syncOpErr(rm, func(s *managerState) (*qznn.QZNNRoom, error) {
		type roomHolder struct {
			Room      *qznn.QZNNRoom
			PlayerNum int
			HasReal   bool
		}
		var withReal []roomHolder
		var withoutReal []roomHolder

		for _, room := range s.rooms {
			if room.Config.BankerType == roomCfg.BankerType && room.Config.Level == roomCfg.Level {
				num, realNum := room.GetPlayerAndRealPlayerCount()
				if num == 0 && time.Since(room.CreateAt) > time.Minute {
					continue
				}
				if room.ID == excludeRoomId {
					continue
				}
				// 只匹配等待中/准备中的房间，避免新人加入已开始的游戏
				if room.CheckGameStart() {
					continue
				}
				if num < room.GetPlayerCap() {
					h := roomHolder{Room: room, PlayerNum: num, HasReal: realNum > 0}
					if realNum > 0 {
						withReal = append(withReal, h)
					} else {
						withoutReal = append(withoutReal, h)
					}
				}
			}
		}

		// 优先选择有真人的房间
		withReal = util.RandomPick(withReal, len(withReal))
		if len(withReal) > 0 {
			return withReal[0].Room, nil
		}
		// 没有有真人的房间，选其他的
		withoutReal = util.RandomPick(withoutReal, len(withoutReal))
		if len(withoutReal) > 0 {
			return withoutReal[0].Room, nil
		}
		return nil, nil
	})

	if err != nil {
		return nil, err
	}

	if targetRoom != nil {
		if _, err := targetRoom.AddPlayer(player); err != nil {
			return nil, err
		}
		return targetRoom, nil
	}

	return nil, nil
}

func (rm *RoomManager) JoinQZNNRoom(joinRoom *qznn.QZNNRoom, user *modelClient.ModelUser,
	player *qznn.Player) (*qznn.QZNNRoom, error) {

	_, err := joinRoom.AddPlayer(player)
	if err != nil {
		return nil, err
	}
	joinRoom.OnBotAction = nil //RobotForQZNNRoom

	// Add room to manager
	syncOp(rm, func(s *managerState) struct{} {
		s.rooms[joinRoom.ID] = joinRoom
		return struct{}{}
	})

	return joinRoom, nil
}

func (rm *RoomManager) cleanupLoop() {
	for {
		time.Sleep(time.Second * 10)

		type cleanupResult struct {
			qznnRooms []*qznn.QZNNRoom
			brnnRooms []*brnn.BRNNRoom
		}

		result := syncOp(rm, func(s *managerState) cleanupResult {
			var res cleanupResult

			// QZNN 房间清理
			for id, r := range s.rooms {
				if r.GetPlayerCount() == 0 && time.Since(r.CreateAt) > time.Minute {
					delete(s.rooms, id)
					res.qznnRooms = append(res.qznnRooms, r)
					logrus.WithField("roomId", id).Info("RoomManager-ReleaseRoom")
				}
			}

			// BRNN 房间清理：空房间且非唯一房间则销毁
			if len(s.brnnRooms) > 1 {
				for id, r := range s.brnnRooms {
					if r.GetPlayerCount() == 0 && len(s.brnnRooms) > 1 {
						delete(s.brnnRooms, id)
						res.brnnRooms = append(res.brnnRooms, r)
						logrus.WithField("roomId", id).Info("RoomManager-ReleaseBRNNRoom")
					}
				}
			}

			return res
		})

		for _, r := range result.qznnRooms {
			r.Destory()
		}
		for _, r := range result.brnnRooms {
			r.Destroy()
		}
	}
}

// GetAllRooms 获取所有房间信息（用于管理端查询）
// 在 syncOp 内完成序列化，避免房间指针逃逸后产生并发读写
func (rm *RoomManager) GetAllRooms() json.RawMessage {
	return syncOp(rm, func(s *managerState) json.RawMessage {
		allRooms, _ := jsondiytag.MarshalWithCustomTag(s.rooms)
		return json.RawMessage(allRooms)
	})
}

// CheckPlayerInBRNN 遍历所有 BRNN 房间，查找玩家所在房间
func (rm *RoomManager) CheckPlayerInBRNN(userId string) (*brnn.BRNNRoom, *brnn.BRNNPlayer) {
	type result struct {
		room   *brnn.BRNNRoom
		player *brnn.BRNNPlayer
	}
	res := syncOp(rm, func(s *managerState) result {
		for _, room := range s.brnnRooms {
			if p := room.GetPlayer(userId); p != nil {
				return result{room: room, player: p}
			}
		}
		return result{}
	})
	return res.room, res.player
}

// GetAllBRNNRooms 返回所有 BRNN 房间的切片（线程安全）。
func (rm *RoomManager) GetAllBRNNRooms() []*brnn.BRNNRoom {
	return syncOp(rm, func(s *managerState) []*brnn.BRNNRoom {
		rooms := make([]*brnn.BRNNRoom, 0, len(s.brnnRooms))
		for _, r := range s.brnnRooms {
			rooms = append(rooms, r)
		}
		return rooms
	})
}

// AssignPlayerToBRNN 原子地为玩家分配房间并加入，避免并发超员。
func (rm *RoomManager) AssignPlayerToBRNN(p *brnn.BRNNPlayer) *brnn.BRNNRoom {
	return syncOp(rm, func(s *managerState) *brnn.BRNNRoom {
		cfg := brnn.DefaultConfig
		// 找一个人数 < MaxPlayers 的房间（排除已含该玩家的房间）
		var room *brnn.BRNNRoom
		for _, r := range s.brnnRooms {
			if r.GetPlayerCount() < cfg.MaxPlayers && r.GetPlayer(p.ID) == nil {
				room = r
				break
			}
		}
		// 无可用房间，创建新房间
		if room == nil {
			s.brnnCounter++
			id := fmt.Sprintf("brnn_%d", s.brnnCounter)
			room = brnn.NewRoom(id, cfg)
			s.brnnRooms[id] = room
			logrus.WithField("roomId", id).Info("RoomManager-CreateBRNNRoom")
		}
		room.AddPlayer(p)
		return room
	})
}

func syncOp[T any](rm *RoomManager, f func(s *managerState) T) T {
	ret := make(chan T, 1)
	rm.opCh <- func(s *managerState) {
		ret <- f(s)
	}
	return <-ret
}

func syncOpErr[T any](rm *RoomManager, f func(s *managerState) (T, error)) (T, error) {
	type result struct {
		val T
		err error
	}
	ret := make(chan result, 1)
	rm.opCh <- func(s *managerState) {
		v, e := f(s)
		ret <- result{val: v, err: e}
	}
	res := <-ret
	return res.val, res.err
}
