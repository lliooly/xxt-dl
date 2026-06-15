# Cloud

负责云同步和云端 API client 的本地侧代码，例如用户绑定、题库同步、远端练习记录同步和数据删除请求。

这一层不能直接依赖 Playwright、Electron 或本地浏览器 profile；学习通登录态只应留在本地采集链路中。
