# ==== Backend Build Stage ====
FROM openjdk:22-jdk-slim AS backend-build

WORKDIR /app
COPY *.jar app.jar
COPY sqlitedb/probsol.db probsol.db

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1 \
    libsdl2-dev \
    git \
    build-essential \
    libgomp1 \
    cmake \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/ggerganov/whisper.cpp.git
WORKDIR /app/whisper.cpp
RUN sh ./models/download-ggml-model.sh base.en
RUN cmake -B build -DWHISPER_SDL2=ON
RUN cmake --build build --config Release


# Expose necessary ports
EXPOSE 8081
EXPOSE 8082
EXPOSE 8000

WORKDIR /app

CMD bash -c "./whisper.cpp/build/bin/whisper-server -m ./whisper.cpp/models/ggml-base.en.bin --processors 2 --port 8082 --host 0.0.0.0 -l en & java -Ddb.file.path=./probsol.db -jar ./app.jar"