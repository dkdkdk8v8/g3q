#!/bin/bash
app=build_robot_server

export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64
go build -o build_robot_server ./
bzip2 -f $app