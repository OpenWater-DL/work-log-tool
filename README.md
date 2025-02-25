# 日报汇总统计小助手
上班每天写工作日报，每周汇总时都觉得麻烦，于是做了这个小工具帮助统计。  
左面板输入日报，右面板自动汇总统计，悬停可按按钮分类

[**跳转使用→**](https://openwater-dl.github.io/work-log-tool/)

![image](https://github.com/user-attachments/assets/17a818e9-ed0a-4f80-9186-272241860de7)

# 使用格式
```
>02-13
- 项目名称 1h
- 父项目名称 1h
  * 子项目
- 父项目也可以不带时间
  * 子项A 1h
  * 子项B 0.5h
 ```

# 注意
🔴 **至少需要包含一个日期**（否则统计面板会没有任何内容出现）  
🟦 由于父子项可能会出现很多种写法情况，例如：
```
- 父项 2h
  * 子项 1h
  * 子项 3h
```
父子项类型的条目，会比较 【子项目总时长】 与 【父项目时长】，取较大者。

# 分类
由于只是为了自用，分类只有四个：
- 核心
- 其他
- 协作
- 未完成
