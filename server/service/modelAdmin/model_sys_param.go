package modelAdmin

import (
	"compoment/ormutil"
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

type ParamDataType int

// 0-字符串 1-富文本 2-文件
const (
	ParamDataTypeStr      = 0
	ParamDataTypeRichText = 1
	ParamDataTypeFile     = 2
)

type ModelSysParam struct {
	Id         int           `orm:"column(id);auto"`
	CreateTime time.Time     `orm:"column(createTime);type(datetime);auto_now_add"`
	UpdateTime time.Time     `orm:"column(updateTime);type(datetime);auto_now"`
	KeyName    string        `orm:"column(keyName);size(255)"`
	Name       string        `orm:"column(name);size(255)"`
	Data       string        `orm:"column(data);type(text)"`
	DataType   ParamDataType `orm:"column(dataType);default(0)"`
	Remark     string        `orm:"column(remark);size(255);null"`
}

func (m *ModelSysParam) TableName() string {
	return "base_sys_param"
}

func GetAllSysParam() ([]*ModelSysParam, error) {
	ormDb := GetReadDb()
	return ormutil.QueryManyNoDiff[ModelSysParam](ormDb)
}

var SysParamCache SysParamManager

type SysParamManager struct {
	ParamMap map[string]*ModelSysParam
	mutex    sync.RWMutex
}

func (s *SysParamManager) Reload() error {
	list, err := GetAllSysParam()
	if err != nil {
		return err
	}
	s.mutex.Lock()
	defer s.mutex.Unlock()

	newMap := make(map[string]*ModelSysParam)
	for _, item := range list {
		newMap[item.KeyName] = item
	}
	s.ParamMap = newMap
	return nil
}

func (s *SysParamManager) GetString(key string, defaultValue string) string {
	s.mutex.RLock()
	item, ok := s.ParamMap[key]
	s.mutex.RUnlock()

	if !ok {
		logrus.WithField("key", key).Error("SysParam-GetString-Fail")
		return defaultValue
	}
	value := strings.TrimSpace(item.Data)
	if value == "" {
		return defaultValue
	}
	return value
}

func (s *SysParamManager) GetInt(key string, defaultValue int) int {
	valStr := s.GetString(key, "")
	if valStr == "" {
		return defaultValue
	}
	v, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultValue
	}
	return v
}

func (s *SysParamManager) GetFloat64(key string, defaultValue float64) float64 {
	valStr := s.GetString(key, "")
	if valStr == "" {
		return defaultValue
	}
	v, err := strconv.ParseFloat(valStr, 64)
	if err != nil {
		return defaultValue
	}
	return v
}

func (s *SysParamManager) GetBool(key string, defaultValue bool) bool {
	valStr := s.GetString(key, "")
	if valStr == "" {
		return defaultValue
	}
	switch valStr {
	case "1", "true", "TRUE", "True":
		return true
	case "0", "false", "FALSE", "False":
		return false
	}
	return defaultValue
}

func (s *SysParamManager) GetJSON(key string, defaultValue interface{}) interface{} {
	valStr := s.GetString(key, "")
	if valStr == "" {
		return defaultValue
	}
	var result interface{}
	err := json.Unmarshal([]byte(valStr), &result)
	if err != nil {
		return defaultValue
	}
	return result
}

func (s *SysParamManager) GetStringArray(key string, defaultValue []string) []string {
	valStr := s.GetString(key, "")
	if valStr == "" {
		if defaultValue == nil {
			return []string{}
		}
		return defaultValue
	}

	replacements := []string{"，", ",", "\r\n", ",", "\n", ",", "\r", ",", "\t", ",", " ", ","}
	for i := 0; i < len(replacements); i += 2 {
		valStr = strings.ReplaceAll(valStr, replacements[i], replacements[i+1])
	}
	parts := strings.Split(valStr, ",")
	var result []string
	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v != "" {
			result = append(result, v)
		}
	}
	if len(result) == 0 {
		return defaultValue
	}
	return result
}
