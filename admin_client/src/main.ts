import { createApp } from "vue";
import App from "./App.vue";
import { bootstrap } from "./cool";
import '../src/assets/css/element-plus-overrides.scss';

const app = createApp(App);

// 启动
bootstrap(app)
	.then(() => {
		app.mount("#app");
	})
	.catch((err) => {
		console.error("HSXS-ADMIN 启动失败", err);
	});
