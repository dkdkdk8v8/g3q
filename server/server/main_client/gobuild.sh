#!/bin/bash
app=build_main_client

export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64
go build -o build_main_client ./
bzip2 -f $app