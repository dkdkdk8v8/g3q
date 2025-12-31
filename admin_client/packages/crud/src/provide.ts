import { type App, reactive } from "vue";
import { mitt } from "./utils/mitt";
import { emitter } from "./emitter";
import { locale } from "./locale";
import { merge } from "./utils";

// 设置配置
function setConfig(app: App, options: Options = {}) {
	const config = merge(
		{
			permission: {
				update: true,
				page: true,
				info: true,
				list: true,
				add: true,
				delete: true
			},
			dict: {
				primaryId: "id",
				api: {
					list: "list",
					add: "add",
					update: "update",
					delete: "delete",
					info: "info",
					page: "page"
				},
				pagination: {
					page: "page",
					size: "size"
				},
				search: {
					keyWord: "keyWord",
					query: "query"
				},
				sort: {
					order: "order",
					prop: "prop"
				},
				label: locale.zhCn
			},
			style: {
				colors: [
					"#3949ab",
					"#d81b60",
					"#8e24aa",
					"#5e35b1",
					"#1e88e5",
					"#00897b",
					"#43a047",
					"#7cb342",
					"#f4511e",
					"#fb8c00",
					"#6d4c41",
					"#546e7a",
					"#c62828",
					"#ad1457",
					"#6a1b9a",
					"#283593",
					"#1565c0",
					"#2e7d32",
					"#ef6c00",
					"#37474f"
				],
				form: {
					labelPostion: "right",
					labelWidth: "100px",
					span: 24
				},
				table: {
					border: true,
					highlightCurrentRow: true,
					autoHeight: true,
					contextMenu: ["refresh", "check", "edit", "delete", "order-asc", "order-desc"],
					column: {
						align: "center",
						opWidth: 160
					}
				}
			},
			events: {}
		} as Options,
		options
	);

	// 初始化事件
	if (config.events) {
		emitter.init(config.events);
	}

	app.provide("__config__", config);

	return config;
}

// 设置浏览器
function setBrowser(app: App) {
	// 浏览器信息
	const browser = reactive({
		isMini: false,
		screen: "full"
	});

	// 更新信息
	function update() {
		const w = document.body.clientWidth;

		if (w < 768) {
			browser.screen = "xs";
		} else if (w < 992) {
			browser.screen = "sm";
		} else if (w < 1200) {
			browser.screen = "md";
		} else if (w < 1920) {
			browser.screen = "xl";
		} else {
			browser.screen = "full";
		}

		browser.isMini = browser.screen === "xs";
	}

	// 监听浏览器窗口变化
	window.addEventListener("resize", () => {
		update();

		// 事件
		mitt.emit("resize");
	});

	update();
	app.provide("__browser__", browser);
}

export function useProvide(app: App, options: Options = {}) {
	setBrowser(app);
	setConfig(app, options);
}
