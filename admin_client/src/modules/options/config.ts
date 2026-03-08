import { type ModuleConfig } from '/@/cool';
import { useOptions } from './index';

export default (): ModuleConfig => {
	return {
		ignore: {
			NProgress: ['/admin/merchant/merchant/list']
		},
		onLoad({ hasToken }) {
			const { options } = useOptions();
			hasToken(() => {
				options.refresh();
			});
		}
	};
};
