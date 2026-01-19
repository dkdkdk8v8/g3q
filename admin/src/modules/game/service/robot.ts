import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import { GameUserEntity } from "../entityGame/user";
import { BaseSysParamService } from '../../base/service/sys/param';

@Provide()
export class GameRobotService extends BaseService {
    @Inject()
    ctx: Context;

    @InjectEntityModel(GameUserEntity)
    userEntity: Repository<GameUserEntity>;

    @Inject()
    baseSysParamService: BaseSysParamService;


    // 中文前缀 (形容词/修饰语) - 100个
    private cnPrefixes = [
        '快乐', '无敌', '神秘', '逍遥', '孤独', '寂寞', '忧伤', '疯狂', '暴躁', '温柔',
        '可爱', '调皮', '捣蛋', '聪明', '笨笨', '糊涂', '迷路', '追风', '逐月', '听雨',
        '观海', '倚楼', '听风', '醉酒', '狂歌', '漫步', '奔跑', '飞翔', '潜水', '睡觉',
        '发呆', '思考', '学习', '努力', '奋斗', '躺平', '咸鱼', '翻身', '逆袭', '绝世',
        '无双', '顶级', '菜鸟', '大神', '萌新', '老手', '职业', '业余', '街头', '巷尾',
        '隔壁', '楼下', '楼上', '对面', '远方', '故乡', '异客', '浪子', '归人', '过客',
        '曾经', '未来', '现在', '昨天', '明天', '梦中', '现实', '虚拟', '网络', '幻境',
        '仙界', '魔界', '人间', '地狱', '天堂', '龙宫', '森林', '沙漠', '草原', '雪山',
        '海洋', '天空', '宇宙', '星空', '银河', '太阳', '月亮', '星星', '白云', '乌云',
        '闪电', '雷鸣', '暴雨', '微风', '烈火', '寒冰', '热血', '冷酷', '多情', '无情'
    ];

    // 中文后缀 (名词/称谓) - 100个
    private cnSuffixes = [
        '少年', '少女', '大叔', '阿姨', '爷爷', '奶奶', '哥哥', '姐姐', '弟弟', '妹妹',
        '先生', '女士', '浪子', '侠客', '剑客', '刀客', '刺客', '法师', '牧师', '战士',
        '射手', '辅助', '坦克', '刺猬', '兔子', '老虎', '狮子', '熊猫', '考拉', '企鹅',
        '海豚', '鲸鱼', '鲨鱼', '鳄鱼', '乌龟', '蜗牛', '蚂蚁', '蜜蜂', '蝴蝶', '蜻蜓',
        '苍蝇', '蚊子', '蟑螂', '老鼠', '猫咪', '狗狗', '狐狸', '狼', '豹子', '大象',
        '犀牛', '河马', '长颈鹿', '斑马', '羚羊', '骆驼', '羊驼', '猴子', '猩猩', '狒狒',
        '金刚', '哥斯拉', '奥特曼', '蜘蛛侠', '蝙蝠侠', '钢铁侠', '绿巨人', '雷神', '洛基',
        '灭霸', '悟空', '八戒', '沙僧', '唐僧', '如来', '观音', '玉帝', '王母', '哪吒',
        '杨戬', '姜子牙', '诸葛亮', '曹操', '刘备', '孙权', '关羽', '张飞', '赵云',
        '马超', '黄忠', '吕布', '貂蝉', '西施', '昭君', '玉环', '路人', '过客', '大神'
    ];

    // 英文名 - 100个
    private enFirstNames = [
        'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Charles', 'Joseph', 'Thomas',
        'Christopher', 'Daniel', 'Paul', 'Mark', 'Donald', 'George', 'Kenneth', 'Steven', 'Edward', 'Brian',
        'Ronald', 'Anthony', 'Kevin', 'Jason', 'Matthew', 'Gary', 'Timothy', 'Jose', 'Larry', 'Jeffrey',
        'Frank', 'Scott', 'Eric', 'Stephen', 'Andrew', 'Raymond', 'Gregory', 'Joshua', 'Jerry', 'Dennis',
        'Walter', 'Patrick', 'Peter', 'Harold', 'Douglas', 'Henry', 'Carl', 'Arthur', 'Ryan', 'Roger',
        'Mary', 'Patricia', 'Linda', 'Barbara', 'Elizabeth', 'Jennifer', 'Maria', 'Susan', 'Margaret', 'Dorothy',
        'Lisa', 'Nancy', 'Karen', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon',
        'Michelle', 'Laura', 'Sarah', 'Kimberly', 'Deborah', 'Jessica', 'Shirley', 'Cynthia', 'Angela', 'Melissa',
        'Brenda', 'Amy', 'Anna', 'Rebecca', 'Virginia', 'Kathleen', 'Pamela', 'Martha', 'Debra', 'Amanda'
    ];

    // 英文姓 - 100个
    private enLastNames = [
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
        'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
        'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
        'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
        'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
        'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
        'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
        'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
    ];

    /**
     * 生成随机昵称
     * 70% 概率中文 (前缀 + [连接词] + 后缀)
     * 30% 概率英文 (First + Last)
     */
    generateNickname(): string {
        const isChinese = Math.random() < 0.7;
        if (isChinese) {
            const prefix = this.cnPrefixes[Math.floor(Math.random() * this.cnPrefixes.length)];
            const suffix = this.cnSuffixes[Math.floor(Math.random() * this.cnSuffixes.length)];
            // 连接词：空、的、之
            const connectors = ['', '的', '之'];
            const connector = connectors[Math.floor(Math.random() * connectors.length)];
            return `${prefix}${connector}${suffix}`;
        } else {
            const first = this.enFirstNames[Math.floor(Math.random() * this.enFirstNames.length)];
            const last = this.enLastNames[Math.floor(Math.random() * this.enLastNames.length)];
            return `${first} ${last}`;
        }
    }

    // 随机生成8位字母数字组合
    generateAppUserId(): string {
        const length = 8;
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async generateAvatar(): Promise<string> {
        const count = await this.baseSysParamService.dataByKey('admin.AvatarCount');
        const index = Math.floor(Math.random() * count) + 1;
        return `gwd3czq/${index}.jpg`;
    }

    // 批量创建机器人用户
    async createRobotBatch(count = 20, app_id, balanceMin = 100 * 100, balanceMax = 1000 * 100) {
        if (!app_id) {
            throw new Error("APP不能为空");
        }
        let successCount = 0;
        while (successCount < count) {
            try {
                const robot = new GameUserEntity();
                robot.app_user_id = this.generateAppUserId();
                robot.app_id = app_id;
                robot.user_id = robot.app_id + robot.app_user_id;
                robot.is_robot = true;
                robot.nick_name = this.generateNickname();
                robot.avatar = await this.generateAvatar();
                robot.balance = 0;
                // robot.balance = Math.floor(Math.random() * (balanceMax - balanceMin + 1)) + balanceMin;
                robot.enable = true;
                robot.create_at = new Date();
                robot.update_at = new Date();
                await this.userEntity.save(robot);
                successCount++;
            } catch (e) {
                // ignore
            }
        }
    }

    async page(query, option, connectionName) {
        const host = await this.baseSysParamService.dataByKey('admin.AvatarHost');
        const result = await super.page(query, option, connectionName);
        result?.list?.map((item: GameUserEntity) => {
            if (item.avatar) item.avatar = `${host}/${item.avatar}`;
        });
        return result;
    }

}
