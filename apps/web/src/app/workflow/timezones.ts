/** 完整时区表（30+ UTC 偏移 / 80+ IANA 时区） */
interface TzEntry { iana: string; cn: string }
const TIMEZONES: Array<{ offset: number; label: string; zones: TzEntry[] }> = [
  { offset: -660, label: "UTC-11:00", zones: [
    { iana: "Pacific/Niue", cn: "纽埃时间" },
    { iana: "Pacific/Midway", cn: "萨摩亚标准时间" },
    { iana: "Pacific/Pago_Pago", cn: "萨摩亚标准时间" },
  ]},
  { offset: -600, label: "UTC-10:00", zones: [
    { iana: "America/Adak", cn: "阿达克时间" },
    { iana: "Pacific/Honolulu", cn: "夏威夷标准时间" },
  ]},
  { offset: -570, label: "UTC-09:30", zones: [
    { iana: "Pacific/Marquesas", cn: "马克萨斯时间" },
  ]},
  { offset: -540, label: "UTC-09:00", zones: [
    { iana: "America/Anchorage", cn: "阿拉斯加标准时间" },
    { iana: "Pacific/Gambier", cn: "甘比尔时间" },
  ]},
  { offset: -480, label: "UTC-08:00", zones: [
    { iana: "America/Los_Angeles", cn: "美国太平洋时间" },
    { iana: "America/Tijuana", cn: "下加利福尼亚时间" },
    { iana: "America/Vancouver", cn: "太平洋时间" },
  ]},
  { offset: -420, label: "UTC-07:00", zones: [
    { iana: "America/Denver", cn: "山地标准时间" },
    { iana: "America/Phoenix", cn: "山地标准时间" },
    { iana: "America/Edmonton", cn: "山地时间" },
  ]},
  { offset: -360, label: "UTC-06:00", zones: [
    { iana: "America/Chicago", cn: "美国中部时间" },
    { iana: "America/Mexico_City", cn: "墨西哥时间" },
  ]},
  { offset: -300, label: "UTC-05:00", zones: [
    { iana: "America/New_York", cn: "美国东部时间" },
    { iana: "America/Toronto", cn: "东部时间" },
  ]},
  { offset: -240, label: "UTC-04:00", zones: [
    { iana: "America/Halifax", cn: "大西洋时间" },
    { iana: "America/Santiago", cn: "智利时间" },
  ]},
  { offset: -180, label: "UTC-03:00", zones: [
    { iana: "America/Sao_Paulo", cn: "巴西利亚时间" },
    { iana: "America/Argentina/Buenos_Aires", cn: "阿根廷时间" },
  ]},
  { offset: -150, label: "UTC-02:30", zones: [
    { iana: "America/St_Johns", cn: "纽芬兰时间" },
  ]},
  { offset: -120, label: "UTC-02:00", zones: [
    { iana: "Atlantic/South_Georgia", cn: "南乔治亚时间" },
  ]},
  { offset: -60, label: "UTC-01:00", zones: [
    { iana: "Atlantic/Azores", cn: "亚速尔时间" },
    { iana: "Atlantic/Cape_Verde", cn: "佛得角时间" },
  ]},
  { offset: 0, label: "UTC+00:00", zones: [
    { iana: "Europe/London", cn: "格林威治标准时间" },
    { iana: "Atlantic/Reykjavik", cn: "冰岛时间" },
    { iana: "Africa/Casablanca", cn: "卡萨布兰卡时间" },
  ]},
  { offset: 60, label: "UTC+01:00", zones: [
    { iana: "Europe/Paris", cn: "中欧标准时间" },
    { iana: "Europe/Berlin", cn: "中欧时间" },
    { iana: "Africa/Lagos", cn: "西非时间" },
  ]},
  { offset: 120, label: "UTC+02:00", zones: [
    { iana: "Europe/Athens", cn: "东欧时间" },
    { iana: "Africa/Cairo", cn: "东欧时间" },
    { iana: "Europe/Helsinki", cn: "东欧时间" },
    { iana: "Asia/Jerusalem", cn: "以色列标准时间" },
  ]},
  { offset: 180, label: "UTC+03:00", zones: [
    { iana: "Europe/Moscow", cn: "莫斯科标准时间" },
    { iana: "Asia/Riyadh", cn: "阿拉伯标准时间" },
    { iana: "Africa/Nairobi", cn: "东非时间" },
    { iana: "Europe/Istanbul", cn: "土耳其时间" },
  ]},
  { offset: 210, label: "UTC+03:30", zones: [
    { iana: "Asia/Tehran", cn: "伊朗标准时间" },
  ]},
  { offset: 240, label: "UTC+04:00", zones: [
    { iana: "Asia/Dubai", cn: "海湾标准时间" },
    { iana: "Asia/Baku", cn: "阿塞拜疆时间" },
  ]},
  { offset: 270, label: "UTC+04:30", zones: [
    { iana: "Asia/Kabul", cn: "阿富汗时间" },
  ]},
  { offset: 300, label: "UTC+05:00", zones: [
    { iana: "Asia/Karachi", cn: "巴基斯坦标准时间" },
    { iana: "Asia/Tashkent", cn: "乌兹别克斯坦时间" },
  ]},
  { offset: 330, label: "UTC+05:30", zones: [
    { iana: "Asia/Kolkata", cn: "印度标准时间" },
    { iana: "Asia/Colombo", cn: "斯里兰卡时间" },
  ]},
  { offset: 345, label: "UTC+05:45", zones: [
    { iana: "Asia/Kathmandu", cn: "尼泊尔时间" },
  ]},
  { offset: 360, label: "UTC+06:00", zones: [
    { iana: "Asia/Dhaka", cn: "孟加拉标准时间" },
    { iana: "Asia/Almaty", cn: "哈萨克斯坦时间" },
  ]},
  { offset: 390, label: "UTC+06:30", zones: [
    { iana: "Asia/Yangon", cn: "缅甸时间" },
  ]},
  { offset: 420, label: "UTC+07:00", zones: [
    { iana: "Asia/Bangkok", cn: "印度支那时间" },
    { iana: "Asia/Jakarta", cn: "西部印尼时间" },
    { iana: "Asia/Ho_Chi_Minh", cn: "印度支那时间" },
  ]},
  { offset: 480, label: "UTC+08:00", zones: [
    { iana: "Asia/Shanghai", cn: "中国标准时间" },
    { iana: "Asia/Hong_Kong", cn: "香港标准时间" },
    { iana: "Asia/Taipei", cn: "台北标准时间" },
    { iana: "Asia/Singapore", cn: "新加坡标准时间" },
    { iana: "Australia/Perth", cn: "澳大利亚西部时间" },
  ]},
  { offset: 525, label: "UTC+08:45", zones: [
    { iana: "Australia/Eucla", cn: "中西部标准时间" },
  ]},
  { offset: 540, label: "UTC+09:00", zones: [
    { iana: "Asia/Tokyo", cn: "日本标准时间" },
    { iana: "Asia/Seoul", cn: "韩国标准时间" },
  ]},
  { offset: 570, label: "UTC+09:30", zones: [
    { iana: "Australia/Adelaide", cn: "中澳大利亚标准时间" },
  ]},
  { offset: 600, label: "UTC+10:00", zones: [
    { iana: "Australia/Sydney", cn: "澳大利亚东部时间" },
    { iana: "Pacific/Guam", cn: "关岛标准时间" },
  ]},
  { offset: 630, label: "UTC+10:30", zones: [
    { iana: "Australia/Lord_Howe", cn: "豪勋爵岛标准时间" },
  ]},
  { offset: 660, label: "UTC+11:00", zones: [
    { iana: "Pacific/Port_Moresby", cn: "巴布亚新几内亚时间" },
    { iana: "Pacific/Noumea", cn: "新喀里多尼亚时间" },
  ]},
  { offset: 720, label: "UTC+12:00", zones: [
    { iana: "Pacific/Auckland", cn: "新西兰标准时间" },
    { iana: "Pacific/Fiji", cn: "斐济时间" },
  ]},
  { offset: 765, label: "UTC+12:45", zones: [
    { iana: "Pacific/Chatham", cn: "查塔姆标准时间" },
  ]},
  { offset: 780, label: "UTC+13:00", zones: [
    { iana: "Pacific/Tongatapu", cn: "汤加时间" },
  ]},
  { offset: 840, label: "UTC+14:00", zones: [
    { iana: "Pacific/Kiritimati", cn: "莱恩群岛时间" },
  ]},
];

export { TIMEZONES };

/** 从 IANA 找所在偏移 */
export function findOffset(iana: string): number {
  for (const g of TIMEZONES) {
    if (g.zones.some((z) => z.iana === iana)) return g.offset;
  }
  return 480;
}

/** 当前时区显示名 */
export function tzLabel(iana: string): string {
  for (const g of TIMEZONES) {
    for (const z of g.zones) {
      if (z.iana === iana) return `${z.cn} - ${z.iana}`;
    }
  }
  return iana;
}
