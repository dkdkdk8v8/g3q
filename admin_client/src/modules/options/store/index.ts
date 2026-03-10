import { useOptionsStore } from './options';

export function useStore() {
	const options = useOptionsStore();

	return {
		options
	};
}
