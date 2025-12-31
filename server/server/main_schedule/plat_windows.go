package main

import (
	"github.com/sirupsen/logrus"
	"net/http"
)

func startHttpListen(addr string, handler http.Handler) {
	if err := http.ListenAndServe(addr, handler); err != nil && err != http.ErrServerClosed {
		logrus.WithField("!", nil).WithError(err).Errorf("listenDefault")
	}
}
