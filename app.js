import { animate } from "motion";

const worklogTextarea = document.getElementById('worklog');
const totalTimeSpan = document.querySelector('.total-time');
const projectStats = document.querySelector('.project-stats');


// 工具函数，用来生成项目ID
function generateProjectId(project, date) {
    return `${project}_${date}`;
}


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
// 在 parseWorklog 函数中添加日期集合
function parseWorklog(text, existingEntries = []) {
    const entries = [];
    const lines = text.trim().split('\n');
    let currentEntry = { date: null };
    let currentParentProject = null;
    const dates = new Set();  // 用于存储不重复的日期

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
            // 更新当前条目的日期
            currentEntry.date = trimmedLine.substring(1).trim();
            dates.add(currentEntry.date);  // 添加日期到集合
            currentParentProject = null;
        } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
            if (!currentEntry.date) continue; // 如果没有日期，跳过该行

            const timeMatch = trimmedLine.substring(1).match(/(.+?)(?:\s*(\d+(?:\.\d+)?h?)\s*)?$/);  // 修改正则表达式以使时间部分可选
            if (timeMatch) {
                const [, project, hours] = timeMatch;
                const trimmedProject = project.trim();
                // 检查是否存在相同项目的分类信息
                const existingType = existingTypeMap.get(trimmedProject);

                // 根据行首符号判断是否为子任务
                if (trimmedLine.startsWith('-')) {
                    currentParentProject = {
                        name: trimmedProject,
                        id: generateProjectId(trimmedProject, currentEntry.date)
                    };//此处的current指的是遍历情况中，当下标记的父任务
                    entries.push({
                        date: currentEntry.date,
                        project: trimmedProject,
                        hours: hours ? parseFloat(hours) : 0,
                        type: existingType || null,
                        parentProject: null,
                        projectId: currentParentProject.id  // 添加项目ID
                    });
                } else if (trimmedLine.startsWith('*') && currentParentProject) {
                    entries.push({
                        date: currentEntry.date,
                        project: trimmedProject,
                        hours: hours ? parseFloat(hours) : 0,
                        type: existingType || null,
                        parentProject: currentParentProject,
                        parentProjectId: currentParentProject.id  // 使用父项目的ID
                    });
                }
            }
        }
    }

    // 更新日期显示
    const daysCount = dates.size;
    document.querySelector('.section-num .num').textContent = daysCount;

    return entries;
}

// 计算统计数据
function calculateStats(entries) {

    // 【预处理每个父任务entry的采用时间】
    /* 针对的情况是:
    - 项目A 2h （父有子无）
        * 子项
    - 项目A （父无子有）
        * 子项 3h
        * 子项 1h
    - 项目A 3h （父子都有，看谁大用谁）
        * 子项 1h
        * 子项 4h
    ---
    得到一个 新的entries： valid_entries：
    [{
        date: currentEntry.date, 不变
        project:项目名,
        hours: 有效值, //主要是更新这个
        type: 不变,
        parentProject: currentParentProject 不变
        },...]
    */

    // 知道父子关系
    function handleParentEntryTime(entries) {
        // 目的：定义每个父项目的有效时间，得到一个新的有效entries。做时间统计时使用有效时间。

        let valid_entries = [];

        // 获取所有没有父任务的条目
        const tasksWithoutParent = entries.filter(entry => !entry.parentProject);

        // 区分独立任务和父任务
        const independentTasks = tasksWithoutParent.filter(task => {
            // 检查是否有子任务指向这个任务
            return !entries.some(entry =>
                entry.parentProject && entry.parentProjectId === task.projectId
            );
        });

        const parentTasks = tasksWithoutParent.filter(task => {
            // 检查是否有子任务指向这个任务
            return entries.some(entry =>
                entry.parentProject && entry.parentProjectId === task.projectId
            );
        });

       
            for (let idpTask of independentTasks) {
                idpTask.finalTime = idpTask.hours;
                valid_entries.push(idpTask);
            }
        



        for (let parent of parentTasks) {
            // 获取当前父任务的所有子任务
            const childEntries = entries.filter(entry =>
                entry.parentProject && entry.parentProjectId === parent.projectId
            );

            // 计算子任务时间总和
            const childrenTotalTime = childEntries.reduce((sum, child) =>
                sum + (child.hours || 0), 0
            );

            // 比较原时间与子任务时间。
            parent.subTaskTime = childrenTotalTime;
            if (parent.hours > parent.subTaskTime) {
                parent.finalTime = parent.hours;
            } else {
                parent.finalTime = parent.subTaskTime;
            }

            valid_entries.push(parent);

        }

        // 把子任务也加入到valid_entries中
        for (let parent of parentTasks) {
            const childEntries = entries.filter(entry =>
                entry.parentProject && entry.parentProjectId === parent.projectId
            );
            // 将子任务添加到valid_entries
            for (let child of childEntries) {
                child.finalTime = child.hours || 0;
                valid_entries.push(child);
            }
        }

        return valid_entries;

    }

    entries = handleParentEntryTime(entries);



    const stats = {
        total: 0,
        types: {
            [TASK_TYPES.CORE]: { total: 0, projects: {} },
            [TASK_TYPES.OTHER]: { total: 0, projects: {} },
            [TASK_TYPES.COMMUNICATION]: { total: 0, projects: {} },
            [TASK_TYPES.PROCESS]: { total: 0, projects: {} }
        }
    };

    // 创建一个映射来存储父项目的子任务时间和子任务列表
    const parentProjectData = new Map();

    // 首先收集所有父任务，并累加同名父任务的时间
    const parentProjectTimes = new Map(); // 用于临时存储父任务的累计时间
    const parentProjectTypes = new Map(); // 用于存储父任务的类型（使用最后一个出现的类型）

    // 多次出现同名任务情况处理，处理时间累加和类型更新
    for (const entry of entries) {
        if (!entry.parentProject) {
            // 累加同名父任务的时间。使用项目名称作为Map键，如果已经存在同名项目，get() 会返回之前累加的值
            const currentTotal = parentProjectTimes.get(entry.project) || 0;
            parentProjectTimes.set(entry.project, currentTotal + (entry.finalTime || 0));
            // 更新类型（使用最后一个出现的类型）
            if (entry.type) {
                parentProjectTypes.set(entry.project, entry.type);
            }
        }
    }

    // parentProjectTimes是已经合并同名、统计过的项目时间，键值对进行遍历，为每个父项目创建数据结构
    for (const [project, selfTotalTime] of parentProjectTimes) {

        // 父项目初始化
        parentProjectData.set(project, {
            finalTime: selfTotalTime, // 最终显示时间
            // parentTime: selfTotalTime,//父任务总时长
            subTaskTime: 0, // 子任务总时长
            subTasks: [], //子任务列表
            type: parentProjectTypes.get(project) || null
        });
    }

    // 把子项目放进父项目中,统计子项目时长之和
    for (const entry of entries) {
        if (entry.parentProject) {
            // 使用父项目的名称作为键
            const thisParent = parentProjectData.get(entry.parentProject.name);
            if (thisParent) {  // 确保找到了父项目
                if (entry.hours) {  // 只有当子任务有时长时才加入总计
                    thisParent.subTaskTime += entry.hours;
                }
                thisParent.subTasks.push(entry);
            }
        }
    }

    // 把parentProjectData中的数据整合到 stats 中
    for (const [project, pjData] of parentProjectData) {
        const type = pjData.type || TASK_TYPES.PROCESS;
        const typeStats = stats.types[type];

        // 将父项目数据添加到对应类型的projects中
        typeStats.projects[project] = {
            projectObj: parentProjectData.get(project),
            finalTime: pjData.finalTime,
            subTaskHours: pjData.subTaskTime,
            subTasks: pjData.subTasks
        };

        // 将最终时间加入类型总计和总计
        typeStats.total += pjData.finalTime;
        stats.total += pjData.finalTime;
    }

    return stats;
}

// 创建类型选择按钮
function createTypeButtons(project, entries) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'type-buttons';
    buttonsContainer.style.display = 'none';

    // 过滤掉当前任务所属的分类类型，只显示其他可选类型的按钮
    Object.values(TASK_TYPES).filter(type => {
        // 查找当前项目的类型，如果未分类则视为"未完成"
        const currentType = entries.find(entry => entry.project === project)?.type || TASK_TYPES.PROCESS;
        return type !== currentType;
    }).forEach(type => {
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
    // 检查文本框是否为空或只包含空白字符
    const worklogContent = worklogTextarea.value.trim();
    if (!worklogContent) {
        // 更新总时间为0
        totalTimeSpan.textContent = '0';
        // 清空统计面板
        projectStats.innerHTML = '';
        // 显示暂无输入的占位符
        const placeholder = document.createElement('div');
        placeholder.className = 'stats-placeholder';
        placeholder.textContent = '暂无输入';
        projectStats.appendChild(placeholder);
        return;
    }

    // 隐藏暂无输入的占位符
    if (document.querySelector('.stats-placeholder')) {

        document.querySelector('.stats-placeholder').style.display = 'none';
    }

    // 更新总时间
    totalTimeSpan.textContent = Number.isInteger(stats.total) ? stats.total.toString() : stats.total.toFixed(1);

    // 更新项目统计
    projectStats.innerHTML = '';

    // 检查是否有任何项目数据
    const hasProjects = Object.values(stats.types).some(typeStats => {
        const projectCount = Object.keys(typeStats.projects).length;
        return projectCount > 0;
    });

    if (!hasProjects) {
        const placeholder = document.createElement('div');
        placeholder.className = 'stats-placeholder';
        placeholder.textContent = '暂无输入';
        projectStats.appendChild(placeholder);
        return;
    }

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
        typeHeader.textContent = `[ ${type === 'unclassified' ? '未分类' : type} - ${Number.isInteger(typeStats.total) ? typeStats.total.toString() : typeStats.total.toFixed(1)} ]`;
        typeContainer.appendChild(typeHeader);

        // 遍历该类型下的所有项目
        Object.entries(typeStats.projects).forEach(i => {
           
            // const thisPj = i[1].projectObj;
            const project = i[0];
            const pj_ofTypeStats = i[1];
            console.log(pj_ofTypeStats)
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
            if (pj_ofTypeStats.subTasks.length > 0) {
                // 格式化时间显示
                const formatTime = (time) => {
                    if (time === undefined || time === null || time === 0) return '';
                    return Number.isInteger(time) ? time.toString() : time.toFixed(1);
                };

                // 构建显示文本
                let displayText = `- ${project}`;

                // 添加主任务时间和子任务时间
                const mainTime = formatTime(pj_ofTypeStats.finalTime);
                // const subTime = formatTime(pj_ofTypeStats.subTaskHours);

                displayText += ` (${mainTime})` ;
      
                projectContent.textContent = displayText;
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
                pj_ofTypeStats.subTasks.forEach(subTask => {
                    const subTaskItem = document.createElement('div');
                    subTaskItem.className = 'project-item sub-task';
                    const subTaskContent = document.createElement('div');
                    subTaskContent.className = 'project-content';
                    
                    // 显示子任务信息，包括名称和时长
                    const timeText = subTask.hours ? ` (${formatTime(subTask.hours)})` : '';
                    subTaskContent.textContent = `    * ${subTask.project}${timeText}`;
                    
                    subTaskItem.appendChild(subTaskContent);
                    typeContainer.appendChild(subTaskItem);
                });
            } else {
                // 独立任务显示
                const formatTime = (time) => {
                    if (time === undefined || time === null || time === 0) return '';
                    return Number.isInteger(time) ? time.toString() : time.toFixed(1);
                };

                // 使用正确的属性访问时间
                const timeText = formatTime(pj_ofTypeStats.finalTime);
                let displayText = `- ${project}`;
                if (timeText) {
                    displayText += ` (${timeText})`;
                }

                projectContent.textContent = displayText;
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

// 页面加载完成后立即执行一次统计和显示
document.addEventListener('DOMContentLoaded', () => {
    const text = worklogTextarea.value;
    currentEntries = parseWorklog(text, currentEntries);
    const stats = calculateStats(currentEntries);
    updateStats(stats);
});

const editor = document.querySelector('#worklog');
editor.addEventListener('input', () => {
    // 重置高度为 auto，以便重新计算
    editor.style.height = 'auto';
    // 设置高度为 scrollHeight（内容的高度）
    editor.style.height = `${editor.scrollHeight}px`;

    // 获取父容器
    const areaL = document.querySelector('.area-l');
    // 获取光标位置相对于视窗的位置
    const cursorPosition = editor.getBoundingClientRect().bottom;


    // 获取视窗高度
    const viewportHeight = window.innerHeight;

    // 如果光标位置超过视窗高度的80%，则滚动父容器
    if (cursorPosition > viewportHeight * 0.8) {
        const scrollAmount = cursorPosition - viewportHeight * 0.8; // 滚动到视窗60%的位置
        areaL.scrollTop += scrollAmount;
    }


});
