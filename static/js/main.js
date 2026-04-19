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

        if (sortable) sortable.destroy();
        reinitSortable();
    });

    function reinitSortable() {
        sortable = new Sortable(thumbList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onStart: function () {
                dragTempState = thumbList.innerHTML;
            },
            onUpdate: function () {
                undoStack.push(dragTempState);
                updateUndoBtn();
            }
        });
    }

    function updateView() {
        if (thumbList.children.length > 0) {
            uploadSection.style.display = 'none';
            workspaceSection.style.display = 'block';
        } else {
            uploadSection.style.display = 'flex';
            workspaceSection.style.display = 'none';
        }
    }

    selectFileBtn.addEventListener('click', () => fileInput.click());
    addMoreBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) handleFileUpload(files);
    });

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
        if (files.length > 0) handleFileUpload(files);
    });

    async function handleFileUpload(files) {
        workspaceSection.style.display = 'block';
        uploadSection.style.display = 'none';
        statusDiv.textContent = 'Uploading...';
        saveButton.disabled = true;
        clearButton.disabled = true;
        addMoreBtn.disabled = true;

        if (sortable) { sortable.destroy(); sortable = null; }

        const formData = new FormData();
        files.forEach(file => formData.append('pdf_files', file));

        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (response.ok) {
                statusDiv.textContent = 'Files added. You can drag and drop to reorder.';
                displayThumbnails(result.thumbnails);
            } else {
                statusDiv.textContent = `Error: ${result.error}`;
            }
        } catch (error) {
            statusDiv.textContent = `Network Error: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            clearButton.disabled = false;
            addMoreBtn.disabled = false;
            fileInput.value = '';
            updateView();
        }
    }

    function displayThumbnails(thumbnails) {
        if (thumbnails.length > 0 && thumbList.children.length > 0) pushState();

        thumbnails.forEach((thumbInfo) => {
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            item.dataset.originalIndex = thumbInfo.original_index;
            item.dataset.sourceFile = thumbInfo.source_file;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-thumb-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remove this page';

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
            pageNumElem.textContent = `Page ${thumbInfo.original_index + 1}`;

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
        statusDiv.textContent = 'Clearing all files...';
        try {
            const response = await fetch('/clear', { method: 'POST' });
            if (response.ok) {
                thumbList.innerHTML = '';
                undoStack = [];
                updateUndoBtn();
                statusDiv.textContent = '';
                if (sortable) { sortable.destroy(); sortable = null; }
                updateView();
            }
        } catch (error) {}
    });

    saveButton.addEventListener('click', async () => {
        const items = thumbList.querySelectorAll('.thumbnail-item');
        const neworder = Array.from(items).map(item => ({
            filename: item.dataset.sourceFile,
            page_index: parseInt(item.dataset.originalIndex, 10)
        }));

        statusDiv.textContent = 'Merging PDFs...';
        saveButton.disabled = true;
        try {
            const response = await fetch('/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: neworder })
            });

            if (response.ok) {
                const blob = await response.blob();
                const a = document.createElement('a');
                const url = window.URL.createObjectURL(blob);
                a.href = url;
                a.download = 'reordered.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                statusDiv.textContent = 'Download complete';
            }
        } catch (error) {
            statusDiv.textContent = 'Error during save.';
        } finally {
            saveButton.disabled = false;
        }
    });

    // --- Lightbox Logic ---
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lb-img');
    const lbCaption = document.getElementById('lb-caption');
    const lbClose = document.getElementById('lb-close');
    const lbPrev = document.getElementById('lb-prev');
    const lbNext = document.getElementById('lb-next');
    let currentLightboxItem = null;

    thumbList.addEventListener('click', (e) => {
        const thumbItem = e.target.closest('.thumbnail-item');
        if (e.target.tagName === 'IMG' && thumbItem) openLightbox(thumbItem);

        const delBtn = e.target.closest('.delete-thumb-btn');
        if (delBtn) {
            e.stopPropagation();
            pushState();
            const item = delBtn.closest('.thumbnail-item');
            item.remove();
            updateView();
        }
    });

    function openLightbox(item) {
        currentLightboxItem = item;
        updateLightboxContent();
        lightbox.style.display = 'flex';
        document.body.classList.add('no-scroll');
        document.addEventListener('keydown', handleLightboxKeydown);
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.style.display = 'none';
        document.body.classList.remove('no-scroll');
        currentLightboxItem = null;
        document.removeEventListener('keydown', handleLightboxKeydown);
    }

    function updateLightboxContent() {
        if (!currentLightboxItem) return;
        lbImg.src = currentLightboxItem.querySelector('img').src;
        lbCaption.textContent = `${currentLightboxItem.querySelector('.thumb-filename').textContent} - ${currentLightboxItem.querySelector('.thumb-page').textContent}`;
        lbPrev.style.display = currentLightboxItem.previousElementSibling ? 'block' : 'none';
        lbNext.style.display = currentLightboxItem.nextElementSibling ? 'block' : 'none';
    }

    function navLightbox(dir) {
        const target = dir === -1 ? currentLightboxItem.previousElementSibling : currentLightboxItem.nextElementSibling;
        if (target && target.classList.contains('thumbnail-item')) {
            currentLightboxItem = target;
            updateLightboxContent();
        }
    }

    lbClose.onclick = closeLightbox;
    lbPrev.onclick = () => navLightbox(-1);
    lbNext.onclick = () => navLightbox(1);
    lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };

    function handleLightboxKeydown(e) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') navLightbox(-1);
        else if (e.key === 'ArrowRight') navLightbox(1);
    }

    updateView();
});
