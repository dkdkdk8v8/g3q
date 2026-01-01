package nn

const (
	// NiuNone 0:没牛 1-9:牛1-9 10:牛牛
	NiuNone      = 0  // 无牛
	NiuOne       = 1  // 牛1
	NiuTwo       = 2  // 牛2
	NiuThree     = 3  // 牛3
	NiuFour      = 4  // 牛4
	NiuFive      = 5  // 牛5
	NiuSix       = 6  // 牛6
	NiuSeven     = 7  // 牛7
	NiuEight     = 8  // 牛8
	NiuNine      = 9  // 牛9
	NiuNiu       = 10 // 牛牛
	NiuFace      = 11 // 五花牛
	NiuBomb      = 12 // 炸弹牛
	NiuFiveSmall = 13 // 五小牛
)

const (
	BankerTypeNoLook = 0 // 无看牌抢庄
	BankerTypeLook3  = 1 // 看三张牌抢庄
	BankerTypeLook4  = 2 // 看四张牌抢庄
)

func CalcNiu(cards []int) CardResult {
	if len(cards) < 5 {
		return CardResult{}
	}

	maxCard := -1
	for _, c := range cards {
		if maxCard == -1 || getCardPower(c) > getCardPower(maxCard) {
			maxCard = c
		}
	}

	ranks := make([]int, 5)
	points := make([]int, 5)
	sumPoints := 0
	for i, c := range cards {
		rank := c / 4
		ranks[i] = rank
		p := rank + 1
		if p > 10 {
			p = 10
		}
		points[i] = p
		sumPoints += p
	}

	// 五花牛(金牛)判断 (全部由 J, Q, K 组成)
	isFiveFlower := true
	for _, r := range ranks {
		// J, Q, K 的 rank 在我们的逻辑中是 10, 11, 12
		if r < 10 {
			isFiveFlower = false
			break
		}
	}
	if isFiveFlower {
		// 使用 NiuFace (11) 代表五花牛，倍率设为 6
		return CardResult{Niu: NiuFace, Mult: GetCardMultiplier(NiuFace), MaxCard: maxCard}
	}

	// 五小牛判断
	isFiveSmall := true
	for _, r := range ranks {
		if r >= 4 {
			isFiveSmall = false
			break
		}
	}
	if isFiveSmall && sumPoints <= 10 {
		return CardResult{Niu: NiuFiveSmall, Mult: GetCardMultiplier(NiuFiveSmall), MaxCard: maxCard}
	}

	// 炸弹牛判断
	rankCounts := make(map[int]int)
	for _, r := range ranks {
		rankCounts[r]++
		if rankCounts[r] == 4 {
			// 修复：炸弹牛比较大小时，应比较炸弹的牌值，而不是手牌最大值
			// 例如 3333K (炸弹3) < 44442 (炸弹4)，但 K > 4
			var bombCard int
			for _, c := range cards {
				if c/4 == r {
					bombCard = c
					break
				}
			}
			return CardResult{Niu: NiuBomb, Mult: GetCardMultiplier(NiuBomb), MaxCard: bombCard}
		}
	}

	niu := 0
	for i := 0; i < 3; i++ {
		for j := i + 1; j < 4; j++ {
			for k := j + 1; k < 5; k++ {
				if (points[i]+points[j]+points[k])%10 == 0 {
					remSum := 0
					for idx := 0; idx < 5; idx++ {
						if idx != i && idx != j && idx != k {
							remSum += points[idx]
						}
					}
					currentNiu := remSum % 10
					if currentNiu == 0 {
						currentNiu = 10
					}
					if currentNiu > niu {
						niu = currentNiu
					}
				}
			}
		}
	}

	return CardResult{Niu: niu, Mult: GetCardMultiplier(niu), MaxCard: maxCard}
}

func CompareCards(a, b CardResult) bool {
	if a.Niu != b.Niu {
		return a.Niu > b.Niu
	}
	return getCardPower(a.MaxCard) > getCardPower(b.MaxCard)
}

func getCardPower(card int) int {
	rank := card / 4
	suit := card % 4
	// 逻辑说明：
	// 1. rank*10 确保了先比较点数 (K > Q ... > A)
	// 2. +suit 确保了点数相同时比较花色
	// 3. 假设 suit 的值为：3=黑桃, 2=红桃, 1=梅花, 0=方块 (符合 黑>红>梅>方)
	return rank*10 + suit
}

// GetCardsByNiu 从可用牌堆中寻找符合特定牛牛点数的5张牌
// availableCards: 当前可用牌堆 (函数不会修改此切片，调用者需自行移除已用牌)
// targetNiu: 目标点数 (0:无牛, 1-9:牛x, 10:牛牛)
// 返回: 找到的5张牌 (如果找不到返回nil)
func GetCardsByNiu(availableCards []int, targetNiu int) []int {
	n := len(availableCards)
	if n < 5 {
		return nil
	}

	// 辅助函数：获取牌的逻辑点数 (J,Q,K 算 10)
	getLogicValue := func(card int) int {
		rank := card / 4
		val := rank + 1
		if val > 10 {
			return 10
		}
		return val
	}

	// 策略1: 如果目标是无牛 (0)，尝试随机寻找 (因为无牛概率高，暴力组合效率低)
	if targetNiu == NiuNone {
		limit := n - 5
		if limit <= 0 {
			hand := make([]int, 5)
			copy(hand, availableCards)
			if CalcNiu(hand).Niu == NiuNone {
				return hand
			}
			return nil
		}

		for i := 0; i < 200; i++ {
			// 简单的伪随机抽取5张验证
			// 注意：这里仅做演示，实际应避免重复索引。为性能考虑，这里假设 availableCards 已经洗牌
			// 我们直接取连续的5张做多次尝试即可，或者使用 sliding window
			start := i % limit
			hand := make([]int, 5)
			copy(hand, availableCards[start:start+5])
			if CalcNiu(hand).Niu == NiuNone {
				return hand
			}
		}
		return nil
	}

	// 策略2: 如果目标是有牛 (1-10)，使用算法查找
	// 必须找到3张牌 sum%10 == 0
	for i := 0; i < n-2; i++ {
		for j := i + 1; j < n-1; j++ {
			for k := j + 1; k < n; k++ {
				v1 := getLogicValue(availableCards[i])
				v2 := getLogicValue(availableCards[j])
				v3 := getLogicValue(availableCards[k])

				if (v1+v2+v3)%10 == 0 {
					// 找到了3张凑整的牌，现在找剩下2张符合 targetNiu
					targetRem := targetNiu
					if targetRem == 10 {
						targetRem = 0 // 牛牛要求剩余两张和为10或20，即 %10 == 0
					}

					for x := 0; x < n; x++ {
						if x == i || x == j || x == k {
							continue
						}
						for y := x + 1; y < n; y++ {
							if y == i || y == j || y == k {
								continue
							}

							v4 := getLogicValue(availableCards[x])
							v5 := getLogicValue(availableCards[y])

							if (v4+v5)%10 == targetRem {
								// 找到结果！
								return []int{
									availableCards[i],
									availableCards[j],
									availableCards[k],
									availableCards[x],
									availableCards[y],
								}
							}
						}
					}
				}
			}
		}
	}
	return nil
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
