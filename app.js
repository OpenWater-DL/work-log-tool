import { animate } from "motion";

const worklogTextarea = document.getElementById('worklog');
const totalTimeSpan = document.querySelector('.total-time span');
const projectStats = document.querySelector('.project-stats');

// 设置textarea的tab键行为
worklogTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = worklogTextarea.selectionStart;
        const end = worklogTextarea.selectionEnd;
        const value = worklogTextarea.value;
        worklogTextarea.value = value.substring(0, start) + '    ' + value.substring(end);
        worklogTextarea.selectionStart = worklogTextarea.selectionEnd = start + 4;
    }
});

// 任务类型定义
const TASK_TYPES = {
    CORE: '核心',
    OTHER: '其他',
    COMMUNICATION: '协作',
    PROCESS: '未完成'
};

// 解析工作日志文本
function parseWorklog(text, existingEntries = []) {
    const entries = [];
    const lines = text.trim().split('\n');
    let currentEntry = {};
    let currentParentProject = null;

    // 创建一个映射来存储现有条目的分类信息
    const existingTypeMap = new Map();
    existingEntries.forEach(entry => {
        if (entry.type) {
            // 使用项目名称作为键，这样即使日期变化也能保持类型
            existingTypeMap.set(entry.project, entry.type);
        }
    });

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('>')) {
            if (Object.keys(currentEntry).length > 0) {
                entries.push(currentEntry);
                currentEntry = {};
            }
            currentEntry.date = trimmedLine.substring(1).trim();
            currentParentProject = null;
        } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
            const timeMatch = trimmedLine.substring(1).match(/(.+?)(?:\s*(\d+(?:\.\d+)?h?)\s*)?$/);  // 修改正则表达式以使时间部分可选
            if (timeMatch && currentEntry.date) {
                const [, project, hours] = timeMatch;
                const trimmedProject = project.trim();
                // 检查是否存在相同项目的分类信息
                const existingType = existingTypeMap.get(trimmedProject);

                // 根据行首符号判断是否为子任务
                if (trimmedLine.startsWith('-')) {
                    currentParentProject = trimmedProject;
                    entries.push({
                        date: currentEntry.date,
                        project: trimmedProject,
                        hours: hours ? parseFloat(hours) : 0,
                        type: existingType || null,
                        parentProject: null
                    });
                } else if (trimmedLine.startsWith('*') && currentParentProject) {
                    entries.push({
                        date: currentEntry.date,
                        project: trimmedProject,
                        hours: hours ? parseFloat(hours) : 0,
                        type: existingType || null,
                        parentProject: currentParentProject
                    });
                }
            }
        }
    }

    return entries;
}

// 计算统计数据
function calculateStats(entries) {
    const stats = {
        total: 0,
        types: {
            [TASK_TYPES.CORE]: { total: 0, projects: {} },
            [TASK_TYPES.OTHER]: { total: 0, projects: {} },
            [TASK_TYPES.COMMUNICATION]: { total: 0, projects: {} },
            [TASK_TYPES.PROCESS]: { total: 0, projects: {} },
            unclassified: { total: 0, projects: {} }
        }
    };

    // 创建一个映射来存储父项目的子任务时间和子任务列表
    const parentProjectData = new Map();

    for (const entry of entries) {
        // 把所有不是子项目的任务都视为父项目   
        if (!entry.parentProject) {
            parentProjectData.set(entry.project, {
                totalHours: entry.hours,
                subTasks: [],
                type: entry.type
            });
        }
    }

    // 把子项目放进父项目中
    for (const entry of entries) {
        if (entry.parentProject) {
            // 从父map中获得该父项目记录
            const thisParent = parentProjectData.get(entry.parentProject);
            thisParent.totalHours += entry.hours;
            thisParent.subTasks.push(entry);
        }
    }

    // 然后处理所有任务的时间统计
    for (const [project, pjData] of parentProjectData) {
        const type = pjData.type || 'unclassified';
        const typeStats = stats.types[type];
        
        // 将该任务总时长加入类型总计
        typeStats.total += pjData.totalHours;
        
        // 将父项目数据添加到对应类型的projects中
        typeStats.projects[project] = {
            mainHours: pjData.totalHours || 0,
            subTaskHours: pjData.totalHours - (pjData.hours || 0),
            subTasks: pjData.subTasks
        };
        
        // 将该任务总时长加入总计
        stats.total += pjData.totalHours;
    }
    console.log('stats')
    console.log(stats)

    return stats;
}

// 创建类型选择按钮
function createTypeButtons(project, entries) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'type-buttons';
    buttonsContainer.style.display = 'none';

    Object.values(TASK_TYPES).forEach(type => {
        const button = document.createElement('button');
        button.textContent = type;
        button.className = 'type-button';
        button.onclick = (e) => {
            e.stopPropagation();
            entries.forEach(entry => {
                if (entry.project === project) {
                    entry.type = type;
                }
            });
            updateStats(calculateStats(entries));
        };
        buttonsContainer.appendChild(button);
    });

    return buttonsContainer;
}

// 更新统计显示
function updateStats(stats) {
    // 更新总时间
    totalTimeSpan.textContent = Number.isInteger(stats.total) ? stats.total.toString() : stats.total.toFixed(1);

    // 更新项目统计
    projectStats.innerHTML = '';

    // 创建类型分组
    // 遍历所有任务类型（核心、其他、协作等）及其统计数据
    Object.entries(stats.types).forEach(([type, typeStats]) => {
        // console.log(`type:${type}`)
        // console.log(typeStats)
        // 如果该类型下没有任何项目，则跳过
        if (Object.keys(typeStats.projects).length === 0) return;

        // 创建一个容器来存放该类型的所有项目
        const typeContainer = document.createElement('div');
        typeContainer.className = 'type-container';

        // 创建类型标题，显示类型名称和总时长
        //<div class="type-header">核心交付</div>
        const typeHeader = document.createElement('div');
        typeHeader.className = 'type-header';
        typeHeader.textContent = `${type === 'unclassified' ? '未分类' : type} - ${Number.isInteger(typeStats.total) ? typeStats.total.toString() : typeStats.total.toFixed(1)} h`;
        typeContainer.appendChild(typeHeader);

        // 遍历该类型下的所有项目
        Object.entries(typeStats.projects).forEach(([project, hours]) => {
            // console.log(project)
            // console.log(hours)
            // 创建项目容器
            /*<div class="project-item">
                <div class="project-content">
                ...
                </div>
            </div>*/
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            const projectContent = document.createElement('div');
            projectContent.className = 'project-content';

            // 判断是否为父任务（带有子任务的项目）
            if (typeof hours === 'object' && hours.subTasks) {
                // 显示父任务信息，包括项目名、主任务时长和子任务总计时长
                projectContent.textContent = `- ${project} (${Number.isInteger(hours.mainHours) ? hours.mainHours.toString() : hours.mainHours.toFixed(1)}h, 子任务总计: ${Number.isInteger(hours.subTaskHours) ? hours.subTaskHours.toString() : hours.subTaskHours.toFixed(1)}h)`;
                projectItem.appendChild(projectContent);

                // 为父任务添加类型选择按钮
                const typeButtons = createTypeButtons(project, currentEntries);
                projectItem.appendChild(typeButtons);

                // 添加鼠标事件
                projectItem.addEventListener('mouseenter', () => {
                    typeButtons.style.display = 'flex';
                });
                projectItem.addEventListener('mouseleave', () => {
                    typeButtons.style.display = 'none';
                });

                typeContainer.appendChild(projectItem);

                // 遍历并显示该父任务下的所有子任务
                hours.subTasks.forEach(subTask => {
                    // 创建子任务容器
                    const subTaskItem = document.createElement('div');
                    subTaskItem.className = 'project-item sub-task';
                    const subTaskContent = document.createElement('div');
                    subTaskContent.className = 'project-content';
                    // 显示子任务信息，包括名称和时长
                    subTaskContent.textContent = `    * ${subTask.project} (${Number.isInteger(subTask.hours) ? subTask.hours.toString() : subTask.hours.toFixed(1)}h)`;
                    subTaskContent.style.color = '#2196F3';
                    subTaskItem.appendChild(subTaskContent);
                    typeContainer.appendChild(subTaskItem);
                });
            } else {
                // 独立任务显示
                projectContent.textContent = `- ${project} (${Number.isInteger(hours) ? hours.toString() : hours.toFixed(1)}h)`;
                projectItem.appendChild(projectContent);

                // 添加类型选择按钮
                const typeButtons = createTypeButtons(project, currentEntries);
                projectItem.appendChild(typeButtons);

                // 添加鼠标事件
                projectItem.addEventListener('mouseenter', () => {
                    typeButtons.style.display = 'flex';
                });
                projectItem.addEventListener('mouseleave', () => {
                    typeButtons.style.display = 'none';
                });

                typeContainer.appendChild(projectItem);
            }
        });

        projectStats.appendChild(typeContainer);
    });
}

// 保存当前数据用于状态管理
let currentEntries = [];

// 监听输入变化
worklogTextarea.addEventListener('input', (e) => {
    const text = e.target.value;
    currentEntries = parseWorklog(text, currentEntries);
    const stats = calculateStats(currentEntries);
    updateStats(stats);
});
