from flask import Flask, jsonify, request
from flask_cors import CORS
import yt_dlp
import os
import re
from urllib.parse import quote

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://*.githubpreview.dev",
            "http://localhost:*"
        ]
    }
})

def sanitize_filename(filename):
    # Remove illegal characters and clean up the filename
    clean = re.sub(r'[\\/*?:"<>|]', "", filename)
    return clean.encode('utf-8', 'ignore').decode('utf-8').strip()

def rfc5987_encode(filename):
    """RFC5987-compliant encoding for Content-Disposition headers"""
    return quote(filename, safe="!#$&+-.^_`|~", encoding='utf-8')

@app.route('/api/info', methods=['POST'])
def get_video_info():
    url = request.json.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'ffmpeg_location': '/usr/bin/ffmpeg',
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            formats = []
            best_audio = None
            
            for f in info['formats']:
                if f.get('vcodec') != 'none':
                    formats.append({
                        'format_id': f['format_id'],
                        'height': f.get('height', 0),
                        'ext': f['ext'],
                        'vcodec': f['vcodec'],
                        'acodec': f['acodec'],
                        'filesize': f.get('filesize', 0)
                    })
                elif f.get('acodec') != 'none' and not best_audio:
                    best_audio = f['format_id']

            return jsonify({
                'title': info.get('title', ''),
                'thumbnail': info.get('thumbnail', ''),
                'formats': formats,
                'best_audio': best_audio
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download_video():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id')
    quality = data.get('quality')

    if not url or not format_id:
        return jsonify({'error': 'Missing parameters'}), 400

    ydl_opts = {
        'format': format_id,
        'outtmpl': '%(title)s.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'ffmpeg_location': '/usr/bin/ffmpeg',
        'postprocessors': []
    }

    try:
        if 'mp3' in quality.lower():
            ydl_opts['postprocessors'].append({
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192'
            })
        else:
            ydl_opts['postprocessors'].append({
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4'
            })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            raw_filename = ydl.prepare_filename(info)
            clean_filename = sanitize_filename(raw_filename)
            
            if 'mp3' in quality.lower():
                clean_filename = clean_filename.replace('.webm', '.mp3').replace('.mp4', '.mp3')

            encoded_filename = rfc5987_encode(clean_filename)

            def generate():
                filepath = None
                try:
                    with ydl:
                        ydl.process_info(info)
                        filepath = ydl.prepare_filename(info)
                        if 'mp3' in quality.lower():
                            filepath = filepath.replace('.webm', '.mp3').replace('.mp4', '.mp3')
                        with open(filepath, 'rb') as f:
                            yield from f
                finally:
                    if filepath and os.path.exists(filepath):
                        os.remove(filepath)

            return app.response_class(
                generate(),
                headers={
                    'Content-Disposition': f'attachment; filename="{encoded_filename}"; filename*=UTF-8\'\'{encoded_filename}',
                    'Content-Type': 'audio/mpeg' if 'mp3' in quality.lower() else 'video/mp4'
                }
            )
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, ssl_context='adhoc')