package game

import (
	"compoment/rds"
	"encoding/json"
	"fmt"
	"service/mainClient/game/qznn"
	"time"

	"github.com/gomodule/redigo/redis"
	"github.com/sirupsen/logrus"
)

const snapshotRedisKey = "g3q:snapshot"
const snapshotRedisTTL = 300 // 5分钟 TTL，给部署留足够时间

// GracefulSnapshot coordinates a snapshot barrier across all QZNN rooms.
// Active (in-game) rooms are asked to pause at a safe point; idle rooms are
// snapshotted immediately.
// 如果超时，释放所有房间并返回错误，调用方应中止停服流程。
func (rm *RoomManager) GracefulSnapshot(timeout time.Duration) ([]*qznn.RoomSnapshot, error) {
	snapshotStart := time.Now()

	// Step 1: collect all rooms from the actor thread.
	rooms := syncOp(rm, func(s *managerState) []*qznn.QZNNRoom {
		out := make([]*qznn.QZNNRoom, 0, len(s.rooms))
		for _, r := range s.rooms {
			out = append(out, r)
		}
		return out
	})

	if len(rooms) == 0 {
		logrus.Info("GracefulSnapshot: no rooms to snapshot")
		return nil, nil
	}

	// Step 2: classify rooms into active (in-game) and idle.
	release := make(chan struct{})

	var (
		idleSnapshots []*qznn.RoomSnapshot
		activeRooms   []*qznn.QZNNRoom
		readyChannels []<-chan struct{}
	)

	for _, r := range rooms {
		if r.IsInGame() {
			r.RequestSnapshot(release)
			readyChannels = append(readyChannels, r.SnapshotReady())
			activeRooms = append(activeRooms, r)
		} else {
			snap := r.TakeSnapshot()
			if snap != nil {
				idleSnapshots = append(idleSnapshots, snap)
			}
		}
	}

	logrus.WithFields(logrus.Fields{
		"idle":   len(idleSnapshots),
		"active": len(activeRooms),
	}).Info("GracefulSnapshot: waiting for active rooms")

	// Step 3: wait for all active rooms to reach a safe point.
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	waitStart := time.Now()
	for i, ch := range readyChannels {
		select {
		case <-ch:
			// Room i is ready.
		case <-timer.C:
			// 超时: 释放所有已暂停的房间，让它们继续运行
			close(release)
			logrus.WithFields(logrus.Fields{
				"blockedRoom": activeRooms[i].ID,
				"ready":       i,
				"total":       len(activeRooms),
			}).Error("GracefulSnapshot: 超时！有房间未能到达安全点，中止快照，不停服，请检查问题")
			return nil, fmt.Errorf("GracefulSnapshot: timed out waiting for room %s (ready %d/%d)",
				activeRooms[i].ID, i, len(activeRooms))
		}
	}

	// Step 4: all active rooms are frozen — take their snapshots.
	activeSnapshots := make([]*qznn.RoomSnapshot, 0, len(activeRooms))
	for _, r := range activeRooms {
		snap := r.TakeSnapshot()
		if snap != nil {
			activeSnapshots = append(activeSnapshots, snap)
		}
	}

	// Step 5: release all rooms so they can resume.
	close(release)

	allSnapshots := append(idleSnapshots, activeSnapshots...)
	logrus.WithFields(logrus.Fields{
		"total":       len(allSnapshots),
		"waitElapsed": time.Since(waitStart).String(),
		"totalElapsed": time.Since(snapshotStart).String(),
	}).Info("GracefulSnapshot: completed")
	return allSnapshots, nil
}

// RestoreFromSnapshots rebuilds rooms from snapshot data and registers them
// in the manager.
func (rm *RoomManager) RestoreFromSnapshots(snapshots []*qznn.RoomSnapshot) {
	if len(snapshots) == 0 {
		logrus.Info("RestoreFromSnapshots: nothing to restore")
		return
	}

	restored := make([]*qznn.QZNNRoom, 0, len(snapshots))
	for _, snap := range snapshots {
		r := qznn.RestoreFromSnapshot(snap)
		if r == nil {
			logrus.WithField("snapshot", snap).Warn("RestoreFromSnapshots: failed to restore room")
			continue
		}
		restored = append(restored, r)
	}

	syncOp(rm, func(s *managerState) struct{} {
		for _, r := range restored {
			s.rooms[r.ID] = r
		}
		return struct{}{}
	})

	logrus.WithField("count", len(restored)).Info("RestoreFromSnapshots: rooms restored")
}

// SaveSnapshotsToRedis serializes snapshots to JSON and writes them to Redis.
func SaveSnapshotsToRedis(snapshots []*qznn.RoomSnapshot) error {
	data, err := json.Marshal(snapshots)
	if err != nil {
		return fmt.Errorf("SaveSnapshotsToRedis: marshal error: %w", err)
	}

	conn := rds.DefConnPool.Pool.Get()
	defer conn.Close()

	_, err = conn.Do("SET", snapshotRedisKey, data, "EX", snapshotRedisTTL)
	if err != nil {
		return fmt.Errorf("SaveSnapshotsToRedis: redis SET error: %w", err)
	}

	logrus.WithField("bytes", len(data)).WithField("ttl", snapshotRedisTTL).Info("SaveSnapshotsToRedis: saved")
	return nil
}

// LoadSnapshotsFromRedis reads snapshots from Redis, deserializes them, and
// atomically deletes the key. Returns nil if the key does not exist.
func LoadSnapshotsFromRedis() []*qznn.RoomSnapshot {
	conn := rds.DefConnPool.Pool.Get()
	defer conn.Close()

	// 使用 GETDEL 原子操作: 读取并删除，防止两个进程同时消费同一份快照
	data, err := redis.Bytes(conn.Do("GETDEL", snapshotRedisKey))
	if err != nil {
		if err == redis.ErrNil {
			logrus.Info("LoadSnapshotsFromRedis: no snapshot found in Redis")
			return nil
		}
		// GETDEL 需要 Redis 6.2+，如果不支持则回退到 GET+DEL
		logrus.WithError(err).Warn("LoadSnapshotsFromRedis: GETDEL failed, fallback to GET+DEL")
		data, err = redis.Bytes(conn.Do("GET", snapshotRedisKey))
		if err != nil {
			if err == redis.ErrNil {
				logrus.Info("LoadSnapshotsFromRedis: no snapshot found in Redis")
				return nil
			}
			logrus.WithError(err).Error("LoadSnapshotsFromRedis: redis GET error")
			return nil
		}
		if _, err := conn.Do("DEL", snapshotRedisKey); err != nil {
			logrus.WithError(err).Warn("LoadSnapshotsFromRedis: redis DEL error")
		}
	}

	var snapshots []*qznn.RoomSnapshot
	if err := json.Unmarshal(data, &snapshots); err != nil {
		logrus.WithError(err).Error("LoadSnapshotsFromRedis: unmarshal error")
		return nil
	}

	logrus.WithField("count", len(snapshots)).Info("LoadSnapshotsFromRedis: loaded")
	return snapshots
}
