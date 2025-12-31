package main

import (
	"compoment/endless"
	"github.com/sirupsen/logrus"
	"net/http"
)

func startHttpListen(addr string, handler http.Handler) {
	if err := endless.ListenAndServe(addr, handler); err != nil && err != http.ErrServerClosed {
		logrus.WithField("!", nil).WithError(err).Errorf("listenDefault")
	}
}
