module main_tunnel

go 1.25

replace compoment => ./../../compoment

require (
	compoment v0.0.0-00010101000000-000000000000
	gopkg.in/yaml.v2 v2.4.0
)

require (
	github.com/jmcvetta/randutil v0.0.0-20150817122601-2bb1b664bcff // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	golang.org/x/crypto v0.14.0 // indirect
	golang.org/x/sys v0.13.0 // indirect
)
