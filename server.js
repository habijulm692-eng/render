const express = require('express');
const cors = require('cors');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for InfinityFree domain, localhost, and any client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Accept', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Recommended & Curated Voices
const CURATED_VOICES = [
  { id: 'bn-BD-PradeepNeural', name: 'প্রদীপ (পুরুষ) - বাংলাদেশ', gender: 'Male', locale: 'bn-BD', isDefault: true },
  { id: 'bn-BD-NabanitaNeural', name: 'নবনীতা (নারী) - বাংলাদেশ', gender: 'Female', locale: 'bn-BD' },
  { id: 'bn-IN-BashkarNeural', name: 'ভাস্কর (পুরুষ) - ভারত', gender: 'Male', locale: 'bn-IN' },
  { id: 'bn-IN-TanishaaNeural', name: 'তানিশা (নারী) - ভারত', gender: 'Female', locale: 'bn-IN' },
  { id: 'en-US-JennyNeural', name: 'Jenny (Female) - English US', gender: 'Female', locale: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy (Male) - English US', gender: 'Male', locale: 'en-US' }
];

// Clean text for speech synthesis (strip markdown, code blocks, excessive symbols)
function cleanTextForSpeech(raw) {
  if (!raw) return '';
  let text = String(raw).normalize('NFC');

  // Strip code blocks and inline code
  text = text.replace(/```[\s\S]*?```/g, ' কোড ব্লক ');
  text = text.replace(/`([^`]+)`/g, '$1');

  // Strip markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Strip markdown headers, bold, italics, strikethrough, blockquotes
  text = text.replace(/^[#>\s*+-]+/gm, ' ');
  text = text.replace(/[*_~]+/g, '');

  // Strip bullet symbols and non-speech symbols
  text = text.replace(/[•●■▪\-_=+~`#@*&^%$<>|\\/{}[\]\(\)]+/g, ' ');

  // Fix Bengali vowel diacritics spacing
  text = text.replace(/\s+([\u09BE-\u09CC\u09D7\u0981-\u0983\u09CD])/gu, '$1');
  text = text.replace(/([\u09CD])\s+([\u0985-\u09B9\u09CE\u09DC-\u09DF])/gu, '$1$2');
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  // Collapse multiple whitespaces and newlines
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// Convert speed multiplier (e.g. 1.0, 1.25, 0.8) or percentage to Edge TTS rate string (+25%, -20%)
function formatRate(rateInput) {
  if (!rateInput) return '+0%';
  const str = String(rateInput).trim();
  if (str.endsWith('%')) {
    return str.startsWith('+') || str.startsWith('-') ? str : `+${str}`;
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    const percent = Math.round((num - 1.0) * 100);
    return percent >= 0 ? `+${percent}%` : `${percent}%`;
  }
  return '+0%';
}

// Split text into chunks smaller than maxChars without breaking sentences
function chunkText(text, maxChars = 1000) {
  if (text.length <= maxChars) return [text];

  const sentences = text.match(/[^।!?.\n]+[।!?.\n]+|[^।!?.\n]+$/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length <= maxChars) {
      current += sentence;
    } else {
      if (current.trim()) chunks.push(current.trim());
      if (sentence.length > maxChars) {
        // Fallback split by space if single sentence is exceptionally long
        const words = sentence.split(/\s+/);
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= maxChars) {
            sub += (sub ? ' ' : '') + w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
      } else {
        current = sentence;
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// Synthesize a single chunk of text to Buffer
async function synthesizeChunk(voiceName, text, rate, pitch) {
  return new Promise(async (resolve, reject) => {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const options = {};
      if (rate && rate !== '+0%') options.rate = rate;
      if (pitch && pitch !== '+0Hz') options.pitch = pitch;

      const { audioStream } = tts.toStream(text, options);
      const chunks = [];

      audioStream.on('data', chunk => chunks.push(chunk));
      audioStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', err => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Synthesize text with auto-chunking for long passages
async function synthesizeFullText(text, voiceName, rate, pitch) {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) throw new Error('টেক্সট খালি বা অকার্যকর');

  const voice = voiceName || 'bn-BD-PradeepNeural';
  const ttsRate = formatRate(rate);
  const ttsPitch = pitch || '+0Hz';

  const chunks = chunkText(cleaned, 1000);
  const audioBuffers = [];

  for (const chunk of chunks) {
    const buf = await synthesizeChunk(voice, chunk, ttsRate, ttsPitch);
    if (buf && buf.length > 0) {
      audioBuffers.push(buf);
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error('অডিও তৈরি করা সম্ভব হয়নি');
  }

  return Buffer.concat(audioBuffers);
}

// In-memory cache for fast repeated responses
const audioCache = new Map();
const MAX_CACHE_SIZE = 100;

function getCacheKey(text, voice, rate, pitch) {
  return `${voice}_${rate}_${pitch}_${text.slice(0, 150)}_${text.length}`;
}

// --- ROUTES ---

// Health & Info Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: '3D AI Book Library - Microsoft Edge Neural TTS API',
    version: '1.0.0',
    platform: 'Render.com',
    message: 'Edge TTS সার্ভিস সক্রিয় আছে!',
    endpoints: {
      health: '/health',
      voices: '/api/voices',
      tts_get: '/api/tts?text=...&voice=...&rate=...&pitch=...',
      tts_post: '/api/tts (POST { text, voice, rate, pitch })'
    },
    default_voice: 'bn-BD-PradeepNeural',
    curated_voices: CURATED_VOICES
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Voices List Endpoint
app.get('/api/voices', async (req, res) => {
  try {
    const tts = new MsEdgeTTS();
    const allVoices = await tts.getVoices();

    const bengali = allVoices.filter(v => (v.Locale || '').startsWith('bn'));
    const english = allVoices.filter(v => (v.Locale || '').startsWith('en-US'));

    res.json({
      status: 'ok',
      curated: CURATED_VOICES,
      bengali: bengali,
      english: english.slice(0, 8),
      total_available: allVoices.length
    });
  } catch (err) {
    res.json({
      status: 'ok',
      curated: CURATED_VOICES,
      fallback: true
    });
  }
});

// Common TTS Handler for GET & POST
async function handleTtsRequest(req, res) {
  const text = req.method === 'POST' ? req.body.text : req.query.text;
  const voice = (req.method === 'POST' ? req.body.voice : req.query.voice) || 'bn-BD-PradeepNeural';
  const rate = req.method === 'POST' ? req.body.rate : req.query.rate;
  const pitch = req.method === 'POST' ? req.body.pitch : req.query.pitch;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text parameter is required' });
  }

  const cacheKey = getCacheKey(text, voice, rate, pitch);
  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': cachedBuffer.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'HIT'
    });
    return res.send(cachedBuffer);
  }

  try {
    const audioBuffer = await synthesizeFullText(text, voice, rate, pitch);

    // Save to cache (limit size)
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'MISS'
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS Synthesis Error:', err);
    res.status(500).json({
      error: 'TTS synthesis failed',
      details: err.message
    });
  }
}

app.get('/api/tts', handleTtsRequest);
app.post('/api/tts', handleTtsRequest);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Microsoft Edge TTS Service running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🎙️ Voices list: http://localhost:${PORT}/api/voices`);
});
