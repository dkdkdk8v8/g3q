package comm_test

import (
	"testing"

	. "service/comm"
)

func TestMarshalMsgpackRoundtrip(t *testing.T) {
	orig := Response{Cmd: "PingPong", Seq: 1, Code: 0, Msg: "ok"}
	b, err := MarshalMsgpack(&orig)
	if err != nil {
		t.Fatalf("MarshalMsgpack error: %v", err)
	}
	if len(b) == 0 {
		t.Fatal("empty output")
	}

	var got Response
	if err := DecodeMsgpackViaJSON(b, &got); err != nil {
		t.Fatalf("DecodeMsgpackViaJSON error: %v", err)
	}
	if got.Cmd != orig.Cmd || got.Seq != orig.Seq || got.Code != orig.Code {
		t.Fatalf("roundtrip mismatch: got %+v, want %+v", got, orig)
	}
}

func TestMarshalMsgpackKeyNames(t *testing.T) {
	// 验证编码后的 key 名称与 json 标签一致
	push := PushData{Cmd: "onServerPush", PushType: "PushRouter"}
	b, err := MarshalMsgpack(&push)
	if err != nil {
		t.Fatalf("MarshalMsgpack error: %v", err)
	}
	// 解码为 map 验证 key 名
	var m map[string]interface{}
	if err := DecodeMsgpackViaJSON(b, &m); err != nil {
		t.Fatalf("DecodeMsgpackViaJSON error: %v", err)
	}
	for _, key := range []string{"cmd", "pushType", "data"} {
		if _, ok := m[key]; !ok {
			t.Errorf("missing expected key %q in encoded PushData", key)
		}
	}
}
