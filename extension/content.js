(function() {
    'use strict';

    const CONTAINER_ID = 'niit-oj-extension-nav-btns';

    function log(msg) {
        console.log(`%c[NIIT OJ Ext] ${msg}`, 'color: #00b894; font-weight: bold;');
    }

    function createButton(text, href) {
        const btn = document.createElement('a');
        btn.href = href;
        btn.innerText = text;
        // 强力样式，确保不被覆盖且可见
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: #409EFF;
            color: #ffffff;
            text-decoration: none;
            padding: 5px 12px;
            font-size: 13px;
            border-radius: 4px;
            border: 1px solid #409EFF;
            cursor: pointer;
            font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            transition: all 0.2s;
            height: 28px;
            box-sizing: border-box;
            white-space: nowrap;
        `;
        
        btn.onmouseover = () => {
            btn.style.backgroundColor = '#66b1ff';
            btn.style.borderColor = '#66b1ff';
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = '#409EFF';
            btn.style.borderColor = '#409EFF';
        };
        
        return btn;
    }

    function init() {
        log('Extension script started checking...');

        // 1. 检查是否已存在
        if (document.getElementById(CONTAINER_ID)) {
            return;
        }

        // 2. 寻找插入点
        // 策略 A: 找 .panel-title (题目名称)
        // 策略 B: 找 .problem-detail (题目内容容器)
        // 策略 C: 找 .el-tabs__nav (标签页导航栏) - 这个通常比较稳定且在顶部
        
        // 优先尝试插入到 .panel-title
        const titleElement = document.querySelector('.panel-title');
        
        if (!titleElement) {
            // 页面未加载完
            return;
        }

        // 3. 解析 ID
        const currentUrl = window.location.href;
        const match = currentUrl.match(/\/problem\/(\d+)/);
        
        if (!match) return;

        const currentIdStr = match[1];
        const currentId = parseInt(currentIdStr, 10);
        const idLength = currentIdStr.length;

        const prevId = currentId - 1;
        const nextId = currentId + 1;
        const prevIdStr = prevId.toString().padStart(idLength, '0');
        const nextIdStr = nextId.toString().padStart(idLength, '0');

        // 4. 创建容器
        const container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.style.cssText = `
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 99999;
            display: flex;
            gap: 8px;
        `;

        // 5. 添加按钮
        if (prevId > 0) {
            container.appendChild(createButton('← 上一题', `/problem/${prevIdStr}`));
        }
        container.appendChild(createButton('下一题 →', `/problem/${nextIdStr}`));

        // 6. 插入 DOM
        // 确保父元素有定位上下文
        const computedStyle = window.getComputedStyle(titleElement);
        if (computedStyle.position === 'static') {
            titleElement.style.position = 'relative';
        }
        
        titleElement.appendChild(container);
        log('Buttons injected successfully into .panel-title');
    }

    // 新功能：在新窗口打开讨论
    function handleDiscussionTab() {
        const tab = document.getElementById('tab-myDiscussion');
        if (!tab || tab.dataset.hasListener) return;

        // 标记已处理
        tab.dataset.hasListener = 'true';

        // 使用 cloneNode 移除原有的 Vue 事件监听器 (最彻底的方法)
        // 注意：这会破坏 Vue 对该组件的控制，但既然我们要接管行为，这是可以接受的
        // 或者，我们可以使用捕获阶段拦截事件
        
        tab.addEventListener('click', function(e) {
            // 阻止 Vue 切换 Tab
            e.stopPropagation();
            e.preventDefault();

            // 获取题目 ID
            const currentUrl = window.location.href;
            const match = currentUrl.match(/\/problem\/(\d+)/);
            if (match) {
                const problemId = match[1];
                // 构造讨论页 URL
                const discussionUrl = `https://oj.niit.com.cn/discussion/${problemId}`;
                window.open(discussionUrl, '_blank');
                log('Opened discussion in new tab');
            }
        }, true); // 使用捕获阶段，确保先于 Vue 执行
        
        log('Discussion tab listener attached');
    }

    function mainLoop() {
        init();
        handleDiscussionTab();
    }

    // 启动循环检测 (处理 SPA 路由切换)
    setInterval(mainLoop, 1000);
    
    // 立即运行一次
    mainLoop();

})();