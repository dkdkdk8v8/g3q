package comm

import (
	"bytes"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"os"
)

var AwsS3 *AwsS3Service

func InitDefaultAwsS3(bucketName string, region, accessKey, secretKey string) error {
	var err error
	AwsS3 = &AwsS3Service{BucketName: bucketName}
	AwsS3.Session, err = session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Credentials: credentials.NewStaticCredentials(accessKey, secretKey, ""),
	})
	if err != nil {
		return err
	}
	return nil
}

type AwsS3Service struct {
	Session    *session.Session
	BucketName string
	ObjectKey  string

	awsRegionName      string
	awsAccessKeyId     string
	awsSecretAccessKey string
}

func (a *AwsS3Service) HeadObject(key string) (*s3.HeadObjectOutput, error) {
	svc := s3.New(a.Session)

	input := &s3.HeadObjectInput{
		Bucket: aws.String(a.BucketName),
		Key:    aws.String(key),
	}
	headResp, err := svc.HeadObject(input)
	if err != nil {
		return nil, err
	}
	return headResp, nil
}

func (a *AwsS3Service) GetObject(rangeHeader string, key string) (*s3.GetObjectOutput, error) {
	svc := s3.New(a.Session)
	input := &s3.GetObjectInput{
		Bucket: aws.String(a.BucketName),
		Key:    aws.String(key),
	}
	if rangeHeader != "" {
		input.Range = aws.String(rangeHeader)
	}
	downloadResponse, errDownload := svc.GetObject(input)
	if errDownload != nil {
		return nil, errDownload
	}
	return downloadResponse, nil
}

func (a *AwsS3Service) PutObject(ioBody *bytes.Reader, key string) (*s3.PutObjectOutput, error) {
	svc := s3.New(a.Session)
	input := &s3.PutObjectInput{
		Bucket: aws.String(a.BucketName),
		Key:    aws.String(key),
		Body:   ioBody, // 设置 Body 字段为 ioBody
	}
	putResponse, errPut := svc.PutObject(input)
	if errPut != nil {
		return nil, errPut
	}
	return putResponse, nil
}

func (a *AwsS3Service) PutObjectEx(ioBody *os.File, key string, md5 string) (*s3.PutObjectOutput, error) {
	svc := s3.New(a.Session)
	input := &s3.PutObjectInput{
		Bucket:     aws.String(a.BucketName),
		Key:        aws.String(key),
		Body:       ioBody, // 设置 Body 字段为 ioBody
		ContentMD5: aws.String(md5),
	}
	putResponse, errPut := svc.PutObject(input)
	if errPut != nil {
		return nil, errPut
	}
	return putResponse, nil
}

func (a *AwsS3Service) DelObject(key string) (*s3.DeleteObjectOutput, error) {
	svc := s3.New(a.Session)
	input := &s3.DeleteObjectInput{
		Bucket: aws.String(a.BucketName),
		Key:    aws.String(key),
		//Body:   ioBody, // 设置 Body 字段为 ioBody
	}
	delResponse, errPut := svc.DeleteObject(input)
	if errPut != nil {
		return nil, errPut
	}
	return delResponse, nil
}
