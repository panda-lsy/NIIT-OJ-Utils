(function() {
    'use strict';

    function log(msg) {
        console.log(`%c[NIIT OJ Ext] ${msg}`, 'color: #00b894; font-weight: bold;');
    }

    // 新功能：在新窗口打开讨论
    function handleDiscussionTab() {
        // 尝试通过 ID 获取 (Element UI tabs 默认 ID 生成规则: tab-{paneName})
        // 常见的 paneName 可能是 myDiscussion, discussion 等
        let tab = document.getElementById('tab-myDiscussion') || document.getElementById('tab-discussion');
        
        // 如果 ID 没找到，尝试通过内容查找 (Element UI tabs)
        if (!tab) {
            const tabs = document.querySelectorAll('.el-tabs__item');
            for (let i = 0; i < tabs.length; i++) {
                if (tabs[i].textContent.trim() === '讨论') {
                    tab = tabs[i];
                    break;
                }
            }
        }

        if (!tab || tab.dataset.hasListener) return;

        // 标记已处理
        tab.dataset.hasListener = 'true';

        // 使用 cloneNode 移除原有的 Vue 事件监听器 (最彻底的方法)
        // 注意：这会破坏 Vue 对该组件的控制，但既然我们要接管行为，这是可以接受的
        // 或者，我们可以使用捕获阶段拦截事件
        
        tab.addEventListener('click', function(e) {
            // 获取题目 ID
            const currentUrl = window.location.href;
            // 兼容 /problem/1001 和 /training/123/problem/1001
            // 使用更宽泛的正则匹配 ID (防止非数字 ID)
            const match = currentUrl.match(/\/problem\/([^\/?#]+)/);
            
            if (match) {
                // 只有成功获取 ID 才拦截
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();

                const problemId = match[1];
                // 构造讨论页 URL
                const discussionUrl = `https://oj.niit.com.cn/discussion/${problemId}`;
                
                if (e.ctrlKey || e.metaKey) {
                    window.open(discussionUrl, '_blank');
                    log('Opened discussion in new tab: ' + discussionUrl);
                } else {
                    window.location.href = discussionUrl;
                    log('Opened discussion in current tab: ' + discussionUrl);
                }
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
                    
                    const url = `/submission-detail/${lastId}`;
                    if (e.ctrlKey || e.metaKey) {
                        window.open(url, '_blank');
                    } else {
                        window.location.href = url;
                    }
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
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            
                            const url = `/submission-detail/${subId}`;
                            if (e.ctrlKey || e.metaKey) {
                                window.open(url, '_blank');
                            } else {
                                window.location.href = url;
                            }
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

        // [NEW] 检查是否在训练中
        let trainingId = null;
        const trainingMatch = window.location.pathname.match(/\/training\/(\d+)\/problem\//);
        if (trainingMatch) {
            trainingId = trainingMatch[1];
        }

        // 2. 检查是否已经渲染且是最新的
        const existingNav = document.getElementById('niit-oj-problem-nav');
        if (existingNav) {
            if (existingNav.dataset.currentId === currentId && existingNav.dataset.trainingId === (trainingId || '')) {
                return; // 已经渲染且是当前题目
            } else {
                existingNav.remove(); // 题目变了，移除旧的重新渲染
            }
        }

        // 3. 获取题目列表
        let list = [];
        let useVirtualList = false;
        let listKey = 'niit_oj_problem_list';
        
        if (trainingId) {
            listKey = `niit_oj_training_list_${trainingId}`;
        }

        const listStr = window.sessionStorage.getItem(listKey);

        if (listStr) {
            try {
                list = JSON.parse(listStr);
                // 如果是普通题库，按序号排序
                if (!trainingId) {
                    list.sort((a, b) => {
                        const idA = parseInt(a.displayId || a.id);
                        const idB = parseInt(b.displayId || b.id);
                        return idA - idB;
                    });
                }
            } catch(e) { 
                list = []; 
            }
        }

        // 检查当前题目是否在列表中
        let index = -1;
        if (list.length > 0) {
            // 适配不同的 ID 字段 (id, problemId, displayId)
            index = list.findIndex(p => {
                const pid = String(p.problemId || p.id);
                const disp = String(p.displayId || p.problemDisplayId || '');
                return pid === currentId || disp === currentId;
            });
        }

        // 如果不在列表中，且不是训练模式，尝试虚拟列表
        if (index === -1 && !trainingId) {
            // 尝试解析当前ID为数字
            const currentNum = parseInt(currentId);
            if (!isNaN(currentNum)) {
                useVirtualList = true;
                const isPadded = currentId.length > 1 && currentId.startsWith('0');
                const paddingLen = currentId.length;
                const pad = (num) => {
                    if (!isPadded) return String(num);
                    return String(num).padStart(paddingLen, '0');
                };
                const minId = 0;
                list = [];
                for (let i = -2; i <= 2; i++) {
                    const idNum = currentNum + i;
                    if (idNum >= minId) {
                        const idStr = pad(idNum);
                        list.push({
                            id: idStr,
                            displayId: idStr,
                            title: '' 
                        });
                    }
                }
                index = list.findIndex(p => p.id === currentId);
            }
        }

        if (index === -1) return;

        // 6. 创建导航容器
        const navDiv = document.createElement('div');
        navDiv.id = 'niit-oj-problem-nav';
        navDiv.dataset.currentId = currentId; 
        navDiv.dataset.trainingId = trainingId || '';
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
            if (trainingId) {
                a.href = `/training/${trainingId}/problem/${id}`;
            } else {
                a.href = `/problem/${id}`;
            }
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
        let start, end;
        if (useVirtualList) {
            start = 0;
            end = list.length - 1;
        } else {
            start = Math.max(0, index - 2);
            end = Math.min(list.length - 1, index + 2);
        }

        // 上一题箭头
        let showPrev = false;
        let prevId = null;
        
        if (useVirtualList) {
             const currentNum = parseInt(currentId);
             if (currentNum > 0) { 
                 const isPadded = currentId.length > 1 && currentId.startsWith('0');
                 const pad = (num) => isPadded ? String(num).padStart(currentId.length, '0') : String(num);
                 showPrev = true;
                 prevId = pad(currentNum - 1);
             }
        } else {
            if (index > 0) {
                showPrev = true;
                const p = list[index - 1];
                prevId = p.displayId || p.problemDisplayId || p.problemId || p.id;
            }
        }

        if (showPrev && prevId) {
            navDiv.appendChild(createNavBtn('← 上一题', prevId, false, true));
        }

        // 中间题目
        for (let i = start; i <= end; i++) {
            const p = list[i];
            const pid = String(p.problemId || p.id);
            const disp = String(p.displayId || p.problemDisplayId || pid);
            const linkId = disp; 
            
            const isCurrent = (pid === currentId || disp === currentId);
            navDiv.appendChild(createNavBtn(disp, linkId, isCurrent));
        }

        // 下一题箭头
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
                const p = list[index + 1];
                nextId = p.displayId || p.problemDisplayId || p.problemId || p.id;
            }
        }

        if (showNext && nextId) {
            navDiv.appendChild(createNavBtn('下一题 →', nextId, false, true));
        }

        // 8. 插入页面
        const container = document.querySelector('.el-card.submit-detail');
        if (container) {
            container.appendChild(navDiv);
            log('Problem navigation rendered in .el-card.submit-detail');
        } else {
            const fallback = document.querySelector('.content-app') || document.body;
            fallback.appendChild(navDiv);
            log('Problem navigation rendered in fallback container');
        }
    }

    // 强制主导航栏在新标签页打开
    function makeNavLinksOpenNewTab() {
        const navMap = {
            '题目': '/problem',
            '训练': '/training',
            '比赛': '/contest',
            '评测': '/status',
            '讨论': '/discussion',
            '关于': '/about' // 假设是 /about，如果不是，点击后会跳转到默认行为
        };

        // 选择所有菜单项
        const items = document.querySelectorAll('.el-menu-item');
        items.forEach(item => {
            if (item.dataset.ojNavProcessed) return;
            
            const text = item.textContent.trim();
            // 检查是否在映射表中
            // 注意：有些菜单项包含图标，textContent 会包含图标文本，所以使用 includes 或 trim
            // 简单处理：遍历 map keys
            for (const key in navMap) {
                if (text === key || text.includes(key)) {
                    // 排除 "我的提交" 等下拉菜单项，只针对主导航
                    // 主导航通常在 .el-menu--horizontal 下
                    if (!item.closest('.el-menu--horizontal')) continue;

                    item.setAttribute('data-oj-nav-processed', 'true');
                    const url = navMap[key];
                    
                    // 移除 Vue 的点击事件监听器比较困难，我们使用捕获阶段拦截
                    item.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        if (e.ctrlKey || e.metaKey) {
                            window.open(url, '_blank');
                        } else {
                            window.location.href = url;
                        }
                    }, true);
                    
                    // 添加视觉提示
                    item.title = "点击跳转，按住 Ctrl 在新标签页打开";
                    break;
                }
            }
        });
    }

    // 注入自定义 Favicon
    function injectFavicon() {
        // 检查是否已有 icon
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        
        // 如果是默认的或者空的，替换它
        // 这里我们简单粗暴一点，直接替换，或者检测是否是 NIIT 的默认 icon
        // 用户说 "如果这个页面没有图标"，通常是指浏览器 tab 上显示的
        // 我们可以尝试设置一个
        if (!link.href || link.href.includes('favicon.ico')) {
             // 使用扩展图标
             link.href = chrome.runtime.getURL('icon.png');
        }
    }

    // 合并后的标签与难度点击处理函数
    function processClickableLabels() {
        const path = window.location.pathname;

        // --- 1. 训练列表页 (/training) 特殊处理 ---
        // [Fix] 使用 startsWith 匹配 /training，但排除 /training/{id}/problem
        // 这样可以匹配 /training, /training/, /training?foo=bar
        if (path.startsWith('/training') && !path.includes('/problem')) {
            // [NEW] 硬编码已知分类 ID，解决刷新也找不到的问题
            const staticCatMap = {
                '基础算法': 1,
                '数学问题': 2,
                '数据结构': 3,
                '图论': 4,
                '计算机几何': 5,
                '算法进阶': 6
            };
            const dynamicCatMap = JSON.parse(window.sessionStorage.getItem('niit_oj_training_category_map') || '{}');
            const catMap = { ...staticCatMap, ...dynamicCatMap };

            const authMap = {
                '公开训练': 'Public',
                '私有训练': 'Private', 
                '密码保护': 'Password' 
            };

            // [Fix] 允许重新处理 'missing' 状态的元素，以便在数据加载后恢复
            document.querySelectorAll('.el-tag').forEach(el => {
                // 如果已经成功处理或者是忽略的，跳过
                if (el.dataset.ojProcessed === 'true' || el.dataset.ojProcessed === 'ignore') return;
                
                const text = el.textContent.trim();
                if (!text) return;

                // 1.1 权限标签
                if (authMap[text]) {
                    enhanceElement(el, 'training-auth', text, authMap[text]);
                    return;
                }

                // 1.2 分类标签
                if (catMap[text]) {
                    enhanceElement(el, 'training-category', text, catMap[text]);
                    return;
                }

                // 1.3 未捕获的分类标签 (看起来像分类，但没有ID)
                // 只有当它明确是 category-item 或者看起来像标签时
                if (el.classList.contains('category-item') || el.classList.contains('el-tag')) {
                     // 排除 "全部" 这种特殊标签
                     if (text === '全部') {
                         return;
                     }

                     // 标记为 missing，但允许下次循环重试 (不设置 ojProcessed=true)
                     // 只设置一次事件监听器，防止重复绑定
                     if (el.dataset.ojProcessed !== 'missing') {
                         el.setAttribute('data-oj-processed', 'missing');
                         el.style.cursor = 'help';
                         el.title = '未找到分类ID (请刷新页面以捕获数据)';
                         el.onclick = (e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             alert(`插件尚未捕获到分类 "${text}" 的ID。\n请尝试刷新页面 (F5)，让插件重新读取训练列表数据。`);
                         };
                     }
                }
            });
            return;
        }

        // --- 2. 题目相关页面 (/problem, /problem/{id}, /training/{id}/problem/{id}) ---
        const difficultyMap = { '简单': 0, '中等': 1, '困难': 2 };
        const diffColorMap = { '简单': 'success', '中等': 'warning', '困难': 'danger' };
        const tagMap = JSON.parse(window.sessionStorage.getItem('niit_oj_tag_map') || '{}');
        
        // 1. 处理难度 (Difficulty)
        // 1.1 .meta-level (通常在题目详情页标题下方)
        document.querySelectorAll('.meta-level:not([data-oj-processed])').forEach(el => {
            const text = el.textContent.trim();
            if (difficultyMap[text] !== undefined) {
                enhanceElement(el, 'difficulty', text, difficultyMap[text]);
            }
        });

        // 1.2 包含 "难度:" 的 span (旧版或侧边栏)
        document.querySelectorAll('span:not([data-oj-processed])').forEach(span => {
            const text = span.textContent.trim();
            if (text.startsWith('难度:')) {
                const levelName = text.replace('难度:', '').trim();
                if (difficultyMap[levelName] !== undefined) {
                    // 替换为 Tag 样式
                    const type = diffColorMap[levelName] || 'info';
                    span.innerHTML = `难度: <span class="el-tag el-tag--small el-tag--${type} el-tag--plain" style="cursor: pointer; margin-left: 2px;">${levelName}</span>`;
                    const newTag = span.querySelector('.el-tag');
                    if (newTag) {
                        enhanceElement(newTag, 'difficulty', levelName, difficultyMap[levelName]);
                        span.setAttribute('data-oj-processed', 'true');
                    }
                }
            }
        });

        // 2. 处理标签 (Tags) 和 列表中的难度标签
        // 查找所有 .el-tag 和 .problem-tags 下的子元素
        // [Fix] 移除 .problem-tags span 以防止选中非标签元素，移除 missing 状态以支持异步加载
        const candidates = document.querySelectorAll('.el-tag, .problem-tags .tag');
        
        candidates.forEach(el => {
            if (el.hasAttribute('data-oj-processed')) return;

            const text = el.textContent.trim();
            if (!text) return;
            
            // 2.1 检查是否是难度
            if (difficultyMap[text] !== undefined) {
                enhanceElement(el, 'difficulty', text, difficultyMap[text]);
                return;
            }

            // 2.2 检查是否是普通标签
            // 过滤无效标签
            if (['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Runtime Error', 'Compile Error', '在线自测', '运行自测', '简单', '中等', '困难'].includes(text) || text.startsWith('填充用例')) {
                el.setAttribute('data-oj-processed', 'ignore');
                return;
            }

            const tagId = tagMap[text];
            if (tagId) {
                enhanceElement(el, 'tag', text, tagId);
            } 
            // [Fix] 不再标记 missing，因为 tagMap 可能尚未加载完成 (异步竞争)
            // 下次循环时会再次尝试匹配
        });
    }

    function enhanceElement(el, type, name, id) {
        el.setAttribute('data-oj-processed', 'true');
        el.style.cursor = 'pointer';
        
        const handleJump = (url, e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                window.open(url, '_blank');
            } else {
                window.location.href = url;
            }
        };

        if (type === 'difficulty') {
            el.title = `点击筛选 "${name}" 难度的题目 (按住 Ctrl 新标签页打开)`;
            el.onclick = (e) => handleJump(`/problem?difficulty=${id}`, e);
        } else if (type === 'tag') {
            el.title = `点击查看 "${name}" 标签下的题目 (按住 Ctrl 新标签页打开)`;
            el.onclick = (e) => handleJump(`/problem?tagId=${id}`, e);
        } else if (type === 'training-auth') {
            el.title = `点击筛选 "${name}" (按住 Ctrl 新标签页打开)`;
            el.onclick = (e) => handleJump(`/training?auth=${id}&currentPage=1`, e);
        } else if (type === 'training-category') {
            el.title = `点击筛选分类 "${name}" (按住 Ctrl 新标签页打开)`;
            el.onclick = (e) => handleJump(`/training?categoryId=${id}`, e);
        }
        
        el.onmouseover = () => { el.style.textDecoration = 'underline'; };
        el.onmouseout = () => { el.style.textDecoration = 'none'; };
    }

    // 替换 About 页面内容 (局部替换)
    function replaceAboutPage() {
        if (window.location.pathname !== '/about') return;

        // 查找 404 错误容器
        const errorContainer = document.querySelector('.container-error-404');
        if (!errorContainer) return;

        // 向上查找最近的卡片容器
        const targetCard = errorContainer.closest('.el-card');
        if (!targetCard) return;

        // 检查是否已经替换过
        if (targetCard.dataset.aboutReplaced === 'true') return;

        log('Detected 404 card on /about, injecting plugin intro...');
        
        const url = chrome.runtime.getURL('about.html');
        fetch(url)
            .then(response => response.text())
            .then(html => {
                // 解析 HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // 1. 注入样式 (如果还没注入过)
                if (!document.getElementById('niit-oj-about-style')) {
                    const styles = doc.querySelectorAll('style');
                    styles.forEach(style => {
                        style.id = 'niit-oj-about-style';
                        document.head.appendChild(style);
                    });
                }

                // 2. 提取主要内容
                const container = doc.querySelector('.container');
                if (container) {
                    // 调整样式以适应嵌入环境
                    container.style.boxShadow = 'none';
                    container.style.margin = '0';
                    container.style.maxWidth = '100%';
                    container.style.padding = '0'; // 让外层 el-card 控制 padding
                    
                    // 3. 替换卡片内容
                    targetCard.innerHTML = '';
                    targetCard.appendChild(container);
                    targetCard.dataset.aboutReplaced = 'true';
                    
                    // 修改页面标题
                    document.title = 'NIIT OJ Utils - 插件介绍';
                    
                    log('About page content injected successfully.');
                }
            })
            .catch(err => console.error('Failed to load about.html', err));
    }

    function mainLoop() {
        replaceAboutPage();
        handleDiscussionTab();
        injectScript();
        fixSubmissionRedirect();
        fixSubmissionListClick();
        fixImages();
        renderProblemNav();
        processClickableLabels();
        makeNavLinksOpenNewTab();
        injectFavicon();
    }

    // 启动循环检测 (处理 SPA 路由切换)
    setInterval(mainLoop, 1000);
    
    // 立即运行一次
    mainLoop();

})();