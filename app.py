import sys
import os
import fitz
from flask import Flask, render_template, request, jsonify, g, send_file
import time
from pypdf import PdfReader, PdfWriter
import io
import atexit

app = Flask(__name__)

THUMBNAIL_DIR = os.path.join('static', 'thumbnails')

UPLOAD_DIR = os.path.join('static', 'uploads')

REORDERED_DIR = os.path.join('static', 'reordered')

app.config['THUMBNAIL_DIR'] = THUMBNAIL_DIR
app.config['UPLOAD_DIR'] = UPLOAD_DIR
# reorderはもういらない
app.config['REORDERED_DIR'] = REORDERED_DIR

# フォルダがなければ作成
os.makedirs(THUMBNAIL_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REORDERED_DIR, exist_ok=True)

# --- 1. メインページを表示するルート ---
@app.route('/')
def index():
    """
    ブラウザが http://127.0.0.1:5000/ にアクセスした時
    templates/index.html を読み込んで表示する
    """
    return render_template('index.html')

# --- 2. PDFアップロードとサムネイル生成のルート ---
@app.route('/upload', methods=['POST'])
def upload_pdf():
    """
    ブラウザからPDFファイルがPOST送信された時の処理
    """
    # if 'pdf_file' not in request.files:
    #     return jsonify({'error': 'ファイルがありません'}), 400
    
    # file = request.files['pdf_file']
    # if file.filename == '':
    #     return jsonify({'error': 'ファイルが選択されていません'}), 400
    files = request.files.getlist('pdf_files')

    all_thumbnails = []

    try:
        base_timestamp = int(time.time() * 1000)  # ミリ秒単位のタイムスタンプ
        file_index = 0
    
        for file in files:
            if file.filename == '':
                continue

            if file and file.filename.endswith('.pdf'):
                # 安全なファイル名で一時保存（各ファイルに固有のタイムスタンプを付与）
                timestamp = str(base_timestamp + file_index)
                file_index += 1
                original_filename = file.filename
                pdf_filename = f"{timestamp}_{original_filename}"
                pdf_path = os.path.join(app.config['UPLOAD_DIR'], pdf_filename)
                file.save(pdf_path)

                # PyMuPDFでPDFを開き、サムネイルを生成
                doc = fitz.open(pdf_path)

                for i in range(len(doc)):
                    page = doc.load_page(i)
                    pix = page.get_pixmap(dpi=96) # Web表示用にDPIを調整

                    # サムネイル画像のファイル名を決定
                    thumb_filename = f"{timestamp}_page_{i}.png"
                    thumb_path_static = os.path.join(app.config['THUMBNAIL_DIR'], thumb_filename)

                    # サムネイル保存
                    pix.save(thumb_path_static)

                    #ブラウザが参照できるパスをリストに追加
                    # os.path.join は \ を使うことがあるため、URLは / で結合
                    all_thumbnails.append({
                        'path': f'static/thumbnails/{thumb_filename}',
                        'original_index': i,
                        'source_file': pdf_filename
                    })

                doc.close()

        # ブラウザに「成功」と「画像パスのリスト」と「元のPDF名」を返す
        return jsonify({
            'message': '成功',
            'thumbnails': all_thumbnails
        })
    
    except Exception as e:
        print(f"エラー: {e}") # ★ デバッグ用にエラーログ
        return jsonify({'error': 'PDF処理中にエラーが発生しました'}), 500

    return jsonify({'error':'PDFファイルのみ対応しています'}), 400

# --- 3. PDF並び替えのルート ---
@app.route('/reorder', methods=['POST'])
def reorder_pdf():
    data = request.json
    order_list = data.get('order')

    if not order_list:
        return jsonify({'error': '必要なデータがありません'}), 400

    try:

        # メモリ上のファイルオブジェクトを作成
        output_stream = io.BytesIO()
        writer = PdfWriter()

        opened_files = {}
        used_filenames = set()

        try:
            for item in order_list:
                filename = item.get('filename')
                page_index = item.get('page_index')

                if not filename or page_index is None:
                    continue

                used_filenames.add(filename)

                #まだ開いていないファイルから開く
                if filename not in opened_files:
                    file_path = os.path.join(app.config['UPLOAD_DIR'], filename)
                    if not os.path.exists(file_path):
                        print(f"ファイルが見つかりません: {file_path}")
                        continue
                    # ファイルオブジェクトを辞書に保存
                    opened_files[filename] = open(file_path, "rb")

                reader = PdfReader(opened_files[filename])

                writer.add_page(reader.pages[page_index])

            writer.write(output_stream)
            output_stream.seek(0)

        finally:
            # 最後に開いたファイルを全て閉じる
            for f in opened_files.values():
                f.close()

        # お掃除処理
        for filename in used_filenames:
            pdf_path = os.path.join(app.config['UPLOAD_DIR'], filename)
            if os.path.exists(pdf_path):
                try:
                    os.remove(pdf_path)
                except Exception as e:
                    print(f"ファイル削除エラー: {e}")
            timestamp = filename.split('_')[0]
            try:
                for f in os.listdir(app.config['THUMBNAIL_DIR']):
                    #ファイル名が一致するサムネイルを探して削除
                    if f.startswith(timestamp + "_page_"):
                        thumb_path = os.path.join(app.config['THUMBNAIL_DIR'], f)
                        try:
                            os.remove(thumb_path)
                        except OSError:
                            pass
            except Exception as e:
                print(f"削除エラー(Thumb): {e}")
        
            # ★ 成功したら、ファイルをブラウザにダウンロードさせる
            
        return send_file(
            output_stream,
            as_attachment=True,
            download_name=f"merged_reordered.pdf", # "並び替え済み_" を "reordered_" に変更
            mimetype='application/pdf'
        )
    
    except Exception as e:
        print(f"並べ替えエラー: {e}")
        return jsonify({'error': 'PDFの並べ替え中にエラーが発生しました'}), 500

# --- フォルダのクリーンアップ処理（アプリ終了時・リロード時） ---
def clean_all_directories():
    directories = [app.config['UPLOAD_DIR'], app.config['THUMBNAIL_DIR'], app.config['REORDERED_DIR']]
    for directory in directories:
        if os.path.exists(directory):
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass

# アプリ終了時にフォルダを掃除するフックを登録
atexit.register(clean_all_directories)

# --- 4. ファイル全体のクリアのルート ---
@app.route('/clear', methods=['POST'])
def clear_all():
    try:
        clean_all_directories()
        return jsonify({'message': 'クリアしました'})
    except Exception as e:
        print(f"クリアエラー: {e}")
        return jsonify({'error': 'ファイルの削除中にエラーが発生しました'}), 500

if __name__ == '__main__':
    app.run(debug=True)