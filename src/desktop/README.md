# Desktop

负责 Electron 主进程、preload、桌面任务调度和 GUI 与后台能力之间的桥接。

桌面端应尽量调用模块 API，不直接包含采集、解析、题库或练习的具体业务实现。
