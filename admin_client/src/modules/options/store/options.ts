import { defineStore } from 'pinia';
import { computed, reactive, toRaw } from 'vue';
import { service } from '/@/cool';
import { isDev } from '/@/config';

type OptionItem = { label: string; value: any; [key: string]: any };

/**
 * 通用选项缓存 store
 * 用于缓存需要优先加载的业务数据（如商户列表），与字典模块类似。
 * 新增数据源只需在 sources 中注册即可。
 */
const useOptionsStore = defineStore('options', () => {
	const data = reactive<Record<string, OptionItem[]>>({});

	// 数据源注册：key → 异步获取函数
	const sources: Record<string, () => Promise<OptionItem[]>> = {
		// 商户 APP 列表（value=appId, label=商户名称）
		merchant_app: async () => {
			const res = await service.merchant.merchant.list();
			return (res || []).map((item: any) => ({
				value: item.appId,
				label: item.merchantName,
			}));
		},
	};

	// 获取（返回 computed，与 dict.get 行为一致）
	function get(name: string) {
		return computed(() => data[name] || []);
	}

	// 刷新所有数据源
	async function refresh() {
		for (const [key, fetcher] of Object.entries(sources)) {
			try {
				data[key] = await fetcher();
			} catch (e) {
				console.error(`[options] refresh "${key}" failed:`, e);
				data[key] = [];
			}
		}

		if (isDev) {
			console.group('选项缓存数据');
			console.log(toRaw(data));
			console.groupEnd();
		}
	}

	return { data, get, refresh };
});

export { useOptionsStore };
