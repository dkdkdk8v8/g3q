/** 抢庄牛牛房间类型（固定配置，不走字典接口） */
export const QznnRoomTypes = [
	{ label: '抢庄牛牛', value: 0 },
	{ label: '看三张', value: 1 },
	{ label: '看四张', value: 2 }
];

/** value → label 映射 */
export const QznnRoomTypeMap: Record<number, string> = Object.fromEntries(
	QznnRoomTypes.map(i => [i.value, i.label])
);

/** 根据 value 获取 label，找不到返回 "未知" */
export function getQznnRoomTypeLabel(value: number | string): string {
	return QznnRoomTypeMap[Number(value)] ?? '未知';
}

export const DictEnable = [
	{
		label: '已启用',
		value: 1,
		type: 'success'
	},
	{
		label: '已禁用',
		value: 0,
		type: 'danger'
	}
];
