#!/bin/bash
app=build_main_robot

export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64
go build -o build_main_robot ./
bzip2 -f $app