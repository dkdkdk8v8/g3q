import * as evilPlugin from './evilPlugin';
import { BaseUpload, MODETYPE } from './upload';
type AnyString = string & {};
/**
 * 插件类型声明
 */
interface PluginMap {
  upload: BaseUpload;
  evilPlugin: evilPlugin.CoolPlugin;
}
