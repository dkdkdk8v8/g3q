import dayjs from "dayjs";

export const dateShortcuts = [
    {
        text: "当天",
        value: () => {
            const end = new Date();
            const start = new Date();
            return [start, end];
        },
    },
    {
        text: "近三天",
        value: () => {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 2);
            return [start, end];
        },
    },
    {
        text: "近一周",
        value: () => {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 6);
            return [start, end];
        },
    },
    {
        text: "近一个月",
        value: () => {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 29);
            return [start, end];
        },
    },
    {
        text: "本周",
        value: () => {
            const end = new Date();
            const now = dayjs();
            const day = now.day();
            const start = now.subtract(day === 0 ? 6 : day - 1, 'day').toDate();
            return [start, end];
        },
    },
    {
        text: "本月",
        value: () => {
            const end = new Date();
            const start = dayjs().startOf("month").toDate();
            return [start, end];
        },
    },
    {
        text: "上个月",
        value: () => {
            const start = dayjs().subtract(1, "month").startOf("month").toDate();
            const end = dayjs().subtract(1, "month").endOf("month").toDate();
            return [start, end];
        },
    },
];