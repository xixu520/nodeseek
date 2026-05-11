    // 新增：黑名单弹窗 - 调用内置模块
    function showBlacklistDialog() {
        if (window.NodeSeekBlacklistViewer && typeof window.NodeSeekBlacklistViewer.showBlacklistDialog === 'function') {
            window.NodeSeekBlacklistViewer.showBlacklistDialog();
        } else {
            alert('黑名单查看功能未加载');
        }
    }

    // ====== 好友弹窗 ======
    // showFriendsDialog 函数已内置
    const showFriendsDialog = () => window.NodeSeekFriends?.showFriendsDialog();



    // updateFriendRemark 函数已内置
    const updateFriendRemark = (username, newRemark) => window.NodeSeekFriends?.updateFriendRemark(username, newRemark);

    function makeDraggable(dialog, handleSize) {
        if (!dialog || dialog.dataset.nsGlobalDragReady) return;
        dialog.dataset.nsGlobalDragReady = '1';
        const handle = document.createElement('div');
        handle.style.position = 'absolute';
        handle.style.left = '0';
        handle.style.top = '0';
        handle.style.width = ((handleSize && handleSize.width) || 48) + 'px';
        handle.style.height = ((handleSize && handleSize.height) || 38) + 'px';
        handle.style.cursor = 'move';
        dialog.appendChild(handle);
        handle.onmousedown = event => {
            event.preventDefault();
            const rect = dialog.getBoundingClientRect();
            const startX = event.clientX;
            const startY = event.clientY;
            const move = e => {
                dialog.style.right = 'auto';
                dialog.style.left = (rect.left + e.clientX - startX) + 'px';
                dialog.style.top = (rect.top + e.clientY - startY) + 'px';
                dialog.style.transform = 'none';
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        };
    }
