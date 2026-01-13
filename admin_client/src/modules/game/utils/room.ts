export const levelMap: Record<string, string> = {
    "1": "体验场",
    "2": "初级场",
    "3": "中级场",
    "4": "高级场",
    "5": "大师场",
    "6": "巅峰场",
};

export const typeMap: Record<string, string> = {
    "0": "不看牌",
    "1": "看三张",
    "2": "看四张",
};

export function getRoomInfo(id: string) {
    if (!id) return { level: "", type: "" };
    const parts = id.split("_");
    if (parts.length >= 3) {
        return {
            level: levelMap[parts[2]] || "未知",
            type: typeMap[parts[1]] || "未知",
        };
    }
    return { level: "未知", type: "未知" };
}