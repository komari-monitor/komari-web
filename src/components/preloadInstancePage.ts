/**
 * 预取详情页 chunk：悬停/聚焦节点卡片或表格行时就开始下载。
 * 共享元素过渡要等新页面挂上标题才能拍「新快照」，chunk 已在缓存里时这段等待几乎为零。
 * 单独成文件：组件文件只导出组件，保持 React Fast Refresh 可用。
 */
export const preloadInstancePage = () => {
  void import("../pages/instance");
};
