import os
import fitz
import time
import io
import atexit
import uuid
import shutil
from flask import Flask, render_template, request, jsonify, send_file, session
from pypdf import PdfReader, PdfWriter
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', static_url_path='/static')

# --- Production Configurations ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-dev-key-change-this-in-prod')
app.config['DEBUG_MODE'] = os.environ.get('FLASK_DEBUG', 'True') == 'True'
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  
app.config['UPLOAD_EXTENSIONS'] = ['.pdf']

BASE_STATIC_DIR = 'static'
os.makedirs(BASE_STATIC_DIR, exist_ok=True)

def cleanup_old_folders():
    """Delete stale directories older than 24 hours."""
    now = time.time()
    for category in ['uploads', 'thumbnails']:
        base_path = os.path.join(BASE_STATIC_DIR, category)
        if not os.path.exists(base_path):
            continue
        for folder_name in os.listdir(base_path):
            folder_path = os.path.join(base_path, folder_name)
            if not os.path.isdir(folder_path):
                continue
            if now - os.path.getmtime(folder_path) > 86400:
                try:
                    shutil.rmtree(folder_path)
                except: pass

def get_user_id():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    return session['user_id']

def get_user_dirs():
    uid = get_user_id()
    dirs = {
        'upload': os.path.join(BASE_STATIC_DIR, 'uploads', uid),
        'thumbnail': os.path.join(BASE_STATIC_DIR, 'thumbnails', uid),
    }
    for path in dirs.values():
        os.makedirs(path, exist_ok=True)
    return dirs

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_pdf():
    if 'pdf_files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('pdf_files')
    user_paths = get_user_dirs()
    all_thumbnails = []
    
    try:
        base_timestamp = int(time.time() * 1000)
        
        for idx, file in enumerate(files):
            if file.filename == '':
                continue
            
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in app.config['UPLOAD_EXTENSIONS']:
                continue

            filename = secure_filename(file.filename)
            timestamp = str(base_timestamp + idx)
            unique_name = f"{timestamp}_{filename}"
            pdf_path = os.path.join(user_paths['upload'], unique_name)
            
            file.save(pdf_path)

            doc = fitz.open(pdf_path)
            for i in range(len(doc)):
                page = doc.load_page(i)
                pix = page.get_pixmap(dpi=72)
                
                thumb_filename = f"{timestamp}_page_{i}.png"
                thumb_path = os.path.join(user_paths['thumbnail'], thumb_filename)
                pix.save(thumb_path)

                uid = session['user_id']
                all_thumbnails.append({
                    'path': f'static/thumbnails/{uid}/{thumb_filename}',
                    'original_index': i,
                    'source_file': unique_name
                })
            doc.close()

        return jsonify({'message': 'Success', 'thumbnails': all_thumbnails})
    
    except Exception as e:
        app.logger.error(f"Upload error: {e}")
        return jsonify({'error': 'Failed to process PDF'}), 500

@app.route('/reorder', methods=['POST'])
def reorder_pdf():
    data = request.json
    order_list = data.get('order')
    user_paths = get_user_dirs()

    if not order_list:
        return jsonify({'error': 'Invalid order data'}), 400

    try:
        output_stream = io.BytesIO()
        writer = PdfWriter()
        opened_files = {}

        try:
            for item in order_list:
                filename = secure_filename(item.get('filename'))
                page_index = item.get('page_index')

                if not filename or page_index is None:
                    continue

                if filename not in opened_files:
                    file_path = os.path.join(user_paths['upload'], filename)
                    if not os.path.exists(file_path):
                        continue
                    opened_files[filename] = open(file_path, "rb")

                reader = PdfReader(opened_files[filename])
                writer.add_page(reader.pages[page_index])

            writer.write(output_stream)
            output_stream.seek(0)
        finally:
            for f in opened_files.values():
                f.close()

        return send_file(
            output_stream,
            as_attachment=True,
            download_name="reordered.pdf",
            mimetype='application/pdf'
        )
    except Exception as e:
        app.logger.error(f"Reorder error: {e}")
        return jsonify({'error': 'Failed to merge PDF'}), 500

@app.route('/clear', methods=['POST'])
def clear_all():
    user_paths = get_user_dirs()
    try:
        for path in user_paths.values():
            if os.path.exists(path):
                shutil.rmtree(path)
        return jsonify({'message': 'Session cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(403)
def forbidden(e):
    app.logger.error(f"403 error: {e}")
    return "403 Forbidden: Check folder permissions.", 403

if __name__ == '__main__':
    cleanup_old_folders()
    app.run(debug=app.config['DEBUG_MODE'], host='0.0.0.0', port=8080)