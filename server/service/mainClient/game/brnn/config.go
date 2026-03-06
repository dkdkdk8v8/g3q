package brnn

type BRNNConfig struct {
	Chips         []int64 `json:"Chips"`
	MaxBetPerArea int64   `json:"MaxBetPerArea"`
	MinBalance    int64   `json:"MinBalance"`
	TaxRate       int64   `json:"TaxRate"`       // 赢家税率，百分比（5 = 5%）
	MaxPlayers    int     `json:"MaxPlayers"`     // 单房间最大人数，满员后自动创建新房间

	SecBetting  int `json:"SecBetting"`
	SecDealing  int `json:"SecDealing"`
	SecShowCard int `json:"SecShowCard"`
	SecSettling int `json:"SecSettling"`
}

var DefaultConfig = &BRNNConfig{
	Chips:         []int64{100, 1000, 5000, 10000, 50000},
	MaxBetPerArea: 500000,
	MinBalance:    0,
	TaxRate:       5,
	MaxPlayers:    10,

	SecBetting:  15,
	SecDealing:  3,
	SecShowCard: 8,
	SecSettling: 5,
}

func (c *BRNNConfig) ValidChip(chip int64) bool {
	for _, v := range c.Chips {
		if v == chip {
			return true
		}
	}
	return false
}
