package comm

import (
	"compoment/conf"
	"compoment/crypto"
	"compoment/rds"
	"compoment/util"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

var ConfTokenTTLSec = conf.NewStrLoader("config.token.ttl", "0")
var CheckDeviceSameOnlineSec = conf.NewIntLoader("config.device.same.ttl", 86400)

const RedisDb = 7

type Token struct {
	ID       string `json:"i"`
	Device   string `json:"d"`
	CreateAt int64  `json:"c"`
	Plat     int    `json:"p"` //0 1
	Sign     string `json:"s"`
}

func getRedisKey(id string, plat int) string {
	return fmt.Sprintf("%s_%d", id, plat)
}
func GenerateToken(id string, device string, plat int) (string, error) {
	if rds.DefConnPool == nil {
		logrus.WithField("!", nil).Error("defRedisPoolInvalid")
		return "", ErrRedisInvalid
	}
	// Create the token object
	token := &Token{
		ID:       id,
		CreateAt: time.Now().Unix(),
		Plat:     plat,
		Device:   device,
	}
	signStr := fmt.Sprintf("%s%s%d%d", id, device, plat, token.CreateAt)
	token.Sign = util.Md5([]byte(signStr))
	// Encode the token as JSON
	tokenJSON, err := json.Marshal(token)
	if err != nil {
		return "", errors.WithMessagef(ErrTokenError, "marshal:%s", err.Error())
	}
	redisKey := getRedisKey(id, plat)
	err = rds.DefConnPool.Set(RedisDb, redisKey, tokenJSON)
	if err != nil {
		return "", errors.WithMessagef(ErrTokenRedisSave, "redisSet:%s", err.Error())
	}

	err = rds.DefConnPool.SetExpire(RedisDb, redisKey, CheckDeviceSameOnlineSec.Load())
	if err != nil {
		return "", errors.WithMessagef(ErrTokenRedisSave, "redisExpire:%s", err.Error())
	}

	aes := crypto.NewAesECBDiy([]byte(TokenAesKey), crypto.PAD_MODE_PKCS7PADDING)
	tokenAes, err := aes.Encrypt(tokenJSON)
	if err != nil {
		return "", errors.WithMessagef(ErrTokenError, "aes:%s", err.Error())
	}
	b64 := base64.NewEncoding(TokenBaseBase64Dict).WithPadding('-')
	tokenString := b64.EncodeToString(tokenAes) // + "." + base64.URLEncoding.EncodeToString(signature)
	return tokenString, nil
}

// token expiration, 以配置为准， redis内辅助记录，主要为了多端登录互踢

func VerifyToken(token string) (*Token, error) {
	b64 := base64.NewEncoding(TokenBaseBase64Dict).WithPadding('-')
	tokenStr, err := b64.DecodeString(token)
	if err != nil {
		return nil, errors.WithMessagef(ErrTokenError, "b64Decode:%s", err.Error())
	}
	aes := crypto.NewAesECBDiy([]byte(TokenAesKey), crypto.PAD_MODE_PKCS7PADDING)
	tokenDec, err := aes.Decrypt(tokenStr)
	if err != nil {
		return nil, errors.WithMessagef(ErrTokenError, "aes:%s", err.Error())
	}
	var tokenJson Token
	err = json.Unmarshal(tokenDec, &tokenJson)
	if err != nil {
		return nil, errors.WithMessagef(ErrTokenError, "unmarshal:%s", err.Error())
	}

	sign := fmt.Sprintf("%s%s%d%d", tokenJson.ID, tokenJson.Device, tokenJson.Plat, tokenJson.CreateAt)
	if tokenJson.Sign != util.Md5([]byte(sign)) {
		return nil, errors.WithMessagef(ErrTokenError, "signInvalid:%s", err.Error())
	}
	ttl := util.Atoi64(ConfTokenTTLSec.Load())
	if ttl > 0 {
		if time.Now().Unix() >= (tokenJson.CreateAt + ttl) {
			return nil, ErrTokenExpire
		}
	}
	//查询redis，只是为了互斥token，多端互踢用的。并不能作为验证token的依据
	result := rds.DefConnPool.Get(RedisDb, getRedisKey(tokenJson.ID, tokenJson.Plat))
	if result.Error() != nil {
		return nil, errors.WithMessagef(ErrTokenError, "redisGet:%s", err.Error())
	}
	redisTokenStr := ""
	if result.Reply != nil {
		redisTokenStr, err = result.AsString()
		if err != nil {
			return nil, errors.WithMessagef(ErrTokenError, "redisStr:%s", err.Error())
		}
	}
	if redisTokenStr != "" {
		var redisTokenJson Token
		err = json.Unmarshal([]byte(redisTokenStr), &redisTokenJson)
		if err != nil {
			return nil, errors.WithMessagef(ErrTokenError, "redisJson:%s", err.Error())
		}
		if tokenJson.Plat != redisTokenJson.Plat {

		} else {
			if tokenJson.Device != redisTokenJson.Device {
				return nil, ErrTokenMultiDid
			}
		}
	}
	return &tokenJson, nil
}

// --- Launch Token (HMAC-SHA256, 用于游戏启动链接验证) ---

const LaunchTokenKey = "bG0nWM8GJkDg3rmZ1tv1a6ecFYYRp0XX"
const LaunchTokenTTL = 604800 // 7天

var ErrLaunchTokenExpired = fmt.Errorf("token expired")

// VerifyLaunchToken 验证游戏启动链接中的 token
// token 格式: {timestamp_hex}.{hmac_sha256_hex}
// 签名错误返回普通 error，过期返回 ErrLaunchTokenExpired（调用方可据此判断是否允许重连）
func VerifyLaunchToken(token, appId, playerId string) error {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid token format")
	}

	tsHex, sig := parts[0], parts[1]

	// 解析十六进制时间戳
	ts, err := strconv.ParseInt(tsHex, 16, 64)
	if err != nil {
		return fmt.Errorf("invalid token timestamp")
	}

	// 先验证签名，再检查过期
	mac := hmac.New(sha256.New, []byte(LaunchTokenKey))
	mac.Write([]byte(fmt.Sprintf("%s:%s:%d", appId, playerId, ts)))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return fmt.Errorf("token signature mismatch")
	}

	// 检查是否过期
	if time.Now().Unix()-ts > LaunchTokenTTL {
		return ErrLaunchTokenExpired
	}

	return nil
}

//func RefreshToken(tokenString string) (string, error) {
//	//token, err := VerifyToken(tokenString)
//	//if err != nil {
//	//	return "", err
//	//}
//	nToken, err := GenerateToken(token.ID, token.Device, token.Plat)
//	if err != nil {
//		return "", err
//	}
//	return nToken, nil
//}

//
//// Helper function to split the token string into token JSON and signature
//func splitToken(tokenString string) []string {
//	return strings.Split(tokenString, ".")
//}
//
//// Helper function to sign the token using HMAC-SHA256
//func signToken(token []byte, secretKey []byte) []byte {
//	hmac := hmac.New(sha256.New, secretKey)
//	hmac.Write(token)
//	return hmac.Sum(nil)
//}
