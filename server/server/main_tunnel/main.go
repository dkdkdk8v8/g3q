package main

import (
	"compoment/util"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gopkg.in/yaml.v2"
)

type Config struct {
	Tunnels []struct {
		SSHUser       string        `yaml:"ssh_user"`
		SSHKeyPath    string        `yaml:"ssh_key_path"`
		SSHHost       string        `yaml:"ssh_host"`
		LocalAddress  string        `yaml:"local_address"`
		RemoteAddress string        `yaml:"remote_address"`
		AutoReconnect bool          `yaml:"auto_reconnect"`
		KeepAlive     bool          `yaml:"keep_alive"`
		RetryInterval time.Duration `yaml:"retry_interval"`
		Mode          string        `yaml:"mode"`
	} `yaml:"tunnels"`
}

func main() {
	// 读取配置文件
	data, err := os.ReadFile("cfg/server.yaml")
	if err != nil {
		log.Fatalf("failed to read config file: %v", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		log.Fatalf("failed to unmarshal config: %v", err)
	}

	var tunnels []*util.SSHTunnel
	for _, t := range cfg.Tunnels {
		// 默认使用 LocalForward，如果需要支持其他模式，可以在这里添加判断逻辑
		mode := util.ModeLocalForward

		tunnels = append(tunnels, &util.SSHTunnel{
			SSHUser:       t.SSHUser,
			SSHKeyPath:    t.SSHKeyPath,
			SSHHost:       t.SSHHost,
			LocalAddress:  t.LocalAddress,
			RemoteAddress: t.RemoteAddress,
			AutoReconnect: t.AutoReconnect,
			KeepAlive:     t.KeepAlive,
			RetryInterval: t.RetryInterval,
			Mode:          mode,
		})
	}

	for _, t := range tunnels {
		log.Printf("Configuring tunnel: %s -> %s via %s@%s\n",
			t.LocalAddress, t.RemoteAddress, t.SSHUser, t.SSHHost)
		// 3. 启动隧道
		if err := t.Start(); err != nil {
			log.Fatalf("Failed to start tunnels: %v", err)
		}

		log.Println("Main tunnel process is running. Press CTRL+C to stop.")
	}

	// 4. 监听系统信号，实现优雅退出
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	log.Println("Shutting down...")
	for _, t := range tunnels {
		t.Stop()
	}
}
