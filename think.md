1. 解析文本，得到 cE = currentEntries

```js
cE : [
    {  date: 2/20,
       project: '呼吸2.0', 
        hours:2,
        type: null,
        parentProject: null
},{...}]

```

2. 计算状态 calculateStats(cE)
    - stats 统计情况，按分类创建
        {
            core:{total:0,projects:{项目Object}}
        }
    - 状态是否正确 
        - 发现子任务也被计算进普通的项目中了，此处有可能有问题

        parentProjectData 是个 Map()
        

3. updateStats(stats) => 显示在右边
    - 按分类检查（stats.types.forEach)
        - 在单个类型下： 检查所有Projects
        - 发现 project里的hours.sub 并没有如预期出现