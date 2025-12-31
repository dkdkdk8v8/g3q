package initMain

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type PidHelp struct {
	PidPath string
	PidDir  string
}

func NewPidHelp(name string, suffix string) *PidHelp {
	ret := PidHelp{}
	ret.PidDir = filepath.Dir(os.Args[0])
	if !strings.HasSuffix(ret.PidDir, "/") {
		ret.PidDir = ret.PidDir + "/"
	}
	if suffix != "" {
		ret.PidPath = ret.PidDir + name + "." + suffix + ".pid"
	} else {
		ret.PidPath = ret.PidDir + name + ".pid"
	}
	return &ret
}

func (d *PidHelp) WritePidFile() error {
	pid := os.Getpid()
	return ioutil.WriteFile(d.PidPath, []byte(strconv.Itoa(pid)), 0644)
}

func (d *PidHelp) ReadPidFile() (int, error) {
	data, err := ioutil.ReadFile(d.PidPath)
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(string(data))
}

func (d *PidHelp) DelPidFile() error {
	return os.Remove(d.PidPath)
}
