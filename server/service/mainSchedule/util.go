package mainSchedule

import (
	"compoment/util"
	"regexp"
	"strings"
	"time"
)

func extractLetters(input string) string {
	re := regexp.MustCompile(`[A-Za-z]+`)
	match := re.FindString(input)
	return match
}

func extractNumber(input string) string {
	re := regexp.MustCompile(`\d+`)
	match := re.FindString(input)
	return match
}

func extractDebut(input string) time.Time {
	re := regexp.MustCompile(`\d+`)
	dateStr := re.FindString(input)
	t, err := time.ParseInLocation("2006", dateStr, util.LocShanghai)
	if err != nil {
		return time.Unix(0, 0)
	}
	return t
}

func extractDate(input string) time.Time {
	re := regexp.MustCompile(`\d{4}-\d{2}-\d{2}`)
	dateStr := re.FindString(input)
	if dateStr == "" {
		return time.Unix(0, 0)
	}
	t, err := time.ParseInLocation(util.DataFormat, dateStr, util.LocShanghai)
	if err != nil {
		return time.Unix(0, 0)
	}
	return t
}

func GovNameFilter(s string) string {
	s = strings.ReplaceAll(s, "习近平", "")
	s = strings.ReplaceAll(s, "習近平", "")
	s = strings.ReplaceAll(s, "共产党", "")
	s = strings.ReplaceAll(s, "共産黨", "")
	return s
}

func HttpFilter(text string) string {
	text = GovNameFilter(text)
	if text != "" && len(text) <= 1 {
		return text
	}
	if text == "" {
		return " "
	}
	//pattern := `(?i)\b(?:https?://|www\.)[^\s]+`
	pattern := `(?i)\b((https?://|www\.)[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})(/[^\s]*)?)`
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return text
	}
	text = regex.ReplaceAllString(text, "")
	if len(text) > 2048 {
		//text = ""
		text = util.TruncateUTF8StringEfficient(text, 2040)
	}
	return text
}

// 判断单个字符是否是中文
func isChinese(c rune) bool {
	return c >= '\u4E00' && c <= '\u9FFF'
}

// 判断单个字符是否是日文（包含平假名+片假名）
func isJapanese(c rune) bool {
	return (c >= '\u3040' && c <= '\u309F') || // 平假名
		(c >= '\u30A0' && c <= '\u30FF') // 片假名
}

// 判断单个字符是否是韩文
func isKorean(c rune) bool {
	return (c >= '\uAC00' && c <= '\uD7AF') || // 韩文音节
		(c >= '\u1100' && c <= '\u11FF') || // 韩文字母（兼容字母、古文）
		(c >= '\u3130' && c <= '\u318F') // 韩文兼容区
}

// 判断单个字符是否是泰文
func isThai(c rune) bool {
	return c >= '\u0E00' && c <= '\u0E7F'
}

// 判断单个字符是否是英语字母 (A-Z, a-z)
func isEnglish(c rune) bool {
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
}

func containsChinese(str string) bool {
	for _, c := range str {
		if isChinese(c) {
			return true
		}
	}
	return false
}

func containsJapanese(str string) bool {
	for _, c := range str {
		if isJapanese(c) {
			return true
		}
	}
	return false
}

func containsKorean(str string) bool {
	for _, c := range str {
		if isKorean(c) {
			return true
		}
	}
	return false
}

func containsThai(str string) bool {
	for _, c := range str {
		if isThai(c) {
			return true
		}
	}
	return false
}

func containsEnglish(str string) bool {
	for _, c := range str {
		if isEnglish(c) {
			return true
		}
	}
	return false
}
