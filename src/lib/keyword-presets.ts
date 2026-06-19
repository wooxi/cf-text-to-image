export type KeywordSelectionMode = "single" | "multi";

export interface KeywordFacetPreset {
  slug: string;
  name: string;
  description: string;
  selectionMode: KeywordSelectionMode;
  maxSelect?: number;
  keywords: string[];
}

export interface KeywordPresetGroup {
  slug: string;
  name: string;
  description: string;
  parameterGroup?: boolean;
  facets: KeywordFacetPreset[];
}

export const legacyKeywordGroupSlugs = ["scene", "character", "style", "lighting", "composition"];
export const legacyOnlyKeywordGroupSlugs = ["character", "style", "clothing", "body-part", "subject", "image-style", "lens", "pose", "styling", "mood", "detail", "output-spec"];
export const keywordSyncVersion = 6;

export const keywordOldDefaults: Record<string, string[]> = {
  subject: [
    "单人", "双人", "多人", "女性", "男性", "亚洲人", "欧美人", "年轻", "成熟",
    "长发", "短发", "直发", "卷发", "模特", "新娘", "学生", "职场人", "运动型",
  ],
  environment: [
    "卧室", "床上", "沙发", "落地窗室内", "咖啡馆", "酒店房间", "白色影棚", "城市街头",
    "地铁站台", "商场中庭", "天台夜景", "海边沙滩", "森林小路", "草地", "雪地", "书店", "雨夜街道",
    "自然光", "侧光", "窗边光", "逆光", "侧逆光", "顶光", "硬光", "柔光", "漫射光", "柔光箱",
    "黄金时刻", "蓝调时刻", "霓虹光", "烛光",
  ],
  outfit: [
    "白衬衫", "黑衬衫", "T恤", "针织衫", "卫衣", "西装外套", "风衣", "牛仔外套", "吊带", "背心",
    "连衣裙", "半身裙", "百褶裙", "牛仔裤", "阔腿裤", "西装裤", "黑丝", "白丝袜", "长筒袜",
    "高跟鞋", "长靴", "运动鞋", "耳环", "项链", "眼镜", "裸感底妆", "清透底妆", "红唇", "粉唇",
    "眼线", "长睫毛", "湿发", "高马尾", "黑长直", "微卷长发", "高清肤质", "胶片颗粒", "低饱和", "冷灰调", "暖黄调",
  ],
  pose: [
    "站立", "坐姿", "蹲姿", "行走", "回头", "低头", "抬手", "整理头发", "靠墙", "看镜头",
    "看向远处", "双手插袋", "单手扶栏杆", "抱臂", "眼神", "睫毛", "唇部", "牙齿", "锁骨", "肩颈", "腰线",
    "腿部线条", "手指", "发丝", "耳饰", "服装纹理",
  ],
  camera: [
    "24mm", "35mm", "50mm", "85mm", "135mm", "广角", "标准镜头", "长焦", "全身", "半身", "七分身", "近景",
    "面部特写", "局部特写", "平视", "仰拍", "俯拍", "低机位", "高机位", "居中构图", "三分法", "对角线构图",
    "引导线", "框景", "前景遮挡", "留白", "横向构图", "竖向构图", "对称构图",
  ],
  style: [
    "写实摄影", "电影写实", "商业广告", "日系写真", "韩系写真", "胶片摄影", "棚拍广告", "日漫风格", "美漫风格",
    "二次元插画", "国风插画", "扁平插画", "日系厚涂", "韩系头像", "儿童绘本", "漫画分镜", "素描手稿", "水彩绘制",
    "油画笔触", "水墨风格", "炭笔速写", "马克笔上色", "版画质感", "像素风格", "3D 渲染", "黏土风格", "赛博霓虹",
    "冷淡", "温柔", "慵懒", "安静", "浪漫", "清冷", "明亮", "神秘", "干净", "松弛",
  ],
  output: ["1:1", "3:4", "4:3", "9:16", "16:9", "1024", "1536", "2048"],
};

export const defaultKeywordGroups: KeywordPresetGroup[] = [
  {
    slug: "subject",
    name: "主体",
    description: "先确定拍谁，再补身份和发型。大部分维度为单选，减少冲突。",
    facets: [
      {
        slug: "subject-count",
        name: "人数",
        description: "决定画面里有几个人。",
        selectionMode: "single",
        keywords: ["单人", "双人", "多人"],
      },
      {
        slug: "subject-gender",
        name: "性别",
        description: "人物性别倾向。",
        selectionMode: "single",
        keywords: ["女性", "男性"],
      },
      {
        slug: "subject-age",
        name: "年龄",
        description: "人物年龄段。",
        selectionMode: "single",
        keywords: ["幼态", "年轻", "成熟", "中老年"],
      },
      {
        slug: "subject-body-shape",
        name: "体型",
        description: "人物身材特征。",
        selectionMode: "single",
        keywords: ["偏瘦", "匀称", "微胖", "健身型"],
      },
      {
        slug: "subject-ethnicity",
        name: "人种",
        description: "人物族裔或面貌风格。",
        selectionMode: "single",
        keywords: ["亚洲人", "欧美人"],
      },
      {
        slug: "subject-role",
        name: "身份",
        description: "人物职业或角色标签。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["模特", "学生", "职场人", "新娘", "运动型"],
      },
      {
        slug: "subject-hair",
        name: "发型",
        description: "发型和发质。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["长发", "短发", "直发", "卷发", "高马尾", "黑长直", "微卷长发"],
      },
    ],
  },
  {
    slug: "environment",
    name: "环境",
    description: "把地点、天气、时间和光线放在同一组里，符合拍摄思路。",
    facets: [
      {
        slug: "environment-type",
        name: "环境类型",
        description: "室内或室外。",
        selectionMode: "single",
        keywords: ["室内", "室外"],
      },
      {
        slug: "environment-scene",
        name: "场景",
        description: "具体拍摄地点。",
        selectionMode: "single",
        keywords: [
          "卧室", "床上", "沙发", "落地窗室内", "咖啡馆", "酒店房间", "白色影棚", "书店",
          "城市街头", "地铁站台", "商场中庭", "天台夜景", "海边沙滩", "森林小路", "草地", "雪地", "雨夜街道",
        ],
      },
      {
        slug: "environment-weather",
        name: "天气与时间",
        description: "天气、时段和环境气候。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["晴天", "阴天", "雨天", "雪天", "黄金时刻", "蓝调时刻", "夜景"],
      },
      {
        slug: "environment-lighting",
        name: "光线",
        description: "光源和质感。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["自然光", "窗边光", "侧光", "逆光", "侧逆光", "顶光", "柔光", "硬光", "漫射光", "霓虹光", "烛光"],
      },
    ],
  },
  {
    slug: "outfit",
    name: "穿着与外观",
    description: "服装、配饰、妆容和画面质感放在一起，减少来回跳转。",
    facets: [
      {
        slug: "outfit-clothes",
        name: "服装",
        description: "服装单品。",
        selectionMode: "multi",
        maxSelect: 4,
        keywords: [
          "白衬衫", "黑衬衫", "T恤", "针织衫", "卫衣", "西装外套", "风衣", "牛仔外套", "吊带", "背心",
          "连衣裙", "半身裙", "百褶裙", "牛仔裤", "阔腿裤", "西装裤", "黑丝", "白丝袜", "长筒袜", "高跟鞋", "长靴", "运动鞋",
        ],
      },
      {
        slug: "outfit-accessories",
        name: "配饰",
        description: "装饰性配件。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["耳环", "项链", "眼镜"],
      },
      {
        slug: "outfit-makeup",
        name: "妆容与发感",
        description: "妆面和附加发感。",
        selectionMode: "multi",
        maxSelect: 3,
        keywords: ["裸感底妆", "清透底妆", "红唇", "粉唇", "眼线", "长睫毛", "湿发"],
      },
      {
        slug: "outfit-finish",
        name: "质感",
        description: "成片质感与调色。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["高清肤质", "胶片颗粒", "低饱和", "冷灰调", "暖黄调"],
      },
    ],
  },
  {
    slug: "pose",
    name: "姿势与身体表现",
    description: "告诉模型人物在做什么，以及重点刻画哪里。",
    facets: [
      {
        slug: "pose-base",
        name: "姿势",
        description: "基础身体姿态。",
        selectionMode: "single",
        keywords: ["站立", "坐姿", "蹲姿", "行走", "靠墙"],
      },
      {
        slug: "pose-action",
        name: "动作",
        description: "补充动作细节。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["回头", "低头", "抬手", "整理头发", "抱臂", "双手插袋", "单手扶栏杆"],
      },
      {
        slug: "pose-gaze",
        name: "视线",
        description: "人物目光方向。",
        selectionMode: "single",
        keywords: ["看镜头", "看向远处"],
      },
      {
        slug: "pose-body-focus",
        name: "部位强调",
        description: "想让模型重点刻画的部位。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["面部", "眼神", "睫毛", "唇部", "牙齿", "锁骨", "肩颈", "腰线", "腿部线条", "手指", "发丝"],
      },
    ],
  },
  {
    slug: "camera",
    name: "拍摄方式",
    description: "把焦段、景别、机位、构图放在一块，更符合摄影表达。",
    facets: [
      {
        slug: "camera-focal",
        name: "焦段",
        description: "镜头焦段。",
        selectionMode: "single",
        keywords: ["24mm", "35mm", "50mm", "85mm", "135mm"],
      },
      {
        slug: "camera-lens-feel",
        name: "镜头感觉",
        description: "镜头整体感觉。",
        selectionMode: "single",
        keywords: ["广角", "标准镜头", "长焦"],
      },
      {
        slug: "camera-framing",
        name: "景别",
        description: "主体与镜头的远近。",
        selectionMode: "single",
        keywords: ["全身", "七分身", "半身", "近景", "面部特写", "局部特写"],
      },
      {
        slug: "camera-angle",
        name: "机位",
        description: "相机角度和高度。",
        selectionMode: "single",
        keywords: ["平视", "仰拍", "俯拍", "低机位", "高机位"],
      },
      {
        slug: "camera-composition",
        name: "构图",
        description: "画面组织方式。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["居中构图", "三分法", "对角线构图", "引导线", "框景", "前景遮挡", "留白", "横向构图", "竖向构图", "对称构图"],
      },
    ],
  },
  {
    slug: "style",
    name: "图片风格",
    description: "最后决定成片像照片、动漫还是插画。",
    facets: [
      {
        slug: "style-medium",
        name: "风格大类",
        description: "主风格。",
        selectionMode: "single",
        keywords: [
          "写实摄影", "电影写实", "商业广告", "日系写真", "韩系写真", "胶片摄影", "棚拍广告",
          "日漫风格", "美漫风格", "二次元插画", "国风插画", "扁平插画", "3D 渲染", "黏土风格", "像素风格",
        ],
      },
      {
        slug: "style-mood",
        name: "情绪与气质",
        description: "气质基调。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["冷淡", "温柔", "慵懒", "安静", "浪漫", "清冷", "明亮", "神秘", "干净", "松弛"],
      },
      {
        slug: "style-finish",
        name: "风格修饰",
        description: "局部风格强调。",
        selectionMode: "multi",
        maxSelect: 2,
        keywords: ["赛博霓虹", "胶片颗粒", "低饱和", "冷灰调", "暖黄调"],
      },
    ],
  },
  {
    slug: "output",
    name: "输出参数",
    description: "输出比例和清晰度参数，不再参与语义推理。",
    parameterGroup: true,
    facets: [
      {
        slug: "output-ratio",
        name: "比例",
        description: "输出画幅比例。",
        selectionMode: "single",
        keywords: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      },
      {
        slug: "output-resolution",
        name: "清晰度",
        description: "输出尺寸档位。",
        selectionMode: "single",
        keywords: ["1024", "1536", "2048"],
      },
    ],
  },
];

export const keywordGroupDescriptions = new Map(defaultKeywordGroups.map((group) => [group.slug, group.description]));

export const keywordFacetMeta = new Map(
  defaultKeywordGroups.flatMap((group) =>
    group.facets.map((facet) => [
      facet.slug,
      {
        groupSlug: group.slug,
        groupName: group.name,
        parameterGroup: Boolean(group.parameterGroup),
        ...facet,
      },
    ] as const),
  ),
);

export const keywordNameMeta = new Map(
  defaultKeywordGroups.flatMap((group) =>
    group.facets.flatMap((facet) => facet.keywords.map((keyword) => [keyword, { groupSlug: group.slug, facetSlug: facet.slug }] as const)),
  ),
);

export function flattenDefaultKeywords() {
  return defaultKeywordGroups.map((group) => ({
    ...group,
    keywords: group.facets.flatMap((facet) => facet.keywords),
  }));
}
