package main

import (
	"compoment/util"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {

	tunnels := []*util.SSHTunnel{
		{
			//redis
			SSHUser:       "ec2-user",
			SSHKeyPath:    "/Users/admin/Documents/ssh/rsa-3q.pem",
			SSHHost:       "43.198.8.247:22",
			LocalAddress:  "127.0.0.1:16379",
			RemoteAddress: "127.0.0.1:6379",
			AutoReconnect: true,
			KeepAlive:     true,
			RetryInterval: time.Second * 5,
		},
		{
			//mysql serverless
			SSHUser:       "ec2-user",
			SSHKeyPath:    "/Users/admin/Documents/ssh/rsa-3q.pem",
			SSHHost:       "43.198.8.247:22",
			LocalAddress:  "127.0.0.1:13306",
			RemoteAddress: "database-g3q-instance-1.c1y06igkstt7.ap-east-1.rds.amazonaws.com:3306",
			AutoReconnect: true,
			KeepAlive:     true,
			RetryInterval: time.Second * 5,
		},
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
