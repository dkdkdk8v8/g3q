@echo off
del build_main_server
SET CGO_ENABLED=0
SET GOOS=linux
SET GOARCH=amd64

go build -o build_main_server ./

SET CGO_ENABLED=1
SET GOOS=windows
SET GOARCH=amd64
