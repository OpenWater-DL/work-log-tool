import { animate } from "motion";

const worklogTextarea = document.getElementById('worklog');
const totalTimeSpan = document.querySelector('.total-time span');
const projectStats = document.querySelector('.project-stats');

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

    // 创建一个映射来存储现有条目的分类信息
    const existingTypeMap = new Map();
    existingEntries.forEach(entry => {
        if (entry.type) {
            existingTypeMap.set(`${entry.date}-${entry.project}`, entry.type);
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
        } else if (trimmedLine.startsWith('-')) {
            const timeMatch = trimmedLine.substring(1).match(/(.+?)\s*(\d+(?:\.\d+)?h?)\s*$/);
            if (timeMatch && currentEntry.date) {
                const [, project, hours] = timeMatch;
                // 检查是否存在相同条目的分类信息
                const existingType = existingTypeMap.get(`${currentEntry.date}-${project}`);
                entries.push({
                    date: currentEntry.date,
                    project: project,
                    hours: parseFloat(hours),
                    type: existingType || null // 使用现有分类或默认为null
                });
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

    for (const entry of entries) {
        if (!entry.hours || !entry.project) continue;
        
        stats.total += entry.hours;
        const typeKey = entry.type || 'unclassified';
        const typeStats = stats.types[typeKey];
        
        typeStats.total += entry.hours;
        if (!typeStats.projects[entry.project]) {
            typeStats.projects[entry.project] = 0;
        }
        typeStats.projects[entry.project] += entry.hours;
    }

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
    Object.entries(stats.types).forEach(([type, typeStats]) => {
        if (Object.keys(typeStats.projects).length === 0) return;

        const typeContainer = document.createElement('div');
        typeContainer.className = 'type-container';
        
        const typeHeader = document.createElement('div');
        typeHeader.className = 'type-header';
        typeHeader.textContent = `${type === 'unclassified' ? '未分类' : type} - ${Number.isInteger(typeStats.total) ? typeStats.total.toString() : typeStats.total.toFixed(1)} h`;
        typeContainer.appendChild(typeHeader);

        Object.entries(typeStats.projects).forEach(([project, hours]) => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            const projectContent = document.createElement('div');
            projectContent.className = 'project-content';
            projectContent.textContent = `- ${project} (${Number.isInteger(hours) ? hours.toString() : hours.toFixed(1)})`;
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
