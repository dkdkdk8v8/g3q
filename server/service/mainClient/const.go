package mainClient

import "time"

const (
	VipForeverDuration = time.Hour * 24 * 365 * 50
	DefaultAvatar      = "app/default_avatar.jpg"
	DurationDay        = time.Hour * 24
	HardCodeResApp     = "app"
	passwdSalt         = "hs2025"
	//TabLimit           = 20
)

type SearchType int

const (
	SearchTypeVideo SearchType = 0 //视频
	SearchTypePic   SearchType = 1 //图片
	SearchTypeText  SearchType = 2 //小说
	SearchLive      SearchType = 3 //直播
)
