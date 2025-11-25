(function() {
    'use strict';

    function log(msg) {
        console.log(`%c[NIIT OJ Ext] ${msg}`, 'color: #00b894; font-weight: bold;');
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

    // 修复图片显示问题 (WIP)
    function fixImages() {
        log('WIP: Image fix started');
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            const rawSrc = img.getAttribute('src');
            if (!rawSrc) return;

            // Only target the specific broken pattern
            if (rawSrc.includes('/api/public/img/')) {
                // If we haven't touched this image yet
                if (img.getAttribute('data-fixed-attempt') === null) {
                    img.setAttribute('data-fixed-attempt', 'true'); // Mark as processing

                    // Extract the filename and ID
                    const filename = rawSrc.split('/').pop();
                    const fileId = filename.split('.')[0];
                    
                    // Define candidate paths
                    const candidates = [
                        `/api/public/file/${filename}`, // HOJ alternative path
                        `/api/public/md/${filename}`,   // HOJ markdown path
                        `/public/img/${filename}`,
                        `/img/${filename}`,
                        `/api/img/${filename}`,
                        `/upload/${filename}`,
                        `/assets/img/${filename}`,
                        `/static/img/${filename}`,
                        `/file/${filename}`,
                        `/files/${filename}`,
                        `/image/${filename}`,
                        `/images/${filename}`,
                        `/api/file/${filename}`,
                        `/api/file/${fileId}`, // Try without extension
                        `/api/file/image/${fileId}`,
                        `/api/file/download/${fileId}`,
                        `https://oj.niit.com.cn/public/img/${filename}`,
                        `https://oj.niit.com.cn/api/public/img/${filename}`
                    ];

                    let attemptIndex = 0;

                    const tryNext = () => {
                        if (attemptIndex >= candidates.length) {
                            log(`All image load attempts failed for ${filename}`);
                            return;
                        }
                        const nextSrc = candidates[attemptIndex++];
                        log(`Trying image path: ${nextSrc}`);
                        
                        // Use fetch to check status code
                        fetch(nextSrc, { method: 'HEAD' })
                            .then(response => {
                                const contentType = response.headers.get('Content-Type');
                                if (response.ok && contentType && contentType.startsWith('image/')) {
                                    log(`Image fix success (HTTP ${response.status} ${contentType}): ${nextSrc}`);
                                    img.src = nextSrc;
                                } else {
                                    log(`Failed ${nextSrc}: HTTP ${response.status} Type: ${contentType}`);
                                    tryNext();
                                }
                            })
                            .catch(err => {
                                log(`Failed ${nextSrc}: ${err.message}`);
                                tryNext();
                            });
                    };

                    // Start the chain
                    tryNext();
                }
            }
        });
    }

    // 渲染题目导航
    function renderProblemNav() {
        // 1. 检查是否在题目详情页
        if (!window.location.pathname.includes('/problem/')) return;
        
        // 4. 获取当前题目ID
        const currentId = window.location.pathname.split('/').pop();

        // 2. 检查是否已经渲染且是最新的
        const existingNav = document.getElementById('niit-oj-problem-nav');
        if (existingNav) {
            if (existingNav.dataset.currentId === currentId) {
                return; // 已经渲染且是当前题目
            } else {
                existingNav.remove(); // 题目变了，移除旧的重新渲染
            }
        }

        // 3. 获取题目列表
        const listStr = window.sessionStorage.getItem('niit_oj_problem_list');
        let list = [];
        let useVirtualList = false;

        if (listStr) {
            try {
                list = JSON.parse(listStr);
                // 修复BUG 1: 按序号排序
                list.sort((a, b) => {
                    const idA = parseInt(a.displayId || a.id);
                    const idB = parseInt(b.displayId || b.id);
                    return idA - idB;
                });
            } catch(e) { 
                list = []; 
            }
        }

        // 修复BUG 2: 如果没有列表，或者当前题目不在列表中，尝试生成虚拟列表
        // 检查当前题目是否在列表中
        let index = -1;
        if (list.length > 0) {
            index = list.findIndex(p => String(p.id) === currentId || String(p.displayId) === currentId);
        }

        if (index === -1) {
            // 尝试解析当前ID为数字
            const currentNum = parseInt(currentId);
            if (!isNaN(currentNum)) {
                useVirtualList = true;
                // 生成虚拟列表：前2个，当前，后2个
                // 假设ID是连续的
                // 检测 padding
                const isPadded = currentId.length > 1 && currentId.startsWith('0');
                const paddingLen = currentId.length;
                
                const pad = (num) => {
                    if (!isPadded) return String(num);
                    return String(num).padStart(paddingLen, '0');
                };

                // 生成范围
                // 修复BUG 1: 第一个序号为0000 (假设最小ID为0)
                const minId = 0;
                
                // 构建虚拟 list
                // 我们只需要生成 -2 到 +2 的范围
                // 但是为了复用下面的逻辑，我们构造一个小的 list
                list = [];
                for (let i = -2; i <= 2; i++) {
                    const idNum = currentNum + i;
                    if (idNum >= minId) {
                        const idStr = pad(idNum);
                        list.push({
                            id: idStr,
                            displayId: idStr,
                            title: '' // 虚拟列表没有标题
                        });
                    }
                }
                
                // 重新查找 index
                index = list.findIndex(p => p.id === currentId);
            }
        }

        if (index === -1) return;

        // 6. 创建导航容器
        const navDiv = document.createElement('div');
        navDiv.id = 'niit-oj-problem-nav';
        navDiv.dataset.currentId = currentId; // 标记当前题目ID
        navDiv.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 20px;
            padding: 15px;
            background: #fff;
            border-radius: 4px;
            box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
            flex-wrap: wrap;
        `;

        // 辅助函数：创建按钮
        const createNavBtn = (text, id, isCurrent = false, isArrow = false) => {
            const a = document.createElement('a');
            a.href = `/problem/${id}`;
            a.innerText = text;
            a.style.cssText = `
                margin: 5px;
                padding: 8px 15px;
                text-decoration: none;
                color: ${isCurrent ? '#fff' : '#606266'};
                background-color: ${isCurrent ? '#409EFF' : '#fff'};
                border: 1px solid ${isCurrent ? '#409EFF' : '#dcdfe6'};
                border-radius: 4px;
                font-size: 14px;
                transition: all .3s;
                font-weight: ${isArrow ? 'bold' : 'normal'};
            `;
            a.onmouseover = () => {
                if (!isCurrent) {
                    a.style.color = '#409EFF';
                    a.style.borderColor = '#c6e2ff';
                    a.style.backgroundColor = '#ecf5ff';
                }
            };
            a.onmouseout = () => {
                if (!isCurrent) {
                    a.style.color = '#606266';
                    a.style.borderColor = '#dcdfe6';
                    a.style.backgroundColor = '#fff';
                }
            };
            return a;
        };

        // 7. 生成按钮
        // 如果是虚拟列表，我们已经生成了局部列表，直接全部显示即可 (除了越界的)
        // 如果是真实列表，显示范围：当前题目 前2个 ~ 后2个
        
        let start, end;
        if (useVirtualList) {
            start = 0;
            end = list.length - 1;
        } else {
            start = Math.max(0, index - 2);
            end = Math.min(list.length - 1, index + 2);
        }

        // 上一题箭头
        // 如果是虚拟列表，只要当前ID > minId，就显示上一题
        // 如果是真实列表，只要 index > 0
        let showPrev = false;
        let prevId = null;
        
        if (useVirtualList) {
             const currentNum = parseInt(currentId);
             if (currentNum > 0) { // 假设0是最小
                 const isPadded = currentId.length > 1 && currentId.startsWith('0');
                 const pad = (num) => isPadded ? String(num).padStart(currentId.length, '0') : String(num);
                 showPrev = true;
                 prevId = pad(currentNum - 1);
             }
        } else {
            if (index > 0) {
                showPrev = true;
                prevId = list[index - 1].id;
            }
        }

        if (showPrev && prevId) {
            navDiv.appendChild(createNavBtn('← 上一题', prevId, false, true));
        }

        // 中间题目
        for (let i = start; i <= end; i++) {
            const p = list[i];
            const isCurrent = (p.id === currentId);
            // 显示 displayId (通常是题号)
            navDiv.appendChild(createNavBtn(p.displayId, p.id, isCurrent));
        }

        // 下一题箭头
        // 虚拟列表总是显示下一题? 或者我们可以限制最大值? 暂时不限制
        let showNext = false;
        let nextId = null;

        if (useVirtualList) {
             const currentNum = parseInt(currentId);
             const isPadded = currentId.length > 1 && currentId.startsWith('0');
             const pad = (num) => isPadded ? String(num).padStart(currentId.length, '0') : String(num);
             showNext = true;
             nextId = pad(currentNum + 1);
        } else {
            if (index < list.length - 1) {
                showNext = true;
                nextId = list[index + 1].id;
            }
        }

        if (showNext && nextId) {
            navDiv.appendChild(createNavBtn('下一题 →', nextId, false, true));
        }

        // 8. 插入页面
        // 优化：将题目选择列表放在 .el-card.submit-detail 的最下方
        const container = document.querySelector('.el-card.submit-detail');
        if (container) {
            container.appendChild(navDiv);
            log('Problem navigation rendered in .el-card.submit-detail');
        } else {
            // Fallback
            const fallback = document.querySelector('.content-app') || document.body;
            fallback.appendChild(navDiv);
            log('Problem navigation rendered in fallback container');
        }
    }

    // 标签点击跳转功能
    function makeTagsClickable() {
        // 移除严格的 URL 检查，只要页面上有相关元素就尝试处理
        // if (!window.location.pathname.includes('/problem')) return;

        // 查找所有可能的标签元素
        const tags = document.querySelectorAll('.el-tag, .problem-tags .tag');
        if (tags.length === 0) return;

        const tagMap = JSON.parse(window.sessionStorage.getItem('niit_oj_tag_map') || '{}');

        tags.forEach(tag => {
            const tagName = tag.textContent.trim();
            
            // 检查是否已经处理过，且内容未变 (防止 Vue 复用 DOM 导致链接错误)
            if (tag.dataset.ojTagProcessed === 'true' && tag.dataset.ojTagName === tagName) {
                return;
            }

            // 简单过滤状态标签和功能按钮
            // 使用正则匹配 "填充用例" 开头的标签
            if (['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Runtime Error', 'Compile Error', '在线自测', '运行自测'].includes(tagName) || tagName.startsWith('填充用例')) {
                tag.setAttribute('data-oj-tag-processed', 'true');
                tag.setAttribute('data-oj-tag-name', tagName);
                // 确保没有 tooltip 和 cursor 样式
                tag.title = '';
                tag.style.cursor = '';
                tag.onmouseover = null;
                tag.onmouseout = null;
                tag.onclick = null;
                return;
            }

            const tagId = tagMap[tagName];

            if (tagId) {
                tag.setAttribute('data-oj-tag-processed', 'true');
                tag.setAttribute('data-oj-tag-name', tagName); // 记录当前处理的标签名
                
                tag.style.cursor = 'pointer';
                tag.title = `点击查看 "${tagName}" 标签下的题目`;
                
                // 视觉反馈
                tag.onmouseover = () => { tag.style.textDecoration = 'underline'; };
                tag.onmouseout = () => { tag.style.textDecoration = 'none'; };

                // 清除旧的事件监听器是不可能的 (匿名函数)，但我们可以通过 cloneNode 来清除
                // 或者，我们假设 Vue 复用时会重置事件？不一定。
                // 最稳妥的方法是：如果检测到 DOM 复用 (tagName 变了)，我们需要更新事件。
                // 由于 addEventListener 无法覆盖，我们使用 onclick 属性，或者在闭包中动态获取 ID？
                // 为了简单且健壮，我们使用 onclick，这样可以直接覆盖旧的 handler
                
                tag.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`/problem?tagId=${tagId}`, '_blank');
                };
            } else {
                // 标记为 missing
                // 如果之前是 true 但现在 ID 没了 (不太可能)，或者之前是 missing
                tag.setAttribute('data-oj-tag-processed', 'missing');
                tag.setAttribute('data-oj-tag-name', tagName);
                tag.title = '未找到标签ID (请先浏览题目列表以捕获标签信息)';
                tag.style.cursor = 'help';
                tag.onclick = null; // 清除点击事件
            }
        });
    }

    // 难度点击跳转功能
    function makeDifficultyClickable() {
        // 查找难度标签
        const levels = document.querySelectorAll('.meta-level:not([data-oj-level-processed])');
        if (levels.length === 0) return;

        const difficultyMap = {
            '简单': 0,
            '中等': 1,
            '困难': 2
        };

        levels.forEach(level => {
            level.setAttribute('data-oj-level-processed', 'true');
            const levelName = level.textContent.trim();
            const difficultyId = difficultyMap[levelName];

            if (difficultyId !== undefined) {
                level.style.cursor = 'pointer';
                level.title = `点击筛选 "${levelName}" 难度的题目`;
                
                // 视觉反馈
                level.onmouseover = () => { level.style.textDecoration = 'underline'; };
                level.onmouseout = () => { level.style.textDecoration = 'none'; };

                level.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // 保持当前页面的其他参数（如 keyword），只修改 difficulty
                    // 或者简单点，直接跳转到筛选页
                    window.location.href = `/problem?difficulty=${difficultyId}`;
                };
            }
        });
    }

    function mainLoop() {
        handleDiscussionTab();
        injectScript();
        fixSubmissionRedirect();
        fixSubmissionListClick();
        fixImages();
        renderProblemNav();
        makeTagsClickable();
        makeDifficultyClickable();
    }

    // 启动循环检测 (处理 SPA 路由切换)
    setInterval(mainLoop, 1000);
    
    // 立即运行一次
    mainLoop();

})();