<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<el-button type="success" @click="openBatchAdd">批量添加</el-button>
			<cl-multi-delete-btn />
			<el-button type="success" :disabled="!Table?.selection?.length" @click="batchEnable">
				批量启用
			</el-button>
			<el-button type="danger" :disabled="!Table?.selection?.length" @click="batchDisable">
				批量禁用
			</el-button>
			<cl-flex1 />
			<cl-filter label="">
				<el-radio-group v-model="enable" @change="refresh({ enable })">
					<el-radio-button v-for="(item, index) in DictEnable" :key="index" :label="item.value">
						{{ item.label }}
					</el-radio-button>
				</el-radio-group>
			</cl-filter>
		</cl-row>
		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert" />
		<!-- 表单 -->
		<cl-form ref="Form" />
	</cl-crud>
</template>

<script lang="ts" name="game-robot" setup>
import { useCrud, useTable, useUpsert, useForm } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { ref } from "vue";

const { service } = useCool();

const DictEnable = [
	{
		label: "启用",
		value: 1,
		type: "success",
	},
	{
		label: "禁用",
		value: 0,
		type: "danger",
	},
];

// 状态
const enable = ref(1);

// cl-table
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "APP", prop: "app_id", dict: [], dictColor: true },
		{ label: "用户ID", prop: "user_id", minWidth: 120 },
		{
			label: "头像",
			prop: "avatar",
			width: 100,
			component: {
				name: "cl-image",
				props: {
					size: 32,
				},
			},
		},
		{ label: "昵称", prop: "nick_name", minWidth: 120 },
		{
			label: "余额",
			prop: "balance",
			minWidth: 100,
			formatter(row) {
				return (row.balance / 100).toFixed(2);
			},
		},
		{
			label: "锁定余额",
			prop: "balance_lock",
			minWidth: 100,
			formatter(row) {
				return (row.balance_lock / 100).toFixed(2);
			},
		},
		{
			label: "最近游戏",
			prop: "last_played",
			minWidth: 150,
			sortable: "custom",
		},
		{ label: "创建时间", prop: "create_at", minWidth: 150, sortable: "desc" },
		{
			label: "状态",
			prop: "enable",
			width: 90,
			fixed: "right",
			dict: DictEnable,
		},
		// { type: "op", buttons: ["edit"], width: 90 },
	],
});

// cl-crud
const Crud = useCrud(
	{
		service: service.game.robot,
	},
	(app) => {
		app.refresh({ enable: enable.value });
	},
);

// cl-form
const Form = useForm();

// 批量添加
function openBatchAdd() {
	Form.value?.open({
		title: "批量添加机器人",
		width: "500px",
		items: [
			{
				component: {
					name: "el-alert",
					props: {
						title: "提示：增加的余额会在最小和最大值之间随机",
						type: "warning",
						closable: false,
					},
				},
			},
			{
				label: "数量",
				prop: "count",
				value: 20,
				component: {
					name: "el-input-number",
					props: {
						min: 1,
						max: 100,
					},
				},
				required: true,
			},
			{
				label: "APP",
				prop: "app_id",
				component: {
					name: "el-input",
				},
				required: true,
			},
			{
				label: "最小余额(元)",
				prop: "balanceMin",
				value: 100,
				component: {
					name: "el-input-number",
					props: {
						min: 0,
						precision: 2,
					},
				},
				required: true,
			},
			{
				label: "最大余额(元)",
				prop: "balanceMax",
				value: 1000,
				component: {
					name: "el-input-number",
					props: {
						min: 0,
						precision: 2,
					},
				},
				required: true,
			},
		],
		on: {
			submit(data, { close, done }) {
				service.game.robot
					.createRobotBatch({
						...data,
						balanceMin: data.balanceMin * 100,
						balanceMax: data.balanceMax * 100,
					})
				ElMessage.success("添加成功，刷新后可以查看。");
				close();
			},
		},
	});
}

// 批量禁用
async function batchDisable() {
	const selection = Table.value?.selection;

	if (!selection || selection.length === 0) {
		ElMessage.warning("请选择要禁用的机器人");
		return;
	}

	await ElMessageBox.confirm("确定要禁用选中的机器人吗？", "提示", {
		type: "warning",
	});

	await service.game.user.batchDisable({
		ids: selection.map((e: any) => e.id),
	});

	ElMessage.success("禁用成功");
	refresh();
}

// 批量启用
async function batchEnable() {
	const selection = Table.value?.selection;

	if (!selection || selection.length === 0) {
		ElMessage.warning("请选择要启用的机器人");
		return;
	}

	await ElMessageBox.confirm("确定要启用选中的机器人吗？", "提示", {
		type: "warning",
	});

	await service.game.user.batchEnable({
		ids: selection.map((e: any) => e.id),
	});

	ElMessage.success("启用成功");
	refresh();
}

// 刷新
function refresh(params?: any) {
	Crud.value?.refresh(params);
}
</script>
