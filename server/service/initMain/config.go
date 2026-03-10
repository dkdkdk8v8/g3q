package initMain

import (
	"os"
	"path/filepath"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"
)

func LoadYamlConfig(cfgDir string, debug bool, out interface{}) error {
	cfgName := "server.yaml"
	if debug {
		cfgName = "server_debug.yaml"
	}
	data, err := os.ReadFile(filepath.Join(cfgDir, "cfg", cfgName))
	if err != nil {
		return errors.WithMessage(err, cfgName)
	}
	return yaml.Unmarshal(data, out)
}
