# PDF Editor - Vintage Glassmorphism Edition

PDFファイルのページを直感的に並び替え、結合、削除ができるモダンで美しいWebツールです。ヴィンテージ・アナログな世界観と、現代的なグラスモーフィズム（Glassmorphism）を融合させたデザインが特徴です。

![Main View Mockup](https://raw.githubusercontent.com/username/repository/main/static/css/preview_mockup.png)
*(※デプロイ後にスクリーンショットを追加することをお勧めします)*

## 特徴

### 1. 洗練されたUI/UX
- **Vintage & Modern Design**: チャコールネイビーとセピアゴールドを基調とした、落ち着きのあるアナログ風デザイン。
- **Glassmorphism**: 半透明のぼかし（backdrop-filter）を多用した、奥行きのある美しいインターフェース。
- **Custom Typography**: Google Fonts から温かみのある手書き風フォント「Caveat」を採用。

### 2. 直感的な操作
- **シームレスな並び替え**: SortableJSによるスムーズなドラッグ&ドロップ操作。
- **不動のセンター拡大表示**: サムネイルクリックで、どの位置からでも画面中央にPDFページを拡大表示（Lightbox方式）。
- **Undo機能**: 操作を間違えても1ステップずつ元に戻せます。

### 3. 安心のセキュリティとプライバシー
- **セッション分離 (Multi-user Ready)**: UUIDベースのセッション管理により、同時実行中であっても他人のPDFが混ざることはありません。
- **自動クリーンアップ**: ブラウザを閉じた際（Beacon API）や、サーバー起動から24時間が経過した古いデータは自動的に削除されます。
- **セグメント化された保存**: 全てのファイル操作はメモリ内（BytesIO）または一時的なUUIDフォルダ内で行われ、安全性が確保されています。

## セットアップと起動方法

### 1. 依存ライブラリのインストール
Python環境がセットアップされている状態で、以下のコマンドを実行します。

```bash
pip install -r requirements.txt
```

### 2. アプリの起動
macOS でのポート競合（AirPlay）を避けるため、デフォルトで **ポート 8080** を使用するように設定されています。

```bash
python app.py
```

起動後、ブラウザで **`http://localhost:8080`** にアクセスしてください。

## 使い方

1. **アップロード**: 初期画面にPDFをドロップするかボタンから選択。サムネイルが生成されます。
2. **編集**: 
   - ページをドラッグして順序を変更。
   - 「×」で不要なページを削除。
   - サムネイルをクリックして詳細（大きな画面）を確認。
3. **保存**: 「Save PDF」ボタンで、現在の順番に基づいた新しいPDFをダウンロード。
4. **リセット**: 「Clear All」ボタンで即座に現在のセッションデータを破棄します。

## 本番環境へのデプロイ (Render等)

Render.com などのプラットフォームで公開する場合、以下の環境変数を設定することを推奨します。

- `SECRET_KEY`: セッションの暗号化に使用する任意の長い文字列。
- `FLASK_DEBUG`: 本番環境では `False` に設定。

起動コマンド:
```bash
gunicorn app:app --bind 0.0.0.0:$PORT
```

## 技術スタック

- **Backend**: Python 3.x, Flask, PyMuPDF (fitz), pypdf, Gunicorn
- **Frontend**: Vanilla JavaScript (ES6+), SortableJS, CSS (Glassmorphism), Google Fonts
- **Assets**: Unsplash (Photography by Annie Spratt)
