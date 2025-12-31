#!/bin/bash
export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64
rm main_schedule.bz2
go build -ldflags "$ldflags" $*
bzip2 -f main_schedule