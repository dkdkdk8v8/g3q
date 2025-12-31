<template>
	<div class="cl-upload-space__wrap">
		<slot>
			<template v-if="showBtn">
				<div class="cl-upload-space__wrap-list" v-show="urls.length > 0 && showList">
					<cl-upload v-model="urls" disabled deletable draggable :multiple="multiple" />
				</div>
				<el-button @click="open">{{ text }}</el-button>
			</template>
		</slot>

		<!-- 弹框 -->
		<cl-dialog
			v-model="visible"
			:title="spaceConfig.title"
			height="650px"
			width="1070px"
			padding="0"
			keep-alive
			:scrollbar="false"
			:close-on-click-modal="false"
			:close-on-press-escape="false"
		>
			<space-inner :ref="setRefs('inner')" v-bind="spaceConfig" @confirm="confirm" />

			<template #footer>
				<el-button @click="close">取消</el-button>
				<el-button :disabled="selection.length == 0" type="success" @click="confirm()">
					选择 {{ selection.length }}/{{ spaceConfig.limit }}
				</el-button>
			</template>
		</cl-dialog>
	</div>
</template>

<script lang="ts" setup name="cl-upload-space">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useCool } from "/@/cool";
import SpaceInner from "./space-inner.vue";
import { isString } from "lodash-es";

const props = defineProps({
	modelValue: [String, Array],
	// 标题
	title: {
		type: String,
		default: "文件空间"
	},
	// 按钮文本
	text: {
		type: String,
		default: "选择文件"
	},
	// 是否多选
	multiple: {
		type: Boolean,
		default: true
	},
	// 可选数量
	limit: {
		type: Number,
		default: 9
	},
	// 类型
	accept: String,
	// 显示按钮
	showBtn: {
		type: Boolean,
		default: true
	},
	// 显示列表
	showList: {
		type: Boolean,
		default: true
	}
});

const emit = defineEmits(["update:modelValue", "change", "confirm"]);

const { refs, setRefs } = useCool();

// 是否可见
const visible = ref(false);

// 配置
const spaceConfig = ref({
	title: "",
	limit: 9
});

// 展示列表
const urls = ref<any[]>([]);

// 选中列表
const selection = computed<Eps.SpaceInfoEntity[]>(() => refs.inner?.selection || []);

// 打开
function open(options?: any) {
	visible.value = true;

	// 合并配置
	spaceConfig.value = Object.assign({ ...props }, options);

	// 非多选情况
	if (!props.multiple) {
		spaceConfig.value.limit = 1;
	}

	nextTick(() => {
		refs.inner?.clear();
	});
}

// 关闭
function close() {
	visible.value = false;
}

// 确认
function confirm(arr?: Eps.SpaceInfoEntity[]) {
	const list = arr || selection.value;
	// 读取文件地址
	const keys = list.map((e) => e.url);
	// 返回值
	const key = props.multiple ? keys : keys[0];
	// 事件
	emit("update:modelValue", key);
	emit("change", key);
	emit("confirm", list);
	// 关闭
	close();
}

onMounted(() => {
	watch(
		() => props.modelValue,
		(val) => {
			if (val) {
				urls.value = isString(val) ? [val] : val;
			}
		},
		{
			immediate: true
		}
	);
});

defineExpose({
	open,
	close
});
</script>

<style lang="scss" scoped>
.cl-upload-space__wrap {
	&-list {
		margin-top: 10px;
	}
}
</style>
