// script.js
async function processUrl() {
    const urlInput = document.getElementById('url');
    const loading = document.querySelector('.loading');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    const videoUrl = urlInput.value.trim();

    error.textContent = '';
    result.style.display = 'none';
    urlInput.classList.remove('error');
    
    if (!isValidYouTubeUrl(videoUrl)) {
        error.textContent = 'Please enter a valid YouTube URL';
        urlInput.classList.add('error');
        return;
    }

    loading.style.display = 'block';
    
    try {
        const response = await fetch(`https://redesigned-fiesta-pjwx9g7vpqx5c6g95-5000.app.github.dev/api/info`,{
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch video info');
        }

        const videoInfo = await response.json();
        
        document.getElementById('title').textContent = videoInfo.title;
        document.getElementById('thumbnail').src = videoInfo.thumbnail;
        
        const qualityOrder = ['4320p', '2160p', '1440p', '1080p', '720p', '480p', '360p'];
        const formatMap = new Map();

        videoInfo.formats.forEach(format => {
            if (format.height && format.ext === 'mp4') {
                const quality = `${format.height}p`;
                if (qualityOrder.includes(quality) && !formatMap.has(quality)) {
                    formatMap.set(quality, {
                        format_id: `${format.format_id}+${videoInfo.best_audio}`,
                        ext: 'mp4'
                    });
                }
            }
        });

        const downloadOptions = qualityOrder
            .filter(quality => formatMap.has(quality))
            .map(quality => ({
                quality,
                format: 'mp4',
                format_id: formatMap.get(quality).format_id
            }));

        downloadOptions.push({
            quality: 'MP3',
            format: 'mp3',
            format_id: videoInfo.best_audio
        });

        const optionsContainer = document.getElementById('downloadOptions');
        optionsContainer.innerHTML = downloadOptions.map(option => `
            <button class="download-btn" 
                onclick="downloadVideo('${videoUrl}', '${option.format_id}', '${option.quality}', '${option.format}')">
                ${option.quality} ${option.format.toUpperCase()}
            </button>
        `).join('');

        loading.style.display = 'none';
        result.style.display = 'block';
    } catch (err) {
        loading.style.display = 'none';
        error.textContent = 'Error: ' + err.message;
        urlInput.classList.add('error');
    }
}

async function downloadVideo(url, formatId, quality, format) {
    const errorElement = document.getElementById('error');
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Preparing...`;
        errorElement.textContent = '';
        
        const response = await fetch('https://redesigned-fiesta-pjwx9g7vpqx5c6g95-5000.app.github.dev/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, format_id: formatId, quality })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Download failed');
        }

        const blob = await response.blob();
        const filename = response.headers.get('Content-Disposition')
            ?.split('filename=')[1]
            ?.replace(/"/g, '') || `video_${quality}.${format}`;

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        errorElement.textContent = `Downloaded: ${filename}`;
        errorElement.style.color = '#4ecdc4';
    } catch (err) {
        errorElement.textContent = 'Error: ' + err.message;
        errorElement.style.color = '#ff6b6b';
    } finally {
        button.innerHTML = originalText;
    }
}

function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(url);
}