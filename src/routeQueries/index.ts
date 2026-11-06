/**
 * 汇总各页面的数据预取登记（副作用导入）。新增页面时在对应分组文件里 registerRouteData，
 * 页面组件从同一个分组文件导入 RouteQuery，传给 useRouteQuery。
 * 分组文件只允许依赖 @/lib/http、@/lib/rpc2、@/lib/routeData、@/lib/routeRegistry 和类型/小工具，
 * 不要导入页面组件或 React：这里会进入首屏包。
 */
import "./admin";
import "./dashboard";
import "./ops";
import "./settings";
import "./appearance";
import "./system";
