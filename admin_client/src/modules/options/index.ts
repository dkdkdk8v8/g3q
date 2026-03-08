import { useStore } from './store';

export function useOptions() {
	return {
		...useStore()
	};
}
