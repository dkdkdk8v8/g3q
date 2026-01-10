package main

import (
	"fmt"
	"sync"
	"time"
)

// 模拟 RoomManager
type RoomManager struct {
	mu sync.RWMutex
}

// 模拟 Room
type Room struct {
	mu sync.Mutex // 或者 sync.RWMutex，效果一样，只要 C 持有的是排他锁
}

func main() {
	rm := &RoomManager{}
	room := &Room{}

	var wg sync.WaitGroup
	wg.Add(3)

	fmt.Println("=== 开始死锁模拟 ===")
	fmt.Println("预期顺序: A拿RM读锁 -> C拿Room锁 -> B申请RM写锁(阻塞) -> A申请Room锁(阻塞) -> C申请RM读锁(阻塞)")

	// Goroutine A: GetAllRooms (序列化操作)
	// 行为：持有 rm.mu (RLock) -> 申请 room.mu
	go func() {
		defer wg.Done()

		// 1. 获取 RoomManager 读锁
		rm.mu.RLock()
		fmt.Println("[A] GetAllRooms: 持有 rm.mu (RLock)")

		// 模拟序列化前的准备时间，确保 C 已经启动并拿到了 room 锁
		time.Sleep(100 * time.Millisecond)

		fmt.Println("[A] GetAllRooms: 正在序列化，尝试申请 room.mu...")
		// 2. 尝试获取 Room 锁 (模拟读取房间数据)
		// 此时 C 持有 room.mu，A 被阻塞
		room.mu.Lock()
		fmt.Println("[A] GetAllRooms: 成功获取 room.mu (这行永远不会打印)")

		room.mu.Unlock()
		rm.mu.RUnlock()
	}()

	// Goroutine C: 游戏逻辑 (玩家操作)
	// 行为：持有 room.mu -> 申请 rm.mu (RLock)
	go func() {
		defer wg.Done()

		// 稍微延迟，让 A 先拿到 rm.mu
		time.Sleep(10 * time.Millisecond)

		// 1. 获取 Room 锁
		room.mu.Lock()
		fmt.Println("[C] GameLogic:   持有 room.mu")

		// 模拟业务处理时间，确保 B 已经进场并开始申请写锁
		time.Sleep(200 * time.Millisecond)

		fmt.Println("[C] GameLogic:   需要访问Manager，尝试申请 rm.mu (RLock)...")
		// 2. 尝试获取 RoomManager 读锁
		// 关键点：虽然 A 持有的是读锁，理论上读读兼容。
		// 但因为 B (写锁) 正在排队，Go 的 RWMutex 会阻止新的读锁获取，以防写锁饥饿。
		// 所以 C 被阻塞。
		rm.mu.RLock()
		fmt.Println("[C] GameLogic:   成功获取 rm.mu (这行永远不会打印)")

		rm.mu.RUnlock()
		room.mu.Unlock()
	}()

	// Goroutine B: 清理/创建 (cleanupLoop)
	// 行为：申请 rm.mu (Lock)
	go func() {
		defer wg.Done()

		// 确保 A 拿了 RLock, C 拿了 Room Lock 之后，B 再进场
		time.Sleep(50 * time.Millisecond)

		fmt.Println("[B] Cleanup:     尝试申请 rm.mu (写锁)...")
		// 尝试获取写锁
		// 此时 A 持有 RLock，所以 B 阻塞排队。
		// B 的排队导致了 C 拿不到 RLock。
		rm.mu.Lock()
		fmt.Println("[B] Cleanup:     成功获取 rm.mu (这行永远不会打印)")

		rm.mu.Unlock()
	}()

	// 监控协程：检测是否卡死
	go func() {
		time.Sleep(3 * time.Second)
		fmt.Println("\n!!! 检测到程序超时，死锁已形成 !!!")
		fmt.Println("------------------------------------------------")
		fmt.Println("死锁环路分析:")
		fmt.Println("1. [A] 持有 rm(R)，等待 -> room")
		fmt.Println("2. [C] 持有 room， 等待 -> rm(R)")
		fmt.Println("   (注意：C 等待 rm(R) 是因为 B 在排队写锁)")
		fmt.Println("3. [B] 等待 rm(W)，阻塞了 -> C")
		fmt.Println("   (B 被 A 阻塞)")
		fmt.Println("------------------------------------------------")
		// 实际测试中，这里可以让程序退出
		// os.Exit(1)
	}()

	wg.Wait()
	fmt.Println("程序正常结束 (如果打印这行，说明没死锁)")
}
