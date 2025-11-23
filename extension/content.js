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

    // 注入拦截脚本 (只运行一次)
    let scriptInjected = false;
    function injectScript() {
        if (scriptInjected) return;
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('inject.js');
            script.onload = function() {
                this.remove();
            };
            (document.head || document.documentElement).appendChild(script);
            scriptInjected = true;
            log('Injected interception script.');
        } catch (e) {
            console.error('Failed to inject script:', e);
        }
    }

    // 修复提交详情跳转 (只运行一次)
    let redirectFixed = false;
    function fixSubmissionRedirect() {
        if (redirectFixed) return;
        document.addEventListener('click', function(e) {
            // 检查点击的是否是提交状态标签
            const target = e.target.closest('.submission-status');
            if (target) {
                const lastId = window.sessionStorage.getItem('niit_oj_last_submission_id');
                log('Click detected on submission status. Last ID: ' + lastId);
                
                if (lastId) {
                    log('Redirecting to submission detail: ' + lastId);
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation(); // 确保阻止其他监听器
                    window.open(`/submission-detail/${lastId}`, '_blank');
                } else {
                    log('No submission ID found in sessionStorage.');
                }
            }
        }, true); // 捕获阶段
        redirectFixed = true;
        log('Submission redirect fix applied.');
    }

    // 修复提交列表点击
    let listClickFixed = false;
    function fixSubmissionListClick() {
        if (listClickFixed) return;
        
        document.addEventListener('click', function(e) {
            // 检查是否在提交列表表格中 (包括主体和固定列)
            const tableWrapper = e.target.closest('#pane-mySubmission .vxe-table--body-wrapper, #pane-mySubmission .vxe-table--fixed-left-wrapper, #pane-mySubmission .vxe-table--fixed-right-wrapper');
            
            if (!tableWrapper) return;

            const tr = e.target.closest('tr');
            if (!tr) return;

            // 获取行号 (在 tbody 中的索引)
            const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
            
            // 获取存储的列表
            const listStr = window.sessionStorage.getItem('niit_oj_submission_list');
            if (listStr) {
                try {
                    const list = JSON.parse(listStr);
                    if (list && list[rowIndex]) {
                        const item = list[rowIndex];
                        const subId = item.id || item.submitId || item.submissionId;
                        
                        if (subId) {
                            log('List click detected. Row: ' + rowIndex + ', ID: ' + subId);
                            // 只有当点击的是可能有交互的元素时才拦截? 
                            // 或者直接拦截所有行内点击，只要它看起来像是一个链接或按钮
                            // 用户反馈的是点击按钮报错，所以我们拦截它
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            window.open(`/submission-detail/${subId}`, '_blank');
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }, true);
        
        listClickFixed = true;
        log('Submission list click fix applied.');
    }

    function mainLoop() {
        init();
        handleDiscussionTab();
        injectScript();
        fixSubmissionRedirect();
        fixSubmissionListClick();
    }

    // 启动循环检测 (处理 SPA 路由切换)
    setInterval(mainLoop, 1000);
    
    // 立即运行一次
    mainLoop();

})();