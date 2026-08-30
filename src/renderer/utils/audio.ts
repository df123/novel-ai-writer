/**
 * 麦克风录音与音频格式转换工具
 * MediaRecorder 采集的 webm/opus 统一转成 16kHz 单声道 PCM WAV,
 * 语音识别服务对 WAV 的支持最稳定
 */

export interface VoiceRecorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

function pickRecorderMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export function isRecordingSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';
}

/**
 * 开始录音,返回控制器;stop 结束并返回原始音频 Blob
 */
export async function startRecording(): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickRecorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(250);

  const releaseStream = () => {
    stream.getTracks().forEach(track => track.stop());
  };

  return {
    stop: () =>
      new Promise<Blob>(resolve => {
        recorder.onstop = () => {
          releaseStream();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop();
      releaseStream();
    },
  };
}

/**
 * 任意浏览器音频 Blob 转 16kHz 单声道 16bit PCM WAV
 */
export async function toWav16kMono(audioBlob: Blob): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  // 以目标采样率创建上下文,解码时浏览器自动重采样
  const audioContext = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = decoded.getChannelData(0);
    return encodeWavPcm16(channelData, 16000);
  } finally {
    await audioContext.close();
  }
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
