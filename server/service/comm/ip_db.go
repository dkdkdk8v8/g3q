package comm

import (
	"github.com/ip2location/ip2location-go/v9"
	"os"
	"path/filepath"
)

var IpDb *ip2location.DB

func InitIpDataBase() error {
	var err error
	cfgDir := filepath.Dir(os.Args[0])
	//IpDb, err = ipdb.NewCity(cfgDir + "/cfg/city.free.ipdb")
	//if err != nil {
	//	return err
	//}
	//2023.11 version
	IpDb, err = ip2location.OpenDB(cfgDir + "/cfg/IP2LOCATION-LITE-DB3.IPV6.BIN")
	if err != nil {
		return err
	}
	return nil
}

func IsMainLandIp(ip string) bool {
	if IpDb == nil {
		return true
	}
	c, err := IpDb.Get_country_long(ip)
	if err != nil {
		return true
	}
	return c.Country_long == "China"
}

func IpCountry(ip string) string {
	if IpDb == nil {
		return ""
	}
	c, err := IpDb.Get_country_long(ip)
	if err != nil {
		return ""
	}
	return c.Country_long
}

func IpArea(ip string) string {
	if IpDb == nil {
		return ""
	}
	c, err := IpDb.Get_region(ip)
	if err != nil {
		return ""
	}
	return c.Region
}

func IpCity(ip string) string {
	if IpDb == nil {
		return ""
	}
	c, err := IpDb.Get_city(ip)
	if err != nil {
		return ""
	}
	return c.City
}
