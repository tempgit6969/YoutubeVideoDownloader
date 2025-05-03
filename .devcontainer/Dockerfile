FROM python:3.10

# Install ffmpeg and other dependencies
RUN apt update && \
    apt install -y ffmpeg && \
    pip install --no-cache-dir flask flask-cors yt-dlp

# Set working directory
WORKDIR /workspace

# Expose Flask port
EXPOSE 5000
