package mainClient

import (
	"compoment/prebuildregexp"
	"compoment/uid"
	"compoment/util"
	"fmt"
	"math/rand"
	"strings"
)

func BuildUserId() string {
	snowId := uid.Generate()
	return util.EncodeToBase36(snowId)
}

func FmtFullPhone(area, mobile string) string {
	return fmt.Sprintf("%s-%s", area, mobile)
}

func BuildCaptcha() string {
	val := 100000 + rand.Intn(899999)
	return fmt.Sprintf("%d", val)
}

func CheckMobile(s string) error {
	if s == "" {
		return ErrParamInvalid
	}
	s = strings.TrimSpace(s)
	if !prebuildregexp.MobileRegexp.MatchString(s) {
		return ErrCommonError.Msg("手机格式不正确，如果有疑问请联系客服姐姐")
	}
	return nil
}

func GetChineseWeekName(i int) string {
	switch i {
	case 1:
		return "一"
	case 2:
		return "二"
	case 3:
		return "三"
	case 4:
		return "四"
	case 5:
		return "五"
	case 6:
		return "六"
	case 0:
		return "日"
	}
	return fmt.Sprintf("%d", i)
}

func unicodeIsLetter(r rune) bool {
	return (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z')
}
func unicodeIsDigit(r rune) bool {
	return r >= '0' && r <= '9'
}
func isLetter(character string) bool {
	for _, c := range character {
		return unicodeIsLetter(c)
	}
	return false
}

func isChinese(c rune) bool {
	return c >= '\u4E00' && c <= '\u9FFF'
}
func isJapanese(c rune) bool {
	return c >= '\u3040' && c <= '\u30FF'
}
func isChineseStr(character string) bool {
	for _, c := range character {
		return isChinese(c)
	}
	return false
}
func isJapaneseStr(character string) bool {
	for _, c := range character {
		return isJapanese(c)
	}
	return false
}
func CalculatePositionCount(str string) int {
	ret := 0
	for _, r := range str {
		if unicodeIsLetter(r) {
			ret += 1
		} else if unicodeIsDigit(r) && r != '1' {
			ret += 2
		} else {
			ret += 2
		}
	}
	return ret
}

func GetClientVersionNum(version string) []int {
	versionArr := strings.Split(version, ".")
	var ret []int
	for _, v := range versionArr {
		ret = append(ret, util.Atoi(v))
	}
	return ret
}
