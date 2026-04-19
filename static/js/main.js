window.addEventListener('DOMContentLoaded', () => {

    const fileInput = document.getElementById('pdf-input');
    const dropZone = document.getElementById('drop-zone');
    const thumbList = document.getElementById('thumbnail-list');
    const statusDiv = document.getElementById('status');
    const saveButton = document.getElementById('save-button');
    const clearButton = document.getElementById('clear-button');
    const uploadSection = document.getElementById('upload-section');
    const workspaceSection = document.getElementById('workspace-section');
    const selectFileBtn = document.getElementById('select-file-btn');
    const addMoreBtn = document.getElementById('add-more-btn');
    const undoBtn = document.getElementById('undo-btn');

    let sortable = null;
    let undoStack = [];
    let dragTempState = '';

    function pushState() {
        undoStack.push(thumbList.innerHTML);
        updateUndoBtn();
    }

    function updateUndoBtn() {
        undoBtn.disabled = undoStack.length === 0;
    }

    undoBtn.addEventListener('click', () => {
        if (undoStack.length === 0) return;
        const previousHTML = undoStack.pop();
        thumbList.innerHTML = previousHTML;
        updateUndoBtn();
        updateView();
        
        // innerHTMLを置き換えたのでSortableを再初期化
        if (sortable) {
            sortable.destroy();
        }
        reinitSortable();
    });

    function reinitSortable() {
        sortable = new Sortable(thumbList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onStart: function() {
                dragTempState = thumbList.innerHTML;
            },
            onUpdate: function() {
                undoStack.push(dragTempState);
                updateUndoBtn();
            }
        });
    }

    // View 切り替え（画面のステート管理）
    function updateView() {
        if (thumbList.children.length > 0) {
            uploadSection.style.display = 'none';
            workspaceSection.style.display = 'block';
        } else {
            uploadSection.style.display = 'flex';
            workspaceSection.style.display = 'none';
        }
    }

    // ボタンからのファイル選択
    selectFileBtn.addEventListener('click', () => fileInput.click());
    addMoreBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });

    // --- ドラッグアンドドロップの処理 ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });

    async function handleFileUpload(files) {
        // UIの切り替えを先に行う
        workspaceSection.style.display = 'block';
        uploadSection.style.display = 'none';
        
        statusDiv.textContent = 'アップロード中...';
        
        // 処理中に保存ボタン等を無効化
        saveButton.disabled = true;
        clearButton.disabled = true;
        addMoreBtn.disabled = true;

        if (sortable) {
            sortable.destroy();
            sortable = null;
        }

        const formData = new FormData();
        files.forEach(file => {
            formData.append('pdf_files', file);
        });

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                statusDiv.textContent = '追加が完了しました。ドラッグ＆ドロップで並び替えできます。';
                displayThumbnails(result.thumbnails);
            } else {
                statusDiv.textContent = `エラー: ${result.error}`;
            }
        } catch (error) {
            statusDiv.textContent = `ネットワークエラー: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            clearButton.disabled = false;
            addMoreBtn.disabled = false;
            fileInput.value = ''; // Reset input to allow submitting the same file again
            updateView();
        }
    }

    function displayThumbnails(thumbnails) {
        if (thumbnails.length > 0 && thumbList.children.length > 0) {
            pushState(); // 新しく追加する前の既存状態を保存
        }

        thumbnails.forEach((thumbInfo) => {
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            item.dataset.originalIndex = thumbInfo.original_index;
            item.dataset.sourceFile = thumbInfo.source_file;

            // 削除ボタン
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-thumb-btn';
            deleteBtn.innerHTML = '&times;'; // バツ印
            deleteBtn.title = 'このページを削除';
            
            const img = document.createElement('img');
            img.src = thumbInfo.path;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'thumb-info';

            const displayName = thumbInfo.source_file.split('_').slice(1).join('_');
            
            const fileNameElem = document.createElement('p');
            fileNameElem.className = 'thumb-filename';
            fileNameElem.textContent = displayName;

            const pageNumElem = document.createElement('p');
            pageNumElem.className = 'thumb-page';
            pageNumElem.textContent = `ページ ${thumbInfo.original_index + 1}`;

            infoDiv.appendChild(fileNameElem);
            infoDiv.appendChild(pageNumElem);

            item.appendChild(deleteBtn);
            item.appendChild(img);
            item.appendChild(infoDiv);
            thumbList.appendChild(item);
        });

        if (sortable) { sortable.destroy(); }
        reinitSortable();
    }

    clearButton.addEventListener('click', async () => {
        statusDiv.textContent = '全ファイルをクリアしています...';
        saveButton.disabled = true;
        clearButton.disabled = true;
        addMoreBtn.disabled = true;
        try {
            const response = await fetch('/clear', { method: 'POST' });
            if (response.ok) {
                thumbList.innerHTML = '';
                undoStack = [];
                updateUndoBtn();
                statusDiv.textContent = '';
                if (sortable) {
                    sortable.destroy();
                    sortable = null;
                }
                updateView(); // ここで初期画面に戻る
            } else {
                statusDiv.textContent = 'クリアに失敗しました。';
            }
        } catch (error) {
            statusDiv.textContent = `ネットワークエラー: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            clearButton.disabled = false;
            addMoreBtn.disabled = false;
        }
    });

    saveButton.addEventListener('click', async () => {
        if (!sortable) return;
        const items = thumbList.querySelectorAll('.thumbnail-item');
        const neworder = Array.from(items).map(item => {
            return {
                filename: item.dataset.sourceFile,
                page_index: parseInt(item.dataset.originalIndex, 10)
            };
        });

        statusDiv.textContent = 'PDFを結合中...';
        saveButton.disabled = true;
        clearButton.disabled = true;
        addMoreBtn.disabled = true;

        try {
            const response = await fetch('/reorder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    order: neworder
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const contentDisposition = response.headers.get('content-disposition');
                let filename = 'reordered.pdf';

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/);
                    if (filenameMatch && filenameMatch[1]) {
                        filename = decodeURIComponent(filenameMatch[1]);
                    }
                }

                const a = document.createElement('a');
                const url = window.URL.createObjectURL(blob);
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

                statusDiv.textContent = 'PDFのダウンロードが完了しました';
            } else {
                const result = await response.json();
                statusDiv.textContent = `エラー: ${result.error}`;
            }
        } catch (error) {
            statusDiv.textContent = `ネットワークエラー: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            clearButton.disabled = false;
            addMoreBtn.disabled = false;
        }
    });

    // ブラウザの再読み込み前・タブを閉じる際にサーバーのファイルをクリア
    window.addEventListener('beforeunload', () => {
        navigator.sendBeacon('/clear');
    });

    // --- ライトボックス機能（拡大表示＆スワイプ） ---
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lb-img');
    const lbCaption = document.getElementById('lb-caption');
    const lbClose = document.getElementById('lb-close');
    const lbPrev = document.getElementById('lb-prev');
    const lbNext = document.getElementById('lb-next');

    let currentLightboxItem = null;

    thumbList.addEventListener('click', (e) => {
        // ライトボックス表示処理
        if (e.target.tagName === 'IMG' && e.target.closest('.thumbnail-item')) {
            openLightbox(e.target.closest('.thumbnail-item'));
        }
        
        // 削除ボタンクリック処理（イベント委譲）
        const delBtn = e.target.closest('.delete-thumb-btn');
        if (delBtn) {
            e.stopPropagation();
            const item = delBtn.closest('.thumbnail-item');
            if (item) {
                pushState(); // 消す前の状態を保存
                item.style.transform = 'scale(0.8)';
                item.style.opacity = '0';
                setTimeout(() => {
                    item.remove();
                    updateView();
                }, 200);
            }
        }
    });

    function openLightbox(item) {
        currentLightboxItem = item;
        updateLightboxContent();
        lightbox.style.display = 'flex';
        document.addEventListener('keydown', handleLightboxKeydown);
    }

    function closeLightbox() {
        lightbox.style.display = 'none';
        currentLightboxItem = null;
        document.removeEventListener('keydown', handleLightboxKeydown);
    }

    function updateLightboxContent() {
        if (!currentLightboxItem) return;
        const img = currentLightboxItem.querySelector('img');
        lbImg.src = img.src;
        
        const filename = currentLightboxItem.querySelector('.thumb-filename').textContent;
        const pagenum = currentLightboxItem.querySelector('.thumb-page').textContent;
        lbCaption.textContent = `${filename} - ${pagenum}`;

        const prevItem = currentLightboxItem.previousElementSibling;
        const nextItem = currentLightboxItem.nextElementSibling;
        lbPrev.style.display = prevItem && prevItem.classList.contains('thumbnail-item') ? 'block' : 'none';
        lbNext.style.display = nextItem && nextItem.classList.contains('thumbnail-item') ? 'block' : 'none';
    }

    function navLightbox(direction) {
        if (!currentLightboxItem) return;
        const targetItem = direction === -1 
            ? currentLightboxItem.previousElementSibling 
            : currentLightboxItem.nextElementSibling;
        
        if (targetItem && targetItem.classList.contains('thumbnail-item')) {
            currentLightboxItem = targetItem;
            updateLightboxContent();
        }
    }

    lbClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    lbPrev.addEventListener('click', () => navLightbox(-1));
    lbNext.addEventListener('click', () => navLightbox(1));

    function handleLightboxKeydown(e) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') navLightbox(-1);
        else if (e.key === 'ArrowRight') navLightbox(1);
    }

    let touchStartX = 0;
    let touchEndX = 0;
    lightbox.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    lightbox.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
    function handleSwipe() {
        if (touchEndX < touchStartX - 50) navLightbox(1);
        if (touchEndX > touchStartX + 50) navLightbox(-1);
    }

    let isWheelThrottled = false;
    lightbox.addEventListener('wheel', (e) => {
        if (lightbox.style.display !== 'flex') return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
            e.preventDefault(); 
            if (isWheelThrottled) return;
            if (e.deltaX > 0) { navLightbox(1); } else { navLightbox(-1); }
            isWheelThrottled = true;
            setTimeout(() => { isWheelThrottled = false; }, 500);
        }
    }, { passive: false });

    // 初期化
    updateView();
});
