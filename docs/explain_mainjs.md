### [`main.js`]main.js ) の行レベル解説

このファイルは、PDF 並び替えツールのフロントエンド JavaScript で、DOM 読み込み後にイベントリスナーを設定し、ファイルアップロード、ドラッグ&ドロップ、サムネイル表示、並び替え、ダウンロードを処理します。各行を順に詳しく説明します。

```javascript
window.addEventListener('DOMContentLoaded', () => {
    // DOM が読み込まれた後に実行されるイベントリスナーを設定。
    
    //HTMLの要素取得
    const fileInput = document.getElementById('pdf-input');
    // PDF ファイル入力要素を取得。
    
    const dropZone = document.getElementById('drop-zone');
    // ドラッグ&ドロップゾーン要素を取得。
    
    const thumbList = document.getElementById('thumbnail-list');
    // サムネイルリスト要素を取得。
    
    const statusDiv = document.getElementById('status');
    // ステータス表示要素を取得。
    
    const saveButton = document.getElementById('save-button');
    // 保存ボタン要素を取得。
    
    //元のPDF名を保存する変数
    let originalPdfName = '';
    // 元の PDF ファイル名を保存する変数を初期化。
    
    let sortable = null; // Sortableのインスタンスを保持する変数
    // Sortable.js のインスタンスを保持する変数を初期化。
    
    //ファイルが選択された時の処理
    fileInput.addEventListener('change', (e) => {
        // ファイル入力の変更イベントリスナー。
        
        const file = e.target.files[0];
        // 選択された最初のファイルを取得。
        
        if (file) {
            handleFileUpload(file);
            // ファイルが存在する場合、アップロード処理を呼び出す。
        }
    });
    
    // --- ドラッグアンドドロップの処理 ---
    dropZone.addEventListener('dragover', (e) =>{
        // ドラッグオーバーイベントリスナー。
        
        e.preventDefault();
        // デフォルトの動作を防ぐ。
        
        dropZone.classList.add('dragover'); //CSSクラスを追加
        // ドラッグ中を示す CSS クラスを追加。
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        // ドラッグリーブイベントリスナー。
        
        e.preventDefault();
        // デフォルトの動作を防ぐ。
        
        dropZone.classList.remove('dragover'); //CSSクラスを削除
        // ドラッグ中を示す CSS クラスを削除。
    });
    
    dropZone.addEventListener('drop', (e) => {
        // ドロップイベントリスナー。
        
        e.preventDefault();
        // デフォルトの動作を防ぐ。
        
        dropZone.classList.remove('dragover'); //CSSクラスを削除
        // ドラッグ中を示す CSS クラスを削除。
        
        const file = e.dataTransfer.files[0];
        // ドロップされた最初のファイルを取得。
        
        if (file) {
            handleFileUpload(file);
            // ファイルが存在する場合、アップロード処理を呼び出す。
        }
    });
    // --- ドラッグアンドドロップここまで ---
    
    // ファイルアップロードとサムネイル表示のメイン関数
    async function handleFileUpload(file) {
        // 非同期関数でファイルアップロードを処理。
        
        statusDiv.textContent = 'アップロード中...';
        // ステータスをアップロード中に設定。
        
        thumbList.innerHTML = ''; //サムネイルリストをクリア
        // サムネイルリストをクリア。
        
        saveButton.style.display = 'none'; //保存ボタンを隠す
        // 保存ボタンを隠す。
        
        if (sortable) { // 既存のSortableインスタンスがあれば破棄
            sortable.destroy();
            sortable = null;
            // 既存の Sortable インスタンスを破棄。
        }
        
        const formData = new FormData();
        // FormData オブジェクトを作成。
        
        formData.append('pdf_file', file);
        // ファイルを FormData に追加。
        
        try {
            // ネットワークリクエストを試行。
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            // /upload エンドポイントに POST リクエスト。
            
            const result = await response.json();
            // レスポンスを JSON としてパース。
            
            if (response.ok) {
                // レスポンスが成功の場合。
                
                statusDiv.textContent = 'サムネイルの生成が完了しました。ドラッグで並び替えできます';
                // ステータスを成功に設定。
                
                originalPdfName = result.original_pdf; //PDF名を保存
                // 元の PDF 名を保存。
                
                displayThumbnails(result.thumbnails);
                // サムネイルを表示。
                
                saveButton.style.display = 'block'; //保存ボタンを表示
                // 保存ボタンを表示。
            } else {
                statusDiv.textContent = `エラー: ${result.error}`;
                // エラーステータスを表示。
            }
        } catch (error) {
            statusDiv.textContent = `ネットワークエラー: ${error.message}`;
            // ネットワークエラーを表示。
        }
    }
    
    //サムネイルを表示する関数
    function displayThumbnails(thumbnails) {
        // サムネイルを表示する関数。
        
        thumbnails.forEach((thumbInfo) => {
            // 各サムネイルに対してループ。
            
            const item = document.createElement('div');
            // サムネイルアイテムの div を作成。
            
            item.className = 'thumbnail-item';
            // CSS クラスを設定。
            
            // 要素に「元のページ番号(インデックス)」を保存
            item.dataset.originalIndex = thumbInfo.original_index;
            // データ属性に元のインデックスを保存。
            
            const img = document.createElement('img');
            // img 要素を作成。
            
            img.src = thumbInfo.path;
            // 画像ソースを設定。
            
            const text = document.createElement('p');
            // p 要素を作成。
            
            text.textContent = `ページ ${thumbInfo.original_index + 1}`;
            // ページ番号を表示。
            
            item.appendChild(img);
            // img をアイテムに追加。
            
            item.appendChild(text);
            // text をアイテムに追加。
            
            thumbList.appendChild(item);
            // アイテムをリストに追加。
        });
        // ここにSortableJSを適用
        sortable = new Sortable(thumbList, {
            animation: 150, //ドラッグのアニメーション
            ghostClass: 'sortable-ghost' // ドラッグ中の要素に適用するクラス
            // Sortable.js を適用し、ドラッグ&ドロップを有効化。
        });
    } // displayThumbnails 関数はここで正しく閉じる
    
    // saveButtonリスナー
    saveButton.addEventListener('click', async() => {
        // 保存ボタンのクリックイベントリスナー。
        
        if (!sortable) return;
        // Sortable が存在しない場合、処理をスキップ。
        
        // 現在のDOMの順序から、元のページインデックスの配列を作成
        const items = thumbList.querySelectorAll('.thumbnail-item');
        // サムネイルアイテムを取得。
        
        const neworder = Array.from(items).map(item => {
            return parseInt(item.dataset.originalIndex, 10);
            // 新しい順序のインデックス配列を作成。
        });
        
        statusDiv.textContent = 'PDFを並び替え中...';
        // ステータスを並び替え中に設定。
        
        try {
            // ネットワークリクエストを試行。
            
            const response = await fetch('/reorder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    original_pdf: originalPdfName,
                    order: neworder
                })
            });
            // /reorder エンドポイントに POST リクエスト。
            
            if (response.ok) {
                // レスポンスが成功の場合。
                
                // 成功した場合、レスポンスはPDFファイル本体 (Blob)
                const blob = await response.blob();
                // レスポンスを Blob として取得。
                
                const contentDisposition = response.headers.get('content-disposition');
                // Content-Disposition ヘッダーを取得。
                
                let filename = 'reordered.pdf'; // デフォルトのファイル名
                // デフォルトファイル名を設定。
                
                // ### ▼▼▼ 修正ブロック (問題2の対策) ▼▼▼ ###
                if (contentDisposition) {
                    // "filename*=" (RFC 5987) と "filename=" (legacy) の両方に対応する正規表現
                    const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/);
                    if (filenameMatch && filenameMatch[1]) {
                        // 取得したファイル名（エンコードされている可能性）をデコードする
                        filename = decodeURIComponent(filenameMatch[1]);
                        // ファイル名をデコード。
                    }
                }
                // ### ▲▲▲ 修正ブロック ▲▲▲ ###
                
                // ブラウザのダウンロード機能をトリガー
                const a = document.createElement('a');
                // a 要素を作成。
                
                const url = window.URL.createObjectURL(blob);
                // Blob の URL を作成。
                
                a.href = url;
                // a の href を設定。
                
                a.download = filename;
                // ダウンロード属性を設定。
                
                document.body.appendChild(a);
                // a を body に追加。
                
                a.click();
                // クリックをシミュレート。
                
                a.remove();
                // a を削除。
                
                window.URL.revokeObjectURL(url);
                // URL を解放。
                
                statusDiv.textContent = 'PDFをダウンロードしました';
                // ステータスをダウンロード完了に設定。
            } else {
                const result = await response.json();
                statusDiv.textContent = `エラー: ${result.error}`;
                // エラーステータスを表示。
            }
        } catch (error) {
            statusDiv.textContent = `ネットワークエラー: ${error.message}`;
            // ネットワークエラーを表示。
        }
    });

}); // DOMContentLoaded の閉じカッコ
// ★ 修正(1): ファイルの一番最後にあった不要な "}" を削除
```

このファイルにより、ユーザーは PDF をアップロードし、サムネイルをドラッグ&ドロップで並び替え、並び替えられた PDF をダウンロードできます。エラーハンドリングが充実しており、ユーザー体験を向上させています。