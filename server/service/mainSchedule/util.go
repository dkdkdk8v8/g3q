package mainSchedule

import (
	"compoment/ormutil"
	"compoment/util"
	"regexp"
	"service/modelClient"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

func processTag(tagName string) (*modelClient.ModelResourceVideoTag, error) {
	tagModel, err := modelClient.GetSrcTag(tagName)
	if err != nil {
		if ormutil.IsNoRow(err) {
			//insert new tag
			tagModel = &modelClient.ModelResourceVideoTag{
				NameSrc: tagName,
			}
			err1 := modelClient.InsertResourceTag(tagModel)
			if err1 != nil {
				return nil, errors.WithMessage(err1, "InsertResourceTag")
			}
		} else {
			return nil, errors.WithMessage(err, "GetResourceTag")
		}
	}
	return tagModel, nil
}

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

func parseMissAvActor(actorModel *modelClient.ModelResourceActor, scraperModelConvert *modelScraper.ModelMissAvActor) error {

	cleanMeasurements := strings.TrimSpace(scraperModelConvert.Measurements)
	if len(cleanMeasurements) > 0 {
		cmIndex := strings.Index(cleanMeasurements, "cm")
		if cmIndex > 0 {
			heightStr := cleanMeasurements[:cmIndex]
			actorModel.Height = uint16(util.Atoi(heightStr))
		}

		measurementArr := strings.Split(cleanMeasurements, "/")
		var param3 []string
		var cleanParam3 []string
		var cupSize string //胸
		if len(measurementArr) == 2 {
			//160cm/34E-23-33
			param3 = strings.Split(measurementArr[1], "-")
		} else {
			//33E-22-32
			//148cm/30-25-31
			param3 = strings.Split(measurementArr[0], "-")
		}
		for _, p := range param3 {
			cleanParam3 = append(cleanParam3, strings.TrimSpace(p))
		}
		if len(cleanParam3) == 3 {
			cupSize = extractLetters(cleanParam3[0])
		}
		actorModel.CupSize = cupSize

		for paramIndex, param := range cleanParam3 {
			if paramIndex == 0 {
				bustStr := extractNumber(param)
				actorModel.BustCircle = uint16(util.Atoi(bustStr))
			} else if paramIndex == 1 {
				actorModel.WaistCircle = uint16(util.Atoi(param))
			} else if paramIndex == 2 {
				actorModel.HipsCircle = uint16(util.Atoi(param))
			} else {
				logrus.WithField("!", nil).WithField("scraperId", scraperModelConvert.Id).Error("param3Invalid")
			}
		}
	}
	if len(scraperModelConvert.Birthday) > 0 {
		actorModel.Birthday = extractDate(scraperModelConvert.Birthday)
	}
	if len(scraperModelConvert.DebutYear) > 0 {
		actorModel.FirstOnPublic = extractDebut(scraperModelConvert.DebutYear)
	}

	return nil
}

func processActor(actorIdStr string, scraperSrc modelScraper.ScraperSrc) (*modelClient.ModelResourceActor, error) {
	logT := logrus.WithField("actorId", actorIdStr)
	actorId := util.Atoi(actorIdStr)
	actorScraperModel, err := modelScraper.GetMissAvActorById(uint64(actorId))
	if err != nil {
		return nil, errors.WithMessage(err, "GetMissAvActorById")
	}
	srcName := strings.TrimSpace(actorScraperModel.Name)
	otherName := ""
	cleanName := srcName
	logT = logT.WithField("nameSrc", srcName)
	actorModel, err := modelClient.GetResourceActor(srcName)
	if err != nil {
		if ormutil.IsNoRow(err) {
			//insert new actor
			otherNameIndex := strings.Index(srcName, "(")
			if otherNameIndex > 0 {
				tempName := strings.TrimSpace(srcName[otherNameIndex:])
				tempName = strings.TrimPrefix(tempName, "(")
				otherName = strings.TrimSuffix(tempName, ")")
				cleanName = strings.TrimSpace(srcName[:otherNameIndex])
				if otherName == cleanName {
					otherName = ""
				}
			}

			bResActor := false
			actorModel = &modelClient.ModelResourceActor{
				Name:            cleanName,
				NameSrc:         srcName,
				NameOther:       otherName,
				Source:          "missav",
				Birthday:        time.Unix(0, 0),
				FirstOnPublic:   time.Unix(0, 0),
				RetiredOnPublic: time.Unix(0, 0),
				Enable:          true,
			}
			switch scraperSrc {
			case modelScraper.ScraperSrcMissAvActor:
				_ = parseMissAvActor(actorModel, actorScraperModel)
				bResActor = true
			default:

			}
			err1 := modelClient.InsertResourceActor(actorModel)
			if err1 != nil {
				return nil, errors.WithMessage(err1, "InsertResourceTag")
			}
			logT.WithField("nameOther", otherName).WithField("name", cleanName).Info("InsertResourceActor")
			if bResActor && actorScraperModel.Avatar != "" {
				err2 := modelScraper.InsertModel(&modelScraper.ModelResourceTool{
					ResourceId: actorModel.Id,
					ScraperId:  actorScraperModel.Id,
					ScraperSrc: scraperSrc,
					Status:     modelScraper.ResourceInit,
					StatusTime: time.Now(),
				})
				if err2 != nil {
					return nil, errors.WithMessage(err2, "InsertResourceToolForActor")
				}
			}
		} else {
			return nil, errors.WithMessage(err, "GetResourceTag")
		}
	}
	return actorModel, nil
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
