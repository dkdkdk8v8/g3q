package game

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int `json:"niu"`      // 0-10, 10为牛牛
	Mult    int `json:"mult"`     // 牌型倍数
	MaxCard int `json:"max_card"` // 最大单牌，用于同牌型比大小
}

// RemoveCardsFromDeck 从牌堆中移除指定的牌
func RemoveCardsFromDeck(deck []int, cardsToRemove []int) []int {
	if len(cardsToRemove) == 0 {
		return cardsToRemove
	}
	toRemove := make(map[int]bool)
	for _, c := range cardsToRemove {
		toRemove[c] = true
	}
	newDeck := make([]int, 0, len(deck))
	for _, c := range deck {
		if !toRemove[c] {
			newDeck = append(newDeck, c)
		}
	}
	return newDeck
}
