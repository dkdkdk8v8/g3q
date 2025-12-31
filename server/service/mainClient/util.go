package mainClient

import (
	"compoment/prebuildregexp"
	"compoment/uid"
	"compoment/util"
	"fmt"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"math"
	"math/rand"
	"reflect"
	"service/modelClient"
	"strings"
)

const (
	AppId91XJ = "91xj"
	AppIdSgui = "sgui"
	AppIdYase = "yase"
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

func CheckParamStr(s string) error {
	if s == "" {
		return ErrParamInvalid
	}
	return nil
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

func GetBuyPrice(p int) int {
	if p <= 0 {
		return 999
	}
	return p
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

type HSXSClick struct {
	Type modelClient.ClickType
	Arg  interface{}
}

func BuildClickEvent(tp modelClient.ClickType, param interface{}) HSXSClick {
	ret := HSXSClick{}
	ret.Type = tp
	ret.Arg = param
	var err error
	switch ret.Type {
	case modelClient.ClickTypeOpenWeb, modelClient.ClickTypeInnerWeb:
		switch reflect.TypeOf(param).Kind() {
		case reflect.String:
			ret.Arg = param
		default:
			err = errors.New("invalidClickType")
		}
	case modelClient.ClickTypePlayList:
		//tod check
	case modelClient.ClickTypeVideoDetail:
		//tod check
	}
	if err != nil {
		logrus.WithField("!", nil).WithField(
			"clickType", tp).WithField("param", param).WithError(err).Error("HSXSClickBuild-Fail")
		ret.Type = modelClient.ClickTypeNone
	}
	return ret
}

func PlayVideo265(plat int) bool {
	// 平台标识// 0：未知；
	// 1：app-android；// 2：app-ios ；
	// 3：h5-ios；// 4：h5-android；
	// 5：h5-pc；static int platTypeNo = 0;
	if plat == 1 {
		return true
	}
	return false
}

type CdnForType int

const (
	CdnForPic       CdnForType = 0
	CdnForVideo     CdnForType = 1
	CdnForPlainText CdnForType = 2
	CdnForPicVue    CdnForType = 3
)

func GetCdnPrefixPath(cft CdnForType, relativePath string) string {
	if relativePath == "" {
		return ""
	}
	switch cft {
	case CdnForPic:
		return "/pass/" + relativePath
	case CdnForVideo:
		return "/through/" + relativePath
	case CdnForPlainText:
		return "/guess/" + relativePath
	case CdnForPicVue:
		return "/quick/" + relativePath
	default:
		return "/error/" + relativePath
	}
}

func AdSamePositionSelect(s []*modelClient.ModelAdCommon) []*modelClient.ModelAdCommon {
	//pre check
	bSamePos := false
	lastPos := math.MinInt16
	for _, ad := range s {
		if lastPos == int(ad.Position) {
			bSamePos = true
			break
		}
		lastPos = int(ad.Position)
	}
	if !bSamePos {
		return s
	}
	//select by weight
	var ret []*modelClient.ModelAdCommon
	var tempSamePositionMap = make(map[int][]*modelClient.ModelAdCommon, len(s))
	for _, ad := range s {
		tArr, ok := tempSamePositionMap[int(ad.Position)]
		if !ok {
			tArr = make([]*modelClient.ModelAdCommon, 0)
		}
		tArr = append(tArr, ad)
		tempSamePositionMap[int(ad.Position)] = tArr
	}
	for _, samePosArr := range tempSamePositionMap {
		if len(samePosArr) > 1 {
			selectOneAd := util.WeightedRandSimple(samePosArr, func(common *modelClient.ModelAdCommon) int {
				return int(common.Weight)
			})
			ret = append(ret, selectOneAd)
		} else if len(samePosArr) == 1 {
			ret = append(ret, samePosArr[0])
		} else {
			//pass,todo log
		}
	}
	return ret
}
