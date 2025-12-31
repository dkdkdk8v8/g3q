package comm

import (
	"compoment/alert"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"io/ioutil"
	"math"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	ErrorUaMd5 = errors.New("uaMd5Invalid")
	ErrorRIp   = errors.New("rIpInvalid")
)

var KvStore *KeyValueStore

func InitCache(memSize int) error {
	if memSize <= 0 {
		return errors.New("invalidCacheMemSize")
	}
	KvStore = NewKeyValueStore(memSize)
	//go KvStore.monitor()
	return nil
}

type loopSlice struct {
	KeyArray    []*string
	Pos         int
	Size        int
	CurSize     int
	lastLoopFin time.Time
	loopCount   int
}

func NewLoopSlice(size int) *loopSlice {
	return &loopSlice{
		KeyArray:    make([]*string, size),
		Size:        size,
		CurSize:     0,
		Pos:         -1,
		lastLoopFin: time.Now(),
		loopCount:   0,
	}
}

func (l *loopSlice) Add(keyPtr *string) bool {
	l.Pos++
	l.CurSize++
	ret := false
	if l.Pos == l.Size {
		ret = true
		l.loopCount++
		l.lastLoopFin = time.Now()
	}
	l.Pos = l.Pos % l.Size
	l.KeyArray[l.Pos] = keyPtr
	return ret
}

func (l *loopSlice) Head() *string {
	if l.CurSize < l.Size {
		return nil
	}
	index := (l.Pos + 1) % l.Size
	return l.KeyArray[index]
}

func (l *loopSlice) Tail() *string {
	if l.Pos < l.Size {
		return nil
	}
	index := l.Pos % l.Size
	return l.KeyArray[index]
}

func (l *loopSlice) Reset() {
	for index := range l.KeyArray {
		l.KeyArray[index] = nil
	}
	l.Pos = -1
	l.CurSize = 0
	l.loopCount = 0
	l.lastLoopFin = time.Now()
}

type IKeyValueItem interface {
	MergeItem(n IKeyValueItem) error
	GetKey() *string //必须使用item 的变量指针，不能给局部变量的指针
}

type BeforeAddFun func()

type KeyValueStore struct {
	mu         sync.RWMutex
	store      map[string]IKeyValueItem
	loop       *loopSlice
	now        int64
	alertUsage int
}

func NewKeyValueStore(size int) *KeyValueStore {
	kvs := &KeyValueStore{
		store: make(map[string]IKeyValueItem, size),
		loop:  NewLoopSlice(size),
	}
	return kvs
}

func (kv *KeyValueStore) AddValue(item IKeyValueItem) (IKeyValueItem, error) {
	kv.mu.Lock()
	muFlag := true
	defer func() {
		if muFlag {
			kv.mu.Unlock()
		}
		muFlag = false
	}()
	value, ok := kv.store[*item.GetKey()]
	if ok {
		err1 := value.MergeItem(item)
		if err1 != nil {
			kv.mu.Unlock()
			muFlag = false
			logrus.WithError(err1).Info("MergeItem-Fail")
			return nil, err1
		}
	} else {
		kv.store[*item.GetKey()] = item
	}
	kv.mu.Unlock()
	muFlag = false
	//del older key
	if !ok {
		olderKey := kv.loop.Head()
		if olderKey != nil {
			kv.mu.Lock()
			muFlag = true
			delete(kv.store, *olderKey)
			kv.mu.Unlock()
			muFlag = false
		}

		lastLoopTime := kv.loop.lastLoopFin
		loopFin := kv.loop.Add(item.GetKey())
		if loopFin {
			nowT := time.Now()
			logrus.WithField("duration", nowT.Sub(lastLoopTime).String()).Info("keyValueStoreLoopFin")
		}
	}
	return value, nil
}

func (kv *KeyValueStore) DeleteValue(key string) {
	kv.mu.Lock()
	defer kv.mu.Unlock()
	delete(kv.store, key)
}

var re = regexp.MustCompile(`^(\w+):\s+(\d+)`)

func memoryUsage() float64 {
	data, err := ioutil.ReadFile("/proc/meminfo")
	if err != nil {
		logrus.WithField("!", alert.Limit).WithError(err).Error("procMemInfoInvalid")
		return 0
	}
	memInfo := make(map[string]uint64)
	for _, line := range strings.Split(string(data), "\n") {
		match := re.FindStringSubmatch(line)
		if len(match) > 0 {
			value, _ := strconv.ParseUint(match[2], 10, 64)
			memInfo[match[1]] = value
		}
	}

	totalMemory := memInfo["MemTotal"]
	availableMemory := memInfo["MemAvailable"]
	usage := math.Round(float64(totalMemory-availableMemory) / float64(totalMemory) * 100)
	return usage
}

func bToMb(b uint64) uint64 {
	return b / 1024 / 1024
}

func (kv *KeyValueStore) monitor() {
	for {
		time.Sleep(10 * time.Second)
		now := time.Now()
		usage := memoryUsage()
		logT := logrus.WithField(
			"loopSize", kv.loop.Size).WithField(
			"mapSize", len(kv.store)).WithField(
			"usage", usage).WithField(
			"loopPos", kv.loop.Pos).WithField(
			"loopCount", kv.loop.loopCount).WithField(
			"duration", now.Sub(kv.loop.lastLoopFin).Round(time.Second).String())
		if int(usage) > kv.alertUsage {
			logT.WithField("!", alert.Limit).Warn("memoryAlert")
			kv.loop.Reset()
			kv.mu.Lock()
			kv.store = map[string]IKeyValueItem{}
			kv.mu.Unlock()
		} else {
			logT.Info("memoryRecord")
		}
	}
}

func (kv *KeyValueStore) timerTicker() {
	for {
		secTick := time.NewTicker(time.Second)
		select {
		case <-secTick.C:
			kv.now = time.Now().Unix()
		}
	}
}
