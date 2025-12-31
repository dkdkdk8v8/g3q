import { Inject, Logger, Provide } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import * as moment from 'moment';
import { Scope, ScopeEnum } from '@midwayjs/core';
import * as net from 'net';
import { ILogger } from '@midwayjs/logger';

/**
 * 帮助类
 */
@Scope(ScopeEnum.Request, { allowDowngrade: true })
@Provide()
export class Utils {
  @Inject()
  baseDir;

  @Logger()
  logger: ILogger;

  /**
   * 获得请求IP
   */
  async getReqIP(ctx: Context) {
    const req = ctx.req;
    return (
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress.replace('::ffff:', '')
    );
  }

  /**
   * 去除对象的空值属性
   * @param obj
   */
  async removeEmptyP(obj) {
    Object.keys(obj).forEach(key => {
      if (obj[key] === null || obj[key] === '' || obj[key] === 'undefined') {
        delete obj[key];
      }
    });
  }

  /**
   * 线程阻塞毫秒数
   * @param ms
   */
  sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取当前时间是星期几（星期一 = 1，星期日 = 7）
   */
  getDayInWeek() {
    // 获取当前时间是星期几（星期日 = 0，星期六 = 6）, day()不受本地化影响
    let day = moment().day();
    if (day == 0) day = 7;
    return day;
  }

  /**
   * 全局替换json中的字符串
   * @param json
   * @param target
   * @param replacement
   * @returns
   */
  replaceInJson(json: any, target: string, replacement: string): any {
    if (typeof json === 'string') {
      return json.replace(new RegExp(target, 'g'), replacement);
    } else if (Array.isArray(json)) {
      json.forEach((item, index) => {
        json[index] = this.replaceInJson(item, target, replacement);
      });
    } else if (typeof json === 'object' && json !== null) {
      Object.entries(json).forEach(([key, value]) => {
        json[key] = this.replaceInJson(value, target, replacement);
      });
    }
    return json;
  }

  /**
   * 拼接host和path形成完整访问路径
   * @param host
   * @param path
   */
  joinHostAndPath(host: string, path: string): string {
    host = host.trim();
    host = host.endsWith('/') ? host.slice(0, -1) : host; // host去末尾斜杠
    path = path.startsWith('/') ? path.slice(1) : path; // path去开头斜杠
    return `${host}/${path}`;
  }

  /**
   * 获取 URL 的路径和查询参数
   * @param url 输入的 URL 字符串
   * @param withSlash 是否已斜杠开头，默认带斜杠
   * @returns 包含路径和查询参数的字符串
   */
  getPathAndSearch(url: string, withSlash = true): string {
    let result = url;
    try {
      const parsedUrl = new URL(url);
      result = parsedUrl.pathname + parsedUrl.search;
    } catch (error) {}
    // 带斜杠
    if (withSlash && !result.startsWith('/')) {
      result = `/${result}`;
    }
    // 不带斜杠
    if (!withSlash && result.startsWith('/')) {
      result = result.substring(1);
    }
    return this.decodePath(result);
  }

  getOrigin(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.origin;
    } catch (error) {
      this.logger.error(error);
      return '';
    }
  }

  decodePath(path: string): string {
    try {
      return decodeURIComponent(path);
    } catch (error) {
      this.logger.error(`${path}解码失败:`, error?.message);
      return path;
    }
  }

  isIPv4(ip: string): boolean {
    return net.isIP(ip) === 4;
  }

  getMinuteMark(duration = 5): Date {
    const now = moment();
    const rounded = moment(now)
      .minutes(Math.floor(now.minutes() / duration) * duration)
      .seconds(0)
      .milliseconds(0);
    return rounded.toDate();
  }

  getRandomItem<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    const index = Math.floor(Math.random() * arr.length);
    return arr[index];
  }

  getRandomInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }

  getTimePointsOfDay(intervalMinutes: number): string[] {
    const result: string[] = [];
    const totalMinutesInDay = 24 * 60;
    for (
      let minutes = 0;
      minutes < totalMinutesInDay;
      minutes += intervalMinutes
    ) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      result.push(timeStr);
    }
    return result;
  }

  getTimePoint(date: Date, intervalMinutes: number): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // 取整到最近的间隔点（向下）
    const roundedMinutes =
      Math.floor(minutes / intervalMinutes) * intervalMinutes;
    const hh = String(hours).padStart(2, '0');
    const mm = String(roundedMinutes).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
