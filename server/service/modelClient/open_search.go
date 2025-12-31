package modelClient

import (
	"bytes"
	myopensearch "compoment/myopensearch"
	"context"
	"encoding/json"
	"fmt"
	"github.com/opensearch-project/opensearch-go/v4"
	"github.com/pkg/errors"
	"io"
	"strings"
	"time"
)

var ErrOpenSearchNoRow = errors.New("OpenSearchDocNotFound")

const OpenSearchVideoIndexName = "hsxs_video_v1"

type EsVideoEsRsp struct {
	Found  bool         `json:"found"`
	Source EsVideoModel `json:"_source"`
}

type EsVideoModel struct {
	Id string `json:"id"`
	//TitleSrc      string   `json:"titleSrc"`
	Title string `json:"title"`
	//TitleEN       string   `json:"titleEN"`
	//TitleJP       string   `json:"titleJP"`
	Duration      int      `json:"duration"`
	Directors     []string `json:"directors"` // 导演集合
	Tags          []string `json:"tags"`      // 标签集合
	Actors        []string `json:"actors"`    // 演员集合
	FanNumber     string   `json:"fanNumber"` // 番号
	Publisher     string   `json:"publisher"` // 发行商
	Series        string   `json:"series"`    // 系列
	Click         int      `json:"click"`
	Like          int      `json:"like"`
	PublishDateTs int64    `json:"publishDateTs"`
	Resolution    string   `json:"resolution"`
	UpdateTs      int64    `json:"updateTs"` //same with videoModel esUpdated
	CreateTs      int64    `json:"createTs"` //入库时间
}

func InsertOrUpdateVideo2OpenSearch(video *ModelResourceVideo) error {
	if video.Id <= 0 {
		return errors.New("InvalidInsertOpenSearchParam")
	}
	timeCtx, timeCancel := context.WithTimeout(context.Background(), time.Second*20)
	defer timeCancel()
	path := "/" + OpenSearchVideoIndexName + "/_doc/" + fmt.Sprintf("%d", video.Id)

	videoTagNames := strings.Split(strings.ToLower(video.Tags), ",")
	videoActorIds := strings.Split(strings.ToLower(video.Actors), ",")
	//tagModels, err1 := GetResourceTagsByIds(videoTagNames...)
	//if err1 != nil {
	//	return errors.WithMessage(err1, "GetResourceTagsByIds")
	//}
	//mysql queryTagName actorName
	actorModels, err1 := GetResourceActorsByIds(videoActorIds...)
	if err1 != nil {
		return errors.WithMessage(err1, "GetResourceActorsByIds")
	}
	var esTags []string
	var esActors []string

	esTags = append(esTags, videoTagNames...)

	for _, act := range actorModels {
		esActors = append(esActors, strings.ToLower(act.NameSrc))
	}
	//默认给中文
	esTitle := video.Title
	if len(esTitle) <= 0 {
		esTitle = video.TitleJP
	}
	if len(esTitle) <= 0 {
		esTitle = video.TitleEN
	}
	if len(esTitle) <= 0 {
		esTitle = video.TitleSrc
	}
	esTitle = strings.ToTitle(esTitle)
	var esVideo = EsVideoModel{
		Id:            fmt.Sprintf("%d", video.Id),
		Title:         esTitle,
		Duration:      int(video.Duration),
		Directors:     strings.Split(strings.ToLower(video.Directors), ","),
		Tags:          esTags,
		Actors:        esActors,
		FanNumber:     strings.ToLower(video.FanNumber),
		Publisher:     strings.ToLower(video.Publisher),
		Series:        strings.ToLower(video.Series),
		Click:         0,
		Like:          0,
		PublishDateTs: video.PublishDate.Unix(),
		Resolution:    video.Resolution,
		UpdateTs:      video.Updated.Unix(),
		CreateTs:      video.Created.Unix(),
	}

	putBody, err := json.Marshal(esVideo)
	if err != nil {
		return errors.WithMessage(err, "InsertOrUpdateVideo2OpenSearch-Marshal")
	}

	putReq, err := opensearch.BuildRequest("PUT", path, bytes.NewBuffer(putBody), nil, nil)
	if err != nil {
		return err
	}
	putReq = putReq.WithContext(timeCtx)
	insertResponse, err := myopensearch.DefClient.Perform(putReq)
	if err != nil {
		return err
	}
	//201 created
	//200 create
	if insertResponse.StatusCode != 200 && insertResponse.StatusCode != 201 {
		return errors.New("InsertOrUpdateVideo2OpenSearch-InvalidHttpCode")
	}

	body, _ := io.ReadAll(insertResponse.Body)
	defer insertResponse.Body.Close()

	var putData struct {
		Id     string `json:"_id"`
		Result string `json:"result"`
	}
	err = json.Unmarshal(body, &putData)
	if err != nil {
		return err
	}
	return nil
}

func GetVideoFromOpenSearch(videoId uint64) (*EsVideoModel, error) {
	timeCtx, timeCancel := context.WithTimeout(context.Background(), time.Second*8)
	defer timeCancel()
	path := "/" + OpenSearchVideoIndexName + "/_doc/" + fmt.Sprintf("%d", videoId)

	getReq, err := opensearch.BuildRequest("GET", path, nil, nil, nil)
	if err != nil {
		return nil, err
	}
	getReq = getReq.WithContext(timeCtx)
	getResponse, err := myopensearch.DefClient.Perform(getReq)
	if err != nil {
		return nil, err
	}
	if getResponse.StatusCode != 200 {
		if getResponse.StatusCode != 404 {
			return nil, errors.New("GetVideoFromOpenSearch-InvalidHttpCode")
		}
	}

	body, _ := io.ReadAll(getResponse.Body)
	defer getResponse.Body.Close()

	var getData EsVideoEsRsp
	err = json.Unmarshal(body, &getData)
	if err != nil {
		return nil, err
	}

	if !getData.Found {
		return nil, ErrOpenSearchNoRow
	}

	return &getData.Source, nil
}
