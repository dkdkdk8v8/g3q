export const levelMap: Record<string, string> = {
    "1": "初级场",
    "2": "中级场",
    "3": "高级场",
    "4": "豪华场",
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