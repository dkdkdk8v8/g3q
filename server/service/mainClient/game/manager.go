package game

import (
	"compoment/jsondiytag"
	"compoment/uid"
	"compoment/util"
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
	rooms      map[string]*qznn.QZNNRoom
	brnnRoom   *brnn.BRNNRoom
	isDraining bool
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

		roomsToDestroy := syncOp(rm, func(s *managerState) []*qznn.QZNNRoom {
			var roomsToDestroy []*qznn.QZNNRoom
			for id, r := range s.rooms {
				if r.GetPlayerCount() == 0 && time.Since(r.CreateAt) > time.Minute {
					delete(s.rooms, id)
					roomsToDestroy = append(roomsToDestroy, r)
					logrus.WithField("roomId", id).Info("RoomManager-ReleaseRoom")
				}
			}
			return roomsToDestroy
		})

		// Destroy outside the monitor loop to avoid blocking it
		for _, r := range roomsToDestroy {
			r.Destory()
		}
	}
}

// GetAllRooms 获取所有房间信息（用于管理端查询）
func (rm *RoomManager) GetAllRooms() string {
	rooms := syncOp(rm, func(s *managerState) map[string]*qznn.QZNNRoom {
		// Create a shallow copy of the map to return
		rooms := make(map[string]*qznn.QZNNRoom, len(s.rooms))
		for k, v := range s.rooms {
			rooms[k] = v
		}
		return rooms
	})

	allRooms, _ := jsondiytag.MarshalWithCustomTag(rooms)
	return string(allRooms)
}

// GetBRNNRoom returns the singleton BRNN room, creating it if needed
func (rm *RoomManager) GetBRNNRoom() *brnn.BRNNRoom {
	return syncOp(rm, func(s *managerState) *brnn.BRNNRoom {
		if s.brnnRoom == nil {
			s.brnnRoom = brnn.NewRoom("brnn_main", brnn.DefaultConfig)
		}
		return s.brnnRoom
	})
}

// CheckPlayerInBRNN checks if player is in the BRNN room
func (rm *RoomManager) CheckPlayerInBRNN(userId string) *brnn.BRNNPlayer {
	return syncOp(rm, func(s *managerState) *brnn.BRNNPlayer {
		if s.brnnRoom == nil {
			return nil
		}
		return s.brnnRoom.GetPlayer(userId)
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
