package comm

import (
	"compoment/crypto"
	"encoding/json"
	"io"
	"net/http"
)

type AesJsonBinding struct {
	proto string
}

func (a *AesJsonBinding) Name() string {
	return "aesJson"
}

func (a *AesJsonBinding) Bind(req *http.Request, obj any) error {
	a.proto = req.Header.Get("proto")
	buf, err := io.ReadAll(req.Body)
	if err != nil {
		return err
	}
	return a.BindBody(buf, obj)
}

func (a *AesJsonBinding) BindBody(body []byte, obj any) error {
	if a.proto == "" {
		aes := crypto.NewAesCBCDiy([]byte(ProtoAesKey), crypto.PAD_MODE_PKCS7PADDING)
		decBody, err := aes.Decrypt(body)
		if err != nil {
			return ErrAesError
		}
		err = json.Unmarshal(decBody, obj)
		if err != nil {
			return ErrAesError
		}
	} else if a.proto == "json" {
		err := json.Unmarshal(body, obj)
		if err != nil {
			return err
		}
	} else {
		return ErrAesError
	}
	return nil
}
