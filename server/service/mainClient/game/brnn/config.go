package brnn

type BRNNConfig struct {
	Chips         []int64 `json:"Chips"`
	MaxBetPerArea int64   `json:"MaxBetPerArea"`
	MinBalance    int64   `json:"MinBalance"`

	SecBetting  int `json:"SecBetting"`
	SecDealing  int `json:"SecDealing"`
	SecShowCard int `json:"SecShowCard"`
	SecSettling int `json:"SecSettling"`
}

var DefaultConfig = &BRNNConfig{
	Chips:         []int64{10, 50, 100, 500, 1000},
	MaxBetPerArea: 50000,
	MinBalance:    100,

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
